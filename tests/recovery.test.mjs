import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRecoveryStore } from '../server/web/recovery.mjs';
import { createMailService, mailConfig } from '../server/web/mail.mjs';
import { createProfileStore } from '../server/web/profile.mjs';
import { createSocialStore } from '../server/web/social.mjs';
import { createGame } from '../shared/game.mjs';

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'bozkurt-recovery-'));
  const path = join(root, 'accounts.sqlite');
  let db = new DatabaseSync(path);
  db.exec(`CREATE TABLE email_accounts(sub TEXT PRIMARY KEY,email TEXT UNIQUE,
    password_hash TEXT,google_sub TEXT,email_verified INTEGER,state_json TEXT,
    revision INTEGER,display_name TEXT,updated_at INTEGER);
    CREATE TABLE google_accounts(sub TEXT PRIMARY KEY,email TEXT,state_json TEXT,
      revision INTEGER,display_name TEXT,updated_at INTEGER);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,account_sub TEXT,account_provider TEXT);`);
  const now = 1_800_000_000_000;
  const state = JSON.stringify(createGame(now));
  for (const [sub, verified, google] of [
    ['alice', 1, null],
    ['bob', 1, 'google-bob'],
    ['pending', 0, null],
    ['unverified-linked', 0, 'google-unverified'],
  ])
    db.prepare('INSERT INTO email_accounts VALUES(?,?,?,?,?,?,?,?,?)').run(
      sub,
      `${sub}@example.com`,
      'old-password-hash',
      google,
      verified,
      state,
      7,
      sub,
      now,
    );
  db.prepare('INSERT INTO google_accounts VALUES(?,?,?,?,?,?)').run(
    'google-bob',
    'bob@example.com',
    state,
    23,
    'Bob',
    now,
  );
  db.prepare('INSERT INTO google_accounts VALUES(?,?,?,?,?,?)').run(
    'google-only',
    'google-only@example.com',
    state,
    5,
    'Google only',
    now,
  );
  const profiles = createProfileStore(db, { HttpError });
  createSocialStore(db, { HttpError, profiles });
  for (const sub of ['alice', 'bob'])
    profiles.ensure({ email: `${sub}@example.com`, name: sub }, now);
  const alice = profiles.getByEmail('alice@example.com');
  const bob = profiles.getByEmail('bob@example.com');
  db.prepare('INSERT INTO friendships VALUES(?,?,?,?,?)').run(
    ...[alice.id, bob.id].sort(),
    alice.id,
    'accepted',
    now,
  );
  db.prepare('INSERT INTO stone_transfers VALUES(?,?,?,?,?)').run(
    alice.id,
    '638e3b74-0b57-4c0f-bb2c-a8fab4ed94d8',
    bob.id,
    37,
    now,
  );
  for (const [token, sub, provider] of [
    ['alice-1', 'alice', 'email'],
    ['alice-2', 'alice', 'email'],
    ['bob-email', 'bob', 'email'],
    ['bob-google', 'google-bob', 'google'],
    ['google-only-session', 'google-only', 'google'],
    ['anonymous-session', null, 'google'],
  ])
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token, sub, provider);
  const messages = [];
  let mode = 'success';
  let delayed;
  const mail = {
    enabled: true,
    async sendPasswordReset(to, code) {
      if (mode === 'failure') throw new Error('private SMTP error');
      if (mode === 'false') return false;
      if (mode === 'delay') await new Promise((resolve) => (delayed = resolve));
      messages.push({ to, code });
      return true;
    },
  };
  let recovery = createRecoveryStore(db, { mail, HttpError });
  t.after(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    get db() {
      return db;
    },
    get recovery() {
      return recovery;
    },
    mail,
    messages,
    now,
    setMode(value) {
      mode = value;
    },
    releaseMail() {
      delayed();
    },
    restart() {
      db.close();
      db = new DatabaseSync(path);
      recovery = createRecoveryStore(db, { mail, HttpError });
    },
  };
}

function invalid(callback) {
  assert.throws(
    callback,
    (error) => error.status === 400 && error.code === 'recovery_code_invalid',
  );
}

