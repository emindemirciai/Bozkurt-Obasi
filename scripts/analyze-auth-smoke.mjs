import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const analyzeImage = process.argv[2] || 'bozkurt-obasi-analyze';
const apiImage = process.argv[3] || 'bozkurt-obasi-api';
const prefix = 'bozkurt-analyze-auth-' + randomBytes(6).toString('hex');
const network = prefix + '-network';
const apiName = prefix + '-api';
const analyzeName = prefix + '-analyze';
const containers = [];
const credentials = { email: 'admin@example.test', password: 'integration-test-password-2026' };
let networkCreated = false;

// This mock is private to a disposable Docker network and exposes only synthetic
// credentials. It does not use the real API, game database, or deployment volumes.
const mockSource = `
import http from 'node:http';
const credentials = ${JSON.stringify(credentials)};
const token = 'a'.repeat(43);
const modes = new Set(['success', 'unavailable', 'configuration', 'throttled', 'invalid', 'forbidden', 'html']);
let state = { login: 'success', session: 'success' };
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
function controlled(response, mode) {
  if (mode === 'unavailable') json(response, 503, { error: 'upstream_unavailable' });
  else if (mode === 'configuration') json(response, 503, { error: 'admin_unavailable' });
  else if (mode === 'throttled') json(response, 429, { error: 'login_rate_limited' });
  else if (mode === 'invalid') json(response, 401, { error: 'invalid_credentials' });
  else if (mode === 'forbidden') json(response, 403, { error: 'admin_session_required' });
  else if (mode === 'html') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<html><body>A proxy page is not an admin session.</body></html>');
  } else return false;
  return true;
}
const server = http.createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://api:3000').pathname;
    if (path === '/api/health') return json(response, 200, { status: 'ok' });
    if (path === '/control' && request.method === 'POST') {
      let text = '';
      for await (const chunk of request) text += chunk;
      const next = JSON.parse(text);
      if (!modes.has(next.login) || !modes.has(next.session)) {
        return json(response, 400, { error: 'invalid_mock_mode' });
      }
      state = { login: next.login, session: next.session };
      return json(response, 200, { ok: true });
    }
    if (path === '/api/auth/login' && request.method === 'POST') {
      if (controlled(response, state.login)) return;
      let text = '';
      for await (const chunk of request) text += chunk;
      const supplied = JSON.parse(text);
      if (supplied.email !== credentials.email || supplied.password !== credentials.password) {
        return json(response, 401, { error: 'invalid_credentials' });
      }
      return json(response, 200, { token });
    }
    if (path === '/api/admin/session' && request.method === 'GET') {
      if (controlled(response, state.session)) return;
      if (request.headers.authorization !== 'Bearer ' + token) {
        return json(response, 401, { error: 'admin_session_required' });
      }
      return json(response, 200, { email: credentials.email, expiresAt: Date.now() + 3_600_000 });
    }
    json(response, 404, { error: 'not_found' });
  } catch {
    json(response, 400, { error: 'invalid_request' });
  }
});
server.listen(3000, '0.0.0.0');
`;

function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 60_000 });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`docker ${args[0]} failed: ${result.stderr || result.error}`);
  }
  return result.stdout?.trim() || '';
}

function containerUrl(name) {
  const binding = JSON.parse(
    docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]),
  );
  return 'http://127.0.0.1:' + binding['3000/tcp'][0].HostPort;
}

async function request(url, options = {}) {
  return fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(3_000) });
}

async function ready(url) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await request(url);
      if (response.status === 200) return;
    } catch {
      // These containers have no application data and may still be starting.
    }
    await delay(250);
  }
  throw new Error('Disposable auth service did not become ready: ' + url);
}

async function controlled(apiBase, login = 'success', session = 'success') {
  const response = await request(apiBase + '/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, session }),
  });
  assert.equal(response.status, 200);
}

async function signIn(base, body = credentials) {
  return request(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function expectFailure(response, status, error) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).error, error);
  assert.equal(response.headers.get('set-cookie'), null, 'Failed login must not issue a cookie.');
}

