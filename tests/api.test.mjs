import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { createApp } from '../server/web/app.mjs';
import { analyticsConfig } from '../server/web/analytics.mjs';
import { createGame } from '../shared/game.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-api-'));
  const staticDir = join(root, 'public');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>Bozkurt test</title>');
  await writeFile(join(staticDir, 'app.js'), 'export const ready = true;');
  await writeFile(join(root, 'secret.txt'), 'private database credentials');
  const settings = {
    dbPath: join(root, 'game.sqlite'),
    staticDir,
    clock: () => 100_000,
    ...options,
  };
  let app = createApp(settings);
  let address = await app.listen();
  let base = `http://127.0.0.1:${address.port}`;
  let accounts = 0;
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    async request(path, { method = 'GET', cookie, body, headers = {} } = {}) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined
          ? {}
          : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      });
    },
    async session(cookie) {
      if (!cookie) {
        const token = randomBytes(32).toString('base64url');
        const sub = `api-test-${++accounts}`;
        const now = settings.clock();
        const state = JSON.stringify(createGame(now));
        const database = new DatabaseSync(settings.dbPath);
        database
          .prepare(
            'INSERT INTO google_accounts (sub, email, display_name, state_json, revision, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
          )
          .run(sub, `${sub}@example.com`, 'Player One', state, now, now);
        database
          .prepare(
            'INSERT INTO sessions (token_hash, state_json, revision, created_at, updated_at, expires_at, account_sub) VALUES (?, ?, 0, ?, ?, ?, ?)',
          )
          .run(
            createHash('sha256').update(token).digest('hex'),
            state,
            now,
            now,
            now + 86_400_000,
            sub,
          );
        database.close();
        cookie = `bozkurt_session=${token}`;
      }
      const response = await this.request('/api/session', { method: 'POST', body: {}, cookie });
      assert.equal(response.status, 200);
      return {
        cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie,
        data: await response.json(),
        response,
      };
    },
    async restart() {
      await app.close();
      app = createApp(settings);
      address = await app.listen();
      base = `http://127.0.0.1:${address.port}`;
    },
    get base() {
      return base;
    },
    get dbPath() {
      return settings.dbPath;
    },
  };
}

test('analytics remains disabled by default and ignores invalid settings without opt-in', () => {
  assert.deepEqual(analyticsConfig(), { enabled: false });
  assert.deepEqual(
    analyticsConfig({
      ANALYZE_ENABLED: 'false',
      ANALYZE_URL: 'http://invalid.example/path?secret=yes',
      ANALYZE_SITE_ID: 'INVALID SITE',
      ANALYZE_ALLOWED_ORIGINS: 'not-an-origin',
    }),
    { enabled: false },
  );
});

test('enabled analytics exposes only public config and adds its endpoint origin to CSP', async (t) => {
  const analytics = analyticsConfig({
    ANALYZE_ENABLED: 'true',
    ANALYZE_URL: 'https://analytics.example:8443',
    ANALYZE_SITE_ID: 'game.example',
    ANALYZE_ALLOWED_ORIGINS: 'https://game.example, https://www.game.example:9443/',
    ANALYZE_PRIVATE_TOKEN: 'must-not-leak',
  });
  assert.deepEqual(analytics, {
    enabled: true,
    endpoint: 'https://analytics.example:8443/api/track',
    site: 'game.example',
    allowedOrigins: ['https://game.example', 'https://www.game.example:9443'],
  });

  const api = await fixture(t, { analytics: { ...analytics, privateToken: 'must-not-leak' } });
  const response = await api.request('/api/config');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(
    response.headers.get('content-security-policy'),
    /connect-src 'self' https:\/\/analytics\.example:8443;/,
  );
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), { analytics });
  assert.doesNotMatch(body, /must-not-leak|privateToken|ANALYZE_PRIVATE_TOKEN/);
});

test('enabled analytics defaults are production-safe', () => {
  assert.deepEqual(analyticsConfig({ ANALYZE_ENABLED: 'true' }), {
    enabled: true,
    endpoint: 'https://analiz.bozkurtobasi.com/api/track',
    site: 'bozkurtobasi.com',
    allowedOrigins: ['https://bozkurtobasi.com', 'https://www.bozkurtobasi.com'],
  });
});

