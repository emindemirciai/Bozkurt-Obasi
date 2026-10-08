import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/web/app.mjs';

test('a profile body arriving after admin deletion cannot recreate a profile or account', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-admin-race-'));
  const dbPath = join(root, 'game.sqlite');
  const password = 'race-player-password-2026';
  const app = createApp({ dbPath, adminEmail: 'admin@example.test', adminPassword: password });
  const { port } = await app.listen();
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  async function request(path, method, body, headers = {}) {
    return fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }
  const token = (
    await (
      await request('/api/auth/login', 'POST', { email: 'admin@example.test', password })
    ).json()
  ).token;
  const admin = { Authorization: `Bearer ${token}` };
  const created = await request(
    '/api/admin/users',
    'POST',
    { email: 'race@example.test', name: 'Race Player', password },
    admin,
  );
  assert.equal(created.status, 201);
  const user = (await created.json()).user;
  const db = new DatabaseSync(dbPath);
  db.prepare('UPDATE email_accounts SET email_verified=1 WHERE email=?').run(user.email);
  db.close();
  const signedIn = await request('/api/auth/player/login', 'POST', { email: user.email, password });
  const cookie = signedIn.headers
    .getSetCookie()
    .find((row) => row.startsWith('bozkurt_session='))
    ?.split(';')[0];
  assert.ok(cookie);
  const payload = JSON.stringify({ nickname: 'Stale nickname' });
  let incoming;
  const bodyStarted = new Promise((resolve) => {
    incoming = (req) => {
      if (req.url === '/api/player/profile') {
        app.server.off('request', incoming);
        resolve();
      }
    };
    app.server.on('request', incoming);
  });
  let client;
  const streamedResponse = new Promise((resolve, reject) => {
    client = httpRequest(
      base + '/api/player/profile',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      },
    );
    client.on('error', reject);
    client.setTimeout(5000, () => client.destroy(new Error('stream timed out')));
    client.write(payload.slice(0, 5));
  });
  t.after(() => {
    app.server.off('request', incoming);
    client?.destroy();
  });
  await bodyStarted;
  assert.equal(
    (await request(`/api/admin/users/${user.id}`, 'DELETE', { confirmation: user.userCode }, admin))
      .status,
    200,
  );
  client.end(payload.slice(5));
  const result = await streamedResponse;
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'account_session_required');
  const check = new DatabaseSync(dbPath);
  assert.equal(check.prepare('SELECT COUNT(*) AS n FROM player_profiles').get().n, 0);
  assert.equal(check.prepare('SELECT COUNT(*) AS n FROM email_accounts').get().n, 0);
  assert.equal(check.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  check.close();
});
