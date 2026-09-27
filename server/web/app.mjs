import { createServer } from 'node:http';
import { createAdminRoutes } from './admin.mjs';
import { appendCookie, createGoogleRoutes, googleAuthConfig } from './google.mjs';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGame,
  advanceGame,
  resumeGame,
  applyAction,
  validateGame,
} from '../../shared/game.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COOKIE_NAME = 'bozkurt_session';
const SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BODY_LIMIT = 16 * 1024;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
};

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function json(response, status, value, extraHeaders = {}) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  response.end(JSON.stringify(value));
}

function securityHeaders(response, analyticsOrigin) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${analyticsOrigin ? ` ${analyticsOrigin}` : ''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
  );
  response.setHeader('Cache-Control', 'no-store');
}

function publicAnalyticsConfig(analytics) {
  if (!analytics?.enabled) return { config: { enabled: false }, endpointOrigin: '' };
  let endpoint;
  try {
    endpoint = new URL(analytics.endpoint);
  } catch {
    throw new Error('analytics.endpoint must be a validated HTTPS /api/track URL.');
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== '/api/track' ||
    endpoint.search ||
    endpoint.hash ||
    analytics.endpoint !== `${endpoint.origin}/api/track`
  ) {
    throw new Error('analytics.endpoint must be a validated HTTPS /api/track URL.');
  }
  if (typeof analytics.site !== 'string' || !Array.isArray(analytics.allowedOrigins)) {
    throw new Error('analytics must come from analyticsConfig().');
  }
  return {
    config: {
      enabled: true,
      endpoint: analytics.endpoint,
      site: analytics.site,
      allowedOrigins: [...analytics.allowedOrigins],
    },
    endpointOrigin: endpoint.origin,
  };
}

function forwardedHeader(request, name) {
  const value = request.headers[name];
  return typeof value === 'string' ? value.split(',').at(-1).trim() : '';
}

function secureRequest(request, trustProxy) {
  return (
    Boolean(request.socket.encrypted) ||
    (trustProxy && forwardedHeader(request, 'x-forwarded-proto') === 'https')
  );
}

function checkMutation(request, trustProxy) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
    throw new HttpError(415, 'json_required');
  }
  if (request.headers['sec-fetch-site'] === 'cross-site')
    throw new HttpError(403, 'origin_rejected');
  const origin = request.headers.origin;
  if (!origin) return; // CLI clients do not send Origin. Browser cookie requests are checked above and below.
  try {
    const expected = requestOrigin(request, trustProxy);
    const supplied = new URL(origin);
    if (supplied.origin !== expected || supplied.href !== `${supplied.origin}/`)
      throw new Error('mismatch');
  } catch {
    throw new HttpError(403, 'origin_rejected');
  }
}

function requestOrigin(request, trustProxy) {
  const host = (trustProxy && forwardedHeader(request, 'x-forwarded-host')) || request.headers.host;
  try {
    return new URL(`${secureRequest(request, trustProxy) ? 'https' : 'http'}://${host}`).origin;
  } catch {
    throw new HttpError(403, 'origin_rejected');
  }
}

async function readJson(request) {
  const length = Number(request.headers['content-length']);
  if (Number.isFinite(length) && length > BODY_LIMIT) {
    request.resume();
    throw new HttpError(413, 'body_too_large');
  }
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    let tooLarge = false;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        if (!tooLarge) {
          tooLarge = true;
          chunks.length = 0;
          reject(new HttpError(413, 'body_too_large'));
        }
        return; // Keep draining the request so the response can still deliver the error.
      }
      chunks.push(chunk);
    });
    request.on('error', () => reject(new HttpError(400, 'invalid_request')));
    request.on('end', () => {
      if (tooLarge) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body))
          throw new Error('object required');
        resolveBody(body);
      } catch {
        reject(new HttpError(400, 'invalid_json'));
      }
    });
  });
}

function sessionHash(request) {
  const cookie = request.headers.cookie || '';
  const token = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash('sha256').update(token).digest('hex');
}

