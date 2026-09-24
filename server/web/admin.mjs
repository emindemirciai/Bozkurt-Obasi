import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;

function hash(value) {
  return createHash('sha256').update(value).digest();
}

function validPassword(actual, supplied) {
  const expected = hash(actual);
  const candidate = hash(supplied);
  return timingSafeEqual(expected, candidate) && actual.length > 0;
}

function hashAdminToken(token, secret) {
  return createHash('sha256').update(token).update(':').update(secret).digest('hex');
}

function bearerHash(request, secret) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || '');
  return match ? hashAdminToken(match[1], secret) : null;
}

export function createAdminRoutes(
  database,
  { email, password, trustProxy, checkMutation, readJson, json, HttpError },
) {
  database.exec(
    'CREATE TABLE IF NOT EXISTS admin_sessions (' +
      'token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL' +
      '); CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);',
  );
  const statements = {
    insert: database.prepare(
      'INSERT INTO admin_sessions(token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ),
    get: database.prepare('SELECT email, expires_at FROM admin_sessions WHERE token_hash = ?'),
    remove: database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?'),
    cleanup: database.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?'),
    overview: database.prepare(
      'SELECT COUNT(*) AS totalPlayers, ' +
        'SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) AS activePlayers ' +
        'FROM sessions WHERE expires_at > ?',
    ),
  };
  const failures = new Map();
  const normalizedEmail = (email || '').trim().toLowerCase();
  const configured =
    normalizedEmail.length > 0 && typeof password === 'string' && password.length >= 12;

  function requireAdmin(request, now) {
    if (!configured) throw new HttpError(503, 'admin_unavailable');
    const tokenHash = bearerHash(request, password);
    const session = tokenHash ? statements.get.get(tokenHash) : null;
    if (!session || session.expires_at <= now) throw new HttpError(401, 'admin_session_required');
    return { tokenHash, email: session.email, expiresAt: session.expires_at };
  }

  async function handle(request, response, pathname, now) {
    if (
      ![
        '/api/auth/login',
        '/api/auth/logout',
        '/api/admin/session',
        '/api/admin/overview',
      ].includes(pathname)
    )
      return false;
    const expectedMethod =
      pathname === '/api/auth/login' || pathname === '/api/auth/logout' ? 'POST' : 'GET';
    if (request.method !== expectedMethod) {
      json(response, 405, { error: 'method_not_allowed' }, { Allow: expectedMethod });
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
        throw new HttpError(429, 'login_rate_limited');
      }
      const body = await readJson(request);
      if (
        Object.keys(body).some((key) => !['email', 'password'].includes(key)) ||
        typeof body.email !== 'string' ||
        typeof body.password !== 'string' ||
        body.email.length > 254 ||
        body.password.length > 1024
      ) {
        throw new HttpError(400, 'invalid_credentials');
      }
      const valid =
        body.email.trim().toLowerCase() === normalizedEmail &&
        validPassword(password, body.password);
      if (!valid) {
        if (!previous || now - previous.since >= LOGIN_WINDOW_MS)
          failures.set(address, { since: now, count: 1 });
        else previous.count++;
        throw new HttpError(401, 'invalid_credentials');
      }
      failures.delete(address);
      statements.cleanup.run(now);
      const token = randomBytes(32).toString('base64url');
      const expiresAt = now + TOKEN_AGE_MS;
      statements.insert.run(hashAdminToken(token, password), normalizedEmail, now, expiresAt);
      json(
        response,
        200,
        { token, expiresAt, email: normalizedEmail },
        { 'Cache-Control': 'no-store' },
      );
      return true;
    }
    const session = requireAdmin(request, now);
    if (pathname === '/api/auth/logout') {
      checkMutation(request, trustProxy);
      statements.remove.run(session.tokenHash);
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
    const overview = statements.overview.get(now - 24 * 60 * 60 * 1000, now);
    json(
      response,
      200,
      {
        totalPlayers: overview.totalPlayers,
        activePlayers: overview.activePlayers || 0,
        generatedAt: now,
      },
      { 'Cache-Control': 'no-store' },
    );
    return true;
  }
  return { handle };
}
