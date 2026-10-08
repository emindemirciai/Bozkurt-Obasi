import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/web/app.mjs';
import { createAuditStore } from '../server/web/audit.mjs';
import { createGame } from '../shared/game.mjs';

const ADMIN_PASSWORD = 'admin-test-password-123';
const PLAYER_PASSWORD = 'player-test-password-123';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-admin-management-'));
  const staticDir = join(root, 'public');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<title>Test</title>');
  let now = 1_800_000_000_000;
  const dbPath = join(root, 'game.sqlite');
  const app = createApp({
    dbPath,
    staticDir,
    clock: () => now,
    adminEmail: 'admin@example.test',
    adminPassword: ADMIN_PASSWORD,
  });
  const address = await app.listen();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  async function request(path, { method = 'GET', body, token, cookie } = {}) {
    return fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: ADMIN_PASSWORD },
  });
  assert.equal(login.status, 200);
  const token = (await login.json()).token;
  return {
    request,
    token,
    dbPath,
    now,
    setNow(value) {
      now = value;
    },
    async create(email, name) {
      const response = await request('/api/admin/users', {
        method: 'POST',
        token,
        body: { email, name, password: PLAYER_PASSWORD },
      });
      assert.equal(response.status, 201);
      return (await response.json()).user;
    },
  };
}

