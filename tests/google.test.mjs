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
    async restart(overrides = {}) {
      await app.close();
      Object.assign(settings, overrides);
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
    assert.deepEqual(await blocked.json(), { error: 'account_session_required' });
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
  assert.deepEqual(await response.json(), { error: 'account_session_required' });
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

const PLAYER_PASSWORD = 'Both methods guard this village 123!';

async function registerEmail(api, email = 'wolf@example.com') {
  const response = await api.request('/api/auth/player/register', {
    method: 'POST',
    body: { email, password: PLAYER_PASSWORD, name: 'Oba Reisi' },
  });
  assert.equal(response.status, 201);
  return cookie(response, 'bozkurt_session');
}

async function loginEmail(api, email = 'wolf@example.com') {
  const response = await api.request('/api/auth/player/login', {
    method: 'POST',
    body: { email, password: PLAYER_PASSWORD },
  });
  assert.equal(response.status, 200);
  return cookie(response, 'bozkurt_session');
}

async function buildVillage(api, accountCookie, building) {
  const initial = await (await api.request('/api/state', { cookies: [accountCookie] })).json();
  const response = await api.request('/api/action', {
    method: 'POST',
    cookies: [accountCookie],
    body: { action: { type: 'build', building }, revision: initial.revision },
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('matching Google and email accounts link only after both proofs and share one village', async (t) => {
  const api = await fixture(t);
  const emailCookie = await registerEmail(api);
  const built = await buildVillage(api, emailCookie, 'quarry');
  const otherEmailDevice = await loginEmail(api);
  const unproved = await api.callback(await api.start());
  assert.equal(unproved.status, 303);
  assert.equal(unproved.headers.get('location'), '/?auth=account_link_required');
  assert.equal(cookie(unproved, 'bozkurt_session'), '');
  const linked = await api.callback(await api.start([emailCookie]), [emailCookie]);
  assert.equal(linked.status, 303);
  assert.equal(linked.headers.get('location'), '/?auth=success');
  const googleCookie = cookie(linked, 'bozkurt_session');
  assert.ok(googleCookie);
  assert.equal((await api.request('/api/state', { cookies: [emailCookie] })).status, 401);
  for (const accountCookie of [googleCookie, otherEmailDevice]) {
    assert.deepEqual(
      await (await api.request('/api/state', { cookies: [accountCookie] })).json(),
      built,
    );
    const status = await (
      await api.request('/api/auth/player/status', { cookies: [accountCookie] })
    ).json();
    assert.equal(status.user.passwordEnabled, true);
    assert.equal(status.user.googleLinked, true);
    assert.equal(status.user.emailVerified, true);
  }
  const passwordCookie = await loginEmail(api);
  const googleAgain = cookie(await api.callback(await api.start()), 'bozkurt_session');
  assert.ok(googleAgain);
  assert.deepEqual(
    await (await api.request('/api/state', { cookies: [passwordCookie] })).json(),
    built,
  );
  assert.deepEqual(
    await (await api.request('/api/state', { cookies: [googleAgain] })).json(),
    built,
  );
  await api.restart({ googleClientSecret: '' });
  const status = await (
    await api.request('/api/auth/player/status', { cookies: [googleAgain] })
  ).json();
  assert.equal(status.enabled, false);
  assert.equal(status.authenticated, true);
  const passwordAfterRestart = await loginEmail(api);
  assert.deepEqual(
    await (await api.request('/api/state', { cookies: [passwordAfterRestart] })).json(),
    built,
  );
});

test('Google users set a password for their verified email without replacing their village', async (t) => {
  const api = await fixture(t);
  const originalCookie = cookie(await api.callback(await api.start()), 'bozkurt_session');
  const built = await buildVillage(api, originalCookie, 'quarry');
  const blocked = await api.request('/api/auth/player/register', {
    method: 'POST',
    body: { email: ' WOLF@EXAMPLE.COM ', password: PLAYER_PASSWORD },
  });
  assert.equal(blocked.status, 409);
  assert.deepEqual(await blocked.json(), { error: 'google_login_required' });
  const anonymous = await api.request('/api/auth/player/password', {
    method: 'POST',
    body: { password: PLAYER_PASSWORD },
  });
  assert.equal(anonymous.status, 401);
  const foreign = await api.request('/api/auth/player/password', {
    method: 'POST',
    cookies: [originalCookie],
    body: { password: PLAYER_PASSWORD },
    headers: { Origin: 'https://attacker.invalid' },
  });
  assert.equal(foreign.status, 403);
  const setup = await api.request('/api/auth/player/password', {
    method: 'POST',
    cookies: [originalCookie],
    body: { password: PLAYER_PASSWORD },
  });
  assert.equal(setup.status, 200);
  const profile = await setup.json();
  assert.equal(profile.user.provider, 'google');
  assert.equal(profile.user.passwordEnabled, true);
  assert.equal(profile.user.googleLinked, true);
  assert.equal(profile.user.emailVerified, true);
  const rotated = cookie(setup, 'bozkurt_session');
  assert.notEqual(rotated, originalCookie);
  assert.equal((await api.request('/api/state', { cookies: [originalCookie] })).status, 401);
  assert.deepEqual(await (await api.request('/api/state', { cookies: [rotated] })).json(), built);
  const changedPassword = await api.request('/api/auth/player/password', {
    method: 'POST',
    cookies: [rotated],
    body: { password: 'new password must not replace old one 123' },
  });
  assert.equal(changedPassword.status, 409);
  assert.deepEqual(await changedPassword.json(), { error: 'password_already_set' });
  const passwordCookie = await loginEmail(api);
  assert.deepEqual(
    await (await api.request('/api/state', { cookies: [passwordCookie] })).json(),
    built,
  );
  assert.equal(
    (
      await api.request('/api/auth/google/logout', {
        method: 'POST',
        cookies: [passwordCookie],
        body: {},
      })
    ).status,
    401,
  );
});

test('linking existing villages preserves Google progress and backs up email state while rejecting stale commands', async (t) => {
  const api = await fixture(t);
  const googleCookie = cookie(await api.callback(await api.start()), 'bozkurt_session');
  const googleBuilt = await buildVillage(api, googleCookie, 'healer');
  const emailCookie = await registerEmail(api, 'legacy@example.com');
  const emailBuilt = await buildVillage(api, emailCookie, 'quarry');
  assert.equal(googleBuilt.revision, emailBuilt.revision);
  assert.notDeepEqual(googleBuilt.state, emailBuilt.state);
  // Simulate independent accounts from an earlier database before identity linking existed.
  const database = new DatabaseSync(api.dbPath);
  database
    .prepare(
      "UPDATE email_accounts SET email = 'wolf@example.com' WHERE email = 'legacy@example.com'",
    )
    .run();
  const emailBefore = database
    .prepare('SELECT state_json, revision, password_hash FROM email_accounts')
    .get();
  const googleBefore = database.prepare('SELECT state_json, revision FROM google_accounts').get();
  database.close();
  const otherEmailDevice = await loginEmail(api);
  const noOverwrite = await api.request('/api/auth/player/password', {
    method: 'POST',
    cookies: [googleCookie],
    body: { password: 'must not replace existing password 123' },
  });
  assert.equal(noOverwrite.status, 409);
  assert.equal((await noOverwrite.json()).error, 'account_link_required');
  const linked = await api.callback(await api.start([emailCookie]), [emailCookie]);
  assert.equal(linked.status, 303);
  assert.equal(linked.headers.get('location'), '/?auth=success');
  const canonical = await (await api.request('/api/state', { cookies: [otherEmailDevice] })).json();
  assert.deepEqual(canonical.state, googleBuilt.state);
  assert.ok(canonical.revision > Math.max(googleBuilt.revision, emailBuilt.revision));
  const stale = await api.request('/api/action', {
    method: 'POST',
    cookies: [otherEmailDevice],
    body: { action: { type: 'collect' }, revision: emailBuilt.revision },
  });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'stale_revision', ...canonical });
  const inspection = new DatabaseSync(api.dbPath);
  const emailAfter = inspection
    .prepare('SELECT state_json, revision, password_hash FROM email_accounts')
    .get();
  const googleAfter = inspection.prepare('SELECT state_json, revision FROM google_accounts').get();
  assert.deepEqual(emailAfter, emailBefore);
  assert.equal(googleAfter.state_json, googleBefore.state_json);
  assert.equal(googleAfter.revision, canonical.revision);
  inspection.close();
  const emailAgain = await loginEmail(api);
  const googleAgain = cookie(await api.callback(await api.start()), 'bozkurt_session');
  assert.deepEqual(
    await (await api.request('/api/state', { cookies: [emailAgain] })).json(),
    canonical,
  );
  assert.deepEqual(
    await (await api.request('/api/state', { cookies: [googleAgain] })).json(),
    canonical,
  );
});

test('different or unverified Google emails cannot link an authenticated email village', async (t) => {
  const api = await fixture(t);
  const emailCookie = await registerEmail(api);
  api.provider.claims = { email: 'another@example.com' };
  const mismatch = await api.callback(await api.start([emailCookie]), [emailCookie]);
  assert.equal(mismatch.status, 303);
  assert.equal(mismatch.headers.get('location'), '/?auth=account_link_email_mismatch');
  assert.equal(cookie(mismatch, 'bozkurt_session'), '');
  api.provider.claims = { email_verified: false };
  assert.equal((await api.callback(await api.start([emailCookie]), [emailCookie])).status, 502);
  const status = await (
    await api.request('/api/auth/player/status', { cookies: [emailCookie] })
  ).json();
  assert.equal(status.user.googleLinked, false);
  assert.equal(status.user.emailVerified, false);
});

test('an expired email session does not count as proof when its OAuth flow is still valid', async (t) => {
  let now = NOW;
  const api = await fixture(t, { clock: () => now });
  const emailCookie = await registerEmail(api);
  const started = await api.start([emailCookie]);
  const database = new DatabaseSync(api.dbPath);
  database.prepare('UPDATE sessions SET expires_at = ?').run(NOW + 1000);
  database.close();
  now += 2000;
  const response = await api.callback(started, [emailCookie]);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/?auth=account_link_required');
  const inspection = new DatabaseSync(api.dbPath);
  assert.equal(inspection.prepare('SELECT count(*) AS count FROM google_accounts').get().count, 0);
  assert.equal(inspection.prepare('SELECT google_sub FROM email_accounts').get().google_sub, null);
  inspection.close();
});
