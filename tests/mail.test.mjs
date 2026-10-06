import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import nodemailer from 'nodemailer';
import { createApp } from '../server/web/app.mjs';
import { createMailService, mailConfig } from '../server/web/mail.mjs';

const PASSWORD = 'Obami koruyan uzun sifre 123!';

function cookie(response) {
  return response.headers
    .getSetCookie()
    .find((value) => value.startsWith('bozkurt_session='))
    ?.split(';')[0];
}

async function fixture(t, { configured = true, sender } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-mail-'));
  const staticDir = join(root, 'public');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<title>Bozkurt</title>');
  const messages = [];
  let now = 1_800_000_000_000;
  const app = createApp({
    dbPath: join(root, 'game.sqlite'),
    staticDir,
    clock: () => now,
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUris: '',
    adminPassword: '',
    mailProvider: configured ? 'smtp' : '',
    mailFrom: 'Bozkurtobasi.com <info@bozkurtobasi.com>',
    smtpHost: configured ? 'smtp.hostinger.com' : '',
    smtpPort: configured ? '465' : '',
    smtpSecure: configured ? 'true' : '',
    smtpUser: configured ? 'info@bozkurtobasi.com' : '',
    smtpPassword: configured === true ? 'test-secret' : '',
    publicUrl: 'https://bozkurtobasi.com',
    mailSender: async (message) => {
      if (sender) await sender(message);
      messages.push(message);
    },
  });
  const address = await app.listen();
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${address.port}`;
  return {
    messages,
    dbPath: join(root, 'game.sqlite'),
    tick(milliseconds) {
      now += milliseconds;
    },
    request(path, { method = 'GET', body, session, headers = {} } = {}) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          Connection: 'close',
          ...(session ? { Cookie: session } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    register() {
      return this.request('/api/auth/player/register', {
        method: 'POST',
        body: { email: 'wolf@example.com', password: PASSWORD, name: 'Oba Reisi' },
      });
    },
    resend(session) {
      return this.request('/api/auth/player/verify/request', {
        method: 'POST',
        body: {},
        session,
      });
    },
    confirm(code, session) {
      return this.request('/api/auth/player/verify/confirm', {
        method: 'POST',
        body: { code },
        session,
      });
    },
  };
}

function codeFrom(message) {
  const matches = [...message.text.matchAll(/code: ([0-9]{6})/g)];
  assert.equal(matches.length, 1);
  return matches[0][1];
}

test('SMTP configuration is complete, TLS protected, and cannot change sender address', () => {
  assert.deepEqual(
    mailConfig({ provider: '', from: '', host: '', port: '', secure: '', user: '', password: '' }),
    { enabled: false },
  );
  const base = {
    provider: 'smtp',
    from: 'Bozkurtobasi.com <info@bozkurtobasi.com>',
    host: 'smtp.hostinger.com',
    port: '465',
    secure: 'true',
    user: 'info@bozkurtobasi.com',
    password: 'test-secret',
    publicUrl: 'https://bozkurtobasi.com',
  };
  const config = mailConfig(base);
  assert.equal(config.enabled, true);
  assert.equal(config.from, base.from);
  assert.equal(config.fromName, 'Bozkurtobasi.com');
  assert.equal(config.port, 465);
  assert.equal(config.secure, true);
  assert.equal(config.publicUrl, 'https://bozkurtobasi.com');
  assert.equal(mailConfig({ ...base, port: '587', secure: 'false' }).secure, false);
  assert.deepEqual(mailConfig({ ...base, password: '' }), { enabled: false });
  for (const override of [
    { provider: 'other' },
    { from: 'Other <other@example.com>' },
    { from: 'attacker@example.net, Brand <info@bozkurtobasi.com>' },
    { from: 'Bozkurtobasi.com <info@bozkurtobasi.com>\r\nBcc: evil@example.com' },
    { port: '587', secure: 'true' },
    { port: '465', secure: 'false' },
    { publicUrl: 'http://bozkurtobasi.com' },
    { publicUrl: 'https://bozkurtobasi.com/other' },
  ])
    assert.throws(() => mailConfig({ ...base, ...override }));
});

test('a stalled SMTP sender has a bounded wait and cannot make registration hang', async () => {
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
  const service = createMailService(config, () => new Promise(() => {}), 20);
  await assert.rejects(service.sendVerification('wolf@example.com', '123456'), /timed out/);
});

test('HTML verification mail embeds the formation and gates every game route until code confirmation', async (t) => {
  const api = await fixture(t),
    registration = await api.register(),
    session = cookie(registration);
  const result = await registration.json();
  assert.equal(result.authenticated, false);
  assert.equal(result.verificationRequired, true);
  assert.equal(result.verificationSent, true);
  assert.equal(result.user, undefined);
  const message = api.messages[0],
    code = codeFrom(message);
  assert.equal(message.from.address, 'info@bozkurtobasi.com');
  assert.match(message.html, /cid:ayyildiz@bozkurtobasi/);
  assert.match(message.html, /Hilal/);
  assert.match(message.html, /crescent/i);
  assert.equal(message.attachments[0].contentType, 'image/png');
  assert.ok(message.attachments[0].content.length > 1000);
  const mime = await nodemailer
    .createTransport({ streamTransport: true, buffer: true })
    .sendMail(message);
  assert.match(mime.message.toString(), /multipart\/related/);
  for (const [path, method, body] of [
    ['/api/state', 'GET', undefined],
    ['/api/session', 'POST', {}],
    ['/api/action', 'POST', { action: { type: 'collect' }, revision: 0 }],
  ])
    assert.equal((await api.request(path, { method, body, session })).status, 403);
  assert.equal((await api.confirm(code)).status, 401);
  const database = new DatabaseSync(api.dbPath),
    challenge = database.prepare('SELECT * FROM email_verifications').get();
  assert.equal(challenge.expires_at - challenge.issued_at, 900000);
  assert.equal(challenge.token_hash.length, 64);
  assert.ok(!JSON.stringify(challenge).includes(code));
  database.close();
  const confirmation = await api.confirm(code, session);
  assert.equal(confirmation.status, 200);
  assert.equal((await confirmation.json()).authenticated, true);
  assert.equal((await api.request('/api/state', { session })).status, 200);
  assert.equal((await api.confirm(code, session)).status, 400);
});

test('resend is same-origin, throttled, limited to five successful sends, and replaces old codes', async (t) => {
  const api = await fixture(t),
    registration = await api.register(),
    session = cookie(registration),
    first = codeFrom(api.messages[0]);
  assert.equal((await api.resend()).status, 401);
  assert.equal(
    (
      await api.request('/api/auth/player/verify/request', {
        method: 'POST',
        body: {},
        session,
        headers: { Origin: 'https://attacker.invalid' },
      })
    ).status,
    403,
  );
  assert.deepEqual(await (await api.resend(session)).json(), { ok: true, sent: false });
  for (let i = 1; i < 5; i++) {
    api.tick(60001);
    assert.equal((await (await api.resend(session)).json()).sent, true);
  }
  api.tick(60001);
  assert.equal((await (await api.resend(session)).json()).sent, false);
  assert.equal((await api.confirm(first, session)).status, 400);
  assert.equal((await api.confirm(codeFrom(api.messages.at(-1)), session)).status, 200);
});

test('five incorrect guesses lock a challenge and the correct code cannot bypass that limit', async (t) => {
  const api = await fixture(t),
    registration = await api.register(),
    session = cookie(registration),
    code = codeFrom(api.messages[0]);
  const wrong = code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await api.confirm(wrong, session)).status, 400);
  assert.equal((await (await api.confirm(code, session)).json()).error, 'verification_expired');
  const db = new DatabaseSync(api.dbPath);
  assert.equal(
    db.prepare('SELECT failed_attempts FROM email_verifications').get().failed_attempts,
    5,
  );
  db.close();
  assert.equal((await api.request('/api/state', { session })).status, 403);
  api.tick(60001);
  await api.resend(session);
  assert.equal((await api.confirm(codeFrom(api.messages.at(-1)), session)).status, 200);
});

test('failed SMTP leaves the previous code valid and never authorizes an unverified account', async (t) => {
  let fail = false;
  const api = await fixture(t, {
    sender: () => {
      if (fail) throw new Error('SMTP_SECRET');
    },
  });
  const registration = await api.register(),
    session = cookie(registration),
    code = codeFrom(api.messages[0]);
  fail = true;
  api.tick(60001);
  const retry = await api.resend(session);
  assert.deepEqual(await retry.json(), { ok: true, sent: false });
  assert.equal((await api.confirm(code, session)).status, 200);
  const absent = await fixture(t, { configured: false }),
    pending = await absent.register(),
    pendingSession = cookie(pending);
  assert.equal((await pending.json()).verificationSent, false);
  assert.equal((await absent.request('/api/state', { session: pendingSession })).status, 403);
});

test('expired codes, malformed input, and another account session cannot confirm ownership', async (t) => {
  const api = await fixture(t),
    registration = await api.register(),
    session = cookie(registration),
    code = codeFrom(api.messages[0]);
  const other = await api.request('/api/auth/player/register', {
    method: 'POST',
    body: { email: 'other@example.com', password: PASSWORD },
  });
  const otherSession = cookie(other);
  assert.equal((await api.confirm(code, otherSession)).status, 400);
  assert.equal((await api.confirm('12', session)).status, 400);
  api.tick(900001);
  assert.equal((await (await api.confirm(code, session)).json()).error, 'verification_expired');
  assert.equal((await api.request('/api/state', { session })).status, 403);
});
