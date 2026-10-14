import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/web/app.mjs';
import { createGame } from '../shared/game.mjs';

const PASSWORD = 'Obami koruyan uzun sifre 123!';

function sessionCookie(response) {
  return response.headers
    .getSetCookie()
    .find((value) => value.startsWith('bozkurt_session='))
    ?.split(';')[0];
}

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-player-auth-'));
  const staticDir = join(root, 'public');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<title>Bozkurt</title>');
  const messages = [];
  const settings = {
    dbPath: join(root, 'game.sqlite'),
    staticDir,
    clock: () => 1_800_000_000_000,
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUris: '',
    adminPassword: '',
    mailProvider: 'smtp',
    smtpHost: 'smtp.hostinger.com',
    smtpPort: '465',
    smtpSecure: 'true',
    smtpUser: 'info@bozkurtobasi.com',
    smtpPassword: 'test-only-secret',
    publicUrl: 'https://bozkurtobasi.com',
    mailSender: async (message) => messages.push(message),
    ...options,
  };
  let app = createApp(settings);
  let address = await app.listen();
  let base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    messages,
    get base() {
      return base;
    },
    get dbPath() {
      return settings.dbPath;
    },
    async request(path, { method = 'GET', cookie, body, headers = {} } = {}) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          Connection: 'close',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined
          ? {}
          : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      });
    },
    async register(body = {}, extra = {}) {
      const response = await this.request('/api/auth/player/register', {
        method: 'POST',
        body: { email: 'wolf@example.com', password: PASSWORD, ...body },
        ...extra,
      });
      if (response.status === 201) {
        const message = messages.findLast(
          (item) => item.to === (body.email || 'wolf@example.com').trim().toLowerCase(),
        );
        const code = /code: ([0-9]{6})/.exec(message.text)[1];
        const verified = await this.request('/api/auth/player/verify/confirm', {
          method: 'POST',
          cookie: sessionCookie(response),
          body: { code },
        });
        assert.equal(verified.status, 200);
      }
      return response;
    },
    login(body = {}, extra = {}) {
      return this.request('/api/auth/player/login', {
        method: 'POST',
        body: { email: 'wolf@example.com', password: PASSWORD, ...body },
        ...extra,
      });
    },
    async restart() {
      await app.close();
      app = createApp(settings);
      address = await app.listen();
      base = `http://127.0.0.1:${address.port}`;
    },
  };
}

test('email authentication is available without Google or administrator credentials', async (t) => {
  const api = await fixture(t);
  const status = await api.request('/api/auth/player/status');
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), {
    enabled: false,
    emailEnabled: true,
    mailEnabled: true,
    authenticated: false,
    reason: 'not_configured',
  });
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.equal((await api.request('/api/state')).status, 401);
  const admin = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'wolf@example.com', password: PASSWORD },
  });
  assert.equal(admin.status, 503);
  assert.equal((await admin.json()).error, 'admin_unavailable');
  for (const [path, allow] of [
    ['/api/auth/player/status', 'GET'],
    ['/api/auth/player/register', 'POST'],
    ['/api/auth/player/login', 'POST'],
    ['/api/auth/player/logout', 'POST'],
    ['/api/auth/player/password', 'POST'],
    ['/api/auth/player/password/reset/request', 'POST'],
    ['/api/auth/player/password/reset/confirm', 'POST'],
    ['/api/auth/player/verify/request', 'POST'],
    ['/api/auth/player/verify/confirm', 'POST'],
  ]) {
    const wrong = await api.request(path, { method: allow === 'GET' ? 'POST' : 'GET' });
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.get('allow'), allow);
  }
});