test('recovery never reveals missing, unverified, Google-only, or unavailable SMTP accounts', async (t) => {
  const f = fixture(t);
  for (const email of [
    'absent@example.com',
    'pending@example.com',
    'unverified-linked@example.com',
    'google-only@example.com',
  ]) {
    assert.deepEqual(await f.recovery.request(email, f.now), { requested: true });
    invalid(() => f.recovery.confirm(email, '123456', 'old-password-hash', 'new-hash', f.now));
  }
  assert.equal(f.messages.length, 0);
  f.mail.enabled = false;
  assert.deepEqual(await f.recovery.request('alice@example.com', f.now), { requested: true });
  f.mail.enabled = true;
  f.setMode('failure');
  assert.deepEqual(await f.recovery.request('alice@example.com', f.now + 60_000), {
    requested: true,
  });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM password_recoveries').get().count, 0);
  assert.equal(
    f.db.prepare("SELECT email_verified FROM email_accounts WHERE sub='pending'").get()
      .email_verified,
    0,
  );
});

test('codes are salted, expire in 15 minutes, and persist without plaintext after restart', async (t) => {
  const f = fixture(t);
  await f.recovery.request('alice@example.com', f.now);
  const row = f.db.prepare("SELECT * FROM password_recoveries WHERE email_sub='alice'").get();
  const code = f.messages.at(-1).code;
  assert.match(code, /^[0-9]{6}$/);
  assert.match(row.salt, /^[0-9a-f]{48}$/);
  assert.match(row.token_hash, /^[0-9a-f]{64}$/);
  assert.equal(row.expires_at - row.issued_at, 900_000);
  assert.notEqual(row.token_hash, code);
  assert.ok(!Object.values(row).includes(code));
  f.restart();
  invalid(() =>
    f.recovery.confirm('alice@example.com', code, 'old-password-hash', 'new-hash', f.now + 900_000),
  );
  assert.equal(
    f.db.prepare("SELECT password_hash FROM email_accounts WHERE sub='alice'").get().password_hash,
    'old-password-hash',
  );
});

test('five wrong codes lock the challenge across restarts and leave credentials untouched', async (t) => {
  const f = fixture(t);
  await f.recovery.request('alice@example.com', f.now);
  const code = f.messages.at(-1).code;
  const wrong = code === '000000' ? '000001' : '000000';
  for (let attempt = 0; attempt < 5; attempt++)
    invalid(() =>
      f.recovery.confirm(
        'alice@example.com',
        wrong,
        'old-password-hash',
        'new-hash',
        f.now + attempt,
      ),
    );
  f.restart();
  assert.equal(
    f.db.prepare("SELECT failed_attempts FROM password_recoveries WHERE email_sub='alice'").get()
      .failed_attempts,
    5,
  );
  invalid(() =>
    f.recovery.confirm('alice@example.com', code, 'old-password-hash', 'new-hash', f.now + 10),
  );
  assert.equal(
    f.db.prepare("SELECT password_hash FROM email_accounts WHERE sub='alice'").get().password_hash,
    'old-password-hash',
  );
});

test('SMTP failures preserve the usable challenge and successful-send quota', async (t) => {
  const f = fixture(t);
  await f.recovery.request('alice@example.com', f.now);
  const before = f.db.prepare("SELECT * FROM password_recoveries WHERE email_sub='alice'").get();
  const code = f.messages.at(-1).code;
  f.setMode('failure');
  await f.recovery.request('alice@example.com', f.now + 60_000);
  assert.deepEqual(
    f.db.prepare("SELECT * FROM password_recoveries WHERE email_sub='alice'").get(),
    before,
  );
  assert.deepEqual(
    f.recovery.confirm('alice@example.com', code, 'old-password-hash', 'new-hash', f.now + 60_001),
    { reset: true },
  );
});

