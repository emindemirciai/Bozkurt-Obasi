import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../services/admin/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../services/admin/index.html', import.meta.url), 'utf8');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

// Run the deployed script against its actual element IDs without a browser dependency.
async function adminPage({ savedToken = '', respond } = {}) {
  const nodes = new Map();
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    const classes = new Set();
    const handlers = new Map();
    nodes.set(id, {
      textContent: '',
      value: '',
      disabled: false,
      dataset: {},
      setAttribute() {},
      classList: {
        toggle(name, enabled) {
          if (enabled) classes.add(name);
          else classes.delete(name);
        },
        contains: (name) => classes.has(name),
      },
      addEventListener: (name, handler) => handlers.set(name, handler),
      dispatch: async (name) => handlers.get(name)?.({ preventDefault() {} }),
    });
  }
  const submit = { disabled: false };
  nodes.get('login-form').querySelector = () => submit;
  nodes.get('login-form').elements = { namedItem: (id) => nodes.get(id) };
  nodes.get('login-form').reset = () => {
    nodes.get('email').value = '';
    nodes.get('password').value = '';
  };
  const sessionStorage = storage(savedToken ? { bozkurt_admin_token: savedToken } : {});
  const requests = [];
  const timeoutDurations = [];
  runInNewContext(source, {
    document: {
      documentElement: { dataset: {}, style: {} },
      getElementById: (id) => nodes.get(id),
      querySelector: () => ({}),
      querySelectorAll: () => [],
    },
    localStorage: storage(),
    sessionStorage,
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    AbortSignal: {
      timeout(duration) {
        timeoutDurations.push(duration);
        return AbortSignal.timeout(duration);
      },
    },
    fetch: async (path, options) => {
      requests.push({ path, options });
      return respond(path, options);
    },
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  return {
    nodes,
    requests,
    sessionStorage,
    timeoutDurations,
    message: () => nodes.get('message').textContent,
    async signIn() {
      nodes.get('email').value = 'admin@example.test';
      nodes.get('password').value = 'test-only-password';
      await nodes.get('login-form').dispatch('submit');
      await settle();
      assert.equal(submit.disabled, false, 'login button must recover after a failed request');
    },
    async language() {
      await nodes.get('language').dispatch('click');
      await settle();
    },
  };
}

function response(status, data = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => data };
}

test('admin checks configuration before credentials and translates its setup warning', async () => {
  const page = await adminPage({ respond: () => response(503, { error: 'admin_unavailable' }) });
  assert.deepEqual(
    page.requests.map(({ path }) => path),
    ['/api/admin/session'],
  );
  assert.equal(page.requests[0].options.method, undefined);
  assert.match(page.message(), /ADMIN_EMAIL.*ADMIN_PASSWORD.*12/);
  assert.match(page.message(), /API servisinde/);
  await page.language();
  assert.match(page.message(), /Check ADMIN_EMAIL.*Dokploy API service/);
  assert.equal(page.sessionStorage.getItem('bozkurt_admin_token'), null);
});

test('anonymous 401 means sign-in is available without a false error', async () => {
  const page = await adminPage({ respond: () => response(401, { error: 'unauthorized' }) });
  assert.equal(page.message(), '');
  assert.equal(page.nodes.get('login-panel').classList.contains('hidden'), false);
  assert.deepEqual(page.timeoutDurations, [15_000]);
  assert.equal(page.requests[0].options.signal instanceof AbortSignal, true);
});

test('gateway HTML during login shows a connection error and keeps it translated', async () => {
  const page = await adminPage({
    respond: (path) =>
      path === '/api/admin/session'
        ? response(401)
        : {
            status: 502,
            ok: false,
            json: async () => {
              throw new SyntaxError('HTML response');
            },
          },
  });
  await page.signIn();
  assert.match(page.message(), /API bağlantısı kurulamadı/);
  assert.doesNotMatch(page.message(), /parola hatalı|ADMIN_PASSWORD/);
  await page.language();
  assert.match(page.message(), /Could not connect to the admin API/);
  assert.equal(page.nodes.get('email').value, 'admin@example.test');
  assert.equal(page.sessionStorage.getItem('bozkurt_admin_token'), null);
  assert.ok(page.timeoutDurations.every((duration) => duration === 15_000));
});