test('registration creates a private account village with salted credentials and a safe public profile', async (t) => {
  const api = await fixture(t);
  const registered = await api.register({ email: ' WOLF@EXAMPLE.COM ', name: '  Oba Reisi  ' });
  assert.equal(registered.status, 201);
  assert.deepEqual(await registered.json(), {
    authenticated: false,
    verificationRequired: true,
    pendingEmail: 'wolf@example.com',
    verificationSent: true,
  });
  const cookie = sessionCookie(registered);
  assert.match(cookie, /^bozkurt_session=[A-Za-z0-9_-]{43}$/);
  assert.match(
    registered.headers.get('set-cookie'),
    /Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000/,
  );
  assert.doesNotMatch(registered.headers.get('set-cookie'), /; Secure/);
  const status = await api.request('/api/auth/player/status', { cookie });
  const text = await status.text();
  assert.equal(JSON.parse(text).authenticated, true);
  assert.doesNotMatch(text, /"password":|password_hash|salt|hash|token|scrypt/);
  assert.ok(!text.includes(PASSWORD));
  assert.deepEqual(await (await api.request('/api/auth/google/status', { cookie })).json(), {
    enabled: false,
    authenticated: false,
    reason: 'not_configured',
  });
  const initial = await api.request('/api/session', { method: 'POST', body: {}, cookie });
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).mode, 'online');
  const second = await api.register({ email: 'another@example.com' });
  assert.equal(second.status, 201);
  const database = new DatabaseSync(api.dbPath);
  const hashes = database.prepare('SELECT password_hash FROM email_accounts').all();
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0].password_hash, hashes[1].password_hash);
  for (const row of hashes) {
    assert.match(row.password_hash, /^scrypt-v1\$/);
    assert.ok(!row.password_hash.includes(PASSWORD));
  }
  const sessions = database.prepare('SELECT token_hash, account_provider FROM sessions').all();
  assert.ok(sessions.every((row) => row.account_provider === 'email'));
  assert.ok(sessions.every((row) => !cookie.includes(row.token_hash)));
  database.close();
});

test('email login restores persistent progress across devices and keeps other villages isolated', async (t) => {
  const api = await fixture(t);
  const first = sessionCookie(await api.register());
  const other = sessionCookie(await api.register({ email: 'other@example.com' }));
  const initial = await (await api.request('/api/state', { cookie: first })).json();
  const changed = await api.request('/api/action', {
    method: 'POST',
    cookie: first,
    body: {
      action: { type: 'build', building: 'quarry', plotId: 'p0' },
      revision: initial.revision,
    },
  });
  assert.equal(changed.status, 200);
  const expected = await changed.json();
  assert.notDeepEqual(expected.state, initial.state);
  assert.deepEqual(
    (await (await api.request('/api/state', { cookie: other })).json()).state,
    initial.state,
  );
  await api.restart();
  const login = await api.login({ email: 'WOLF@EXAMPLE.COM' });
  assert.equal(login.status, 200);
  const second = sessionCookie(login);
  assert.notEqual(second, first);
  assert.deepEqual(await (await api.request('/api/state', { cookie: second })).json(), expected);
  assert.deepEqual(await (await api.request('/api/state', { cookie: first })).json(), expected);
  const stale = await api.request('/api/action', {
    method: 'POST',
    cookie: second,
    body: { action: { type: 'collect' }, revision: initial.revision },
  });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'stale_revision', ...expected });
});

test('normalized duplicates and parallel registration cannot replace an existing email account', async (t) => {
  const api = await fixture(t);
  const responses = await Promise.all([
    api.register({ email: 'new@example.com', name: 'First' }),
    api.register({ email: ' NEW@EXAMPLE.COM ', name: 'Second' }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(
    (await responses.find((response) => response.status === 409).json()).error,
    'email_in_use',
  );
  const duplicate = await api.register({
    email: 'New@Example.com',
    password: 'another long password 456',
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, 'email_in_use');
  const original = await api.login({ email: 'new@example.com' });
  assert.equal(original.status, 200);
  const changed = await api.login({
    email: 'new@example.com',
    password: 'another long password 456',
  });
  assert.equal(changed.status, 401);
});

test('wrong and unknown credentials return the same generic error and never mint a session', async (t) => {
  const api = await fixture(t);
  await api.register();
  for (const body of [
    { email: 'wolf@example.com', password: 'wrong password' },
    { email: 'unknown@example.com', password: PASSWORD },
    { email: 'invalid-email', password: PASSWORD },
  ]) {
    const response = await api.login(body);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'invalid_credentials' });
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await api.request('/api/auth/player/status')).status, 200);
  assert.equal((await api.login()).status, 200);
});

test('registration bounds names, email, Unicode passwords, and rejects save injection', async (t) => {
  const api = await fixture(t);
  const invalid = [
    [{ email: 'missing-at' }, 'invalid_email'],
    [{ email: 'name@example' }, 'invalid_email'],
    [{ password: 'short' }, 'invalid_password'],
    [{ password: 'a'.repeat(129) }, 'invalid_password'],
    [{ password: '🐺'.repeat(6) }, 'invalid_password'],
    [{ name: 'a'.repeat(61) }, 'invalid_name'],
    [{ name: 'name\nadmin' }, 'invalid_name'],
    [{ name: 123 }, 'invalid_name'],
    [{ state: createGame(1) }, 'unexpected_fields'],
    [{ provider: 'google' }, 'unexpected_fields'],
    [{ emailVerified: true }, 'unexpected_fields'],
  ];
  for (const [body, error] of invalid) {
    const response = await api.register(body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error });
    assert.equal(response.headers.get('set-cookie'), null);
  }
  const password = `  ${'🐺'.repeat(12)}  `;
  const registered = await api.register({ password });
  assert.equal(registered.status, 201);
  assert.equal(
    (
      await (
        await api.request('/api/auth/player/status', { cookie: sessionCookie(registered) })
      ).json()
    ).user.name,
    'wolf',
  );
  assert.equal((await api.login({ password })).status, 200);
  assert.equal((await api.login({ password: password.trim() })).status, 401);
});