test('admin creates a pending normal player and can list, inspect, and audit it', async (t) => {
  const api = await fixture(t);
  assert.equal((await api.request('/api/admin/users')).status, 401);
  const user = await api.create('Kaya@Example.test', 'Kaya');
  assert.equal(user.email, 'kaya@example.test');
  assert.equal(user.createdAt, api.now);
  assert.equal(user.lastLoginAt, null);
  assert.equal(user.verified, false);
  assert.deepEqual(user.providers, ['email']);
  assert.equal(user.activeSessions, 0);
  assert.match(user.id, /^[0-9a-f-]{36}$/);
  assert.match(user.userCode, /^kaya#[0-9]+$/);

  const listed = await (
    await api.request(
      '/api/admin/users?query=kaya&verification=pending&provider=email&page=1&limit=5',
      { token: api.token },
    )
  ).json();
  assert.equal(listed.total, 1);
  assert.equal(listed.users[0].id, user.id);
  assert.equal(
    (
      await (
        await api.request('/api/admin/users?verification=verified', { token: api.token })
      ).json()
    ).total,
    0,
  );
  const detail = await (
    await api.request('/api/admin/users/' + user.id, { token: api.token })
  ).json();
  assert.equal(detail.user.villages[0].provider, 'email');
  assert.equal(detail.user.villages[0].regionId, 'homeland');
  assert.equal(detail.user.villages[0].herd, 24);
  assert.deepEqual(detail.user.sessions, []);

  const db = new DatabaseSync(api.dbPath);
  const account = db
    .prepare('SELECT password_hash,email_verified,last_login_at FROM email_accounts WHERE email=?')
    .get(user.email);
  assert.match(account.password_hash, /^scrypt-v1\$/);
  assert.equal(account.email_verified, 0);
  assert.equal(account.last_login_at, null);
  const storedToken = db.prepare('SELECT token_hash FROM admin_sessions').get().token_hash;
  assert.ok(!storedToken.includes(api.token));
  db.close();

  const playerLogin = await api.request('/api/auth/player/login', {
    method: 'POST',
    body: { email: user.email, password: PLAYER_PASSWORD },
  });
  assert.equal(playerLogin.status, 200);
  assert.deepEqual((await playerLogin.json()).verificationRequired, true);
  const overview = await (await api.request('/api/admin/overview', { token: api.token })).json();
  assert.equal(overview.totalUsers, 1);
  assert.equal(overview.verifiedUsers, 0);
  assert.equal(overview.pendingUsers, 1);
  assert.equal(overview.emailUsers, 1);
  const logs = await (
    await api.request('/api/admin/logs?action=admin.user.create&limit=10', { token: api.token })
  ).json();
  assert.equal(logs.total, 1);
  assert.equal(logs.logs[0].targetId, user.id);
  assert.equal(logs.logs[0].targetLabel, user.userCode);
  assert.ok(!JSON.stringify(logs).includes(PLAYER_PASSWORD));
});

test('wrong confirmation preserves records; full delete removes linked accounts, sessions and social rows', async (t) => {
  const api = await fixture(t);
  const alice = await api.create('alice@example.test', 'Alice');
  const bob = await api.create('bob@example.test', 'Bob');
  const db = new DatabaseSync(api.dbPath);
  db.prepare('UPDATE email_accounts SET email_verified=1 WHERE email=?').run(bob.email);
  const aliceAccount = db.prepare('SELECT sub FROM email_accounts WHERE email=?').get(alice.email);
  const bobBefore = db
    .prepare('SELECT state_json,revision FROM email_accounts WHERE email=?')
    .get(bob.email);
  const googleSub = 'google-test-sub-for-alice';
  db.prepare(
    `INSERT INTO google_accounts
    (sub,email,display_name,state_json,revision,created_at,updated_at,last_login_at)
    VALUES(?,?,?,?,0,?,?,?)`,
  ).run(
    googleSub,
    alice.email,
    'Alice Google',
    JSON.stringify(createGame(api.now)),
    api.now,
    api.now,
    api.now,
  );
  db.prepare('UPDATE email_accounts SET google_sub=?,email_verified=1 WHERE sub=?').run(
    googleSub,
    aliceAccount.sub,
  );
  db.prepare(
    `INSERT INTO sessions
    (token_hash,state_json,revision,created_at,updated_at,expires_at,account_sub,account_provider)
    VALUES(?,?,0,?,?,?,?,?)`,
  ).run(
    'a'.repeat(64),
    JSON.stringify(createGame(api.now)),
    api.now,
    api.now,
    api.now + 60_000,
    aliceAccount.sub,
    'email',
  );
  db.prepare(
    `INSERT INTO sessions
    (token_hash,state_json,revision,created_at,updated_at,expires_at,account_sub,account_provider)
    VALUES(?,?,0,?,?,?,?,?)`,
  ).run(
    'b'.repeat(64),
    JSON.stringify(createGame(api.now)),
    api.now,
    api.now,
    api.now + 60_000,
    googleSub,
    'google',
  );
  db.prepare(
    `INSERT INTO google_oauth_flows
    (state_hash,browser_hash,session_hash,nonce,verifier,redirect_uri,expires_at)
    VALUES(?,?,?,?,?,?,?)`,
  ).run(
    'flow-state',
    'browser-hash',
    'a'.repeat(64),
    'nonce',
    'verifier',
    'https://bozkurtobasi.com/api/auth/google/callback',
    api.now + 60_000,
  );
  db.prepare(
    `INSERT INTO email_verifications
    (email_sub,token_hash,issued_at,expires_at,window_start,window_count,salt,failed_attempts)
    VALUES(?,?,?,?,?,?,?,0)`,
  ).run(aliceAccount.sub, 'verification-hash', api.now, api.now + 60_000, api.now, 1, 'salt');
  db.prepare(
    `INSERT INTO password_recoveries
    (email_sub,token_hash,salt,password_hash,issued_at,expires_at,window_start,window_count,failed_attempts)
    VALUES(?,?,?,?,?,?,?,?,0)`,
  ).run(
    aliceAccount.sub,
    'recovery-hash',
    'salt',
    'old-password-hash',
    api.now,
    api.now + 60_000,
    api.now,
    1,
  );
  const ordered = [alice.id, bob.id].sort();
  db.prepare(
    'INSERT INTO friendships(first_id,second_id,sender_id,status,created_at) VALUES(?,?,?,?,?)',
  ).run(ordered[0], ordered[1], alice.id, 'accepted', api.now);
  db.prepare(
    'INSERT INTO stone_transfers(sender_id,request_id,recipient_id,amount,created_at) VALUES(?,?,?,?,?)',
  ).run(alice.id, 'transfer-one', bob.id, 25, api.now);
  db.close();

  const wrong = await api.request('/api/admin/users/' + alice.id, {
    method: 'DELETE',
    token: api.token,
    body: { confirmation: 'wrong#0000' },
  });
  assert.equal(wrong.status, 400);
  assert.equal((await wrong.json()).error, 'confirmation_required');
  const beforeDelete = await (
    await api.request('/api/admin/users/' + alice.id, {
      token: api.token,
    })
  ).json();
  assert.equal(beforeDelete.user.activeSessions, 2);
  assert.deepEqual(beforeDelete.user.providers, ['email', 'google']);
  assert.equal(beforeDelete.user.lastLoginAt, api.now);
  assert.equal(beforeDelete.user.villages.length, 2);

  const deleted = await api.request('/api/admin/users/' + alice.id, {
    method: 'DELETE',
    token: api.token,
    body: { confirmation: alice.userCode },
  });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deleted.accounts, 2);
  assert.equal(
    (
      await api.request('/api/admin/users/' + alice.id, {
        token: api.token,
      })
    ).status,
    404,
  );

  const check = new DatabaseSync(api.dbPath);
  for (const table of [
    'email_accounts',
    'google_accounts',
    'sessions',
    'email_verifications',
    'password_recoveries',
    'google_oauth_flows',
    'friendships',
    'stone_transfers',
  ]) {
    assert.equal(
      check.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
      table === 'email_accounts' ? 1 : 0,
      table,
    );
  }
  assert.equal(check.prepare('SELECT COUNT(*) AS count FROM player_profiles').get().count, 1);
  assert.deepEqual(
    check.prepare('SELECT state_json,revision FROM email_accounts WHERE email=?').get(bob.email),
    bobBefore,
  );
  const tombstone = check
    .prepare('SELECT sub_hash,deleted_at,expires_at FROM deleted_google_accounts')
    .get();
  assert.equal(tombstone.sub_hash, createHash('sha256').update(googleSub).digest('hex'));
  assert.equal(tombstone.deleted_at, api.now);
  assert.equal(tombstone.expires_at, api.now + 10 * 60_000);
  const rawAudit = JSON.stringify(check.prepare('SELECT * FROM audit_logs').all());
  assert.ok(!rawAudit.includes(alice.userCode));
  assert.ok(!rawAudit.includes(alice.email));
  assert.ok(!rawAudit.includes(alice.id));
  check.close();
  const bobLogin = await api.request('/api/auth/player/login', {
    method: 'POST',
    body: { email: bob.email, password: PLAYER_PASSWORD },
  });
  assert.equal(bobLogin.status, 200);
  const bobCookie = bobLogin.headers
    .getSetCookie()
    .find((value) => value.startsWith('bozkurt_session='))
    ?.split(';')[0];
  assert.ok(bobCookie);
  const bobFriends = await api.request('/api/player/friends', { cookie: bobCookie });
  assert.equal(bobFriends.status, 200);
  assert.deepEqual((await bobFriends.json()).friends, []);
  const bobState = await api.request('/api/state', { cookie: bobCookie });
  assert.equal(bobState.status, 200);
  assert.deepEqual(
    (await bobState.json()).state.resources,
    JSON.parse(bobBefore.state_json).resources,
  );
  const logs = await (
    await api.request('/api/admin/logs?action=admin.user.delete', { token: api.token })
  ).json();
  assert.equal(logs.total, 1);
  assert.equal(logs.logs[0].targetId, null);
  assert.equal(logs.logs[0].details.accounts, 2);
});