test('503 needs the admin_unavailable error code to report missing settings', async () => {
  for (const [data, expected] of [
    [{ error: 'admin_unavailable' }, /ADMIN_EMAIL.*ADMIN_PASSWORD/],
    [{ error: 'upstream_unavailable' }, /API bağlantısı kurulamadı/],
    [null, /API bağlantısı kurulamadı/],
  ]) {
    const page = await adminPage({
      respond: (path) => (path === '/api/admin/session' ? response(401) : response(503, data)),
    });
    await page.signIn();
    assert.match(page.message(), expected);
    assert.equal(page.sessionStorage.getItem('bozkurt_admin_token'), null);
  }
});

test('rate limiting and rejected credentials have separate translated messages', async () => {
  for (const [status, turkish, english] of [
    [429, /10 dakika/, /10 minutes/],
    [401, /E-posta veya parola hatalı/, /Incorrect email or password/],
  ]) {
    const page = await adminPage({
      respond: (path) => (path === '/api/admin/session' ? response(401) : response(status)),
    });
    await page.signIn();
    assert.match(page.message(), turkish);
    await page.language();
    assert.match(page.message(), english);
  }
});

test('transient gateway and admin configuration errors preserve the saved session', async () => {
  for (const [status, data, expected] of [
    [502, {}, /API bağlantısı kurulamadı/],
    [503, {}, /API bağlantısı kurulamadı/],
    [503, { error: 'admin_unavailable' }, /ADMIN_PASSWORD/],
  ]) {
    const page = await adminPage({
      savedToken: 'existing-admin-session',
      respond: (path) => (path === '/api/health' ? response(200) : response(status, data)),
    });
    assert.match(page.message(), expected);
    assert.equal(page.sessionStorage.getItem('bozkurt_admin_token'), 'existing-admin-session');
    assert.equal(page.nodes.get('dashboard').classList.contains('hidden'), true);
    assert.equal(page.requests[0].options.headers.Authorization, 'Bearer existing-admin-session');
  }
});

test('an expired session is discarded even when the separate health request fails', async () => {
  const page = await adminPage({
    savedToken: 'expired-session',
    respond: (path) => {
      if (path === '/api/health') throw new TypeError('connection refused');
      return response(401, { error: 'unauthorized' });
    },
  });
  assert.match(page.message(), /Oturum geçersiz/);
  assert.equal(page.sessionStorage.getItem('bozkurt_admin_token'), null);
  assert.equal(page.nodes.get('login-panel').classList.contains('hidden'), false);
});

test('health failure does not discard a valid dashboard session', async () => {
  const page = await adminPage({
    savedToken: 'valid-session',
    respond: (path) => {
      if (path === '/api/health') throw new TypeError('connection refused');
      return response(200, {
        totalPlayers: 4,
        activePlayers: 2,
        generatedAt: '2026-10-07T00:00:00Z',
      });
    },
  });
  assert.equal(page.nodes.get('dashboard').classList.contains('hidden'), false);
  assert.equal(page.nodes.get('health').textContent, 'Erişilemiyor');
  assert.equal(page.nodes.get('total').textContent, '4');
  assert.equal(page.message(), '');
  assert.equal(page.sessionStorage.getItem('bozkurt_admin_token'), 'valid-session');
});

test('a delayed anonymous readiness response cannot overwrite a successful login', async () => {
  let finishReadiness;
  const page = await adminPage({
    respond: (path) => {
      if (path === '/api/admin/session')
        return new Promise((resolve) => {
          finishReadiness = resolve;
        });
      if (path === '/api/auth/login') return response(200, { token: 'new-session' });
      if (path === '/api/admin/overview')
        return response(200, { generatedAt: '2026-10-07T00:00:00Z' });
      return response(200);
    },
  });
  await page.signIn();
  finishReadiness(response(503, { error: 'admin_unavailable' }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.nodes.get('dashboard').classList.contains('hidden'), false);
  assert.equal(page.message(), '');
  assert.equal(page.sessionStorage.getItem('bozkurt_admin_token'), 'new-session');
});
