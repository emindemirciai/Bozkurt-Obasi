import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createProfileStore } from '../server/web/profile.mjs';
import { createSocialStore } from '../server/web/social.mjs';
import { createGame, validateGame, applyAction } from '../shared/game.mjs';
class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE email_accounts(sub TEXT PRIMARY KEY,email TEXT,password_hash TEXT,google_sub TEXT,email_verified INTEGER,state_json TEXT,revision INTEGER,updated_at INTEGER);
 CREATE TABLE google_accounts(sub TEXT PRIMARY KEY,email TEXT,state_json TEXT,revision INTEGER,updated_at INTEGER);`);
  const profiles = createProfileStore(db, { HttpError }),
    social = createSocialStore(db, { HttpError, profiles }),
    now = 1800000000000;
  for (const [id, name] of [
    ['alice', 'Ali'],
    ['bob', 'Bora'],
    ['charlie', 'Can'],
  ]) {
    profiles.ensure({ email: id + '@example.com', name }, now);
    db.prepare('INSERT INTO email_accounts VALUES(?,?,?,NULL,1,?,0,?)').run(
      id,
      id + '@example.com',
      'hash',
      JSON.stringify(createGame(now)),
      now,
    );
  }
  return { db, profiles, social, now, code: profiles.publicProfile('bob@example.com').userCode };
}
test('nickname edits never change email, legal name or friend code', (t) => {
  const { profiles, now } = fixture(t),
    before = profiles.publicProfile('alice@example.com');
  const after = profiles.update(before.email, { nickname: 'Yeni Reis' }, now);
  assert.equal(after.name, 'Yeni Reis');
  assert.equal(after.fullName, before.fullName);
  assert.equal(after.userCode, before.userCode);
  for (const field of ['email', 'fullName', 'userCode'])
    assert.throws(
      () => profiles.update(before.email, { [field]: 'injected' }, now),
      /unexpected_fields/,
    );
  profiles.ensure({ email: before.email, name: 'Google changed name' }, now);
  assert.deepEqual(profiles.publicProfile(before.email), after);
});
test('custom photos override subsequent Google pictures; removal suppresses both', (t) => {
  const { profiles, now } = fixture(t),
    email = 'alice@example.com';
  profiles.ensure(
    { email, name: 'Alice', googlePicture: 'https://lh3.googleusercontent.com/a' },
    now,
  );
  assert.equal(profiles.publicProfile(email).avatarUrl, 'https://lh3.googleusercontent.com/a');
  const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const custom = profiles.update(email, { avatarDataUrl: gif }, now);
  assert.match(custom.avatarUrl, /api\/player\/avatar/);
  profiles.ensure(
    { email, name: 'Changed', googlePicture: 'https://lh3.googleusercontent.com/b' },
    now + 1,
  );
  assert.equal(profiles.publicProfile(email).avatarUrl, custom.avatarUrl);
  assert.equal(profiles.getAvatar(custom.userCode).mime, 'image/gif');
  assert.equal(profiles.update(email, { avatarDataUrl: null }, now).avatarUrl, null);
  for (const value of [
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,SGVsbG8=',
    'x'.repeat(3000000),
  ])
    assert.throws(() => profiles.update(email, { avatarDataUrl: value }, now), /invalid_avatar/);
});
test('friends must explicitly accept; self requests, duplicate requests and unsolicited gifts fail', (t) => {
  const { profiles, social, now, code } = fixture(t),
    mine = profiles.publicProfile('alice@example.com').userCode;
  assert.throws(() => social.request('alice@example.com', mine, now), /self_friend/);
  social.request('alice@example.com', code, now);
  assert.equal(social.list('bob@example.com').incoming[0].userCode, mine);
  assert.throws(() => social.request('bob@example.com', mine, now), /friend_exists/);
  assert.throws(() => social.accept('alice@example.com', code), /friend_request_required/);
  assert.throws(
    () =>
      social.transfer(
        'alice@example.com',
        { userCode: code, amount: 10, revision: 0, requestId: randomUUID() },
        now,
      ),
    /friend_required/,
  );
  social.accept('bob@example.com', mine);
  assert.equal(social.list('alice@example.com').friends.length, 1);
  assert.ok(!JSON.stringify(social.list('alice@example.com')).includes('@example.com'));
});
test('stone transfer conserves resources, increments both revisions and is idempotent', (t) => {
  const { db, profiles, social, now, code } = fixture(t);
  social.request('alice@example.com', code, now);
  social.accept('bob@example.com', profiles.publicProfile('alice@example.com').userCode);
  const body = { userCode: code, amount: 40, revision: 0, requestId: randomUUID() },
    receipt = social.transfer('alice@example.com', body, now);
  assert.equal(receipt.state.resources.stone, 110);
  assert.equal(receipt.revision, 1);
  const recipient = db.prepare("SELECT * FROM email_accounts WHERE sub='bob'").get();
  assert.equal(JSON.parse(recipient.state_json).resources.stone, 190);
  assert.equal(recipient.revision, 1);
  assert.ok(validateGame(JSON.parse(recipient.state_json)));
  assert.equal(social.transfer('alice@example.com', body, now).duplicate, true);
  assert.throws(
    () => social.transfer('alice@example.com', { ...body, amount: 41 }, now),
    /transfer_conflict/,
  );
  assert.throws(
    () => social.transfer('alice@example.com', { ...body, requestId: randomUUID() }, now),
    /stale_revision/,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stone_transfers').get().count, 1);
});
test('failed transfers roll back both villages and capacity/amount checks prevent resource loss', (t) => {
  const { db, profiles, social, now, code } = fixture(t);
  social.request('alice@example.com', code, now);
  social.accept('bob@example.com', profiles.publicProfile('alice@example.com').userCode);
  const before = db.prepare('SELECT * FROM email_accounts').all(),
    body = { userCode: code, amount: 151, revision: 0, requestId: randomUUID() };
  assert.throws(() => social.transfer('alice@example.com', body, now), /insufficient_stone/);
  assert.deepEqual(db.prepare('SELECT * FROM email_accounts').all(), before);
  const state = createGame(now);
  state.resources.stone = 499;
  db.prepare("UPDATE email_accounts SET state_json=? WHERE sub='bob'").run(JSON.stringify(state));
  assert.throws(
    () => social.transfer('alice@example.com', { ...body, amount: 2 }, now),
    /recipient_storage_full/,
  );
  for (const amount of [-1, 0, 1.5, 10001])
    assert.throws(
      () => social.transfer('alice@example.com', { ...body, amount }, now),
      /invalid_transfer/,
    );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stone_transfers').get().count, 0);
});

test('a gift never abandons either player’s active battle', (t) => {
  const { db, profiles, social, now, code } = fixture(t);
  social.request('alice@example.com', code, now);
  social.accept('bob@example.com', profiles.publicProfile('alice@example.com').userCode);
  const battling = createGame(now);
  applyAction(battling, { type: 'startBattle' }, now);
  db.prepare('UPDATE email_accounts SET state_json=?').run(JSON.stringify(battling));
  social.transfer(
    'alice@example.com',
    { userCode: code, amount: 10, revision: 0, requestId: randomUUID() },
    now,
  );
  for (const row of db
    .prepare('SELECT state_json FROM email_accounts WHERE sub IN (?,?)')
    .all('alice', 'bob')) {
    const state = JSON.parse(row.state_json);
    assert.equal(state.battle.status, 'active');
    assert.deepEqual(state.battle, battling.battle);
  }
});