test('enabled analytics rejects unsafe or malformed environment values', () => {
  const enabled = { ANALYZE_ENABLED: 'true' };
  const invalid = [
    [{ ANALYZE_URL: 'http://analytics.example' }, /ANALYZE_URL.*HTTPS origin/],
    [{ ANALYZE_URL: 'https://user:pass@analytics.example' }, /ANALYZE_URL.*HTTPS origin/],
    [{ ANALYZE_URL: 'https://analytics.example/path' }, /ANALYZE_URL.*HTTPS origin/],
    [{ ANALYZE_URL: 'https://analytics.example?token=secret' }, /ANALYZE_URL.*HTTPS origin/],
    [{ ANALYZE_URL: 'https://analytics.example#fragment' }, /ANALYZE_URL.*HTTPS origin/],
    [{ ANALYZE_SITE_ID: 'Game.Example' }, /ANALYZE_SITE_ID.*lowercase/],
    [{ ANALYZE_SITE_ID: 'bad_site' }, /ANALYZE_SITE_ID.*lowercase/],
    [{ ANALYZE_SITE_ID: 'a'.repeat(129) }, /ANALYZE_SITE_ID.*128/],
    [{ ANALYZE_ALLOWED_ORIGINS: 'http://game.example' }, /ANALYZE_ALLOWED_ORIGINS.*HTTPS/],
    [{ ANALYZE_ALLOWED_ORIGINS: 'https://game.example/path' }, /ANALYZE_ALLOWED_ORIGINS.*HTTPS/],
    [
      {
        ANALYZE_ALLOWED_ORIGINS: Array.from(
          { length: 11 },
          (_, index) => `https://${index}.example`,
        ).join(','),
      },
      /ANALYZE_ALLOWED_ORIGINS.*1 and 10/,
    ],
  ];
  for (const [override, message] of invalid) {
    assert.throws(() => analyticsConfig({ ...enabled, ...override }), message);
  }
});

test('Google account session persists across restart and remains isolated from other accounts', async (t) => {
  const api = await fixture(t);
  const first = await api.session();
  const second = await api.session();
  assert.notEqual(first.cookie, second.cookie);
  assert.equal(first.data.mode, 'online');
  assert.equal(first.data.revision, 0);
  assert.equal(first.response.headers.get('set-cookie'), null);

  const action = await api.request('/api/action', {
    method: 'POST',
    cookie: first.cookie,
    body: { action: { type: 'build', building: 'quarry' }, revision: first.data.revision },
  });
  assert.equal(action.status, 200);
  const changed = await action.json();
  assert.equal(changed.revision, 1);
  assert.notDeepEqual(changed.state, first.data.state);

  const otherState = await api.request('/api/state', { cookie: second.cookie });
  assert.deepEqual((await otherState.json()).state, second.data.state);
  await api.restart();
  const resumed = await api.session(first.cookie);
  assert.deepEqual(resumed.data.state, changed.state);
  assert.equal(resumed.data.revision, changed.revision);
  assert.equal(resumed.response.headers.get('set-cookie'), null);
});

test('game endpoints require an authenticated account; clients cannot upload saves', async (t) => {
  const api = await fixture(t);
  const unauthorized = await api.request('/api/session', { method: 'POST', body: {} });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { error: 'google_session_required' });
  assert.equal((await api.request('/api/state')).status, 401);
  assert.equal((await api.request('/api/state', { cookie: 'bozkurt_session=forged' })).status, 401);
  const uploaded = await api.request('/api/session', {
    method: 'POST',
    body: { state: { resources: { gold: 9999999 } } },
  });
  assert.equal(uploaded.status, 400);
  assert.equal((await uploaded.json()).error, 'unexpected_fields');
});

test('resuming an interrupted battle preserves injuries and XP without replaying combat', async (t) => {
  let now = 100_000;
  const api = await fixture(t, { clock: () => now });
  const guest = await api.session();
  const started = await api.request('/api/action', {
    method: 'POST',
    cookie: guest.cookie,
    body: { action: { type: 'startBattle' }, revision: guest.data.revision },
  });
  assert.equal(started.status, 200);
  now += 4000;
  const running = await (await api.request('/api/state', { cookie: guest.cookie })).json();
  assert.equal(running.state.battle.status, 'active');
  assert.ok(running.state.wolves.some((wolf) => wolf.hp < wolf.maxHp));
  await api.restart();
  now += 60 * 60 * 1000;
  const resumed = await api.session(guest.cookie);
  assert.equal(resumed.data.state.battle.status, 'preparing');
  assert.equal(resumed.data.state.battle.wave, running.state.battle.wave);
  assert.deepEqual(resumed.data.state.wolves, running.state.wolves);
  assert.deepEqual(resumed.data.state.herd, running.state.herd);
  assert.equal(resumed.data.state.stats.wins, running.state.stats.wins);
  assert.equal(resumed.data.state.battle.tick, 0);
  assert.ok(resumed.data.state.battle.enemies.every((enemy) => enemy.hp === enemy.maxHp));
});

