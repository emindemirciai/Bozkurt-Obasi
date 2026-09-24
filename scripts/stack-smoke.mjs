import assert from 'node:assert/strict';

const base = {
  web: 'http://127.0.0.1:3000',
  api: 'http://127.0.0.1:3001',
  admin: 'http://127.0.0.1:3002',
  analyze: 'http://127.0.0.1:3003',
};
const password = process.env.ADMIN_PASSWORD || '';
async function ready(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Service did not become healthy: ' + url);
}
async function json(url, options) {
  const response = await fetch(url, options);
  return { response, data: await response.json().catch(() => ({})) };
}
async function main() {
  await Promise.all([
    ready(base.web + '/healthz'),
    ready(base.api + '/api/health'),
    ready(base.admin + '/healthz'),
    ready(base.analyze + '/api/health'),
  ]);
  assert.equal((await fetch(base.web + '/')).status, 200);
  const adminPage = await fetch(base.admin + '/');
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /Bozkurt Obası/);
  assert.equal((await fetch(base.analyze + '/login')).status, 200);
  const game = await json(base.web + '/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(game.response.status, 200);
  assert.equal(game.data.mode, 'online');
  assert.equal((await fetch(base.admin + '/api/admin/session')).status, password ? 401 : 503);
  if (!password) {
    console.log(
      'Four-service health and gameplay passed. Set ADMIN_PASSWORD for authenticated panel smoke.',
    );
    return;
  }
  const login = await json(base.admin + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL || 'info@bozkurtobasi.com',
      password,
    }),
  });
  assert.equal(login.response.status, 200);
  assert.match(login.data.token, /^[A-Za-z0-9_-]{43}$/);
  const authorization = { Authorization: 'Bearer ' + login.data.token };
  const session = await json(base.api + '/api/admin/session', { headers: authorization });
  assert.equal(session.response.status, 200);
  const overview = await json(base.admin + '/api/admin/overview', { headers: authorization });
  assert.equal(overview.response.status, 200);
  assert.ok(overview.data.totalPlayers >= 1);
  const panelLogin = await json(base.analyze + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL || 'info@bozkurtobasi.com',
      password,
    }),
  });
  assert.equal(panelLogin.response.status, 200);
  const panelCookie = panelLogin.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(panelCookie?.startsWith('analyze_session_'));
  assert.equal(
    (
      await fetch(base.analyze + '/', {
        headers: { Cookie: panelCookie },
        redirect: 'manual',
      })
    ).status,
    200,
  );
  const id = 'smoke-' + crypto.randomUUID();
  const event = {
    id,
    eventType: 'pageview',
    site: 'bozkurtobasi.com',
    createdAt: new Date().toISOString(),
    visitorId: 'smoke-visitor',
    sessionId: 'smoke-session',
    path: '/village',
    url: 'https://bozkurtobasi.com/village',
    referrer: 'direct',
    duration: 0,
  };
  for (const duration of [0, 7]) {
    const track = await json(base.analyze + '/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://bozkurtobasi.com',
      },
      body: JSON.stringify({ ...event, duration }),
    });
    assert.equal(track.response.status, 200);
    assert.equal(track.data.ok, true);
  }
  const events = await json(base.analyze + '/api/analyze/events?range=all', {
    headers: { Cookie: panelCookie },
  });
  assert.equal(events.response.status, 200);
  assert.equal(events.data.events.filter((item) => item.id === id).length, 1);
  assert.equal(events.data.events.find((item) => item.id === id).duration, 7);
  console.log(
    'Four-service game, admin auth, analytics auth, tracking, and duration smoke passed.',
  );
}
await main();