test('all player auth mutations enforce same-origin JSON and bounded request bodies', async (t) => {
  const api = await fixture(t);
  for (const path of ['register', 'login', 'logout', 'password']) {
    const body =
      path === 'logout'
        ? {}
        : path === 'password'
          ? { password: PASSWORD }
          : { email: 'wolf@example.com', password: PASSWORD };
    for (const headers of [
      { Origin: 'https://attacker.invalid' },
      { 'Sec-Fetch-Site': 'cross-site' },
    ]) {
      const response = await api.request(`/api/auth/player/${path}`, {
        method: 'POST',
        body,
        headers,
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'origin_rejected' });
    }
    const plain = await api.request(`/api/auth/player/${path}`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain' },
    });
    assert.equal(plain.status, 415);
    assert.equal((await plain.json()).error, 'json_required');
  }
  const malformed = await api.request('/api/auth/player/register', { method: 'POST', body: '{' });
  assert.equal(malformed.status, 400);
  const oversized = await api.register({ password: 'a'.repeat(20_000) });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error, 'body_too_large');
  assert.equal((await api.register({}, { headers: { Origin: api.base } })).status, 201);
});

test('login rotates only the current browser session; logout leaves other devices intact', async (t) => {
  const api = await fixture(t);
  const first = sessionCookie(await api.register());
  const second = sessionCookie(await api.login({}, { cookie: first }));
  assert.notEqual(first, second);
  assert.equal((await api.request('/api/state', { cookie: first })).status, 401);
  const third = sessionCookie(await api.login());
  const foreign = await api.request('/api/auth/player/logout', {
    method: 'POST',
    cookie: second,
    body: {},
    headers: { Origin: 'https://attacker.invalid' },
  });
  assert.equal(foreign.status, 403);
  assert.equal((await api.request('/api/state', { cookie: second })).status, 200);
  const extra = await api.request('/api/auth/player/logout', {
    method: 'POST',
    cookie: second,
    body: { all: true },
  });
  assert.equal(extra.status, 400);
  const logout = await api.request('/api/auth/player/logout', {
    method: 'POST',
    cookie: second,
    body: {},
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=0/);
  assert.equal((await api.request('/api/state', { cookie: second })).status, 401);
  assert.equal((await api.request('/api/state', { cookie: third })).status, 200);
  const unauthenticated = await api.request('/api/auth/player/logout', {
    method: 'POST',
    body: {},
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).error, 'account_session_required');
});

test('authenticated browsers must sign out before switching email accounts or registering another account', async (t) => {
  const api = await fixture(t);
  const first = sessionCookie(await api.register());
  await api.register({ email: 'other@example.com' });
  const conflict = await api.login({ email: 'other@example.com' }, { cookie: first });
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { error: 'account_conflict' });
  const registration = await api.register({ email: 'third@example.com' }, { cookie: first });
  assert.equal(registration.status, 409);
  const status = await (await api.request('/api/auth/player/status', { cookie: first })).json();
  assert.equal(status.user.email, 'wolf@example.com');
  assert.equal((await api.request('/api/state', { cookie: first })).status, 200);
});

