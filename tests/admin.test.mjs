import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/web/app.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-admin-'));
  const staticDir = join(root, 'public');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>Test</title>');
  const settings = { dbPath: join(root, 'game.sqlite'), staticDir, ...options };
  let app = createApp(settings);
  let address = await app.listen();
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    async request(path, { method = 'GET', body, token, headers = {} } = {}) {
      return fetch('http://127.0.0.1:' + address.port + path, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    },
    async restart() {
      await app.close();
      app = createApp(settings);
      address = await app.listen();
    },
  };
}

test('admin stays unavailable without a configured password', async (t) => {
  const api = await fixture(t, { adminEmail: 'admin@example.test', adminPassword: '' });
  const login = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'anything' },
  });
  assert.equal(login.status, 503);
  assert.deepEqual(await login.json(), { error: 'admin_unavailable' });
  assert.equal((await api.request('/api/admin/overview')).status, 503);
  assert.equal((await api.request('/api/health')).status, 200);
});

test('admin login, protected overview, restart, expiry and logout', async (t) => {
  let now = 1_000_000;
  const api = await fixture(t, {
    clock: () => now,
    adminEmail: 'Admin@Example.test',
    adminPassword: 'long-test-password-123',
  });
  const rejected = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'wrong' },
  });
  assert.equal(rejected.status, 401);
  assert.equal((await api.request('/api/admin/session')).status, 401);
  const login = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'ADMIN@example.test', password: 'long-test-password-123' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  const { token, expiresAt } = await login.json();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(expiresAt, now + 7 * 24 * 60 * 60 * 1000);
  const session = await api.request('/api/admin/session', { token });
  assert.deepEqual(await session.json(), { email: 'admin@example.test', expiresAt });
  const overview = await api.request('/api/admin/overview', { token });
  assert.deepEqual(await overview.json(), { totalPlayers: 0, activePlayers: 0, generatedAt: now });
  const guest = await api.request('/api/session', { method: 'POST', body: {} });
  assert.equal(guest.status, 200);
  const updated = await api.request('/api/admin/overview', { token });
  assert.equal((await updated.json()).totalPlayers, 1);
  await api.restart();
  assert.equal((await api.request('/api/admin/session', { token })).status, 200);
  const logout = await api.request('/api/auth/logout', { method: 'POST', body: {}, token });
  assert.equal(logout.status, 200);
  assert.equal((await api.request('/api/admin/session', { token })).status, 401);
  const again = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'long-test-password-123' },
  });
  const secondToken = (await again.json()).token;
  now += 7 * 24 * 60 * 60 * 1000 + 1;
  assert.equal((await api.request('/api/admin/session', { token: secondToken })).status, 401);
});

test('admin mutations enforce JSON and same-origin checks', async (t) => {
  const api = await fixture(t, {
    adminEmail: 'admin@example.test',
    adminPassword: 'long-test-password-123',
  });
  const crossSite = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'long-test-password-123' },
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(crossSite.status, 403);
  const origin = await api.request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'long-test-password-123' },
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(origin.status, 403);
});
