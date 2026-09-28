import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/web/app.mjs';
import { googleAuthConfig } from '../server/web/google.mjs';
import { createGame } from '../shared/game.mjs';

const CLIENT_ID = '1234567890.apps.googleusercontent.com';
const NOW = 1_800_000_000_000;

function jwt(privateKey, claims, signatureValid = true) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const value = `${header}.${payload}`;
  const signature = sign('RSA-SHA256', Buffer.from(value), privateKey);
  if (!signatureValid) signature[0] ^= 1;
  return `${value}.${signature.toString('base64url')}`;
}

function cookie(response, name) {
  const found = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  return found?.split(';')[0] || '';
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-google-'));
  const staticDir = join(root, 'public');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<title>Bozkurt</title>');
  const port = await freePort();
  const redirect = `http://127.0.0.1:${port}/api/auth/google/callback`;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256' };
  const provider = {
    calls: [],
    claims: {},
    validSignature: true,
    async fetch(url, options) {
      this.calls.push({ url, options });
      if (url === 'https://www.googleapis.com/oauth2/v3/certs')
        return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
      assert.equal(url, 'https://oauth2.googleapis.com/token');
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('grant_type'), 'authorization_code');
      assert.equal(form.get('client_id'), CLIENT_ID);
      assert.equal(form.get('client_secret'), 'test-secret');
      assert.equal(form.get('redirect_uri'), redirect);
      assert.equal(
        createHash('sha256').update(form.get('code_verifier')).digest('base64url'),
        provider.challenge,
      );
      const claims = {
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        sub: 'google-sub-123',
        email: 'wolf@example.com',
        email_verified: true,
        name: 'Wolf Keeper',
        iat: Math.floor(NOW / 1000),
        exp: Math.floor(NOW / 1000) + 3600,
        nonce: provider.nonce,
        ...provider.claims,
      };
      return new Response(
        JSON.stringify({ id_token: jwt(privateKey, claims, provider.validSignature) }),
        {
          status: 200,
        },
      );
    },
  };
  const settings = {
    dbPath: join(root, 'game.sqlite'),
    staticDir,
    clock: () => NOW,
    googleClientId: CLIENT_ID,
    googleClientSecret: 'test-secret',
    googleRedirectUris: redirect,
    googleFetch: provider.fetch.bind(provider),
    ...overrides,
  };
  let app = createApp(settings);
  await app.listen(port);
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  return {
    provider,
    dbPath: settings.dbPath,
    async request(path, { method = 'GET', cookies = [], body, headers = {} } = {}) {
      return fetch(`${base}${path}`, {
        method,
        redirect: 'manual',
        headers: {
          Connection: 'close',
          ...(cookies.length ? { Cookie: cookies.join('; ') } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    async start(cookies = []) {
      const response = await this.request('/api/auth/google/start', { cookies });
      assert.equal(response.status, 302);
      const authorization = new URL(response.headers.get('location'));
      assert.equal(authorization.origin, 'https://accounts.google.com');
      assert.equal(authorization.searchParams.get('scope'), 'openid email profile');
      assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
      provider.nonce = authorization.searchParams.get('nonce');
      provider.challenge = authorization.searchParams.get('code_challenge');
      return { authorization, flowCookie: cookie(response, 'bozkurt_google_flow') };
    },
    async callback(started, cookies = []) {
      const state = started.authorization.searchParams.get('state');
      return this.request(`/api/auth/google/callback?state=${state}&code=valid-code`, {
        cookies: [...cookies, started.flowCookie],
      });
    },
    async restart() {
      await app.close();
      app = createApp(settings);
      await app.listen(port);
    },
  };
}

test('Google settings fail closed when credentials or redirect origins are missing', async (t) => {
  assert.deepEqual(googleAuthConfig(), { enabled: false, reason: 'not_configured' });
  assert.deepEqual(googleAuthConfig({ clientId: CLIENT_ID, clientSecret: 'secret' }), {
    enabled: false,
    reason: 'configuration_incomplete',
  });
  const api = await fixture(t, { googleClientSecret: undefined });
  const status = await api.request('/api/auth/google/status');
  assert.deepEqual(await status.json(), {
    enabled: false,
    authenticated: false,
    reason: 'configuration_incomplete',
  });
  const start = await api.request('/api/auth/google/start');
  assert.equal(start.status, 503);
  assert.deepEqual(await start.json(), { error: 'google_auth_unavailable' });
  for (const [path, method, body] of [
    ['/api/session', 'POST', {}],
    ['/api/state', 'GET', undefined],
    ['/api/action', 'POST', { action: { type: 'collect' }, revision: 0 }],
  ]) {
    const blocked = await api.request(path, { method, body });
    assert.equal(blocked.status, 401);
    assert.deepEqual(await blocked.json(), { error: 'google_session_required' });
  }
  assert.equal(api.provider.calls.length, 0);
});

test('existing guest SQLite saves migrate without losing progress', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-google-migration-'));
  const dbPath = join(root, 'game.sqlite');
  const database = new DatabaseSync(dbPath);
  database.exec(`CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  const token = 'a'.repeat(43);
  const state = createGame(NOW);
  database
    .prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      createHash('sha256').update(token).digest('hex'),
      JSON.stringify(state),
      0,
      NOW,
      NOW,
      NOW + 30 * 24 * 60 * 60 * 1000,
    );
  database.close();
  const app = createApp({ dbPath, clock: () => NOW });
  const port = await freePort();
  await app.listen(port);
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/state`, {
    headers: { Cookie: `bozkurt_session=${token}` },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'google_session_required' });
});

test('Google login claims a legacy guest village and resumes it across devices', async (t) => {
  const api = await fixture(t);
  const token = 'a'.repeat(43);
  const guestCookie = `bozkurt_session=${token}`;
  const built = createGame(NOW);
  built.resources.wood += 17;
  const database = new DatabaseSync(api.dbPath);
  database
    .prepare(
      'INSERT INTO sessions (token_hash, state_json, revision, created_at, updated_at, expires_at) VALUES (?, ?, 0, ?, ?, ?)',
    )
    .run(
      createHash('sha256').update(token).digest('hex'),
      JSON.stringify(built),
      NOW,
      NOW,
      NOW + 86400000,
    );
  database.close();
  assert.equal(
    (await api.request('/api/session', { method: 'POST', cookies: [guestCookie], body: {} }))
      .status,
    401,
  );
  assert.equal((await api.request('/api/state', { cookies: [guestCookie] })).status, 401);
  assert.equal(
    (
      await api.request('/api/action', {
        method: 'POST',
        cookies: [guestCookie],
        body: { action: { type: 'collect' }, revision: 0 },
      })
    ).status,
    401,
  );
  const started = await api.start([guestCookie]);
  const callback = await api.callback(started, [guestCookie]);
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('location'), '/?auth=success');
  const accountCookie = cookie(callback, 'bozkurt_session');
  assert.ok(accountCookie);
  assert.notEqual(accountCookie, guestCookie);
  assert.equal((await api.request('/api/state', { cookies: [guestCookie] })).status, 401);
  const status = await api.request('/api/auth/google/status', { cookies: [accountCookie] });
  assert.deepEqual(await status.json(), {
    enabled: true,
    authenticated: true,
    user: { name: 'Wolf Keeper', email: 'wolf@example.com' },
  });
  const linked = await (await api.request('/api/state', { cookies: [accountCookie] })).json();
  assert.deepEqual(linked.state, built);
  await api.restart();
  const resumed = await (
    await api.request('/api/session', {
      method: 'POST',
      cookies: [accountCookie],
      body: {},
    })
  ).json();
  assert.deepEqual(resumed.state, built);
  const another = await api.start();
  const secondCallback = await api.callback(another);
  const secondCookie = cookie(secondCallback, 'bozkurt_session');
  assert.ok(secondCookie);
  const secondState = await (await api.request('/api/state', { cookies: [secondCookie] })).json();
  assert.deepEqual(secondState.state, built);
  const changed = await api.request('/api/action', {
    method: 'POST',
    cookies: [secondCookie],
    body: { action: { type: 'collect' }, revision: secondState.revision },
  });
  assert.equal(changed.status, 200);
  const firstAfter = await (await api.request('/api/state', { cookies: [accountCookie] })).json();
  assert.deepEqual(firstAfter, await changed.json());
  const logout = await api.request('/api/auth/google/logout', {
    method: 'POST',
    cookies: [accountCookie],
    body: {},
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await api.request('/api/state', { cookies: [accountCookie] })).status, 401);
  assert.equal((await api.request('/api/state', { cookies: [secondCookie] })).status, 200);
});

test('state, browser cookie, origin, replay, and signed identity are enforced', async (t) => {
  const api = await fixture(t, { trustProxy: true });
  const started = await api.start();
  const noCookie = await api.request(
    `/api/auth/google/callback?state=${started.authorization.searchParams.get('state')}&code=valid-code`,
  );
  assert.equal(noCookie.status, 400);
  assert.deepEqual(await noCookie.json(), { error: 'google_state_invalid' });
  const wrongState = await api.request('/api/auth/google/callback?state=wrong&code=valid-code', {
    cookies: [started.flowCookie],
  });
  assert.equal(wrongState.status, 400);
  assert.equal(api.provider.calls.length, 0);
  api.provider.claims = { aud: 'other-client.apps.googleusercontent.com' };
  const wrongAudience = await api.callback(started);
  assert.equal(wrongAudience.status, 502);
  assert.deepEqual(await wrongAudience.json(), { error: 'google_auth_failed' });
  assert.equal((await api.callback(started)).status, 400);
  const next = await api.start();
  api.provider.claims = {};
  api.provider.validSignature = false;
  const invalidSignature = await api.callback(next);
  assert.equal(invalidSignature.status, 502);
  assert.deepEqual(await invalidSignature.json(), { error: 'google_auth_failed' });
  const third = await api.start();
  api.provider.validSignature = true;
  api.provider.claims = { nonce: 'wrong-nonce' };
  assert.equal((await api.callback(third)).status, 502);
  const foreign = await api.request('/api/auth/google/start', {
    headers: { 'X-Forwarded-Host': 'evil.example' },
  });
  assert.equal(foreign.status, 403);
  assert.equal((await api.request('/api/auth/google/status')).status, 200);
});

test('Google logout requires authenticated same-origin JSON request', async (t) => {
  const api = await fixture(t);
  const missing = await api.request('/api/auth/google/logout', { method: 'POST', body: {} });
  assert.equal(missing.status, 401);
  const crossed = await api.request('/api/auth/google/logout', {
    method: 'POST',
    body: {},
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(crossed.status, 403);
  const invalid = await api.request('/api/auth/google/logout', {
    method: 'POST',
    body: { extra: true },
  });
  assert.equal(invalid.status, 400);
});