test('invalid stored state is rejected instead of being accepted or silently reset', async (t) => {
  const api = await fixture(t);
  const guest = await api.session();
  const database = new DatabaseSync(api.dbPath);
  database
    .prepare('UPDATE google_accounts SET state_json = ?')
    .run(JSON.stringify({ version: 1, resources: { wood: -999 } }));
  database.close();
  const response = await api.request('/api/state', { cookie: guest.cookie });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'internal_error' });
});

test('same origin and JSON guards block cross-site state mutations', async (t) => {
  const api = await fixture(t);
  const foreign = await api.request('/api/session', {
    method: 'POST',
    body: {},
    headers: { Origin: 'https://attacker.invalid' },
  });
  assert.equal(foreign.status, 403);
  assert.equal((await foreign.json()).error, 'origin_rejected');
  const forged = await api.request('/api/session', {
    method: 'POST',
    body: {},
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(forged.status, 403);
  const plain = await api.request('/api/session', {
    method: 'POST',
    body: '{}',
    headers: { 'Content-Type': 'text/plain' },
  });
  assert.equal(plain.status, 415);
  const valid = await api.request('/api/session', {
    method: 'POST',
    body: {},
    cookie: (await api.session()).cookie,
    headers: { Origin: api.base },
  });
  assert.equal(valid.status, 200);
});

test('trusted proxy headers never create a guest gameplay cookie', async (t) => {
  const api = await fixture(t, { trustProxy: true });
  const response = await api.request('/api/session', {
    method: 'POST',
    body: {},
    headers: {
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Host': 'game.example',
      Origin: 'https://game.example',
    },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('stale revisions cannot overwrite a newer action', async (t) => {
  const api = await fixture(t);
  const guest = await api.session();
  const body = { action: { type: 'build', building: 'quarry' }, revision: guest.data.revision };
  const first = await api.request('/api/action', { method: 'POST', cookie: guest.cookie, body });
  assert.equal(first.status, 200);
  const expected = await first.json();
  const stale = await api.request('/api/action', { method: 'POST', cookie: guest.cookie, body });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'stale_revision', ...expected });
});

test('invalid action and malformed payload never change saved state', async (t) => {
  const api = await fixture(t);
  const guest = await api.session();
  const invalid = await api.request('/api/action', {
    method: 'POST',
    cookie: guest.cookie,
    body: { action: { type: 'invent_gold' }, revision: guest.data.revision },
  });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /^[A-Za-z][A-Za-z0-9_]+$/);
  const missingRevision = await api.request('/api/action', {
    method: 'POST',
    cookie: guest.cookie,
    body: { action: { type: 'collect' } },
  });
  assert.equal(missingRevision.status, 400);
  const malformed = await api.request('/api/action', {
    method: 'POST',
    cookie: guest.cookie,
    body: '{',
  });
  assert.equal(malformed.status, 400);
  const large = await api.request('/api/action', {
    method: 'POST',
    cookie: guest.cookie,
    body: JSON.stringify({ padding: 'x'.repeat(20_000) }),
  });
  assert.equal(large.status, 413);
  const current = await api.request('/api/state', { cookie: guest.cookie });
  assert.deepEqual(await current.json(), {
    state: guest.data.state,
    revision: guest.data.revision,
  });
});

test('SPA fallback serves only public files and exposes security headers', async (t) => {
  const api = await fixture(t);
  const page = await api.request('/village', { headers: { Accept: 'text/html' } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Bozkurt test/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const script = await api.request('/app.js');
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal(
    (await api.request('/missing.js', { headers: { Accept: 'text/html' } })).status,
    404,
  );
  assert.equal((await api.request('/%2eenv')).status, 404);
  assert.equal((await api.request('/..%5Csecret.txt')).status, 404);
  assert.equal((await api.request('/server/web/index.mjs')).status, 404);
  assert.equal(
    (await api.request('/api/unknown', { headers: { Accept: 'text/html' } })).status,
    404,
  );
  assert.equal((await api.request('/api/state', { method: 'POST', body: {} })).status, 405);
  const health = await api.request('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
});

test('rate limiting rejects excessive API traffic without breaking health probes', async (t) => {
  const api = await fixture(t, { rateLimit: 2 });
  await api.request('/api/state');
  await api.request('/api/state');
  const limited = await api.request('/api/state');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal((await limited.json()).error, 'rate_limited');
  assert.equal((await api.request('/api/health')).status, 200);
});
