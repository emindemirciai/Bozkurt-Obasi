import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { createApp } from '../server/web/app.mjs';
import { analyticsConfig } from '../server/web/analytics.mjs';
import { createGame, validateGame } from '../shared/game.mjs';
import {
  createGame as createLegacyGame,
  applyAction as applyLegacyAction,
} from '../shared/legacy-v1.mjs';

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
    body: {
      action: { type: 'build', building: 'quarry', plotId: 'p35' },
      revision: first.data.revision,
    },
  });
  assert.equal(action.status, 200);
  const changed = await action.json();
  assert.equal(changed.revision, 1);
  assert.notDeepEqual(changed.state, first.data.state);
  assert.equal(changed.state.version, 2);
  assert.deepEqual(changed.state.buildings, [
    { id: 'building-quarry', type: 'quarry', level: 1, x: 5, y: 5 },
  ]);

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
  assert.deepEqual(await unauthorized.json(), { error: 'account_session_required' });
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
  now += 8000;
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

test('a v1 account migrates once on read and retains its buildings and resources across restart', async (t) => {
  const api = await fixture(t);
  const session = await api.session();
  const legacy = createLegacyGame(100_000);
  applyLegacyAction(legacy, { type: 'build', building: 'quarry' }, 100_000);
  const database = new DatabaseSync(api.dbPath);
  database
    .prepare('UPDATE google_accounts SET state_json = ?, revision = 7')
    .run(JSON.stringify(legacy));
  database.close();
  const migratedResponse = await api.request('/api/state', { cookie: session.cookie });
  assert.equal(migratedResponse.status, 200);
  const migrated = await migratedResponse.json();
  assert.equal(migrated.state.version, 2);
  assert.equal(validateGame(migrated.state), true);
  assert.deepEqual(migrated.state.buildings, legacy.buildings);
  assert.deepEqual(migrated.state.resources, legacy.resources);
  assert.equal(migrated.revision, 8);
  await api.restart();
  const restored = await api.session(session.cookie);
  assert.deepEqual(restored.data.state, migrated.state);
  assert.equal(restored.data.revision, migrated.revision);
});

