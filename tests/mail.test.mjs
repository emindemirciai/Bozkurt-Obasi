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
    confirm(token, session) {
      return this.request('/api/auth/player/verify/confirm', {
        method: 'POST',
        body: { token },
        session,
      });
    },
  };
}

function tokenFrom(message) {
  const matches = [
    ...message.text.matchAll(/https:\/\/bozkurtobasi\.com\/#verify=([A-Za-z0-9_-]{43})/g),
  ];
  assert.equal(matches.length, 2);
  assert.equal(matches[0][1], matches[1][1]);
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
  await assert.rejects(service.sendVerification('wolf@example.com', 'v'.repeat(43)), /timed out/);
});

test('registration sends fixed-From mail and verifies a single-use hashed token without logging in', async (t) => {
  const api = await fixture(t);
  const before = await (await api.request('/api/auth/player/status')).json();
  assert.equal(before.mailEnabled, true);
  const registration = await api.register();
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.equal(registered.verificationSent, true);
  assert.equal(registered.user.emailVerified, false);
  const session = cookie(registration);
  assert.equal(api.messages.length, 1);
  const message = api.messages[0];
  assert.deepEqual(message.from, {
    name: 'Bozkurtobasi.com',
    address: 'info@bozkurtobasi.com',
  });
  const rendered = await nodemailer.createTransport({ streamTransport: true }).sendMail(message);
  assert.equal(rendered.envelope.from, 'info@bozkurtobasi.com');
  assert.equal(message.to, 'wolf@example.com');
  const token = tokenFrom(message);
  const database = new DatabaseSync(api.dbPath);
  const challenge = database
    .prepare('SELECT token_hash, expires_at FROM email_verifications')
    .get();
  assert.equal(challenge.token_hash, createHash('sha256').update(token).digest('hex'));
  assert.equal(challenge.expires_at, 1_800_000_000_000 + 60 * 60 * 1000);
  assert.ok(
    !JSON.stringify(database.prepare('SELECT * FROM email_verifications').all()).includes(token),
  );
  database.close();
  const confirmation = await api.confirm(token);
  assert.equal(confirmation.status, 200);
  assert.deepEqual(await confirmation.json(), { verified: true });
  assert.equal(confirmation.headers.get('set-cookie'), null);
  assert.equal((await (await api.request('/api/auth/player/status')).json()).authenticated, false);
  const status = await (await api.request('/api/auth/player/status', { session })).json();
  assert.equal(status.user.emailVerified, true);
  assert.equal((await api.confirm(token)).status, 400);
  const resend = await api.resend(session);
  assert.deepEqual(await resend.json(), { ok: true, sent: false });
  assert.equal(api.messages.length, 1);
});

test('resends are authenticated, same-origin, throttled, and replace the prior token', async (t) => {
  const api = await fixture(t);
  const registration = await api.register();
  const session = cookie(registration);
  const first = tokenFrom(api.messages[0]);
  const guest = await api.resend();
  assert.equal(guest.status, 401);
  assert.equal((await guest.json()).error, 'account_session_required');
  const crossOrigin = await api.request('/api/auth/player/verify/request', {
    method: 'POST',
    body: {},
    session,
    headers: { Origin: 'https://attacker.invalid' },
  });
  assert.equal(crossOrigin.status, 403);
  assert.deepEqual(await (await api.resend(session)).json(), { ok: true, sent: false });
  api.tick(60_001);
  assert.deepEqual(await (await api.resend(session)).json(), { ok: true, sent: true });
  const second = tokenFrom(api.messages[1]);
  assert.notEqual(second, first);
  assert.equal((await api.confirm(first)).status, 400);
  const badOrigin = await api.request('/api/auth/player/verify/confirm', {
    method: 'POST',
    body: { token: second },
    headers: { Origin: 'https://attacker.invalid' },
  });
  assert.equal(badOrigin.status, 403);
  assert.equal((await api.confirm(second)).status, 200);
});

test('failed resends keep the delivered link and do not consume the daily send quota', async (t) => {
  let unavailable = false;
  const api = await fixture(t, {
    sender: () => {
      if (unavailable) throw new Error('temporary SMTP failure');
    },
  });
  const registration = await api.register();
  const session = cookie(registration);
  const first = tokenFrom(api.messages[0]);
  unavailable = true;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    api.tick(60_001);
    assert.deepEqual(await (await api.resend(session)).json(), { ok: true, sent: false });
  }
  const database = new DatabaseSync(api.dbPath);
  const challenge = database
    .prepare('SELECT window_count, token_hash FROM email_verifications')
    .get();
  assert.equal(challenge.window_count, 1);
  assert.equal(challenge.token_hash, createHash('sha256').update(first).digest('hex'));
  database.close();
  unavailable = false;
  api.tick(60_001);
  assert.deepEqual(await (await api.resend(session)).json(), { ok: true, sent: true });
  assert.equal((await api.confirm(first)).status, 400);
  assert.equal((await api.confirm(tokenFrom(api.messages[1]))).status, 200);
});

test('expired tokens fail; delivery failure and absent SMTP never block account creation', async (t) => {
  const failed = await fixture(t, {
    sender: () => {
      throw new Error('SMTP_SECRET confidential');
    },
  });
  const registration = await failed.register();
  assert.equal(registration.status, 201);
  assert.equal((await registration.json()).verificationSent, false);
  const session = cookie(registration);
  assert.equal((await failed.request('/api/state', { session })).status, 200);
  const failedRetry = await failed.resend(session);
  const failedBody = await failedRetry.text();
  assert.deepEqual(JSON.parse(failedBody), { ok: true, sent: false });
  assert.ok(!failedBody.includes('SMTP_SECRET'));

  const absent = await fixture(t, { configured: false });
  const disabled = await absent.register();
  assert.equal(disabled.status, 201);
  assert.equal((await disabled.json()).verificationSent, false);
  assert.equal(absent.messages.length, 0);
  const disabledSession = cookie(disabled);
  assert.deepEqual(await (await absent.resend(disabledSession)).json(), { ok: true, sent: false });
  assert.equal(
    (await (await absent.request('/api/auth/player/status', { session: disabledSession })).json())
      .mailEnabled,
    false,
  );

  const template = await fixture(t, { configured: 'withoutPassword' });
  const firstRun = await template.register();
  assert.equal(firstRun.status, 201);
  assert.equal((await firstRun.json()).verificationSent, false);
  assert.equal(template.messages.length, 0);
  assert.equal(
    (await (await template.request('/api/auth/player/status')).json()).mailEnabled,
    false,
  );

  const expiring = await fixture(t);
  await expiring.register();
  const token = tokenFrom(expiring.messages[0]);
  expiring.tick(60 * 60 * 1000 + 1);
  const expired = await expiring.confirm(token);
  assert.equal(expired.status, 400);
  assert.deepEqual(await expired.json(), { error: 'invalid_verification_token' });
});
