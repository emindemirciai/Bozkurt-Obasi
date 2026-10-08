import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createAdminUserStore } from './admin-users.mjs';

const TOKEN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;

function hash(value) {
  return createHash('sha256').update(value).digest();
}
function validPassword(actual, supplied) {
  return timingSafeEqual(hash(actual), hash(supplied)) && actual.length > 0;
}
function hashAdminToken(token, secret) {
  return createHash('sha256').update(token).update(':').update(secret).digest('hex');
}
function bearerHash(request, secret) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || '');
  return match ? hashAdminToken(match[1], secret) : null;
}
function queryNumber(params, key, fallback, maximum) {
  const values = params.getAll(key);
  if (!values.length) return fallback;
  if (values.length !== 1 || !/^[1-9][0-9]{0,4}$/.test(values[0]))
    throw new RangeError('invalid_page');
  const number = Number(values[0]);
  if (number > maximum) throw new RangeError('invalid_page');
  return number;
}
function queryOptions(request, keys) {
  const params = new URL(request.url, 'http://localhost').searchParams;
  if ([...params.keys()].some((key) => !keys.includes(key) || params.getAll(key).length !== 1))
    throw new RangeError('invalid_filter');
  return params;
}
function safeAudit(audit, event) {
  try {
    audit.record(event);
  } catch {
    console.error('Admin audit write failed');
  }
}