test('an expedition persists through restart and completes once for only its selected wolves', async (t) => {
  let now = 100_000;
  const api = await fixture(t, { clock: () => now });
  const session = await api.session();
  const response = await api.request('/api/action', {
    method: 'POST',
    cookie: session.cookie,
    body: {
      action: { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-scout'] },
      revision: session.data.revision,
    },
  });
  assert.equal(response.status, 200);
  const started = await response.json();
  assert.equal(started.state.adventure.active.kind, 'expedition');
  await api.restart();
  now = started.state.adventure.active.endsAt;
  const restored = await api.session(session.cookie);
  assert.equal(restored.data.state.adventure.active, null);
  assert.equal(restored.data.state.inventory.leather_vest, 1);
  assert.deepEqual(
    restored.data.state.wolves.map((w) => w.xp),
    [0, 0, 0, 30, 0],
  );
  assert.equal(validateGame(restored.data.state), true);
  const repeated = await (await api.request('/api/state', { cookie: session.cookie })).json();
  assert.deepEqual(repeated.state, restored.data.state);
  assert.equal(repeated.revision, restored.data.revision);
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
  const body = {
    action: { type: 'build', building: 'quarry', plotId: 'p0' },
    revision: guest.data.revision,
  };
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

// Recreate a saved, battle-damaged account in the fixture's disposable database.
async function herdAccount(api, { count = 20, pasture = true, resources = {} } = {}) {
  const session = await api.session();
  const state = structuredClone(session.data.state);
  state.herd = { count, hp: count * 10 - 60, maxHp: count * 10, panic: 35 };
  if (pasture)
    state.buildings.push({ id: 'building-pasture', type: 'pasture', level: 1, x: 0, y: 0 });
  Object.assign(state.resources, resources);
  assert.equal(validateGame(state), true);
  const token = session.cookie.slice('bozkurt_session='.length);
  const database = new DatabaseSync(api.dbPath);
  try {
    const saved = database
      .prepare(
        'UPDATE google_accounts SET state_json = ? WHERE sub = (SELECT account_sub FROM sessions WHERE token_hash = ?)',
      )
      .run(JSON.stringify(state), createHash('sha256').update(token).digest('hex'));
    assert.equal(saved.changes, 1);
  } finally {
    database.close();
  }
  return { cookie: session.cookie, state, revision: session.data.revision };
}

test('herd replenishment spends exactly the selected price, preserves injuries, and survives restart', async (t) => {
  const api = await fixture(t);
  const account = await herdAccount(api, { count: 19, resources: { water: 30, feed: 60 } });
  const other = await api.session();
  const response = await api.request('/api/action', {
    method: 'POST',
    cookie: account.cookie,
    body: { action: { type: 'replenishHerd', amount: 5 }, revision: account.revision },
  });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.revision, account.revision + 1);
  assert.deepEqual(saved.state.herd, { count: 24, hp: 180, maxHp: 240, panic: 35 });
  assert.deepEqual(saved.state.resources, { ...account.state.resources, water: 0, feed: 0 });
  assert.deepEqual(saved.state.wolves, account.state.wolves);
  assert.deepEqual(saved.state.buildings, account.state.buildings);
  assert.equal(saved.state.log.at(-1).key, 'herdReplenished');
  assert.equal(validateGame(saved.state), true);
  assert.deepEqual(
    (await (await api.request('/api/state', { cookie: other.cookie })).json()).state,
    other.data.state,
  );
  await api.restart();
  const restored = await api.session(account.cookie);
  assert.deepEqual(restored.data.state, saved.state);
  assert.equal(restored.data.revision, saved.revision);
});

test('herd replenishment requires an explicit integer quantity and rejects coercion without spending', async (t) => {
  const api = await fixture(t);
  const account = await herdAccount(api);
  for (const amount of [undefined, null, '2', true, 0, -1, 1.5, 6, {}, []]) {
    const response = await api.request('/api/action', {
      method: 'POST',
      cookie: account.cookie,
      body: { action: { type: 'replenishHerd', amount }, revision: account.revision },
    });
    assert.equal(response.status, 400, String(amount));
    assert.deepEqual(await response.json(), { error: 'INVALID_REPLENISH_AMOUNT' });
  }
  assert.deepEqual(await (await api.request('/api/state', { cookie: account.cookie })).json(), {
    state: account.state,
    revision: account.revision,
  });
});

test('herd replenishment requires a pasture and enforces the saved herd capacity', async (t) => {
  const api = await fixture(t);
  for (const [options, amount, error] of [
    [{ pasture: false }, 1, 'PASTURE_REQUIRED'],
    [{ count: 23 }, 2, 'HERD_LIMIT'],
    [{ count: 24 }, 1, 'HERD_FULL'],
  ]) {
    const account = await herdAccount(api, options);
    const response = await api.request('/api/action', {
      method: 'POST',
      cookie: account.cookie,
      body: { action: { type: 'replenishHerd', amount }, revision: account.revision },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error });
    assert.deepEqual(await (await api.request('/api/state', { cookie: account.cookie })).json(), {
      state: account.state,
      revision: account.revision,
    });
  }
});

test('herd replenishment never partially spends when the second resource is insufficient', async (t) => {
  const api = await fixture(t);
  const account = await herdAccount(api, { resources: { water: 100, feed: 23 } });
  const response = await api.request('/api/action', {
    method: 'POST',
    cookie: account.cookie,
    body: { action: { type: 'replenishHerd', amount: 2 }, revision: account.revision },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INSUFFICIENT_RESOURCES' });
  assert.deepEqual(await (await api.request('/api/state', { cookie: account.cookie })).json(), {
    state: account.state,
    revision: account.revision,
  });
});

test('concurrent herd replenishment and stale replay cannot spend or replenish twice', async (t) => {
  const api = await fixture(t);
  const account = await herdAccount(api);
  const body = { action: { type: 'replenishHerd', amount: 2 }, revision: account.revision };
  const responses = await Promise.all([
    api.request('/api/action', { method: 'POST', cookie: account.cookie, body }),
    api.request('/api/action', { method: 'POST', cookie: account.cookie, body }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const saved = await responses.find((response) => response.status === 200).json();
  assert.equal(saved.state.herd.count, 22);
  assert.equal(saved.state.resources.water, account.state.resources.water - 12);
  assert.equal(saved.state.resources.feed, account.state.resources.feed - 24);
  assert.equal(saved.revision, account.revision + 1);
  assert.deepEqual(await responses.find((response) => response.status === 409).json(), {
    error: 'stale_revision',
    ...saved,
  });
  const replay = await api.request('/api/action', { method: 'POST', cookie: account.cookie, body });
  assert.equal(replay.status, 409);
  assert.deepEqual(await replay.json(), { error: 'stale_revision', ...saved });
  assert.deepEqual(
    await (await api.request('/api/state', { cookie: account.cookie })).json(),
    saved,
  );
});

test('herd replenishment rejects missing and forged sessions without changing a player account', async (t) => {
  const api = await fixture(t);
  const account = await herdAccount(api);
  for (const cookie of [undefined, 'bozkurt_session=forged']) {
    const response = await api.request('/api/action', {
      method: 'POST',
      cookie,
      body: { action: { type: 'replenishHerd', amount: 1 }, revision: account.revision },
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'account_session_required' });
  }
  assert.deepEqual(await (await api.request('/api/state', { cookie: account.cookie })).json(), {
    state: account.state,
    revision: account.revision,
  });
});

test('v2.4 upgrades a v2 account once without changing village, old quests or balances', async (t) => {
  const api = await fixture(t);
  const session = await api.session();
  const previous = structuredClone(session.data.state);
  delete previous.firstWatch;
  previous.stats.gathers = 3;
  previous.quests.find((q) => q.id === 'gatherer').progress = 3;
  previous.quests.find((q) => q.id === 'gatherer').claimed = true;
  const database = new DatabaseSync(api.dbPath);
  database
    .prepare('UPDATE google_accounts SET state_json = ?, revision = 11')
    .run(JSON.stringify(previous));
  database.close();
  const response = await api.request('/api/state', { cookie: session.cookie });
  assert.equal(response.status, 200);
  const migrated = await response.json();
  const { firstWatch, ...preserved } = migrated.state;
  assert.deepEqual(preserved, previous);
  assert.equal(firstWatch.cohort, 'returning');
  assert.equal(firstWatch.milestones.gather, previous.updatedAt);
  assert.deepEqual(firstWatch.claims, []);
  assert.equal(migrated.revision, 12);
  await api.restart();
  const resumed = await api.session(session.cookie);
  assert.deepEqual(resumed.data, { ...migrated, mode: 'online' });
});

test('first-watch reward survives restart and cannot be repeated with stale or current revisions', async (t) => {
  const api = await fixture(t);
  const session = await api.session();
  const other = await api.session();
  const send = async (action, revision) => {
    const response = await api.request('/api/action', {
      method: 'POST',
      cookie: session.cookie,
      body: { action, revision },
    });
    return { status: response.status, data: await response.json() };
  };
  const locked = await send({ type: 'claimFirstWatch', id: 'build' }, session.data.revision);
  assert.equal(locked.status, 400);
  assert.equal(locked.data.error, 'FIRST_WATCH_LOCKED');
  const incomplete = await send({ type: 'claimFirstWatch', id: 'gather' }, session.data.revision);
  assert.equal(incomplete.data.error, 'FIRST_WATCH_INCOMPLETE');
  const collected = await send({ type: 'collect' }, session.data.revision);
  assert.equal(collected.status, 200);
  const claimed = await send({ type: 'claimFirstWatch', id: 'gather' }, collected.data.revision);
  assert.equal(claimed.status, 200);
  assert.equal(claimed.data.state.firstWatch.claims.length, 1);
  const stale = await send({ type: 'claimFirstWatch', id: 'gather' }, collected.data.revision);
  assert.equal(stale.status, 409);
  const duplicate = await send({ type: 'claimFirstWatch', id: 'gather' }, claimed.data.revision);
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.data.error, 'FIRST_WATCH_CLAIMED');
  const otherState = await (await api.request('/api/state', { cookie: other.cookie })).json();
  assert.equal(otherState.state.firstWatch.milestones.gather, null);
  assert.deepEqual(otherState.state.firstWatch.claims, []);
  await api.restart();
  const resumed = await api.session(session.cookie);
  assert.deepEqual(resumed.data.state, claimed.data.state);
  assert.equal(resumed.data.revision, claimed.data.revision);
});

test('a full store blocks all first-watch reward mutations until space exists', async (t) => {
  const api = await fixture(t);
  const session = await api.session();
  const full = structuredClone(session.data.state);
  full.stats.gathers = 1;
  full.quests.find((q) => q.id === 'gatherer').progress = 1;
  full.firstWatch.milestones.gather = full.updatedAt;
  for (const key of Object.keys(full.resources)) full.resources[key] = full.capacity;
  const database = new DatabaseSync(api.dbPath);
  database.prepare('UPDATE google_accounts SET state_json = ?').run(JSON.stringify(full));
  database.close();
  const response = await api.request('/api/action', {
    method: 'POST',
    cookie: session.cookie,
    body: { action: { type: 'claimFirstWatch', id: 'gather' }, revision: session.data.revision },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'FIRST_WATCH_STORAGE_FULL');
  const persisted = await (await api.request('/api/state', { cookie: session.cookie })).json();
  assert.deepEqual(persisted.state, full);
  assert.equal(persisted.revision, session.data.revision);
});

test('battle orders persist across API restart, reject replay and remain isolated by account', async (t) => {
  let now = 100_000;
  const api = await fixture(t, { clock: () => now });
  const player = await api.session();
  const other = await api.session();
  const send = async (action, revision) => {
    const response = await api.request('/api/action', {
      method: 'POST',
      cookie: player.cookie,
      body: { action, revision },
    });
    return { status: response.status, data: await response.json() };
  };
  const started = await send({ type: 'startBattle' }, player.data.revision);
  assert.equal(started.status, 200);
  const early = await send({ type: 'battleCommand', id: 'brace' }, started.data.revision);
  assert.equal(early.data.error, 'BATTLE_COMMAND_INTRO');
  now += 6000;
  const ready = await (await api.request('/api/state', { cookie: player.cookie })).json();
  const issued = await send({ type: 'battleCommand', id: 'brace' }, ready.revision);
  assert.equal(issued.status, 200);
  assert.deepEqual(issued.data.state.battle.commands, [{ id: 'brace', tick: 6 }]);
  assert.deepEqual(issued.data.state.resources, ready.state.resources);
  assert.equal(issued.data.revision, ready.revision + 1);
  const replay = await send({ type: 'battleCommand', id: 'brace' }, ready.revision);
  assert.equal(replay.status, 409);
  assert.deepEqual(replay.data, { error: 'stale_revision', ...issued.data });
  const freshReplay = await send({ type: 'battleCommand', id: 'focus' }, issued.data.revision);
  assert.equal(freshReplay.status, 400);
  assert.equal(freshReplay.data.error, 'BATTLE_COMMAND_COOLDOWN');
  await api.restart();
  assert.deepEqual(
    await (await api.request('/api/state', { cookie: player.cookie })).json(),
    issued.data,
  );
  const otherState = await (await api.request('/api/state', { cookie: other.cookie })).json();
  assert.equal(otherState.state.battle.status, 'preparing');
  assert.deepEqual(otherState.state.battle.commands, []);
  const resumed = await api.session(player.cookie);
  assert.equal(resumed.data.state.battle.status, 'preparing');
  assert.deepEqual(resumed.data.state.battle.commands, []);
  assert.deepEqual(resumed.data.state.wolves, issued.data.state.wolves);
  assert.deepEqual(resumed.data.state.firstWatch, issued.data.state.firstWatch);
});

test('simultaneous battle orders accept only one revision and rally cannot be replayed for panic reduction', async (t) => {
  let now = 100_000;
  const api = await fixture(t, { clock: () => now });
  const player = await api.session();
  const send = async (id, revision) => {
    const response = await api.request('/api/action', {
      method: 'POST',
      cookie: player.cookie,
      body: { action: { type: 'battleCommand', id }, revision },
    });
    return { status: response.status, data: await response.json() };
  };
  const started = await api.request('/api/action', {
    method: 'POST',
    cookie: player.cookie,
    body: { action: { type: 'startBattle' }, revision: player.data.revision },
  });
  assert.equal(started.status, 200);
  now += 7000;
  const ready = await (await api.request('/api/state', { cookie: player.cookie })).json();
  assert.ok(ready.state.herd.panic > 0);
  const responses = await Promise.all([
    send('rally', ready.revision),
    send('focus', ready.revision),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const accepted = responses.find((response) => response.status === 200).data;
  assert.equal(accepted.state.battle.commands.length, 1);
  assert.equal(accepted.revision, ready.revision + 1);
  if (accepted.state.battle.commands[0].id === 'rally') assert.equal(accepted.state.herd.panic, 0);
  else assert.equal(accepted.state.herd.panic, ready.state.herd.panic);
  const blocked = await send('rally', accepted.revision);
  assert.equal(blocked.data.error, 'BATTLE_COMMAND_COOLDOWN');
  assert.deepEqual(
    await (await api.request('/api/state', { cookie: player.cookie })).json(),
    accepted,
  );
});

test('battle order API rejects forged sessions, client effect overrides and invalid IDs without mutation', async (t) => {
  let now = 100_000;
  const api = await fixture(t, { clock: () => now });
  const player = await api.session();
  const started = await api.request('/api/action', {
    method: 'POST',
    cookie: player.cookie,
    body: { action: { type: 'startBattle' }, revision: player.data.revision },
  });
  assert.equal(started.status, 200);
  now += 6000;
  const ready = await (await api.request('/api/state', { cookie: player.cookie })).json();
  for (const cookie of [undefined, 'bozkurt_session=forged']) {
    const denied = await api.request('/api/action', {
      method: 'POST',
      cookie,
      body: { action: { type: 'battleCommand', id: 'focus' }, revision: ready.revision },
    });
    assert.equal(denied.status, 401);
  }
  for (const action of [
    { type: 'battleCommand', id: 'focus', tick: 90 },
    { type: 'battleCommand', id: 'brace', multiplier: 0 },
    { type: 'battleCommand', id: '__proto__' },
    { type: 'battleCommand', id: 1 },
    { type: 'battleCommand' },
  ]) {
    const rejected = await api.request('/api/action', {
      method: 'POST',
      cookie: player.cookie,
      body: { action, revision: ready.revision },
    });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).error, 'INVALID_BATTLE_COMMAND');
  }
  assert.deepEqual(
    await (await api.request('/api/state', { cookie: player.cookie })).json(),
    ready,
  );
});

test('v2.4 battle saves gain only command history, once, while malformed history is never silently reset', async (t) => {
  const api = await fixture(t);
  const player = await api.session();
  const previous = structuredClone(player.data.state);
  delete previous.battle.commands;
  const database = new DatabaseSync(api.dbPath);
  database
    .prepare('UPDATE google_accounts SET state_json = ?, revision = 7')
    .run(JSON.stringify(previous));
  database.close();
  const migratedResponse = await api.request('/api/state', { cookie: player.cookie });
  assert.equal(migratedResponse.status, 200);
  const migrated = await migratedResponse.json();
  assert.deepEqual(migrated.state, { ...previous, battle: { ...previous.battle, commands: [] } });
  assert.equal(migrated.revision, 8);
  await api.restart();
  assert.deepEqual(
    await (await api.request('/api/state', { cookie: player.cookie })).json(),
    migrated,
  );
  const corrupt = structuredClone(previous);
  corrupt.battle.commands = [{ id: 'brace', tick: 1 }];
  const brokenDatabase = new DatabaseSync(api.dbPath);
  brokenDatabase.prepare('UPDATE google_accounts SET state_json = ?').run(JSON.stringify(corrupt));
  brokenDatabase.close();
  const rejected = await api.request('/api/state', { cookie: player.cookie });
  assert.equal(rejected.status, 500);
  assert.equal((await rejected.json()).error, 'internal_error');
  const verification = new DatabaseSync(api.dbPath);
  assert.equal(
    verification.prepare('SELECT state_json FROM google_accounts').get().state_json,
    JSON.stringify(corrupt),
  );
  verification.close();
});
