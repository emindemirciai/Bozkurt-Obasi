import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLATFORM_AUTH_TIMEOUT_MS,
  signInPlatformAdmin,
  verifyPlatformAdminSession,
} from '../services/analyze/src/lib/platformAuth.ts';

const token = 'a'.repeat(43);
const now = 10_000;
const session = { email: 'admin@example.test', expiresAt: now + 60_000 };
const json = (value, status = 200) => Response.json(value, { status });

test('analytics requires a valid API token and verified matching administrator session', async () => {
  const requests = [];
  const responses = [json({ token }), json(session)];
  const result = await signInPlatformAdmin('http://api:3000', 'Admin@example.test', 'a-secret', {
    now,
    fetcher: async (url, options) => {
      requests.push({ url, options });
      return responses.shift();
    },
  });
  assert.deepEqual(result, { ok: true, token, session });
  assert.equal(requests[0].url, 'http://api:3000/api/auth/login');
  assert.equal(requests[1].url, 'http://api:3000/api/admin/session');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer ' + token);
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(requests[0].options.redirect, 'error');
  assert.ok(requests.every(({ options }) => options.signal instanceof AbortSignal));
  assert.equal(PLATFORM_AUTH_TIMEOUT_MS, 8_000);
});

test('analytics distinguishes configuration, credentials, rate limits, and unavailable gateways', async () => {
  for (const [status, body, error] of [
    [503, { error: 'admin_unavailable' }, 'admin_unavailable'],
    [401, { error: 'invalid_credentials' }, 'invalid_credentials'],
    [429, { error: 'login_rate_limited' }, 'login_rate_limited'],
    [502, {}, 'auth_api_unavailable'],
    [503, {}, 'auth_api_unavailable'],
  ]) {
    const result = await signInPlatformAdmin('http://api:3000', session.email, 'a-secret', {
      fetcher: async () => json(body, status),
    });
    assert.deepEqual(result, { ok: false, status: status >= 500 ? 503 : status, error });
  }
});

test('malformed successful login responses cannot create an analytics session', async () => {
  for (const response of [
    new Response('<html>proxy page</html>', { status: 200 }),
    json({}),
    json({ token: 'too-short' }),
    new Response(null, { status: 204 }),
  ]) {
    let count = 0;
    const result = await signInPlatformAdmin('http://api:3000', session.email, 'a-secret', {
      fetcher: async () => {
        count++;
        return response;
      },
    });
    assert.deepEqual(result, { ok: false, status: 503, error: 'auth_api_unavailable' });
    assert.equal(count, 1);
  }
});

test('HTTP 200 alone cannot grant access to protected analytics', async () => {
  for (const response of [
    new Response('<html>proxy page</html>', { status: 200 }),
    json({}),
    json({ email: '', expiresAt: session.expiresAt }),
    json({ email: session.email, expiresAt: String(session.expiresAt) }),
    json({ email: session.email, expiresAt: now }),
    new Response(null, { status: 204 }),
  ]) {
    const result = await verifyPlatformAdminSession('http://api:3000', token, {
      now,
      fetcher: async () => response,
    });
    assert.deepEqual(result, { ok: false, status: 503, error: 'auth_api_unavailable' });
  }
  const mismatched = [json({ token }), json({ ...session, email: 'different@example.test' })];
  assert.deepEqual(
    await signInPlatformAdmin('http://api:3000', session.email, 'a-secret', {
      now,
      fetcher: async () => mismatched.shift(),
    }),
    { ok: false, status: 503, error: 'auth_api_unavailable' },
  );
});

test('session outages remain unavailable while expired and malformed sessions remain unauthorized', async () => {
  assert.deepEqual(
    await verifyPlatformAdminSession('http://api:3000', token, {
      fetcher: async () => json({ error: 'admin_unavailable' }, 503),
    }),
    { ok: false, status: 503, error: 'admin_unavailable' },
  );
  assert.deepEqual(
    await verifyPlatformAdminSession('http://api:3000', token, {
      fetcher: async () => json({ error: 'admin_session_required' }, 401),
    }),
    { ok: false, status: 401, error: 'admin_session_required' },
  );
  let called = false;
  const malformed = await verifyPlatformAdminSession('http://api:3000', 'bad-token', {
    fetcher: async () => {
      called = true;
      return json(session);
    },
  });
  assert.deepEqual(malformed, { ok: false, status: 401, error: 'admin_session_required' });
  assert.equal(called, false);
});

test('authentication transport and stalled response bodies have bounded failure', async () => {
  const failed = await signInPlatformAdmin('http://api:3000', session.email, 'a-secret', {
    fetcher: async () => {
      throw new Error('connection refused');
    },
  });
  assert.deepEqual(failed, { ok: false, status: 503, error: 'auth_api_unavailable' });

  let aborted = false;
  const stalled = await verifyPlatformAdminSession('http://api:3000', token, {
    timeoutMs: 20,
    fetcher: async (_url, { signal }) => ({
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(new Error('aborted'));
            },
            { once: true },
          );
        }),
    }),
  });
  assert.equal(aborted, true);
  assert.deepEqual(stalled, { ok: false, status: 503, error: 'auth_api_unavailable' });
});