function isWithin(root, candidate) {
  const path = relative(root, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function staticResponse(request, response, pathname, staticDir) {
  if (!['GET', 'HEAD'].includes(request.method))
    return json(response, 405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD' });
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'invalid_path');
  }
  if (
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    decoded.split('/').some((part) => part.startsWith('.'))
  ) {
    throw new HttpError(404, 'not_found');
  }
  let root;
  try {
    root = realpathSync(staticDir);
  } catch {
    throw new HttpError(503, 'frontend_unavailable');
  }
  let candidate = resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (!isWithin(root, candidate)) throw new HttpError(404, 'not_found');
  try {
    candidate = realpathSync(candidate);
    if (!isWithin(root, candidate) || !statSync(candidate).isFile())
      throw new HttpError(404, 'not_found');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (extname(decoded) || !(request.headers.accept || '').includes('text/html'))
      throw new HttpError(404, 'not_found');
    try {
      candidate = realpathSync(resolve(root, 'index.html'));
    } catch {
      throw new HttpError(503, 'frontend_unavailable');
    }
    if (!isWithin(root, candidate)) throw new HttpError(404, 'not_found');
  }
  const mime = MIME_TYPES[extname(candidate).toLowerCase()];
  if (!mime) throw new HttpError(404, 'not_found');
  const data = await readFile(candidate);
  response.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': data.length,
    'Cache-Control': extname(candidate) === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  response.end(request.method === 'HEAD' ? undefined : data);
}

/** One application instance owns one SQLite connection. Run one replica per persistent volume. */
export function createApp({
  dbPath = resolve(PROJECT_ROOT, 'data/game.sqlite'),
  staticDir = resolve(PROJECT_ROOT, 'dist'),
  clock = Date.now,
  trustProxy = false,
  rateLimit = 180,
  analytics = { enabled: false },
  adminEmail = process.env.ADMIN_EMAIL,
  adminPassword = process.env.ADMIN_PASSWORD,
  googleClientId = process.env.GOOGLE_CLIENT_ID,
  googleClientSecret = process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUris = process.env.GOOGLE_REDIRECT_URIS,
  googleFetch = globalThis.fetch,
} = {}) {
  const { config: publicAnalytics, endpointOrigin: analyticsOrigin } =
    publicAnalyticsConfig(analytics);
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);
  `);
  if (
    !database
      .prepare('PRAGMA table_info(sessions)')
      .all()
      .some((column) => column.name === 'account_sub')
  )
    database.exec('ALTER TABLE sessions ADD COLUMN account_sub TEXT');
  database.exec(`
    CREATE TABLE IF NOT EXISTS google_accounts (
      sub TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      state_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_sub);
  `);
  const statements = {
    health: database.prepare('SELECT 1 AS ready'),
    get: database.prepare(
      'SELECT state_json, revision, expires_at, account_sub FROM sessions WHERE token_hash = ?',
    ),
    insert: database.prepare(
      'INSERT INTO sessions (token_hash, state_json, revision, created_at, updated_at, expires_at) VALUES (?, ?, 0, ?, ?, ?)',
    ),
    update: database.prepare(
      'UPDATE sessions SET state_json = ?, revision = ?, updated_at = ? WHERE token_hash = ?',
    ),
    cleanup: database.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    insertAccountSession: database.prepare(
      'INSERT INTO sessions (token_hash, state_json, revision, created_at, updated_at, expires_at, account_sub) VALUES (?, ?, 0, ?, ?, ?, ?)',
    ),
    bindAccount: database.prepare(
      'UPDATE sessions SET token_hash = ?, account_sub = ?, updated_at = ?, expires_at = ? WHERE token_hash = ?',
    ),
    touchAccountSession: database.prepare(
      'UPDATE sessions SET updated_at = ? WHERE token_hash = ?',
    ),
    removeSession: database.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    accountGet: database.prepare(
      'SELECT sub, email, display_name, state_json, revision FROM google_accounts WHERE sub = ?',
    ),
    accountInsert: database.prepare(
      'INSERT INTO google_accounts (sub, email, display_name, state_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
    ),
    accountProfile: database.prepare(
      'UPDATE google_accounts SET email = ?, display_name = ?, updated_at = ? WHERE sub = ?',
    ),
    accountSave: database.prepare(
      'UPDATE google_accounts SET state_json = ?, revision = ?, updated_at = ? WHERE sub = ? AND revision = ?',
    ),
  };
  const adminRoutes = createAdminRoutes(database, {
    email: adminEmail,
    password: adminPassword,
    trustProxy,
    checkMutation,
    readJson,
    json,
    HttpError,
  });
  const limits = new Map();
  let lastCleanup = 0;
  let closed = false;

  function allowRequest(request, now) {
    if (!rateLimit) return;
    const identity =
      (trustProxy && forwardedHeader(request, 'x-forwarded-for')) ||
      request.socket.remoteAddress ||
      'unknown';
    const minute = Math.floor(now / 60_000);
    const previous = limits.get(identity);
    if (previous?.minute === minute) {
      if (++previous.count > rateLimit) throw new HttpError(429, 'rate_limited');
    } else {
      if (limits.size >= 10_000) {
        for (const [key, bucket] of limits) if (bucket.minute !== minute) limits.delete(key);
        if (limits.size >= 10_000) throw new HttpError(429, 'rate_limited');
      }
      limits.set(identity, { minute, count: 1 });
    }
  }

  function loadSession(request, now) {
    const hash = sessionHash(request);
    const row = hash ? statements.get.get(hash) : null;
    if (!row || row.expires_at <= now) return null;
    const account = row.account_sub ? statements.accountGet.get(row.account_sub) : null;
    if (row.account_sub && !account) throw new Error('Orphaned Google game session');
    const serialized = account ? account.state_json : row.state_json;
    const state = JSON.parse(serialized);
    if (!validateGame(state)) throw new Error('Invalid persisted game');
    return {
      hash,
      state,
      revision: account ? account.revision : row.revision,
      serialized,
      accountSub: row.account_sub,
      account,
    };
  }

  function persist(session, now, force = false) {
    if (!validateGame(session.state)) throw new Error('Invalid game transition');
    const serialized = JSON.stringify(session.state);
    if (force || serialized !== session.serialized) {
      const previousRevision = session.revision;
      session.revision++;
      if (session.accountSub) {
        const result = statements.accountSave.run(
          serialized,
          session.revision,
          now,
          session.accountSub,
          previousRevision,
        );
        if (result.changes !== 1) throw new HttpError(409, 'stale_revision');
        statements.touchAccountSession.run(now, session.hash);
      } else {
        statements.update.run(serialized, session.revision, now, session.hash);
      }
      session.serialized = serialized;
    }
    return { state: session.state, revision: session.revision };
  }

  const googleConfig = googleAuthConfig({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectUris: googleRedirectUris,
  });
  const googleRoutes = createGoogleRoutes(database, {
    config: googleConfig,
    fetchImpl: googleFetch,
    HttpError,
    json,
    checkMutation,
    readJson,
    trustProxy,
    requestOrigin,
    secureRequest,
    sessionHash,
    getSession: loadSession,
    publicUser: (session) =>
      session?.account
        ? { name: session.account.display_name, email: session.account.email }
        : null,
    completeLogin(request, response, identity, now) {
      const current = loadSession(request, now);
      if (current?.accountSub && current.accountSub !== identity.sub)
        throw new HttpError(409, 'google_account_conflict');
      const existing = statements.accountGet.get(identity.sub);
      const state = current?.state ?? createGame(now);
      if (!validateGame(state)) throw new Error('Invalid game to link');
      if (!existing && current && !current.accountSub) resumeGame(state, now);
      const token = randomBytes(32).toString('base64url');
      const hash = createHash('sha256').update(token).digest('hex');
      database.exec('BEGIN IMMEDIATE');
      try {
        if (existing) {
          statements.accountProfile.run(identity.email, identity.name, now, identity.sub);
        } else {
          statements.accountInsert.run(
            identity.sub,
            identity.email,
            identity.name,
            JSON.stringify(state),
            now,
            now,
          );
        }
        if (current) {
          statements.bindAccount.run(hash, identity.sub, now, now + SESSION_AGE_MS, current.hash);
        } else {
          statements.insertAccountSession.run(
            hash,
            existing ? existing.state_json : JSON.stringify(state),
            now,
            now,
            now + SESSION_AGE_MS,
            identity.sub,
          );
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      appendCookie(
        response,
        `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE_MS / 1000}${secureRequest(request, trustProxy) ? '; Secure' : ''}`,
      );
    },
    logout(request, response, session) {
      statements.removeSession.run(session.hash);
      appendCookie(
        response,
        `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureRequest(request, trustProxy) ? '; Secure' : ''}`,
      );
    },
  });

  const server = createServer(async (request, response) => {
    securityHeaders(response, analyticsOrigin);
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/api/health' && request.method === 'GET') {
        if (closed || statements.health.get().ready !== 1) throw new HttpError(503, 'unavailable');
        return json(response, 200, { status: 'ok' });
      }
      if (!pathname.startsWith('/api/'))
        return await staticResponse(request, response, pathname, staticDir);
      const now = Math.floor(clock());
      allowRequest(request, now);
      if (await adminRoutes.handle(request, response, pathname, now)) return;
      if (await googleRoutes.handle(request, response, pathname, now)) return;
      if (pathname === '/api/config' && request.method === 'GET') {
        return json(response, 200, { analytics: publicAnalytics }, { 'Cache-Control': 'no-store' });
      }
      if (pathname === '/api/session' && request.method === 'POST') {
        checkMutation(request, trustProxy);
        const body = await readJson(request);
        if (Object.keys(body).length) throw new HttpError(400, 'unexpected_fields');
        let session = loadSession(request, now);
        if (session) {
          resumeGame(session.state, now);
        } else {
          if (now - lastCleanup >= 60_000) {
            statements.cleanup.run(now);
            lastCleanup = now;
          }
          const token = randomBytes(32).toString('base64url');
          const hash = createHash('sha256').update(token).digest('hex');
          const state = createGame(now);
          if (!validateGame(state)) throw new Error('Invalid initial game');
          const serialized = JSON.stringify(state);
          statements.insert.run(hash, serialized, now, now, now + SESSION_AGE_MS);
          session = { hash, state, serialized, revision: 0 };
          response.setHeader(
            'Set-Cookie',
            `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE_MS / 1000}${secureRequest(request, trustProxy) ? '; Secure' : ''}`,
          );
        }
        return json(response, 200, { ...persist(session, now), mode: 'online' });
      }
      if (pathname === '/api/state' && request.method === 'GET') {
        const session = loadSession(request, now);
        if (!session) throw new HttpError(401, 'session_required');
        advanceGame(session.state, now);
        return json(response, 200, persist(session, now));
      }
      if (pathname === '/api/action' && request.method === 'POST') {
        checkMutation(request, trustProxy);
        const body = await readJson(request);
        if (Object.keys(body).some((key) => !['action', 'revision'].includes(key)))
          throw new HttpError(400, 'unexpected_fields');
        if (
          !Number.isSafeInteger(body.revision) ||
          body.revision < 0 ||
          !body.action ||
          typeof body.action !== 'object' ||
          Array.isArray(body.action)
        ) {
          throw new HttpError(400, 'invalid_action_request');
        }
        const session = loadSession(request, now);
        if (!session) throw new HttpError(401, 'session_required');
        if (body.revision !== session.revision) {
          advanceGame(session.state, now);
          return json(response, 409, { error: 'stale_revision', ...persist(session, now) });
        }
        try {
          advanceGame(session.state, now);
          applyAction(session.state, body.action, now);
        } catch (error) {
          const code = error.code || error.message;
          throw new HttpError(
            400,
            /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(code) ? code : 'invalid_action',
          );
        }
        return json(response, 200, persist(session, now, true));
      }
      if (
        ['/api/session', '/api/state', '/api/action', '/api/health', '/api/config'].includes(
          pathname,
        )
      ) {
        return json(
          response,
          405,
          { error: 'method_not_allowed' },
          {
            Allow: ['/api/state', '/api/health', '/api/config'].includes(pathname) ? 'GET' : 'POST',
          },
        );
      }
      throw new HttpError(404, 'not_found');
    } catch (error) {
      if (error.status === 429) response.setHeader('Retry-After', '60');
      json(response, error instanceof HttpError ? error.status : 500, {
        error: error instanceof HttpError ? error.code : 'internal_error',
      });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 64;

  return {
    server,
    async listen(port = 0, host = '127.0.0.1') {
      await new Promise((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolveListen();
        });
      });
      return server.address();
    },
    async close() {
      if (closed) return;
      closed = true;
      if (server.listening)
        await new Promise((resolveClose, reject) =>
          server.close((error) => (error ? reject(error) : resolveClose())),
        );
      database.close();
    },
  };
}
