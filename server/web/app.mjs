import { createServer } from 'node:http';
import { createAdminRoutes } from './admin.mjs';
import { appendCookie, createGoogleRoutes, googleAuthConfig } from './google.mjs';
import {
  createPlayerRoutes,
  createPlayerCredentials,
  normalizedEmail,
  boundedPassword,
} from './player-auth.mjs';
import { createAuditStore } from './audit.mjs';
import { createMailService, mailConfig } from './mail.mjs';
import { createVerificationStore } from './verification.mjs';
import { createRecoveryStore } from './recovery.mjs';
import { createProfileStore } from './profile.mjs';
import { createSocialStore } from './social.mjs';
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
  migrateGame,
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
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; font-src 'self'; connect-src 'self'${analyticsOrigin ? ` ${analyticsOrigin}` : ''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
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

async function readJson(request, limit = BODY_LIMIT) {
  const length = Number(request.headers['content-length']);
  if (Number.isFinite(length) && length > limit) {
    request.resume();
    throw new HttpError(413, 'body_too_large');
  }
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    let tooLarge = false;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
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
  mailProvider = process.env.MAIL_PROVIDER,
  mailFrom = process.env.MAIL_FROM,
  smtpHost = process.env.SMTP_HOST,
  smtpPort = process.env.SMTP_PORT,
  smtpSecure = process.env.SMTP_SECURE,
  smtpUser = process.env.SMTP_USER,
  smtpPassword = process.env.SMTP_PASSWORD,
  publicUrl = process.env.PUBLIC_URL,
  mailSender,
} = {}) {
  const { config: publicAnalytics, endpointOrigin: analyticsOrigin } =
    publicAnalyticsConfig(analytics);
  const mail = createMailService(
    mailConfig({
      provider: mailProvider,
      from: mailFrom,
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      password: smtpPassword,
      publicUrl,
    }),
    mailSender,
  );
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
  if (
    !database
      .prepare('PRAGMA table_info(sessions)')
      .all()
      .some((column) => column.name === 'account_provider')
  )
    database.exec(
      "ALTER TABLE sessions ADD COLUMN account_provider TEXT NOT NULL DEFAULT 'google'",
    );
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
    CREATE TABLE IF NOT EXISTS email_accounts (
      sub TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      state_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  if (
    !database
      .prepare('PRAGMA table_info(email_accounts)')
      .all()
      .some((column) => column.name === 'google_sub')
  )
    database.exec('ALTER TABLE email_accounts ADD COLUMN google_sub TEXT');
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_google ON email_accounts(google_sub) WHERE google_sub IS NOT NULL',
  );
  if (
    !database
      .prepare('PRAGMA table_info(email_accounts)')
      .all()
      .some((column) => column.name === 'email_verified')
  )
    database.exec(
      'ALTER TABLE email_accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0',
    );
  database.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      email_sub TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      window_start INTEGER NOT NULL,
      window_count INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS email_verifications_expiry ON email_verifications(expires_at);
  `);
  for (const table of ['email_accounts', 'google_accounts']) {
    if (
      !database
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((column) => column.name === 'last_login_at')
    )
      database.exec(`ALTER TABLE ${table} ADD COLUMN last_login_at INTEGER`);
  }
  const statements = {
    health: database.prepare('SELECT 1 AS ready'),
    get: database.prepare(
      'SELECT state_json, revision, expires_at, account_sub, account_provider FROM sessions WHERE token_hash = ?',
    ),
    update: database.prepare(
      'UPDATE sessions SET state_json = ?, revision = ?, updated_at = ? WHERE token_hash = ?',
    ),
    insertAccountSession: database.prepare(
      'INSERT INTO sessions (token_hash, state_json, revision, created_at, updated_at, expires_at, account_sub, account_provider) VALUES (?, ?, 0, ?, ?, ?, ?, ?)',
    ),
    bindAccount: database.prepare(
      'UPDATE sessions SET token_hash = ?, account_sub = ?, account_provider = ?, updated_at = ?, expires_at = ? WHERE token_hash = ?',
    ),
    touchAccountSession: database.prepare(
      'UPDATE sessions SET updated_at = ? WHERE token_hash = ?',
    ),
    removeSession: database.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    cleanup: database.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    accountGet: database.prepare(
      'SELECT sub, email, display_name, state_json, revision FROM google_accounts WHERE sub = ?',
    ),
    accountInsert: database.prepare(
      'INSERT INTO google_accounts (sub, email, display_name, state_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    accountProfile: database.prepare(
      'UPDATE google_accounts SET email = ?, display_name = ?, updated_at = ? WHERE sub = ?',
    ),
    googleByEmail: database.prepare('SELECT sub FROM google_accounts WHERE lower(trim(email)) = ?'),
    accountSave: database.prepare(
      'UPDATE google_accounts SET state_json = ?, revision = ?, updated_at = ? WHERE sub = ? AND revision = ?',
    ),
    accountRevision: database.prepare(
      'UPDATE google_accounts SET revision = ?, updated_at = ? WHERE sub = ? AND revision = ?',
    ),
    emailGet: database.prepare(
      'SELECT sub, email, display_name, state_json, revision, google_sub, email_verified FROM email_accounts WHERE sub = ?',
    ),
    emailByAddress: database.prepare('SELECT sub, google_sub FROM email_accounts WHERE email = ?'),
    emailByGoogle: database.prepare(
      'SELECT sub, password_hash FROM email_accounts WHERE google_sub = ?',
    ),
    emailCredentialGet: database.prepare('SELECT password_hash FROM email_accounts WHERE sub = ?'),
    emailInsert: database.prepare(
      'INSERT INTO email_accounts (sub, email, display_name, password_hash, state_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    ),
    emailSave: database.prepare(
      'UPDATE email_accounts SET state_json = ?, revision = ?, updated_at = ? WHERE sub = ? AND revision = ?',
    ),
    emailLink: database.prepare(
      'UPDATE email_accounts SET google_sub = ?, email_verified = 1, updated_at = ? WHERE sub = ? AND google_sub IS NULL',
    ),
  };
  const profiles = createProfileStore(database, { HttpError });
  const social = createSocialStore(database, { HttpError, profiles });
  const audit = createAuditStore(database);
  const credentials = createPlayerCredentials({ HttpError });
  function recordPlayer(action, email, now, details = {}) {
    const profile = typeof email === 'string' ? profiles.getByEmail(email) : null;
    if (!profile) return;
    try {
      audit.record({
        at: now,
        level: 'info',
        actorType: 'player',
        actor: profile.user_code,
        action,
        targetId: profile.id,
        targetLabel: profile.user_code,
        details,
      });
    } catch {
      console.error('Player audit write failed');
    }
  }
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
    if (now - lastCleanup >= 60_000) {
      statements.cleanup.run(now);
      lastCleanup = now;
    }
    const hash = sessionHash(request);
    const row = hash ? statements.get.get(hash) : null;
    if (!row || row.expires_at <= now) return null;
    if (!['google', 'email'].includes(row.account_provider))
      throw new Error('Invalid persisted account provider');
    const credential = row.account_sub
      ? (row.account_provider === 'email' ? statements.emailGet : statements.accountGet).get(
          row.account_sub,
        )
      : null;
    if (row.account_sub && !credential) throw new Error('Orphaned game account session');
    const canonicalProvider = credential?.google_sub ? 'google' : row.account_provider;
    const canonicalSub = credential?.google_sub || row.account_sub;
    const account = credential?.google_sub
      ? statements.accountGet.get(credential.google_sub)
      : credential;
    if (credential?.google_sub && !account) throw new Error('Orphaned linked account');
    const serialized = account ? account.state_json : row.state_json;
    const state = migrateGame(JSON.parse(serialized));
    if (!validateGame(state)) throw new Error('Invalid persisted game');
    return {
      hash,
      state,
      revision: account ? account.revision : row.revision,
      serialized,
      accountSub: row.account_sub,
      accountProvider: row.account_provider,
      canonicalProvider,
      canonicalSub,
      credential,
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
        const result = (
          session.canonicalProvider === 'email' ? statements.emailSave : statements.accountSave
        ).run(serialized, session.revision, now, session.canonicalSub, previousRevision);
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

  const verification = createVerificationStore(database, { mail, HttpError });
  const recovery = createRecoveryStore(database, { mail, HttpError });

  async function issueEmailVerification(emailSub, now) {
    return verification.issue(emailSub, now);
  }

  function confirmPlayerCode(request, code, now) {
    const session = loadSession(request, now);
    if (!session?.accountSub || session.accountProvider !== 'email')
      throw new HttpError(401, 'account_session_required');
    verification.confirm(session.accountSub, code, now);
    recordPlayer('player.email_verified', session.account.email, now);
    return publicPlayer(loadSession(request, now));
  }

  function requirePlayer(request, now) {
    const session = loadSession(request, now);
    if (!session?.accountSub) throw new HttpError(401, 'account_session_required');
    if (session.canonicalProvider !== 'google' && !session.credential.email_verified)
      throw new HttpError(403, 'email_verification_required');
    return session;
  }

  function publicPlayer(session) {
    if (!session?.account) return null;
    const credential =
      session.canonicalProvider === 'google'
        ? statements.emailByGoogle.get(session.canonicalSub)
        : statements.emailCredentialGet.get(session.accountSub);
    const passwordEnabled = Boolean(credential?.password_hash);
    const profile = profiles.ensure(
      { email: session.account.email, name: session.account.display_name },
      Math.floor(clock()),
    );
    return {
      ...profiles.publicProfile(profile.email),
      provider: session.accountProvider,
      emailVerified:
        session.canonicalProvider === 'google' || Boolean(session.credential?.email_verified),
      passwordEnabled,
      googleLinked: session.canonicalProvider === 'google',
    };
  }

  function logoutPlayer(request, response, session) {
    recordPlayer('player.logout', session.account?.email, Math.floor(clock()), {
      provider: session.accountProvider,
    });
    statements.removeSession.run(session.hash);
    appendCookie(
      response,
      `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureRequest(request, trustProxy) ? '; Secure' : ''}`,
    );
  }

  function completeEmailLogin(request, response, identity, now, registration = false) {
    now = Math.floor(clock());
    // Do not silently replace a browser's authenticated identity or link by matching email.
    const current = loadSession(request, now);
    const existing = statements.emailGet.get(identity.sub);
    if (!registration && !existing) throw new HttpError(401, 'invalid_credentials');
    if (
      !registration &&
      statements.emailCredentialGet.get(identity.sub)?.password_hash !== identity.passwordHash
    )
      throw new HttpError(401, 'invalid_credentials');
    if (
      current?.accountSub &&
      !(current.accountProvider === 'email' && current.accountSub === identity.sub) &&
      !(
        existing?.google_sub &&
        current.canonicalProvider === 'google' &&
        current.canonicalSub === existing.google_sub
      )
    )
      throw new HttpError(409, 'account_conflict');
    const state = current?.state ?? createGame(now);
    if (!validateGame(state)) throw new Error('Invalid game to link');
    if (registration && current && !current.accountSub) resumeGame(state, now);
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    database.exec('BEGIN IMMEDIATE');
    try {
      if (registration) {
        // Re-check inside the transaction because password hashing yields to other requests.
        if (statements.emailByAddress.get(identity.email)) throw new HttpError(409, 'email_in_use');
        if (statements.googleByEmail.get(identity.email))
          throw new HttpError(409, 'google_login_required');
        statements.emailInsert.run(
          identity.sub,
          identity.email,
          identity.name,
          identity.passwordHash,
          JSON.stringify(state),
          now,
          now,
        );
      }
      if (!registration)
        database
          .prepare('UPDATE email_accounts SET last_login_at=? WHERE sub=?')
          .run(now, identity.sub);
      if (current) {
        statements.bindAccount.run(
          hash,
          identity.sub,
          'email',
          now,
          now + SESSION_AGE_MS,
          current.hash,
        );
      } else {
        statements.insertAccountSession.run(
          hash,
          existing ? existing.state_json : JSON.stringify(state),
          now,
          now,
          now + SESSION_AGE_MS,
          identity.sub,
          'email',
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
    const canonical = existing?.google_sub
      ? statements.accountGet.get(existing.google_sub)
      : existing;
    const profile = profiles.ensure(
      { email: canonical?.email ?? identity.email, name: canonical?.display_name ?? identity.name },
      now,
    );
    recordPlayer(registration ? 'player.register' : 'player.login', profile.email, now, {
      provider: 'email',
    });
    return {
      ...profiles.publicProfile(profile.email),
      provider: 'email',
      emailVerified: Boolean(existing?.google_sub || existing?.email_verified),
      passwordEnabled: true,
      googleLinked: Boolean(existing?.google_sub),
    };
  }

  function setPlayerPassword(request, response, passwordHash, now) {
    now = Math.floor(clock());
    const current = loadSession(request, now);
    if (!current?.accountSub || current.accountProvider !== 'google')
      throw new HttpError(401, 'google_session_required');
    const email = current.account.email.trim().toLowerCase();
    const sub = randomBytes(24).toString('base64url');
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    database.exec('BEGIN IMMEDIATE');
    try {
      const existing = statements.emailByAddress.get(email);
      if (
        existing?.google_sub === current.canonicalSub ||
        statements.emailByGoogle.get(current.canonicalSub)
      )
        throw new HttpError(409, 'password_already_set');
      if (existing) throw new HttpError(409, 'account_link_required');
      statements.emailInsert.run(
        sub,
        email,
        current.account.display_name,
        passwordHash,
        current.serialized,
        now,
        now,
      );
      statements.emailLink.run(current.canonicalSub, now, sub);
      statements.bindAccount.run(
        hash,
        current.accountSub,
        'google',
        now,
        now + SESSION_AGE_MS,
        current.hash,
      );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    appendCookie(
      response,
      `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE_MS / 1000}${secureRequest(request, trustProxy) ? '; Secure' : ''}`,
    );
    recordPlayer('player.password_added', email, now);
    return { ...publicPlayer(current), passwordEnabled: true };
  }

  const playerRoutes = createPlayerRoutes(database, {
    googleConfig,
    mailEnabled: mail.enabled,
    HttpError,
    json,
    checkMutation,
    readJson,
    trustProxy,
    credentials,
    getSession: loadSession,
    publicUser: publicPlayer,
    register: (request, response, identity, now) =>
      completeEmailLogin(
        request,
        response,
        { ...identity, sub: randomBytes(24).toString('base64url') },
        now,
        true,
      ),
    login: (request, response, identity, now) =>
      completeEmailLogin(request, response, identity, now),
    setPassword: setPlayerPassword,
    requirePlayer,
    changePassword(request, expectedHash, passwordHash, now) {
      const session = requirePlayer(request, Math.floor(clock()));
      const credential =
        session.canonicalProvider === 'google'
          ? statements.emailByGoogle.get(session.canonicalSub)
          : { sub: session.accountSub };
      if (!credential) throw new HttpError(409, 'account_conflict');
      database.exec('BEGIN IMMEDIATE');
      try {
        const changed = database
          .prepare(
            'UPDATE email_accounts SET password_hash=?,updated_at=? WHERE sub=? AND password_hash=?',
          )
          .run(passwordHash, now, credential.sub, expectedHash);
        if (changed.changes !== 1) throw new HttpError(409, 'account_conflict');
        database
          .prepare(
            "DELETE FROM sessions WHERE token_hash<>? AND ((account_provider='email' AND account_sub=?) OR (account_provider='google' AND account_sub=?))",
          )
          .run(
            session.hash,
            credential.sub,
            session.canonicalProvider === 'google' ? session.canonicalSub : '',
          );
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      recordPlayer('player.password_changed', session.account.email, now);
      return publicPlayer(session);
    },
    logout: logoutPlayer,
    issueVerification: issueEmailVerification,
    confirmVerification: confirmPlayerCode,
    requestRecovery(email) {
      setImmediate(() => {
        void recovery.request(email, Math.floor(clock())).catch(() => {});
      });
    },
    confirmRecovery(email, code, expectedHash, passwordHash) {
      recovery.confirm(email, code, expectedHash, passwordHash, Math.floor(clock()));
      recordPlayer('player.password_reset', email, Math.floor(clock()));
    },
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
      session?.account && session.accountProvider === 'google'
        ? { name: session.account.display_name, email: session.account.email }
        : null,
    completeLogin(request, response, identity, now, { flowStartedAt } = {}) {
      now = Math.floor(clock());
      database.prepare('DELETE FROM deleted_google_accounts WHERE expires_at<=?').run(now);
      const deleted = database
        .prepare('SELECT deleted_at FROM deleted_google_accounts WHERE sub_hash=?')
        .get(createHash('sha256').update(identity.sub).digest('hex'));
      if (deleted && (!Number.isFinite(flowStartedAt) || flowStartedAt <= deleted.deleted_at))
        throw new HttpError(409, 'account_deleted');
      const current = loadSession(request, now);
      const email = identity.email.trim().toLowerCase();
      if (current?.accountProvider === 'email' && !current.credential.email_verified)
        throw new HttpError(403, 'email_verification_required');
      const credential = statements.emailByAddress.get(email);
      let linkingEmail = null;
      if (current?.accountSub && current.accountProvider === 'email') {
        if (current.credential.email !== email)
          throw new HttpError(409, 'account_link_email_mismatch');
        if (current.credential.google_sub && current.credential.google_sub !== identity.sub)
          throw new HttpError(409, 'google_account_conflict');
        const linked = statements.emailByGoogle.get(identity.sub);
        if (linked && linked.sub !== current.accountSub)
          throw new HttpError(409, 'account_link_required');
        linkingEmail = current.accountSub;
      } else if (current?.accountSub) {
        if (current.canonicalProvider !== 'google' || current.canonicalSub !== identity.sub)
          throw new HttpError(409, 'google_account_conflict');
      } else if (credential && credential.google_sub !== identity.sub) {
        // A verified Google email alone does not prove control of a pre-existing password.
        throw new HttpError(409, 'account_link_required');
      }
      const existing = statements.accountGet.get(identity.sub);
      if (existing && existing.email.trim().toLowerCase() !== email)
        throw new HttpError(409, 'account_link_email_mismatch');
      const state = current?.state ?? createGame(now);
      if (!validateGame(state)) throw new Error('Invalid game to link');
      if (!existing && current && !current.accountSub) resumeGame(state, now);
      const token = randomBytes(32).toString('base64url');
      const hash = createHash('sha256').update(token).digest('hex');
      database.exec('BEGIN IMMEDIATE');
      try {
        if (existing) {
          statements.accountProfile.run(existing.email, existing.display_name, now, identity.sub);
        } else {
          statements.accountInsert.run(
            identity.sub,
            identity.email,
            identity.name,
            JSON.stringify(state),
            current?.canonicalProvider === 'email' ? current.revision : 0,
            now,
            now,
          );
        }
        database
          .prepare('UPDATE google_accounts SET last_login_at=? WHERE sub=?')
          .run(now, identity.sub);
        profiles.ensure(
          {
            email: existing?.email ?? identity.email,
            name: linkingEmail
              ? current.account.display_name
              : (existing?.display_name ?? identity.name),
            googlePicture: identity.picture,
          },
          now,
        );
        if (linkingEmail && !current.credential.google_sub) {
          if (existing) {
            // Preserve the Google save verbatim and invalidate commands from either old village.
            const changed = statements.accountRevision.run(
              Math.max(existing.revision, current.revision) + 1,
              now,
              identity.sub,
              existing.revision,
            );
            if (changed.changes !== 1) throw new HttpError(409, 'stale_revision');
          }
          const linked = statements.emailLink.run(identity.sub, now, linkingEmail);
          if (linked.changes !== 1) throw new HttpError(409, 'account_link_required');
        }
        if (current) {
          statements.bindAccount.run(
            hash,
            identity.sub,
            'google',
            now,
            now + SESSION_AGE_MS,
            current.hash,
          );
        } else {
          statements.insertAccountSession.run(
            hash,
            existing ? existing.state_json : JSON.stringify(state),
            now,
            now,
            now + SESSION_AGE_MS,
            identity.sub,
            'google',
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
      recordPlayer(linkingEmail ? 'player.google_linked' : 'player.google_login', email, now, {
        provider: 'google',
      });
    },
    logout: logoutPlayer,
  });

  const adminRoutes = createAdminRoutes(database, {
    email: adminEmail,
    password: adminPassword,
    trustProxy,
    checkMutation,
    readJson,
    json,
    HttpError,
    profiles,
    audit,
    hashPassword: credentials.hashPassword,
    normalizedEmail,
    boundedPassword,
    clock,
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
      if (await playerRoutes.handle(request, response, pathname, now)) return;
      if (await googleRoutes.handle(request, response, pathname, now)) return;
      if (pathname.startsWith('/api/player/avatar/') && request.method === 'GET') {
        requirePlayer(request, now);
        let code;
        try {
          code = decodeURIComponent(pathname.slice('/api/player/avatar/'.length));
        } catch {
          throw new HttpError(400, 'invalid_avatar');
        }
        const avatar = profiles.getAvatar(code);
        if (!avatar) throw new HttpError(404, 'not_found');
        response.writeHead(200, {
          'Content-Type': avatar.mime,
          'Cache-Control': 'private, no-store',
        });
        return response.end(Buffer.from(avatar.bytes));
      }
      if (pathname === '/api/player/profile' || pathname.startsWith('/api/player/friends')) {
        const session = requirePlayer(request, now);
        const email = publicPlayer(session).email;
        if (pathname === '/api/player/profile' && request.method === 'GET')
          return json(response, 200, { user: publicPlayer(session) });
        if (pathname === '/api/player/friends' && request.method === 'GET')
          return json(response, 200, social.list(email));
        if (pathname === '/api/player/friends/messages' && request.method === 'GET') {
          const params = new URL(request.url, 'http://localhost').searchParams;
          if (
            [...params.keys()].some((key) => !['userCode', 'before', 'limit'].includes(key)) ||
            ['userCode', 'before', 'limit'].some((key) => params.getAll(key).length > 1)
          )
            throw new HttpError(400, 'unexpected_fields');
          return json(
            response,
            200,
            social.conversation(email, {
              userCode: params.get('userCode'),
              ...(params.has('before') ? { before: Number(params.get('before')) } : {}),
              ...(params.has('limit') ? { limit: Number(params.get('limit')) } : {}),
            }),
          );
        }
        const allowed = [
          '/api/player/profile',
          '/api/player/friends/request',
          '/api/player/friends/accept',
          '/api/player/friends/remove',
          '/api/player/friends/transfer',
          '/api/player/friends/gift',
          '/api/player/friends/messages',
        ];
        if (!allowed.includes(pathname)) throw new HttpError(404, 'not_found');
        if (request.method !== 'POST')
          return json(
            response,
            405,
            { error: 'method_not_allowed' },
            { Allow: pathname === '/api/player/friends/messages' ? 'GET, POST' : 'POST' },
          );
        checkMutation(request, trustProxy);
        const body = await readJson(
          request,
          pathname === '/api/player/profile' ? 3 * 1024 * 1024 : BODY_LIMIT,
        );
        // The account/session may have been deleted while its request body was arriving.
        requirePlayer(request, Math.floor(clock()));
        if (pathname === '/api/player/profile') {
          const user = { ...publicPlayer(session), ...profiles.update(email, body, now) };
          recordPlayer('player.profile_updated', email, now);
          return json(response, 200, { user });
        }
        const action = pathname.split('/').at(-1);
        const fields =
          action === 'gift'
            ? ['userCode', 'kind', 'assetId', 'amount', 'revision', 'requestId']
            : action === 'messages'
              ? ['userCode', 'body', 'requestId']
              : action === 'transfer'
                ? ['userCode', 'amount', 'revision', 'requestId']
                : ['userCode'];
        if (Object.keys(body).some((key) => !fields.includes(key)))
          throw new HttpError(400, 'unexpected_fields');
        const result = ['transfer', 'gift', 'messages'].includes(action)
          ? social[action === 'messages' ? 'sendMessage' : action](email, body, now)
          : social[action](email, body.userCode, now);
        if (!result.duplicate)
          recordPlayer(
            {
              request: 'player.friend_requested',
              accept: 'player.friend_accepted',
              remove: 'player.friend_removed',
              transfer: 'player.stone_transferred',
              gift: 'player.asset_gifted',
              messages: 'player.message_sent',
            }[action],
            email,
            now,
            action === 'gift'
              ? { amount: body.amount, asset: body.assetId, kind: body.kind }
              : action === 'transfer'
                ? { amount: body.amount }
                : {},
          );
        return json(response, 200, result);
      }
      if (pathname === '/api/config' && request.method === 'GET') {
        return json(response, 200, { analytics: publicAnalytics }, { 'Cache-Control': 'no-store' });
      }
      if (pathname === '/api/session' && request.method === 'POST') {
        checkMutation(request, trustProxy);
        const body = await readJson(request);
        if (Object.keys(body).length) throw new HttpError(400, 'unexpected_fields');
        const session = requirePlayer(request, now);
        resumeGame(session.state, now);
        return json(response, 200, { ...persist(session, now), mode: 'online' });
      }
      if (pathname === '/api/state' && request.method === 'GET') {
        const session = requirePlayer(request, now);
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
        const session = requirePlayer(request, now);
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
        const result = persist(session, now, true);
        recordPlayer('player.game_action', session.account.email, now, {
          actionType: body.action.type,
        });
        return json(response, 200, result);
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
      if (!(error instanceof HttpError) || error.status >= 500) {
        try {
          audit.record({
            at: Math.floor(clock()),
            level: 'error',
            actorType: 'system',
            actor: 'API',
            action: 'system.api_error',
            details: {
              status: error instanceof HttpError ? error.status : 500,
              error: error instanceof HttpError ? error.code : 'internal_error',
            },
          });
        } catch {
          console.error('System audit write failed');
        }
      }
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