try {
  // Publish only loopback ephemeral ports; an internal-only network omits host bindings on Docker Desktop.
  docker(['network', 'create', network]);
  networkCreated = true;
  docker([
    'run',
    '-d',
    '--name',
    apiName,
    '--network',
    network,
    '--network-alias',
    'api',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges:true',
    '--no-healthcheck',
    '-p',
    '127.0.0.1::3000',
    '--entrypoint',
    'node',
    apiImage,
    '--input-type=module',
    '-e',
    mockSource,
  ]);
  containers.push(apiName);
  const apiBase = containerUrl(apiName);
  await ready(apiBase + '/api/health');

  docker([
    'run',
    '-d',
    '--name',
    analyzeName,
    '--network',
    network,
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges:true',
    '--no-healthcheck',
    '--tmpfs',
    '/tmp:mode=1777',
    '--tmpfs',
    '/app/data:mode=1777',
    '-p',
    '127.0.0.1::3000',
    '-e',
    'ANALYZE_SITE_ID=bozkurtobasi.com',
    '-e',
    'ANALYZE_SITE_NAME=Bozkurt Obası Auth Regression',
    '-e',
    'ANALYZE_AUTH_MODE=platform-admin',
    '-e',
    'ANALYZE_AUTH_API_URL=http://api:3000',
    '-e',
    'ANALYZE_ALLOWED_ORIGINS=https://bozkurtobasi.com',
    '-e',
    'ANALYZE_EVENT_SITES=bozkurtobasi.com',
    '-e',
    'ANALYZE_DATA_DIR=/tmp/analyze-auth-events',
    '-e',
    'ANALYZE_GEO_LOOKUP=false',
    analyzeImage,
  ]);
  containers.push(analyzeName);
  const base = containerUrl(analyzeName);
  await ready(base + '/api/health');
  assert.equal((await request(base + '/login')).status, 200);

  for (const body of ['{invalid-json', 'null']) {
    const response = await request(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    await expectFailure(response, 400, 'invalid_request');
  }
  await expectFailure(
    await signIn(base, { ...credentials, password: 'incorrect-password' }),
    401,
    'invalid_credentials',
  );

  await controlled(apiBase, 'throttled');
  await expectFailure(await signIn(base), 429, 'login_rate_limited');
  await controlled(apiBase, 'configuration');
  await expectFailure(await signIn(base), 503, 'admin_unavailable');
  await controlled(apiBase, 'html');
  await expectFailure(await signIn(base), 503, 'auth_api_unavailable');

  await controlled(apiBase);
  const login = await signIn(base);
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { ok: true });
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie || '', /analyze_session_bozkurtobasi\.com=[A-Za-z0-9_-]{43}/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];
  const headers = { Cookie: cookie };
  const authorized = await request(base + '/api/analyze/events?range=all', { headers });
  assert.equal(authorized.status, 200);
  assert.deepEqual((await authorized.json()).events, []);
  assert.equal((await request(base + '/', { headers })).status, 200);

  await controlled(apiBase, 'success', 'unavailable');
  await expectFailure(await signIn(base), 503, 'auth_api_unavailable');
  const outage = await request(base + '/api/analyze/events?range=all', { headers });
  assert.equal(outage.status, 503);
  assert.equal((await outage.json()).error, 'auth_api_unavailable');
  assert.equal(outage.headers.get('set-cookie'), null);
  const outagePage = await request(base + '/', { headers });
  assert.equal(outagePage.status, 307);
  assert.equal(new URL(outagePage.headers.get('location'), base).pathname, '/login');
  assert.equal(new URL(outagePage.headers.get('location'), base).searchParams.get('error'), 'api');
  assert.equal(
    outagePage.headers.get('set-cookie'),
    null,
    'Temporary outage must preserve cookies.',
  );

  await controlled(apiBase, 'success', 'configuration');
  const unconfiguredPage = await request(base + '/', { headers });
  assert.equal(unconfiguredPage.status, 307);
  assert.equal(
    new URL(unconfiguredPage.headers.get('location'), base).searchParams.get('error'),
    'admin_unavailable',
  );
  assert.equal(unconfiguredPage.headers.get('set-cookie'), null);

  await controlled(apiBase, 'success', 'html');
  await expectFailure(await signIn(base), 503, 'auth_api_unavailable');
  const proxyHtml = await request(base + '/api/analyze/events?range=all', { headers });
  assert.equal(proxyHtml.status, 503, 'HTTP200 HTML must not grant protected analytics access.');
  assert.equal((await proxyHtml.json()).error, 'auth_api_unavailable');

  await controlled(apiBase, 'success', 'invalid');
  const expiredPage = await request(base + '/', { headers });
  assert.equal(expiredPage.status, 307);
  assert.match(
    expiredPage.headers.get('set-cookie') || '',
    /analyze_session_bozkurtobasi\.com=;/,
    'An invalid API session must clear the analytics cookie.',
  );
  assert.match(expiredPage.headers.get('set-cookie'), /expires=Thu, 01 Jan 1970/i);

  console.log(
    'Analytics auth integration passed: invalid input, credentials, throttling, configuration, verified login, protected metrics, outage cookie preservation, HTML200 rejection and invalid-session expiry.',
  );
} catch (error) {
  for (const name of containers) {
    console.error(docker(['logs', '--tail', '30', name], true));
  }
  throw error;
} finally {
  for (const name of containers.reverse()) docker(['rm', '-f', name], true);
  if (networkCreated) docker(['network', 'rm', network], true);
}