test('password failures and IP attempt quotas expire without locking an account permanently', async (t) => {
  let now = 1_800_000_000_000;
  const api = await fixture(t, { clock: () => now });
  await api.register();
  for (let attempt = 0; attempt < 5; attempt++)
    assert.equal((await api.login({ password: 'wrong password' })).status, 401);
  const blocked = await api.login();
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error, 'login_rate_limited');
  assert.equal(blocked.headers.get('retry-after'), '60');
  assert.equal((await api.request('/api/health')).status, 200);
  now += 10 * 60 * 1000 + 1;
  assert.equal((await api.login()).status, 200);
  const quota = await fixture(t);
  for (let attempt = 0; attempt < 20; attempt++)
    assert.equal((await quota.login({ email: 'invalid-email' })).status, 401);
  const limited = await quota.register();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('set-cookie'), null);
  assert.equal((await quota.request('/api/health')).status, 200);
});

test('trusted HTTPS proxies mint Secure cookies and expired sessions cannot access a saved village', async (t) => {
  let now = 1_800_000_000_000;
  const api = await fixture(t, { trustProxy: true, clock: () => now });
  const registered = await api.register(
    {},
    {
      headers: {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'game.example',
        Origin: 'https://game.example',
      },
    },
  );
  assert.equal(registered.status, 201);
  assert.match(registered.headers.get('set-cookie'), /; Secure$/);
  const cookie = sessionCookie(registered);
  now += 30 * 24 * 60 * 60 * 1000 + 1;
  const status = await (await api.request('/api/auth/player/status', { cookie })).json();
  assert.equal(status.authenticated, false);
  assert.equal((await api.request('/api/state', { cookie })).status, 401);
  const login = await api.login();
  assert.equal(login.status, 200);
  assert.equal((await api.request('/api/state', { cookie: sessionCookie(login) })).status, 200);
});

test('legacy guest saves can be claimed by email without leaking or resetting their progress', async (t) => {
  const api = await fixture(t);
  const token = 'a'.repeat(43);
  const legacy = `bozkurt_session=${token}`;
  const state = createGame(1_800_000_000_000);
  state.resources.wood += 17;
  const database = new DatabaseSync(api.dbPath);
  database
    .prepare(
      'INSERT INTO sessions (token_hash,state_json,revision,created_at,updated_at,expires_at) VALUES (?, ?, 0, ?, ?, ?)',
    )
    .run(
      createHash('sha256').update(token).digest('hex'),
      JSON.stringify(state),
      1_800_000_000_000,
      1_800_000_000_000,
      1_800_000_000_000 + 86_400_000,
    );
  database.close();
  assert.equal((await api.request('/api/state', { cookie: legacy })).status, 401);
  const registered = await api.register({}, { cookie: legacy });
  assert.equal(registered.status, 201);
  assert.equal((await api.request('/api/state', { cookie: legacy })).status, 401);
  assert.deepEqual(
    (await (await api.request('/api/state', { cookie: sessionCookie(registered) })).json()).state,
    state,
  );
});

test('concurrent password derivations are throttled and release their capacity afterwards', async (t) => {
  const api = await fixture(t);
  const responses = await Promise.all(
    Array.from({ length: 9 }, (_, index) => api.register({ email: `burst-${index}@example.com` })),
  );
  assert.ok(responses.some((response) => response.status === 429));
  assert.ok(responses.every((response) => [201, 429].includes(response.status)));
  assert.equal((await api.register({ email: 'after-burst@example.com' })).status, 201);
  assert.equal((await api.request('/api/health')).status, 200);
});