export function createAdminRoutes(
  database,
  {
    email,
    password,
    trustProxy,
    checkMutation,
    readJson,
    json,
    HttpError,
    profiles,
    audit,
    hashPassword,
    normalizedEmail,
    boundedPassword,
    clock = Date.now,
  },
) {
  database.exec(
    'CREATE TABLE IF NOT EXISTS admin_sessions (' +
      'token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL' +
      '); CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);',
  );
  const statements = {
    insert: database.prepare(
      'INSERT INTO admin_sessions(token_hash,email,created_at,expires_at) VALUES(?,?,?,?)',
    ),
    get: database.prepare('SELECT email,expires_at FROM admin_sessions WHERE token_hash=?'),
    remove: database.prepare('DELETE FROM admin_sessions WHERE token_hash=?'),
    cleanup: database.prepare('DELETE FROM admin_sessions WHERE expires_at<=?'),
    overview: database.prepare(
      'SELECT COUNT(*) AS totalPlayers, ' +
        'SUM(CASE WHEN updated_at>=? THEN 1 ELSE 0 END) AS activePlayers ' +
        'FROM sessions WHERE expires_at>?',
    ),
  };
  const users = createAdminUserStore(database, {
    profiles,
    audit,
    hashPassword,
    normalizedEmail,
    boundedPassword,
    HttpError,
  });
  const failures = new Map();
  const adminEmail = (email || '').trim().toLowerCase();
  const configured = adminEmail.length > 0 && typeof password === 'string' && password.length >= 12;

  function requireAdmin(request, now) {
    if (!configured) throw new HttpError(503, 'admin_unavailable');
    const tokenHash = bearerHash(request, password);
    const session = tokenHash ? statements.get.get(tokenHash) : null;
    if (!session || session.expires_at <= now) throw new HttpError(401, 'admin_session_required');
    return { tokenHash, email: session.email, expiresAt: session.expires_at };
  }
  function auditFailure(action, actor, error, now) {
    safeAudit(audit, {
      at: now,
      level: error.status >= 500 ? 'error' : 'warning',
      actorType: 'admin',
      actor,
      action,
      details: {
        error: error instanceof HttpError ? error.code : 'internal_error',
        status: error.status || 500,
      },
    });
  }

  async function handle(request, response, pathname, now) {
    const userDetail =
      pathname.startsWith('/api/admin/users/') && pathname.length > '/api/admin/users/'.length;
    const known = new Set([
      '/api/auth/login',
      '/api/auth/logout',
      '/api/admin/session',
      '/api/admin/overview',
      '/api/admin/users',
      '/api/admin/logs',
    ]);
    if (!known.has(pathname) && !userDetail) return false;
    const methods =
      pathname === '/api/auth/login' ||
      pathname === '/api/auth/logout' ||
      pathname === '/api/admin/users'
        ? pathname === '/api/admin/users'
          ? ['GET', 'POST']
          : ['POST']
        : userDetail
          ? ['GET', 'DELETE']
          : ['GET'];
    if (!methods.includes(request.method)) {
      json(response, 405, { error: 'method_not_allowed' }, { Allow: methods.join(', ') });
      return true;
    }

    if (pathname === '/api/auth/login') {
      checkMutation(request, trustProxy);
      if (!configured) throw new HttpError(503, 'admin_unavailable');
      const address =
        (trustProxy && request.headers['x-forwarded-for']?.split(',').at(-1)?.trim()) ||
        request.socket.remoteAddress ||
        'unknown';
      const previous = failures.get(address);
      if (
        previous &&
        now - previous.since < LOGIN_WINDOW_MS &&
        previous.count >= MAX_FAILED_LOGINS
      ) {
        safeAudit(audit, {
          at: now,
          level: 'warning',
          actorType: 'system',
          action: 'admin.login.rate_limited',
          details: { status: 429 },
        });
        throw new HttpError(429, 'login_rate_limited');
      }
      const body = await readJson(request);
      if (
        Object.keys(body).some((key) => !['email', 'password'].includes(key)) ||
        typeof body.email !== 'string' ||
        typeof body.password !== 'string' ||
        body.email.length > 254 ||
        body.password.length > 1024
      )
        throw new HttpError(400, 'invalid_credentials');
      const passwordValid = validPassword(password, body.password);
      const emailValid = body.email.trim().toLowerCase() === adminEmail;
      if (!passwordValid || !emailValid) {
        if (!previous || now - previous.since >= LOGIN_WINDOW_MS) {
          if (failures.size >= 10_000) {
            for (const [key, value] of failures)
              if (now - value.since >= LOGIN_WINDOW_MS) failures.delete(key);
            if (failures.size >= 10_000) throw new HttpError(429, 'login_rate_limited');
          }
          failures.set(address, { since: now, count: 1 });
        } else previous.count++;
        safeAudit(audit, {
          at: now,
          level: 'warning',
          actorType: 'system',
          action: 'admin.login.failed',
          details: { status: 401 },
        });
        throw new HttpError(401, 'invalid_credentials');
      }
      failures.delete(address);
      statements.cleanup.run(now);
      const token = randomBytes(32).toString('base64url'),
        expiresAt = now + TOKEN_AGE_MS;
      statements.insert.run(hashAdminToken(token, password), adminEmail, now, expiresAt);
      safeAudit(audit, {
        at: now,
        actorType: 'admin',
        actor: adminEmail,
        action: 'admin.login.success',
        details: { status: 200 },
      });
      json(response, 200, { token, expiresAt, email: adminEmail }, { 'Cache-Control': 'no-store' });
      return true;
    }

    const session = requireAdmin(request, now);
    if (pathname === '/api/auth/logout') {
      checkMutation(request, trustProxy);
      statements.remove.run(session.tokenHash);
      safeAudit(audit, {
        at: now,
        actorType: 'admin',
        actor: session.email,
        action: 'admin.logout',
        details: { status: 200 },
      });
      json(response, 200, { ok: true }, { 'Cache-Control': 'no-store' });
      return true;
    }
    if (pathname === '/api/admin/session') {
      json(
        response,
        200,
        { email: session.email, expiresAt: session.expiresAt },
        { 'Cache-Control': 'no-store' },
      );
      return true;
    }
    if (pathname === '/api/admin/overview') {
      const overview = statements.overview.get(now - 24 * 60 * 60 * 1000, now);
      json(
        response,
        200,
        {
          totalPlayers: overview.totalPlayers,
          activePlayers: overview.activePlayers || 0,
          ...users.counts(),
          generatedAt: now,
        },
        { 'Cache-Control': 'no-store' },
      );
      return true;
    }
    if (pathname === '/api/admin/logs') {
      let result;
      try {
        const params = queryOptions(request, ['query', 'action', 'level', 'page', 'limit']);
        result = audit.list({
          query: params.get('query') || '',
          action: params.get('action') || '',
          level: params.get('level') || 'all',
          page: queryNumber(params, 'page', 1, 10_000),
          limit: queryNumber(params, 'limit', 20, 100),
          now,
        });
      } catch (error) {
        if (error instanceof RangeError) throw new HttpError(400, 'invalid_log_filter');
        throw error;
      }
      json(response, 200, result, { 'Cache-Control': 'no-store' });
      return true;
    }
    if (pathname === '/api/admin/users' && request.method === 'GET') {
      let options;
      try {
        const params = queryOptions(request, [
          'query',
          'verification',
          'provider',
          'page',
          'limit',
        ]);
        options = {
          query: params.get('query') || '',
          verification: params.get('verification') || 'all',
          provider: params.get('provider') || 'all',
          page: queryNumber(params, 'page', 1, 10_000),
          limit: queryNumber(params, 'limit', 20, 100),
          now,
        };
      } catch (error) {
        if (error instanceof RangeError) throw new HttpError(400, 'invalid_user_filter');
        throw error;
      }
      json(response, 200, users.list(options, now), { 'Cache-Control': 'no-store' });
      return true;
    }
    if (pathname === '/api/admin/users' && request.method === 'POST') {
      try {
        checkMutation(request, trustProxy);
        const body = await readJson(request);
        const result = await users.create(body, {
          now: Math.floor(clock()),
          actor: session.email,
          recheck: () => requireAdmin(request, Math.floor(clock())),
        });
        json(response, 201, result, { 'Cache-Control': 'no-store' });
      } catch (error) {
        auditFailure('admin.user.create_failed', session.email, error, Math.floor(clock()));
        throw error;
      }
      return true;
    }
    const id = pathname.slice('/api/admin/users/'.length);
    if (request.method === 'GET') {
      json(response, 200, users.detail(id, now), { 'Cache-Control': 'no-store' });
      return true;
    }
    try {
      checkMutation(request, trustProxy);
      const body = await readJson(request);
      if (Object.keys(body).some((key) => key !== 'confirmation'))
        throw new HttpError(400, 'unexpected_fields');
      const result = users.remove(id, body.confirmation, {
        now: Math.floor(clock()),
        actor: session.email,
        recheck: () => requireAdmin(request, Math.floor(clock())),
      });
      json(response, 200, result, { 'Cache-Control': 'no-store' });
    } catch (error) {
      auditFailure('admin.user.delete_failed', session.email, error, Math.floor(clock()));
      throw error;
    }
    return true;
  }
  return { handle };
}