test('resend and daily quotas survive restarts and successful consumption', async (t) => {
  const f = fixture(t);
  await f.recovery.request('alice@example.com', f.now);
  f.restart();
  await f.recovery.request('alice@example.com', f.now + 59_999);
  assert.equal(f.messages.length, 1);
  f.recovery.confirm(
    'alice@example.com',
    f.messages[0].code,
    'old-password-hash',
    'new-hash',
    f.now + 100,
  );
  for (let i = 1; i <= 5; i++) {
    f.restart();
    await f.recovery.request('alice@example.com', f.now + i * 60_000);
  }
  assert.equal(f.messages.length, 5);
  assert.equal(
    f.db.prepare("SELECT window_count FROM password_recoveries WHERE email_sub='alice'").get()
      .window_count,
    5,
  );
  await f.recovery.request('alice@example.com', f.now + 86_400_000);
  assert.equal(f.messages.length, 6);
  assert.equal(
    f.db.prepare("SELECT window_count FROM password_recoveries WHERE email_sub='alice'").get()
      .window_count,
    1,
  );
});

test('linked account reset revokes every email and Google session while preserving all game and social data', async (t) => {
  const f = fixture(t);
  const emailBefore = f.db.prepare("SELECT * FROM email_accounts WHERE sub='bob'").get();
  const googleBefore = f.db.prepare('SELECT * FROM google_accounts').all();
  const profilesBefore = f.db.prepare('SELECT * FROM player_profiles').all();
  const friendsBefore = f.db.prepare('SELECT * FROM friendships').all();
  const transfersBefore = f.db.prepare('SELECT * FROM stone_transfers').all();
  await f.recovery.request('bob@example.com', f.now);
  const code = f.messages.at(-1).code;
  assert.deepEqual(
    f.recovery.confirm('bob@example.com', code, 'old-password-hash', 'changed-hash', f.now + 1),
    { reset: true },
  );
  const emailAfter = f.db.prepare("SELECT * FROM email_accounts WHERE sub='bob'").get();
  assert.deepEqual(
    { ...emailAfter },
    { ...emailBefore, password_hash: 'changed-hash', updated_at: f.now + 1 },
  );
  assert.deepEqual(f.db.prepare('SELECT * FROM google_accounts').all(), googleBefore);
  assert.deepEqual(f.db.prepare('SELECT * FROM player_profiles').all(), profilesBefore);
  assert.deepEqual(f.db.prepare('SELECT * FROM friendships').all(), friendsBefore);
  assert.deepEqual(f.db.prepare('SELECT * FROM stone_transfers').all(), transfersBefore);
  assert.deepEqual(
    f.db
      .prepare('SELECT token_hash FROM sessions ORDER BY token_hash')
      .all()
      .map((row) => row.token_hash),
    ['alice-1', 'alice-2', 'anonymous-session', 'google-only-session'],
  );
  invalid(() =>
    f.recovery.confirm('bob@example.com', code, 'old-password-hash', 'replay-hash', f.now + 2),
  );
  assert.equal(
    f.db.prepare("SELECT password_hash FROM email_accounts WHERE sub='bob'").get().password_hash,
    'changed-hash',
  );
});

test('password changes during KDF or SMTP invalidate older recovery challenges', async (t) => {
  const f = fixture(t);
  await f.recovery.request('alice@example.com', f.now);
  const code = f.messages.at(-1).code;
  f.db.prepare("UPDATE email_accounts SET password_hash='parallel-change' WHERE sub='alice'").run();
  invalid(() =>
    f.recovery.confirm(
      'alice@example.com',
      code,
      'old-password-hash',
      'recovery-change',
      f.now + 1,
    ),
  );
  invalid(() =>
    f.recovery.confirm('alice@example.com', code, 'parallel-change', 'recovery-change', f.now + 1),
  );
  const before = f.db.prepare("SELECT * FROM password_recoveries WHERE email_sub='alice'").get();
  f.setMode('delay');
  const inFlight = f.recovery.request('alice@example.com', f.now + 60_000);
  const repeated = f.recovery.request('alice@example.com', f.now + 120_000);
  assert.deepEqual(await repeated, { requested: true });
  f.db.prepare("UPDATE email_accounts SET password_hash='later-change' WHERE sub='alice'").run();
  f.releaseMail();
  await inFlight;
  assert.deepEqual(
    f.db.prepare("SELECT * FROM password_recoveries WHERE email_sub='alice'").get(),
    before,
  );
  assert.equal(f.messages.length, 2);
  assert.equal(
    f.db.prepare("SELECT password_hash FROM email_accounts WHERE sub='alice'").get().password_hash,
    'later-change',
  );
});