test('profile API rejects immutable fields, serves bounded image uploads and requires verified sessions', async (t) => {
  const api = await fixture(t),
    response = await api.register({ name: 'Emin Demirci' }),
    cookie = sessionCookie(response);
  const user = (await (await api.request('/api/player/profile', { cookie })).json()).user;
  assert.equal(user.fullName, 'Emin Demirci');
  assert.match(user.userCode, /^emindemirci#[0-9]{4}$/);
  for (const field of ['email', 'fullName', 'userCode']) {
    const rejected = await api.request('/api/player/profile', {
      method: 'POST',
      cookie,
      body: { [field]: 'other@example.com' },
    });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).error, 'unexpected_fields');
  }
  const avatarDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const updated = await api.request('/api/player/profile', {
    method: 'POST',
    cookie,
    body: { nickname: 'Yeni Reis', avatarDataUrl },
  });
  assert.equal(updated.status, 200);
  const changed = (await updated.json()).user;
  assert.equal(changed.email, user.email);
  assert.equal(changed.fullName, user.fullName);
  assert.equal(changed.userCode, user.userCode);
  assert.equal(changed.name, 'Yeni Reis');
  const image = await api.request(changed.avatarUrl, { cookie });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/gif');
  assert.equal((await image.arrayBuffer()).byteLength, 34);
  assert.equal((await api.request(changed.avatarUrl)).status, 401);
  const foreign = await api.request('/api/player/profile', {
    method: 'POST',
    cookie,
    body: { nickname: 'Attacker' },
    headers: { Origin: 'https://attacker.invalid' },
  });
  assert.equal(foreign.status, 403);
  const pending = await api.request('/api/auth/player/register', {
    method: 'POST',
    body: { email: 'pending@example.com', password: PASSWORD },
  });
  assert.equal(
    (await api.request('/api/player/profile', { cookie: sessionCookie(pending) })).status,
    403,
  );
  assert.equal(
    (await api.request('/api/player/friends', { cookie: sessionCookie(pending) })).status,
    403,
  );
  await api.restart();
  assert.deepEqual(
    (await (await api.request('/api/player/profile', { cookie })).json()).user,
    changed,
  );
});

test('changing a password requires the current secret, revokes other devices and preserves village progress', async (t) => {
  const api = await fixture(t),
    cookie = sessionCookie(await api.register()),
    other = sessionCookie(await api.login());
  const before = await (await api.request('/api/state', { cookie })).json();
  const next = 'Yeni ve guvenli parola 2026!';
  const rejected = await api.request('/api/auth/player/password/change', {
    method: 'POST',
    cookie,
    body: { currentPassword: 'wrong', password: next },
  });
  assert.equal(rejected.status, 401);
  assert.equal((await api.request('/api/state', { cookie: other })).status, 200);
  const changed = await api.request('/api/auth/player/password/change', {
    method: 'POST',
    cookie,
    body: { currentPassword: PASSWORD, password: next },
  });
  assert.equal(changed.status, 200);
  assert.equal((await api.request('/api/state', { cookie: other })).status, 401);
  assert.deepEqual(await (await api.request('/api/state', { cookie })).json(), before);
  assert.equal((await api.login()).status, 401);
  assert.equal((await api.login({ password: next })).status, 200);
});

test('accepted friendships and stone transfers persist across API restart without overwriting recipient commands', async (t) => {
  const api = await fixture(t),
    alice = sessionCookie(await api.register({ name: 'Alice' })),
    bob = sessionCookie(await api.register({ email: 'bob@example.com', name: 'Bob' }));
  const a = (await (await api.request('/api/player/profile', { cookie: alice })).json()).user,
    b = (await (await api.request('/api/player/profile', { cookie: bob })).json()).user;
  assert.equal(
    (
      await api.request('/api/player/friends/request', {
        method: 'POST',
        cookie: alice,
        body: { userCode: b.userCode },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api.request('/api/player/friends/accept', {
        method: 'POST',
        cookie: bob,
        body: { userCode: a.userCode },
      })
    ).status,
    200,
  );
  const prior = await (await api.request('/api/state', { cookie: alice })).json();
  const recipientBefore = await (await api.request('/api/state', { cookie: bob })).json();
  const body = {
    userCode: b.userCode,
    amount: 40,
    revision: prior.revision,
    requestId: crypto.randomUUID(),
  };
  const sent = await api.request('/api/player/friends/transfer', {
    method: 'POST',
    cookie: alice,
    body,
  });
  assert.equal(sent.status, 200);
  const received = await (await api.request('/api/state', { cookie: bob })).json();
  assert.equal(received.state.resources.stone, recipientBefore.state.resources.stone + body.amount);
  const senderAfter = await sent.json();
  assert.equal(senderAfter.state.resources.stone, prior.state.resources.stone - body.amount);
  assert.equal(
    (
      await (
        await api.request('/api/player/friends/transfer', { method: 'POST', cookie: alice, body })
      ).json()
    ).duplicate,
    true,
  );
  const stale = await api.request('/api/action', {
    method: 'POST',
    cookie: bob,
    body: { action: { type: 'collect' }, revision: 0 },
  });
  assert.equal(stale.status, 409);
  await api.restart();
  const list = await (await api.request('/api/player/friends', { cookie: bob })).json();
  assert.equal(list.friends[0].userCode, a.userCode);
  assert.equal(list.transfers[0].amount, 40);
  assert.equal(list.transfers[0].sent, false);
});

test('pending verification code and failed-attempt count survive a server restart', async (t) => {
  const api = await fixture(t),
    response = await api.request('/api/auth/player/register', {
      method: 'POST',
      body: { email: 'restart@example.com', password: PASSWORD },
    }),
    cookie = sessionCookie(response);
  const code = /code: ([0-9]{6})/.exec(api.messages[0].text)[1],
    wrong = code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await api.request('/api/auth/player/verify/confirm', {
          method: 'POST',
          cookie,
          body: { code: wrong },
        })
      ).status,
      400,
    );
  await api.restart();
  const db = new DatabaseSync(api.dbPath);
  assert.equal(
    db.prepare('SELECT failed_attempts FROM email_verifications').get().failed_attempts,
    3,
  );
  db.close();
  assert.equal((await api.request('/api/state', { cookie })).status, 403);
  const confirmed = await api.request('/api/auth/player/verify/confirm', {
    method: 'POST',
    cookie,
    body: { code },
  });
  assert.equal(confirmed.status, 200);
  assert.equal((await api.request('/api/state', { cookie })).status, 200);
});

