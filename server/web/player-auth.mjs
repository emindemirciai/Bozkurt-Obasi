import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const MAX_AUTH_ATTEMPTS = 20;
const MAX_FAILED_LOGINS = 5;
const MAX_KDF_JOBS = 4;

export function normalizedEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      email,
    )
  )
    return null;
  return email;
}

export function boundedPassword(value, minimum = 1) {
  return (
    typeof value === 'string' &&
    value.length <= 256 &&
    Array.from(value).length >= minimum &&
    Array.from(value).length <= 128 &&
    !value.includes('\0')
  );
}

/** Share the same salted format and per-app KDF budget with administrator-created players. */
export function createPlayerCredentials({ HttpError }) {
  let activeJobs = 0;
  async function passwordKey(password, salt) {
    if (activeJobs >= MAX_KDF_JOBS) throw new HttpError(429, 'login_rate_limited');
    activeJobs++;
    try {
      return await deriveKey(password, salt, 64, SCRYPT_OPTIONS);
    } finally {
      activeJobs--;
    }
  }
  async function hashPassword(password) {
    const salt = randomBytes(16);
    const hash = await passwordKey(password, salt);
    return `scrypt-v1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  }
  async function verifyPassword(password, encoded) {
    const parts = /^scrypt-v1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/.exec(encoded || '');
    const salt = parts ? Buffer.from(parts[1], 'base64url') : Buffer.alloc(16);
    const expected = parts ? Buffer.from(parts[2], 'base64url') : Buffer.alloc(64);
    // Unknown accounts perform the same expensive derivation and constant-time comparison.
    const candidate = await passwordKey(password, salt);
    return timingSafeEqual(candidate, expected) && Boolean(parts);
  }
  return { hashPassword, verifyPassword };
}

/** Player credentials never share the administrator token routes or Google identity namespace. */
export function createPlayerRoutes(
  database,
  {
    googleConfig,
    mailEnabled,
    HttpError,
    json,
    checkMutation,
    readJson,
    trustProxy,
    getSession,
    publicUser,
    register,
    login,
    setPassword,
    logout,
    issueVerification,
    confirmVerification,
    requirePlayer,
    changePassword,
    requestRecovery,
    confirmRecovery,
    credentials,
  },
) {
  const findEmail = database.prepare(
    'SELECT sub, password_hash FROM email_accounts WHERE email = ?',
  );
  const findGoogle = database.prepare(
    'SELECT sub FROM google_accounts WHERE lower(trim(email)) = ?',
  );
  const attempts = new Map();
  const failures = new Map();
  const { hashPassword, verifyPassword } = credentials || createPlayerCredentials({ HttpError });

  function bucket(map, key, now) {
    const previous = map.get(key);
    if (previous && now - previous.since < AUTH_WINDOW_MS) return previous;
    if (map.size >= 10_000) {
      for (const [identity, value] of map)
        if (now - value.since >= AUTH_WINDOW_MS) map.delete(identity);
      if (map.size >= 10_000) throw new HttpError(429, 'login_rate_limited');
    }
    const value = { since: now, count: 0 };
    map.set(key, value);
    return value;
  }

  function allowAttempt(request, now) {
    const address =
      (trustProxy && request.headers['x-forwarded-for']?.split(',').at(-1)?.trim()) ||
      request.socket.remoteAddress ||
      'unknown';
    const value = bucket(attempts, address, now);
    if (value.count >= MAX_AUTH_ATTEMPTS) throw new HttpError(429, 'login_rate_limited');
    value.count++;
  }

  async function handle(request, response, pathname, now) {
    const methods = {
      '/api/auth/player/status': 'GET',
      '/api/auth/player/register': 'POST',
      '/api/auth/player/login': 'POST',
      '/api/auth/player/logout': 'POST',
      '/api/auth/player/password': 'POST',
      '/api/auth/player/password/change': 'POST',
      '/api/auth/player/password/reset/request': 'POST',
      '/api/auth/player/password/reset/confirm': 'POST',
      '/api/auth/player/verify/request': 'POST',
      '/api/auth/player/verify/confirm': 'POST',
    };
    const expected = methods[pathname];
    if (!expected) return false;
    if (request.method !== expected) {
      json(response, 405, { error: 'method_not_allowed' }, { Allow: expected });
      return true;
    }
    if (pathname === '/api/auth/player/status') {
      const user = publicUser(getSession(request, now));
      json(response, 200, {
        enabled: googleConfig.enabled,
        emailEnabled: true,
        mailEnabled,
        authenticated: Boolean(user?.emailVerified),
        ...(user?.emailVerified
          ? { user }
          : user
            ? { verificationRequired: true, pendingEmail: user.email }
            : {}),
        ...(!googleConfig.enabled ? { reason: googleConfig.reason } : {}),
      });
      return true;
    }
    checkMutation(request, trustProxy);
    const body = await readJson(request);
    if (pathname.startsWith('/api/auth/player/password/reset/')) {
      const confirming = pathname.endsWith('/confirm');
      const fields = confirming ? ['email', 'code', 'password'] : ['email'];
      if (Object.keys(body).some((key) => !fields.includes(key)))
        throw new HttpError(400, 'unexpected_fields');
      allowAttempt(request, now);
      const email = normalizedEmail(body.email);
      if (!email) throw new HttpError(400, 'invalid_email');
      if (!mailEnabled) throw new HttpError(503, 'mail_unavailable');
      if (!confirming) {
        // Delivery runs behind a bounded guard; SMTP latency never reveals account existence.
        requestRecovery(email);
      } else {
        if (typeof body.code !== 'string' || !/^[0-9]{6}$/.test(body.code))
          throw new HttpError(400, 'recovery_code_invalid');
        if (!boundedPassword(body.password, 12)) throw new HttpError(400, 'invalid_password');
        const expectedHash = findEmail.get(email)?.password_hash;
        confirmRecovery(email, body.code, expectedHash, await hashPassword(body.password));
        failures.delete(email);
      }
      json(response, 200, { ok: true });
      return true;
    }
    if (pathname === '/api/auth/player/verify/confirm') {
      if (Object.keys(body).some((key) => key !== 'code'))
        throw new HttpError(400, 'unexpected_fields');
      allowAttempt(request, now);
      const user = confirmVerification(request, body.code, now);
      json(response, 200, { verified: true, authenticated: true, user });
      return true;
    }
    if (pathname === '/api/auth/player/verify/request') {
      if (Object.keys(body).length) throw new HttpError(400, 'unexpected_fields');
      allowAttempt(request, now);
      const session = getSession(request, now);
      if (!session?.accountSub) throw new HttpError(401, 'account_session_required');
      const sent = await issueVerification(
        session.accountProvider === 'email' ? session.accountSub : undefined,
        now,
      );
      json(response, 200, { ok: true, sent });
      return true;
    }
    if (pathname === '/api/auth/player/logout') {
      if (Object.keys(body).length) throw new HttpError(400, 'unexpected_fields');
      const session = getSession(request, now);
      if (!session?.accountSub) throw new HttpError(401, 'account_session_required');
      logout(request, response, session);
      json(response, 200, { ok: true });
      return true;
    }
    if (pathname === '/api/auth/player/password/change') {
      if (Object.keys(body).some((key) => !['password', 'currentPassword'].includes(key)))
        throw new HttpError(400, 'unexpected_fields');
      allowAttempt(request, now);
      const session = requirePlayer(request, now);
      const credential =
        session.canonicalProvider === 'google'
          ? database
              .prepare('SELECT password_hash FROM email_accounts WHERE google_sub=?')
              .get(session.canonicalSub)
          : database
              .prepare('SELECT password_hash FROM email_accounts WHERE sub=?')
              .get(session.accountSub);
      if (!credential?.password_hash) throw new HttpError(400, 'password_not_set');
      if (!boundedPassword(body.password, 12)) throw new HttpError(400, 'invalid_password');
      if (
        !boundedPassword(body.currentPassword) ||
        !(await verifyPassword(body.currentPassword, credential.password_hash))
      )
        throw new HttpError(401, 'invalid_credentials');
      const user = changePassword(
        request,
        credential.password_hash,
        await hashPassword(body.password),
        now,
      );
      json(response, 200, { authenticated: true, user });
      return true;
    }
    if (pathname === '/api/auth/player/password') {
      if (Object.keys(body).some((key) => key !== 'password'))
        throw new HttpError(400, 'unexpected_fields');
      allowAttempt(request, now);
      const session = getSession(request, now);
      if (!session?.accountSub || session.accountProvider !== 'google')
        throw new HttpError(401, 'google_session_required');
      if (!normalizedEmail(session.account.email)) throw new HttpError(400, 'invalid_email');
      if (!boundedPassword(body.password, 12)) throw new HttpError(400, 'invalid_password');
      const user = setPassword(request, response, await hashPassword(body.password), now);
      json(response, 200, { authenticated: true, user });
      return true;
    }
    const isRegistration = pathname === '/api/auth/player/register';
    const fields = isRegistration ? ['email', 'password', 'name'] : ['email', 'password'];
    if (Object.keys(body).some((key) => !fields.includes(key)))
      throw new HttpError(400, 'unexpected_fields');
    allowAttempt(request, now);
    const email = normalizedEmail(body.email);
    if (!email)
      throw new HttpError(
        isRegistration ? 400 : 401,
        isRegistration ? 'invalid_email' : 'invalid_credentials',
      );
    if (!boundedPassword(body.password, isRegistration ? 12 : 1))
      throw new HttpError(
        isRegistration ? 400 : 401,
        isRegistration ? 'invalid_password' : 'invalid_credentials',
      );
    if (isRegistration) {
      if (
        body.name !== undefined &&
        (typeof body.name !== 'string' ||
          body.name.trim().length > 60 ||
          /[\x00-\x1f\x7f]/.test(body.name))
      )
        throw new HttpError(400, 'invalid_name');
      if (getSession(request, now)?.accountSub) throw new HttpError(409, 'account_conflict');
      if (findEmail.get(email)) throw new HttpError(409, 'email_in_use');
      if (findGoogle.get(email)) throw new HttpError(409, 'google_login_required');
      const passwordHash = await hashPassword(body.password);
      const name = body.name?.trim() || email.split('@')[0].slice(0, 60);
      const user = register(request, response, { email, name, passwordHash }, now);
      const account = findEmail.get(email);
      const verificationSent = await issueVerification(account.sub, now);
      json(response, 201, {
        authenticated: false,
        verificationRequired: true,
        pendingEmail: user.email,
        verificationSent,
      });
      return true;
    }
    const failed = bucket(failures, email, now);
    if (failed.count >= MAX_FAILED_LOGINS) throw new HttpError(429, 'login_rate_limited');
    const account = findEmail.get(email);
    if (!(await verifyPassword(body.password, account?.password_hash))) {
      failed.count++;
      throw new HttpError(401, 'invalid_credentials');
    }
    const user = login(
      request,
      response,
      { sub: account.sub, passwordHash: account.password_hash },
      now,
    );
    failures.delete(email);
    const verificationSent = !user.emailVerified
      ? await issueVerification(account.sub, now)
      : false;
    json(
      response,
      200,
      user.emailVerified
        ? { authenticated: true, user }
        : {
            authenticated: false,
            verificationRequired: true,
            pendingEmail: user.email,
            verificationSent,
          },
    );
    return true;
  }
  return { handle };
}