test('database failures roll back password replacement and session revocation together', async (t) => {
  const f = fixture(t);
  await f.recovery.request('alice@example.com', f.now);
  const code = f.messages.at(-1).code;
  f.db.exec(`CREATE TRIGGER prevent_session_deletion BEFORE DELETE ON sessions
    WHEN OLD.account_sub='alice' BEGIN SELECT RAISE(ABORT,'forced rollback'); END;`);
  assert.throws(
    () => f.recovery.confirm('alice@example.com', code, 'old-password-hash', 'new-hash', f.now + 1),
    /forced rollback/,
  );
  assert.equal(
    f.db.prepare("SELECT password_hash FROM email_accounts WHERE sub='alice'").get().password_hash,
    'old-password-hash',
  );
  assert.equal(
    f.db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE account_sub='alice'").get().count,
    2,
  );
  assert.equal(
    f.db.prepare("SELECT consumed_at FROM password_recoveries WHERE email_sub='alice'").get()
      .consumed_at,
    null,
  );
  f.db.exec('DROP TRIGGER prevent_session_deletion');
  f.recovery.confirm('alice@example.com', code, 'old-password-hash', 'new-hash', f.now + 2);
});

test('concurrent recovery delivery has a bounded global SMTP queue', async (t) => {
  const f = fixture(t);
  const release = [];
  const sent = [];
  f.mail.sendPasswordReset = async (to) => {
    sent.push(to);
    await new Promise((resolve) => release.push(resolve));
    return true;
  };
  const operations = [];
  for (let i = 0; i < 17; i++) {
    const sub = `concurrent-${i}`;
    f.db
      .prepare('INSERT INTO email_accounts VALUES(?,?,?,NULL,1,?,0,?,?)')
      .run(sub, `${sub}@example.com`, 'old-password-hash', '{}', sub, f.now);
    operations.push(f.recovery.request(`${sub}@example.com`, f.now));
  }
  assert.equal(sent.length, 16);
  assert.deepEqual(await operations[16], { requested: true });
  for (const done of release) done();
  await Promise.all(operations);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM password_recoveries').get().count, 16);
  const final = f.recovery.request('concurrent-16@example.com', f.now);
  assert.equal(sent.length, 17);
  release.at(-1)();
  await final;
});

test('password reset emails retain the formation image, fixed sender, and bilingual instructions', async () => {
  const messages = [];
  const config = mailConfig({
    provider: 'smtp',
    from: 'Bozkurtobasi.com <info@bozkurtobasi.com>',
    host: 'smtp.hostinger.com',
    port: '465',
    secure: 'true',
    user: 'info@bozkurtobasi.com',
    password: 'test-secret',
    publicUrl: 'https://bozkurtobasi.com',
  });
  const mail = createMailService(config, async (message) => messages.push(message));
  assert.equal(await mail.sendPasswordReset('alice@example.com', '012345'), true);
  const message = messages[0];
  assert.equal(message.from.address, 'info@bozkurtobasi.com');
  assert.equal(message.to, 'alice@example.com');
  assert.match(message.subject, /Şifre yenileme \/ Reset your password/);
  assert.match(message.text, /password reset code: 012345/);
  assert.match(message.html, /Şifreni yenile \/ Reset your password/);
  assert.match(message.html, /every device/);
  assert.match(message.html, /cid:ayyildiz@bozkurtobasi/);
  assert.equal(message.attachments[0].cid, 'ayyildiz@bozkurtobasi');
  assert.equal(message.attachments[0].contentType, 'image/png');
  assert.ok(message.attachments[0].content.length > 1000);
});