const RESET_PASSWORD = 'Yeni Ay-Yildiz sifrem 2026!';
const RESET_REQUEST = '/api/auth/player/password/reset/request';
const RESET_CONFIRM = '/api/auth/player/password/reset/confirm';

test('anonymous recovery revokes every device, preserves the village and clears failed-login locks', async (t) => {
  const api = await fixture(t);
  const first = sessionCookie(await api.register({ name: 'Kurt Reisi' }));
  const second = sessionCookie(await api.login());
  await api.request('/api/player/profile', {
    method: 'POST',
    cookie: first,
    body: { nickname: 'Bozkır Muhafızı' },
  });
  const initial = await (await api.request('/api/state', { cookie: first })).json();
  assert.equal(
    (
      await api.request('/api/action', {
        method: 'POST',
        cookie: first,
        body: { revision: initial.revision, action: { type: 'collect' } },
      })
    ).status,
    200,
  );
  const before = await (await api.request('/api/state', { cookie: first })).json();
  const profile = (await (await api.request('/api/player/profile', { cookie: first })).json()).user;
  for (let i = 0; i < 5; i++)
    assert.equal((await api.login({ password: 'wrong password' })).status, 401);
  assert.equal((await api.login()).status, 429);
  const requested = await api.request(RESET_REQUEST, {
    method: 'POST',
    body: { email: ' WOLF@EXAMPLE.COM ' },
  });
  assert.deepEqual(await requested.json(), { ok: true });
  const message = api.messages.findLast((mail) => mail.subject.includes('Reset your password'));
  const code = /code: ([0-9]{6})/.exec(message.text)[1];
  assert.ok(message.html.includes('cid:ayyildiz@bozkurtobasi'));
  assert.equal(message.from.address, 'info@bozkurtobasi.com');
  const confirmed = await api.request(RESET_CONFIRM, {
    method: 'POST',
    body: { email: 'wolf@example.com', code, password: RESET_PASSWORD },
  });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(await confirmed.json(), { ok: true });
  assert.equal(confirmed.headers.get('set-cookie'), null);
  for (const cookie of [first, second]) {
    assert.equal((await api.request('/api/state', { cookie })).status, 401);
    assert.equal(
      (await (await api.request('/api/auth/player/status', { cookie })).json()).authenticated,
      false,
    );
  }
  assert.equal((await api.login()).status, 401);
  const resumed = sessionCookie(await api.login({ password: RESET_PASSWORD }));
  assert.ok(resumed);
  assert.deepEqual(await (await api.request('/api/state', { cookie: resumed })).json(), before);
  assert.deepEqual(
    (await (await api.request('/api/player/profile', { cookie: resumed })).json()).user,
    profile,
  );
  assert.equal(
    (
      await api.request(RESET_CONFIRM, {
        method: 'POST',
        body: { email: 'wolf@example.com', code, password: PASSWORD },
      })
    ).status,
    400,
  );
});

