import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const FLOW_AGE_MS = 10 * 60 * 1000;
const FLOW_COOKIE = 'bozkurt_google_flow';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return randomBytes(32).toString('base64url');
}

function cookie(request, name) {
  return (request.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function appendCookie(response, value) {
  const previous = response.getHeader('Set-Cookie');
  response.setHeader(
    'Set-Cookie',
    previous ? [...(Array.isArray(previous) ? previous : [previous]), value] : value,
  );
}

function flowCookie(value, secure, maxAge) {
  return `${FLOW_COOKIE}=${value}; Path=/api/auth/google/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function redirect(response, location) {
  response.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

function safeRedirectUri(value) {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/api/auth/google/callback' &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) &&
      value === url.href
    );
  } catch {
    return false;
  }
}

/** Incomplete credentials disable Google sign-in without disabling existing game accounts. */
export function googleAuthConfig({ clientId, clientSecret, redirectUris } = {}) {
  const id = typeof clientId === 'string' ? clientId.trim() : '';
  const secret = typeof clientSecret === 'string' ? clientSecret.trim() : '';
  const uris =
    typeof redirectUris === 'string'
      ? redirectUris
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  if (!id && !secret && uris.length === 0) return { enabled: false, reason: 'not_configured' };
  if (
    !/^[A-Za-z0-9._-]{10,256}\.apps\.googleusercontent\.com$/.test(id) ||
    !secret ||
    uris.length === 0 ||
    uris.length > 8 ||
    new Set(uris).size !== uris.length ||
    uris.some((uri) => !safeRedirectUri(uri))
  )
    return { enabled: false, reason: 'configuration_incomplete' };
  return { enabled: true, clientId: id, clientSecret: secret, redirectUris: uris };
}

async function providerJson(fetchImpl, url, options, HttpError) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
  } catch {
    throw new HttpError(502, 'google_auth_unavailable');
  }
  if (!response.ok) throw new HttpError(502, 'google_auth_failed');
  let body;
  try {
    const text = await response.text();
    if (text.length > 64 * 1024) throw new Error('oversized provider response');
    body = JSON.parse(text);
  } catch {
    throw new HttpError(502, 'google_auth_failed');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new HttpError(502, 'google_auth_failed');
  return body;
}

function decodedPart(part, HttpError) {
  if (!/^[A-Za-z0-9_-]+$/.test(part) || part.length > 16_384)
    throw new HttpError(502, 'google_auth_failed');
  try {
    const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid JWT');
    return value;
  } catch {
    throw new HttpError(502, 'google_auth_failed');
  }
}

/** The browser never receives Google tokens or the OAuth client secret. */
export function createGoogleRoutes(
  database,
  {
    config,
    fetchImpl,
    HttpError,
    json,
    checkMutation,
    readJson,
    trustProxy,
    requestOrigin,
    secureRequest,
    sessionHash,
    getSession,
    publicUser,
    completeLogin,
    logout,
  },
) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS google_oauth_flows (
      state_hash TEXT PRIMARY KEY,
      browser_hash TEXT NOT NULL,
      session_hash TEXT,
      nonce TEXT NOT NULL,
      verifier TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS google_oauth_flows_expiry ON google_oauth_flows (expires_at);
  `);
  const flows = {
    insert: database.prepare('INSERT INTO google_oauth_flows VALUES (?, ?, ?, ?, ?, ?, ?)'),
    get: database.prepare('SELECT * FROM google_oauth_flows WHERE state_hash = ?'),
    remove: database.prepare('DELETE FROM google_oauth_flows WHERE state_hash = ?'),
    cleanup: database.prepare('DELETE FROM google_oauth_flows WHERE expires_at <= ?'),
  };
  let jwks = null;
  let jwksUntil = 0;

  async function publicKey(kid, now) {
    if (!jwks || now >= jwksUntil || !jwks.keys.some((key) => key.kid === kid)) {
      const received = await providerJson(fetchImpl, JWKS_URL, { method: 'GET' }, HttpError);
      if (!Array.isArray(received.keys) || received.keys.length > 32)
        throw new HttpError(502, 'google_auth_failed');
      jwks = received;
      jwksUntil = now + 5 * 60 * 1000;
    }
    const matches = jwks.keys.filter((key) => key.kid === kid && key.kty === 'RSA');
    if (matches.length !== 1 || (matches[0].alg && matches[0].alg !== 'RS256'))
      throw new HttpError(502, 'google_auth_failed');
    try {
      return createPublicKey({ key: matches[0], format: 'jwk' });
    } catch {
      throw new HttpError(502, 'google_auth_failed');
    }
  }

  async function identity(idToken, nonce, now) {
    if (typeof idToken !== 'string' || idToken.length > 16_384)
      throw new HttpError(502, 'google_auth_failed');
    const parts = idToken.split('.');
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[2]))
      throw new HttpError(502, 'google_auth_failed');
    const header = decodedPart(parts[0], HttpError);
    const claims = decodedPart(parts[1], HttpError);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 128)
      throw new HttpError(502, 'google_auth_failed');
    const key = await publicKey(header.kid, now);
    if (
      !verify(
        'RSA-SHA256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        key,
        Buffer.from(parts[2], 'base64url'),
      )
    )
      throw new HttpError(502, 'google_auth_failed');
    const seconds = Math.floor(now / 1000);
    if (
      !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) ||
      claims.aud !== config.clientId ||
      (claims.azp && claims.azp !== config.clientId) ||
      claims.nonce !== nonce ||
      !Number.isInteger(claims.iat) ||
      claims.iat > seconds + 300 ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= seconds ||
      claims.exp <= claims.iat ||
      typeof claims.sub !== 'string' ||
      claims.sub.length < 1 ||
      claims.sub.length > 255 ||
      !/^[\x21-\x7e]+$/.test(claims.sub) ||
      typeof claims.email !== 'string' ||
      claims.email.length > 254 ||
      !claims.email.includes('@') ||
      ![true, 'true'].includes(claims.email_verified)
    )
      throw new HttpError(502, 'google_auth_failed');
    return {
      picture:
        typeof claims.picture === 'string' &&
        claims.picture.length <= 2048 &&
        /^https:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com\//i.test(claims.picture)
          ? claims.picture
          : null,
      sub: claims.sub,
      email: claims.email,
      name:
        typeof claims.name === 'string' && claims.name.trim()
          ? claims.name.trim().slice(0, 100)
          : claims.email,
    };
  }

  async function handle(request, response, pathname, now) {
    if (!pathname.startsWith('/api/auth/google/')) return false;
    const methods = {
      '/api/auth/google/status': 'GET',
      '/api/auth/google/start': 'GET',
      '/api/auth/google/callback': 'GET',
      '/api/auth/google/logout': 'POST',
    };
    const expected = methods[pathname];
    if (!expected) return false;
    if (request.method !== expected) {
      json(response, 405, { error: 'method_not_allowed' }, { Allow: expected });
      return true;
    }
    if (pathname === '/api/auth/google/status') {
      const user = config.enabled ? publicUser(getSession(request, now)) : null;
      json(response, 200, {
        enabled: config.enabled,
        authenticated: Boolean(user),
        ...(user ? { user } : {}),
        ...(!config.enabled ? { reason: config.reason } : {}),
      });
      return true;
    }
    if (!config.enabled) throw new HttpError(503, 'google_auth_unavailable');
    if (pathname === '/api/auth/google/start') {
      if (request.headers['sec-fetch-site'] === 'cross-site')
        throw new HttpError(403, 'origin_rejected');
      const origin = requestOrigin(request, trustProxy);
      const redirectUri = config.redirectUris.find((value) => new URL(value).origin === origin);
      if (!redirectUri) throw new HttpError(403, 'google_origin_unavailable');
      const state = randomToken();
      const browser = randomToken();
      const nonce = randomToken();
      const verifier = randomToken();
      flows.cleanup.run(now);
      flows.insert.run(
        sha256(state),
        sha256(browser),
        sessionHash(request),
        nonce,
        verifier,
        redirectUri,
        now + FLOW_AGE_MS,
      );
      appendCookie(
        response,
        flowCookie(browser, secureRequest(request, trustProxy), FLOW_AGE_MS / 1000),
      );
      const authorization = new URL(AUTH_URL);
      authorization.searchParams.set('client_id', config.clientId);
      authorization.searchParams.set('redirect_uri', redirectUri);
      authorization.searchParams.set('response_type', 'code');
      authorization.searchParams.set('scope', 'openid email profile');
      authorization.searchParams.set('state', state);
      authorization.searchParams.set('nonce', nonce);
      authorization.searchParams.set(
        'code_challenge',
        createHash('sha256').update(verifier).digest('base64url'),
      );
      authorization.searchParams.set('code_challenge_method', 'S256');
      response.writeHead(302, { Location: authorization.href, 'Cache-Control': 'no-store' });
      response.end();
      return true;
    }
    if (pathname === '/api/auth/google/callback') {
      appendCookie(response, flowCookie('', secureRequest(request, trustProxy), 0));
      const query = new URL(request.url, 'http://localhost').searchParams;
      const state = query.getAll('state');
      const browser = cookie(request, FLOW_COOKIE);
      if (
        state.length !== 1 ||
        !/^[A-Za-z0-9_-]{43}$/.test(state[0]) ||
        !browser ||
        !/^[A-Za-z0-9_-]{43}$/.test(browser)
      )
        throw new HttpError(400, 'google_state_invalid');
      const pending = flows.get.get(sha256(state[0]));
      if (
        !pending ||
        pending.expires_at <= now ||
        pending.browser_hash !== sha256(browser) ||
        pending.session_hash !== sessionHash(request) ||
        pending.redirect_uri !== `${requestOrigin(request, trustProxy)}${pathname}`
      )
        throw new HttpError(400, 'google_state_invalid');
      flows.remove.run(sha256(state[0])); // Single-use, including canceled and failed exchanges.
      if (query.has('error')) {
        redirect(response, '/?auth=cancelled');
        return true;
      }
      const codes = query.getAll('code');
      if (codes.length !== 1 || !codes[0] || codes[0].length > 4096)
        throw new HttpError(400, 'google_code_invalid');
      const tokens = await providerJson(
        fetchImpl,
        TOKEN_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: codes[0],
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: pending.redirect_uri,
            grant_type: 'authorization_code',
            code_verifier: pending.verifier,
          }).toString(),
        },
        HttpError,
      );
      const person = await identity(tokens.id_token, pending.nonce, now);
      try {
        completeLogin(request, response, person, now, {
          flowStartedAt: pending.expires_at - FLOW_AGE_MS,
        });
      } catch (error) {
        if (
          ['account_link_required', 'account_link_email_mismatch', 'account_deleted'].includes(
            error.code,
          )
        ) {
          redirect(response, `/?auth=${error.code}`);
          return true;
        }
        throw error;
      }
      redirect(response, '/?auth=success');
      return true;
    }
    checkMutation(request, trustProxy);
    const body = await readJson(request);
    if (Object.keys(body).length) throw new HttpError(400, 'unexpected_fields');
    const session = getSession(request, now);
    if (!session?.accountSub || session.accountProvider !== 'google')
      throw new HttpError(401, 'google_session_required');
    logout(request, response, session);
    json(response, 200, { ok: true });
    return true;
  }
  return { handle };
}