test('management filters, rejection audit, and pagination are bounded', async (t) => {
  const api = await fixture(t);
  await api.create('one@example.test', 'One');
  await api.create('two@example.test', 'Two');
  const page = await (
    await api.request('/api/admin/users?page=2&limit=1', { token: api.token })
  ).json();
  assert.equal(page.total, 2);
  assert.equal(page.users.length, 1);
  const duplicate = await api.request('/api/admin/users', {
    method: 'POST',
    token: api.token,
    body: { email: 'one@example.test', name: 'Duplicate', password: PLAYER_PASSWORD },
  });
  assert.equal(duplicate.status, 409);
  const failedLogs = await (
    await api.request('/api/admin/logs?action=admin.user.create_failed&level=warning', {
      token: api.token,
    })
  ).json();
  assert.equal(failedLogs.total, 1);
  assert.equal(failedLogs.logs[0].details.error, 'email_in_use');
  assert.equal(failedLogs.logs[0].details.status, 409);
  assert.ok(!JSON.stringify(failedLogs).includes(PLAYER_PASSWORD));
  for (const path of [
    '/api/admin/users?page=0',
    '/api/admin/users?limit=101',
    '/api/admin/users?provider=secret',
    '/api/admin/logs?level=secret',
  ]) {
    assert.equal((await api.request(path, { token: api.token })).status, 400, path);
  }
});

test('audit keeps at most 100000 entries and expires idle logs after 90 days', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const audit = createAuditStore(db);
  const at = 1_800_000_000_000;
  db.exec(`WITH RECURSIVE sequence(n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM sequence WHERE n < 100000
  ) INSERT INTO audit_logs(created_at,level,actor_type,actor,action,target_id,target_label,details_json)
    SELECT ${at},'info','system',NULL,'system.api_error',NULL,NULL,'{}' FROM sequence`);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit_logs').get().count, 100000);
  audit.record({
    at,
    level: 'error',
    action: 'system.api_error',
    details: { error: 'internal_error', secret: 'never-store-this' },
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit_logs').get().count, 100000);
  assert.equal(db.prepare('SELECT MIN(id) AS id FROM audit_logs').get().id, 2);
  const recent = audit.list({ now: at });
  assert.equal(recent.total, 100000);
  assert.deepEqual(recent.logs[0].details, { error: 'internal_error' });
  assert.equal(audit.list({ now: at + 90 * 24 * 60 * 60 * 1000 + 1 }).total, 0);
});