test('recovery requests hide account existence, keep pending accounts locked and enforce origin and input checks', async (t) => {
  const api = await fixture(t);
  await api.register();
  const pending = await api.request('/api/auth/player/register', {
    method: 'POST',
    body: { email: 'pending@example.com', password: PASSWORD },
  });
  for (const email of [
    'wolf@example.com',
    'unknown@example.com',
    'pending@example.com',
    'wolf@example.com',
  ]) {
    const reply = await api.request(RESET_REQUEST, { method: 'POST', body: { email } });
    assert.equal(reply.status, 200);
    assert.deepEqual(await reply.json(), { ok: true });
    assert.equal(reply.headers.get('cache-control'), 'no-store');
  }
  assert.equal(
    api.messages.filter((mail) => mail.subject.includes('Reset your password')).length,
    1,
  );
  assert.equal((await api.request('/api/state', { cookie: sessionCookie(pending) })).status, 403);
  for (const [body, status] of [
    [{ email: 'bad' }, 400],
    [{ email: 'wolf@example.com', extra: true }, 400],
  ])
    assert.equal((await api.request(RESET_REQUEST, { method: 'POST', body })).status, status);
  assert.equal(
    (
      await api.request(RESET_REQUEST, {
        method: 'POST',
        headers: { Origin: 'https://other.example' },
        body: { email: 'wolf@example.com' },
      })
    ).status,
    403,
  );
  for (const code of ['000000', 123456, '12345']) {
    const reply = await api.request(RESET_CONFIRM, {
      method: 'POST',
      body: { email: 'unknown@example.com', code, password: RESET_PASSWORD },
    });
    assert.equal(reply.status, 400);
    assert.equal((await reply.json()).error, 'recovery_code_invalid');
  }
});

test('recovery delivery does not block its response or reveal SMTP failure and recovery requires configured mail', async (t) => {
  let release, captured;
  const sent = new Promise((resolve) => {
    release = resolve;
  });
  // A disabled provider reports the same global configuration status for every address.
  const separate = await fixture(t, { smtpPassword: '' });
  const unavailable = await separate.request(RESET_REQUEST, {
    method: 'POST',
    body: { email: 'wolf@example.com' },
  });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error, 'mail_unavailable');
  const delayed = await fixture(t, {
    mailSender: async (message) => {
      captured = message;
      if (message.subject.includes('Reset your password')) {
        await sent;
        throw new Error('Test SMTP failure');
      }
    },
  });
  const registration = await delayed.request('/api/auth/player/register', {
    method: 'POST',
    body: { email: 'wolf@example.com', password: PASSWORD },
  });
  await delayed.request('/api/auth/player/verify/confirm', {
    method: 'POST',
    cookie: sessionCookie(registration),
    body: { code: /code: ([0-9]{6})/.exec(captured.text)[1] },
  });
  try {
    const reply = await delayed.request(RESET_REQUEST, {
      method: 'POST',
      body: { email: 'wolf@example.com' },
    });
    assert.deepEqual(await reply.json(), { ok: true });
    assert.equal(
      (await delayed.request('/api/state', { cookie: sessionCookie(registration) })).status,
      200,
    );
  } finally {
    release();
  }
});

test('two recovery confirmations race safely and a registration code cannot change the password', async (t) => {
  const api = await fixture(t);
  const registered = await api.register();
  const verification = /code: ([0-9]{6})/.exec(api.messages[0].text)[1];
  await api.request(RESET_REQUEST, { method: 'POST', body: { email: 'wolf@example.com' } });
  const code = /code: ([0-9]{6})/.exec(api.messages.at(-1).text)[1];
  if (code !== verification) {
    assert.equal(
      (
        await api.request(RESET_CONFIRM, {
          method: 'POST',
          body: { email: 'wolf@example.com', code: verification, password: RESET_PASSWORD },
        })
      ).status,
      400,
    );
  }
  const replies = await Promise.all(
    [RESET_PASSWORD, 'Another valid new password 2026!'].map((password) =>
      api.request(RESET_CONFIRM, {
        method: 'POST',
        body: { email: 'wolf@example.com', code, password },
      }),
    ),
  );
  assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 400]);
  assert.equal(
    (await api.request('/api/state', { cookie: sessionCookie(registered) })).status,
    401,
  );
  assert.equal((await api.login()).status, 401);
});
