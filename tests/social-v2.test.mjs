import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProfileStore } from '../server/web/profile.mjs';
import { createSocialStore } from '../server/web/social.mjs';
import { createApp } from '../server/web/app.mjs';
import { createGame, validateGame } from '../shared/game.mjs';
import { createGame as createLegacyGame } from '../shared/legacy-v1.mjs';

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const NOW = 1_800_000_000_000;
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE email_accounts(sub TEXT PRIMARY KEY,email TEXT,password_hash TEXT,google_sub TEXT,email_verified INTEGER,state_json TEXT,revision INTEGER,updated_at INTEGER);
    CREATE TABLE google_accounts(sub TEXT PRIMARY KEY,email TEXT,state_json TEXT,revision INTEGER,updated_at INTEGER);`);
  const profiles = createProfileStore(db, { HttpError });
  const social = createSocialStore(db, { HttpError, profiles });
  const codes = {};
  for (const id of ['alice', 'bob', 'charlie']) {
    profiles.ensure({ email: id + '@example.test', name: id }, NOW);
    codes[id] = profiles.publicProfile(id + '@example.test').userCode;
    const state = createGame(NOW);
    state.inventory.iron_guard = 3;
    db.prepare('INSERT INTO email_accounts VALUES(?,?,?,NULL,1,?,0,?)').run(
      id,
      id + '@example.test',
      'hash',
      JSON.stringify(state),
      NOW,
    );
  }
  function befriend(a = 'alice', b = 'bob') {
    social.request(a + '@example.test', codes[b], NOW);
    social.accept(b + '@example.test', codes[a]);
  }
  const snapshot = () => db.prepare('SELECT * FROM email_accounts ORDER BY sub').all();
  return { db, profiles, social, codes, befriend, snapshot };
}
const giftBody = (code, extra = {}) => ({
  userCode: code,
  kind: 'resource',
  assetId: 'wood',
  amount: 25,
  revision: 0,
  requestId: randomUUID(),
  ...extra,
});
test('private messages require accepted friendship, preserve plaintext and never expose other conversations', (t) => {
  const { social, codes, befriend } = fixture(t);
  const body = {
    userCode: codes.bob,
    body: ' <img src=x onerror=alert(1)>\nMerhaba! ',
    requestId: randomUUID(),
  };
  assert.throws(() => social.sendMessage('alice@example.test', body, NOW), /friend_required/);
  social.request('alice@example.test', codes.bob, NOW);
  assert.throws(
    () => social.conversation('alice@example.test', { userCode: codes.bob }),
    /friend_required/,
  );
  social.accept('bob@example.test', codes.alice);
  const sent = social.sendMessage('alice@example.test', body, NOW);
  assert.equal(sent.message.body, body.body.trim());
  assert.equal(social.sendMessage('alice@example.test', body, NOW).duplicate, true);
  assert.throws(
    () => social.sendMessage('alice@example.test', { ...body, body: 'Changed' }, NOW),
    /message_conflict/,
  );
  const received = social.conversation('bob@example.test', { userCode: codes.alice });
  assert.deepEqual(received.messages, [{ ...sent.message, sent: false }]);
  assert.equal(received.nextBefore, null);
  assert.ok(!JSON.stringify(received).includes('@example.test'));
  befriend('alice', 'charlie');
  assert.deepEqual(
    social.conversation('charlie@example.test', { userCode: codes.alice }).messages,
    [],
  );
  social.remove('alice@example.test', codes.bob);
  assert.throws(() => social.sendMessage('alice@example.test', body, NOW), /friend_required/);
  assert.throws(
    () => social.conversation('bob@example.test', { userCode: codes.alice }),
    /friend_required/,
  );
});
test('private messages use bounded chronological cursor pages and durable retry receipts', (t) => {
  const { db, profiles, social, codes, befriend } = fixture(t);
  befriend();
  const sent = [];
  for (let i = 0; i < 7; i++)
    sent.push(
      social.sendMessage(
        'alice@example.test',
        { userCode: codes.bob, body: `Message ${i}`, requestId: randomUUID() },
        NOW + i,
      ),
    );
  const latest = social.conversation('bob@example.test', { userCode: codes.alice, limit: 3 });
  assert.deepEqual(
    latest.messages.map((m) => m.body),
    ['Message 4', 'Message 5', 'Message 6'],
  );
  const older = social.conversation('bob@example.test', {
    userCode: codes.alice,
    limit: 3,
    before: latest.nextBefore,
  });
  assert.deepEqual(
    older.messages.map((m) => m.body),
    ['Message 1', 'Message 2', 'Message 3'],
  );
  const first = social.conversation('bob@example.test', {
    userCode: codes.alice,
    limit: 3,
    before: older.nextBefore,
  });
  assert.deepEqual(
    first.messages.map((m) => m.body),
    ['Message 0'],
  );
  assert.equal(first.nextBefore, null);
  assert.equal(
    new Set([...first.messages, ...older.messages, ...latest.messages].map((m) => m.id)).size,
    7,
  );
  for (const options of [{ limit: 0 }, { limit: 51 }, { before: 0 }, { before: 1.2 }])
    assert.throws(
      () => social.conversation('alice@example.test', { userCode: codes.bob, ...options }),
      /invalid_message_cursor/,
    );
  const restarted = createSocialStore(db, { HttpError, profiles });
  assert.equal(
    restarted.sendMessage(
      'alice@example.test',
      { userCode: codes.bob, body: 'Message 0', requestId: sent[0].requestId },
      NOW + 10,
    ).duplicate,
    true,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM private_messages').get().n, 7);
});
test('message size, controls and sender rate limits reject invalid writes without losing successful messages', (t) => {
  const { db, social, codes, befriend } = fixture(t);
  befriend();
  for (const body of ['', '  ', 'x'.repeat(1001), 'test\0bad', 42])
    assert.throws(
      () =>
        social.sendMessage(
          'alice@example.test',
          { userCode: codes.bob, body, requestId: randomUUID() },
          NOW,
        ),
      /invalid_message/,
    );
  let original;
  for (let i = 0; i < 30; i++) {
    const body = { userCode: codes.bob, body: 'Hello ' + i, requestId: randomUUID() };
    social.sendMessage('alice@example.test', body, NOW);
    if (i === 0) original = body;
  }
  assert.equal(social.sendMessage('alice@example.test', original, NOW).duplicate, true);
  const next = { userCode: codes.bob, body: 'Later', requestId: randomUUID() };
  assert.throws(
    () => social.sendMessage('alice@example.test', next, NOW + 59_999),
    /message_rate_limited/,
  );
  assert.equal(social.sendMessage('alice@example.test', next, NOW + 60_000).ok, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM private_messages').get().n, 31);
});
test('resource and unequipped item gifts conserve assets and reject stale or altered retries', (t) => {
  const { db, profiles, social, codes, befriend, snapshot } = fixture(t);
  const resource = giftBody(codes.bob);
  assert.throws(() => social.gift('alice@example.test', resource, NOW), /friend_required/);
  befriend();
  const initial = snapshot();
  const result = social.gift('alice@example.test', resource, NOW);
  assert.equal(result.state.resources.wood, JSON.parse(initial[0].state_json).resources.wood - 25);
  const recipient = JSON.parse(snapshot()[1].state_json);
  assert.equal(recipient.resources.wood, JSON.parse(initial[1].state_json).resources.wood + 25);
  assert.equal(result.revision, 1);
  assert.equal(snapshot()[1].revision, 1);
  assert.ok(validateGame(recipient));
  assert.equal(social.gift('alice@example.test', resource, NOW).duplicate, true);
  assert.throws(
    () => social.gift('alice@example.test', { ...resource, amount: 26 }, NOW),
    /gift_conflict/,
  );
  assert.throws(
    () => social.gift('alice@example.test', { ...resource, assetId: 'stone' }, NOW),
    /gift_conflict/,
  );
  assert.throws(
    () => social.gift('alice@example.test', { ...resource, requestId: randomUUID() }, NOW),
    /stale_revision/,
  );
  const item = giftBody(codes.bob, { kind: 'item', assetId: 'iron_guard', amount: 2, revision: 1 });
  const after = social.gift('alice@example.test', item, NOW);
  assert.equal(after.state.inventory.iron_guard, 1);
  assert.equal(JSON.parse(snapshot()[1].state_json).inventory.iron_guard, 5);
  const restarted = createSocialStore(db, { HttpError, profiles });
  assert.equal(restarted.gift('alice@example.test', item, NOW).duplicate, true);
  assert.deepEqual(
    restarted.list('bob@example.test').gifts.map((g) => [g.sent, g.kind, g.assetId, g.amount]),
    [
      [false, 'item', 'iron_guard', 2],
      [false, 'resource', 'wood', 25],
    ],
  );
});
test('gift failures roll back both accounts and receipts, including a failure on the second village write', (t) => {
  const { db, social, codes, befriend, snapshot } = fixture(t);
  befriend();
  const recipient = createGame(NOW);
  recipient.resources.wood = recipient.capacity - 50;
  db.prepare("UPDATE email_accounts SET state_json=? WHERE sub='bob'").run(
    JSON.stringify(recipient),
  );
  const before = snapshot();
  for (const extra of [
    { amount: 0 },
    { amount: 10001 },
    { amount: 1.2 },
    { kind: 'wrong' },
    { assetId: '__proto__' },
    { kind: 'item', assetId: 'unknown' },
    { revision: -1 },
    { requestId: 'bad' },
  ])
    assert.throws(
      () => social.gift('alice@example.test', giftBody(codes.bob, extra), NOW),
      /invalid_gift/,
    );
  assert.throws(
    () =>
      social.gift(
        'alice@example.test',
        giftBody(codes.bob, { kind: 'item', assetId: 'iron_guard', amount: 4 }),
        NOW,
      ),
    /insufficient_gift/,
  );
  assert.throws(
    () => social.gift('alice@example.test', giftBody(codes.bob, { amount: 51 }), NOW),
    /recipient_storage_full/,
  );
  assert.deepEqual(snapshot(), before);
  db.exec(
    "CREATE TRIGGER reject_recipient BEFORE UPDATE ON email_accounts WHEN OLD.sub='bob' BEGIN SELECT RAISE(ABORT,'recipient_write_failed'); END;",
  );
  assert.throws(
    () => social.gift('alice@example.test', giftBody(codes.bob), NOW),
    /recipient_write_failed/,
  );
  assert.deepEqual(snapshot(), before);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_gifts').get().n, 0);
});
test('gifts migrate legacy saves and resolve linked Google villages without mutating the obsolete email copy', (t) => {
  const { db, social, codes, befriend } = fixture(t);
  befriend();
  const legacy = createLegacyGame(NOW);
  db.prepare(
    "UPDATE email_accounts SET state_json=?,google_sub='google-alice' WHERE sub='alice'",
  ).run(JSON.stringify(legacy));
  db.prepare('INSERT INTO google_accounts VALUES(?,?,?,?,?)').run(
    'google-alice',
    'alice@example.test',
    JSON.stringify(legacy),
    7,
    NOW,
  );
  db.prepare("UPDATE email_accounts SET state_json=? WHERE sub='bob'").run(JSON.stringify(legacy));
  const result = social.gift(
    'alice@example.test',
    giftBody(codes.bob, { assetId: 'stone', revision: 7 }),
    NOW,
  );
  assert.equal(result.revision, 8);
  assert.equal(result.state.version, 3);
  assert.equal(result.state.buildings.length, legacy.buildings.length);
  assert.deepEqual(
    JSON.parse(
      db.prepare("SELECT state_json FROM email_accounts WHERE sub='alice'").get().state_json,
    ),
    legacy,
  );
  const bob = JSON.parse(
    db.prepare("SELECT state_json FROM email_accounts WHERE sub='bob'").get().state_json,
  );
  assert.equal(bob.version, 3);
  assert.equal(bob.resources.stone, legacy.resources.stone + 25);
  assert.ok(validateGame(bob));
});

async function apiFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-social-v2-'));
  const staticDir = join(root, 'public');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<title>Test</title>');
  const messages = [];
  const settings = {
    dbPath: join(root, 'game.sqlite'),
    staticDir,
    clock: () => NOW,
    adminEmail: 'admin@example.test',
    adminPassword: 'admin-test-password-123',
    mailProvider: 'smtp',
    smtpHost: 'smtp.example.test',
    smtpPort: '465',
    smtpSecure: 'true',
    smtpUser: 'info@bozkurtobasi.com',
    smtpPassword: 'test-only-secret',
    publicUrl: 'https://bozkurtobasi.com',
    mailSender: async (message) => messages.push(message),
    googleClientId: '',
    googleClientSecret: '',
  };
  let app = createApp(settings),
    address = await app.listen(),
    base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  async function request(path, { method = 'GET', body, cookie, token, headers = {} } = {}) {
    return fetch(base + path, {
      method,
      headers: {
        Connection: 'close',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function register(id) {
    const response = await request('/api/auth/player/register', {
      method: 'POST',
      body: { email: id + '@example.test', name: id, password: 'player-test-password-123' },
    });
    assert.equal(response.status, 201);
    const cookie = response.headers
      .getSetCookie()
      .find((v) => v.startsWith('bozkurt_session='))
      .split(';')[0];
    const mail = messages.findLast((m) => m.to === id + '@example.test');
    const verified = await request('/api/auth/player/verify/confirm', {
      method: 'POST',
      cookie,
      body: { code: /code: ([0-9]{6})/.exec(mail.text)[1] },
    });
    assert.equal(verified.status, 200);
    const { user } = await (await request('/api/player/profile', { cookie })).json();
    return { cookie, user };
  }
  return {
    request,
    register,
    dbPath: settings.dbPath,
    async restart() {
      await app.close();
      app = createApp(settings);
      address = await app.listen();
      base = `http://127.0.0.1:${address.port}`;
    },
  };
}
test('message and gift HTTP routes protect sessions, enforce request fields, persist across restart and audit without message text', async (t) => {
  const api = await apiFixture(t),
    alice = await api.register('alice'),
    bob = await api.register('bob');
  assert.equal(
    (
      await api.request(
        '/api/player/friends/messages?userCode=' + encodeURIComponent(bob.user.userCode),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await api.request('/api/player/friends/request', {
        method: 'POST',
        cookie: alice.cookie,
        body: { userCode: bob.user.userCode },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api.request('/api/player/friends/accept', {
        method: 'POST',
        cookie: bob.cookie,
        body: { userCode: alice.user.userCode },
      })
    ).status,
    200,
  );
  const body = {
    userCode: bob.user.userCode,
    body: 'Özel mesaj <strong>metin</strong>',
    requestId: randomUUID(),
  };
  assert.equal(
    (
      await api.request('/api/player/friends/messages', {
        method: 'POST',
        cookie: alice.cookie,
        body: { ...body, recipientEmail: 'bad@example.test' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api.request('/api/player/friends/messages', {
        method: 'POST',
        cookie: alice.cookie,
        body,
        headers: { Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
  const posted = await api.request('/api/player/friends/messages', {
    method: 'POST',
    cookie: alice.cookie,
    body,
  });
  assert.equal(posted.status, 200);
  const state = await (await api.request('/api/state', { cookie: alice.cookie })).json();
  const gift = giftBody(bob.user.userCode, {
    assetId: 'stone',
    amount: 10,
    revision: state.revision,
  });
  const delivered = await api.request('/api/player/friends/gift', {
    method: 'POST',
    cookie: alice.cookie,
    body: gift,
  });
  assert.equal(delivered.status, 200);
  assert.equal((await delivered.json()).state.resources.stone, state.state.resources.stone - 10);
  await api.restart();
  const conversation = await (
    await api.request(
      '/api/player/friends/messages?userCode=' + encodeURIComponent(alice.user.userCode),
      { cookie: bob.cookie },
    )
  ).json();
  assert.equal(conversation.messages[0].body, body.body);
  assert.equal(conversation.messages[0].sent, false);
  assert.equal(
    (
      await (
        await api.request('/api/player/friends/gift', {
          method: 'POST',
          cookie: alice.cookie,
          body: gift,
        })
      ).json()
    ).duplicate,
    true,
  );
  const db = new DatabaseSync(api.dbPath);
  const audit = db
    .prepare(
      "SELECT * FROM audit_logs WHERE action IN ('player.message_sent','player.asset_gifted')",
    )
    .all();
  db.close();
  assert.equal(audit.length, 2);
  assert.ok(!JSON.stringify(audit).includes(body.body));
  assert.deepEqual(JSON.parse(audit.find((r) => r.action === 'player.asset_gifted').details_json), {
    amount: 10,
    asset: 'stone',
    kind: 'resource',
  });
});
test('permanent admin deletion removes messages and gifts in both directions while preserving unrelated conversations', async (t) => {
  const api = await apiFixture(t),
    alice = await api.register('alice'),
    bob = await api.register('bob'),
    charlie = await api.register('charlie');
  for (const player of [alice, charlie]) {
    assert.equal(
      (
        await api.request('/api/player/friends/request', {
          method: 'POST',
          cookie: player.cookie,
          body: { userCode: bob.user.userCode },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api.request('/api/player/friends/accept', {
          method: 'POST',
          cookie: bob.cookie,
          body: { userCode: player.user.userCode },
        })
      ).status,
      200,
    );
  }
  for (const [from, to] of [
    [alice, bob],
    [bob, alice],
    [charlie, bob],
  ]) {
    assert.equal(
      (
        await api.request('/api/player/friends/messages', {
          method: 'POST',
          cookie: from.cookie,
          body: { userCode: to.user.userCode, body: 'Private hello', requestId: randomUUID() },
        })
      ).status,
      200,
    );
    const current = await (await api.request('/api/state', { cookie: from.cookie })).json();
    assert.equal(
      (
        await api.request('/api/player/friends/gift', {
          method: 'POST',
          cookie: from.cookie,
          body: giftBody(to.user.userCode, {
            assetId: 'stone',
            amount: 1,
            revision: current.revision,
          }),
        })
      ).status,
      200,
    );
  }
  const login = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'admin-test-password-123' },
  });
  const { token } = await login.json();
  const users = await (await api.request('/api/admin/users?query=alice', { token })).json();
  const removed = await api.request('/api/admin/users/' + users.users[0].id, {
    method: 'DELETE',
    token,
    body: { confirmation: alice.user.userCode },
  });
  assert.equal(removed.status, 200);
  const result = await removed.json();
  assert.equal(result.deleted.messages, 2);
  assert.equal(result.deleted.gifts, 2);
  const db = new DatabaseSync(api.dbPath);
  const messageCount = db.prepare('SELECT COUNT(*) AS n FROM private_messages').get().n;
  const giftCount = db.prepare('SELECT COUNT(*) AS n FROM asset_gifts').get().n;
  db.close();
  assert.equal(messageCount, 1);
  assert.equal(giftCount, 1);
  assert.equal((await api.request('/api/player/friends', { cookie: alice.cookie })).status, 401);
  const retained = await (
    await api.request(
      '/api/player/friends/messages?userCode=' + encodeURIComponent(charlie.user.userCode),
      { cookie: bob.cookie },
    )
  ).json();
  assert.equal(retained.messages.length, 1);
});
