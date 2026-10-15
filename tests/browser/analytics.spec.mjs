import { test, expect } from '@playwright/test';
import { signIn } from './sign-in.mjs';

const SITE = 'https://bozkurtobasi.com';
const COLLECTOR = 'https://analiz.bozkurtobasi.com/api/track';

async function productionSite(page, options = {}) {
  const events = [];
  events.progressions = [];
  if (options.authenticated !== false) await signIn(page);
  const cookies = await page.context().cookies('http://127.0.0.1:4173');
  const cookieHeader = cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
  await page.route(`${SITE}/**`, async (route) => {
    const url = new URL(route.request().url());
    const headers = { ...route.request().headers() };
    delete headers.host;
    delete headers.cookie;
    if (headers.origin) headers.origin = 'http://127.0.0.1:4173';
    if (headers.referer) headers.referer = 'http://127.0.0.1:4173/';
    // Bridge only this test's authenticated local API session into the mocked site.
    if (cookieHeader) headers.cookie = cookieHeader;
    const response = await route.fetch({
      url: `http://127.0.0.1:4173${url.pathname}${url.search}`,
      headers,
    });
    await route.fulfill({ response });
  });
  // All analytics remains inside this mock. Nothing is sent to the live panel.
  await page.route(COLLECTOR, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': SITE,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }
    if (options.fail) return route.abort('failed');
    const body = route.request().postDataJSON();
    (body.eventType === 'progression' ? events.progressions : events).push({
      body,
      headers: route.request().headers(),
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}',
      headers: { 'access-control-allow-origin': SITE },
    });
  });
  return events;
}

test('production screens send one upserted visit, cumulative duration, and no game secrets', async ({
  page,
}) => {
  await page.clock.install();
  const events = await productionSite(page);
  await page.goto(`${SITE}/?token=private-value#village`);
  await expect.poll(() => events.length).toBe(1);
  const initial = events[0].body;
  expect(initial).toMatchObject({
    eventType: 'pageview',
    site: 'bozkurtobasi.com',
    path: '/village',
    url: `${SITE}/village`,
    duration: 0,
  });
  await expect(page).toHaveTitle(/Bozkurt Obası: Ay-Yıldız Nöbeti/);
  await page.clock.fastForward(5000);
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
  await expect.poll(() => events.length).toBe(3);
  expect(events[1].body).toMatchObject({
    id: initial.id,
    eventType: 'pageview',
    path: '/village',
    duration: 5,
  });
  expect(events[2].body.path).toBe('/battle');
  expect(events[2].body.id).not.toBe(initial.id);
  expect(events[2].body.visitorId).toBe(initial.visitorId);
  await page.getByRole('button', { name: 'Geniş', exact: true }).first().click();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.clock.fastForward(3000);
  expect(events).toHaveLength(3); // Rendering, formations and translation do not count as visits.
  for (const event of events) {
    expect(event.headers.cookie).toBeUndefined();
    expect(JSON.stringify(event.body)).not.toMatch(
      /private-value|secret|bozkurt_session|resources|wolves|revision/,
    );
  }
  const rows = new Map(events.map(({ body }) => [body.id, body]));
  expect([...rows.values()].filter((row) => row.eventType === 'pageview')).toHaveLength(2);
  expect(rows.get(initial.id).duration).toBe(5);
});

test('release history is tracked as a named screen without private state', async ({ page }) => {
  const events = await productionSite(page);
  await page.goto(`${SITE}/#village`);
  await expect.poll(() => events.length).toBe(1);
  await page.getByRole('button', { name: 'Yenilikler', exact: true }).click();
  await expect.poll(() => events.length).toBe(3);
  expect(events[2].body).toMatchObject({ path: '/updates', url: `${SITE}/updates` });
  expect(events[2].body.visitorId).toBe(events[0].body.visitorId);
  expect(JSON.stringify(events[2].body)).not.toMatch(/resources|wolves|revision/);
});

test('landing and authenticated play are distinct anonymous analytics pageviews', async ({
  page,
}) => {
  const events = await productionSite(page);
  await page.goto(SITE);
  await expect.poll(() => events.length).toBe(1);
  expect(events[0].body).toMatchObject({ path: '/home', url: `${SITE}/home` });
  await page.getByRole('button', { name: 'Oynamaya başla' }).first().click();
  await expect.poll(() => events.length).toBe(3);
  expect(events[2].body).toMatchObject({ path: '/village', url: `${SITE}/village` });
  expect(events[2].body.visitorId).toBe(events[0].body.visitorId);
  expect(JSON.stringify(events[2].body)).not.toMatch(/resources|wolves|revision/);
});

test('an unauthenticated deep link records only the public homepage', async ({ page }) => {
  const events = await productionSite(page, { authenticated: false });
  await page.goto(`${SITE}/#village`);
  await expect.poll(() => events.length).toBe(1);
  expect(events[0].body.path).toBe('/home');
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await expect(page.locator('[data-action="play"]')).toHaveCount(0);
  expect(JSON.stringify(events[0].body)).not.toMatch(/resources|wolves|revision|example.com/);
});

test('analytics failure does not interrupt gameplay', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await productionSite(page, { fail: true });
  await page.goto(`${SITE}/#village`);
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  expect(errors).toEqual([]);
});

for (const preference of ['doNotTrack', 'globalPrivacyControl']) {
  test(`${preference} disables analytics requests and identifiers`, async ({ page }) => {
    await page.addInitScript(
      (key) =>
        Object.defineProperty(navigator, key, { get: () => (key === 'doNotTrack' ? '1' : true) }),
      preference,
    );
    const events = await productionSite(page);
    await page.goto(`${SITE}/#village`);
    await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
    await expect(page.locator('.map-title')).toContainText('Savaş meydanı');
    expect(events).toHaveLength(0);
    expect(events.progressions).toHaveLength(0);
    expect(
      await page.evaluate(() => localStorage.getItem('bozkurt.analytics.first-watch')),
    ).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('bozkurt.analytics.visitor'))).toBeNull();
  });
}

test('localhost never sends analytics traffic', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('analiz.bozkurtobasi.com')) requests.push(request.url());
  });
  await signIn(page);
  await page.goto('/#village');
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.analytics.visitor'))).toBeNull();
});

test('confirmed story progress upserts one anonymous chapter and reloads without duplicates', async ({
  page,
}) => {
  const events = await productionSite(page);
  await page.goto(SITE + '/#village');
  await expect.poll(() => events.progressions.length).toBe(1);
  const first = events.progressions[0].body;
  expect(first.progression).toMatchObject({
    chapter: 'first-watch',
    cohort: 'new',
    completed: [],
    claimed: [],
    firstWin: false,
  });
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await expect.poll(() => events.progressions.length).toBe(2);
  expect(events.progressions[1].body.id).toBe(first.id);
  expect(events.progressions[1].body.progression.completed).toContain('build');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  // The next confirmed snapshot and a language render must retain the successful fingerprint.
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('.map-title')).toContainText('Homeland');
  expect(events.progressions).toHaveLength(2);
  for (const event of events.progressions) {
    expect(Object.keys(event.body).sort()).toEqual(
      ['createdAt', 'eventType', 'id', 'progression', 'sessionId', 'site', 'visitorId'].sort(),
    );
    expect(event.headers.cookie).toBeUndefined();
    expect(JSON.stringify(event.body)).not.toMatch(
      /@|resources|wolves|revision|userCode|startedAt|secret/,
    );
  }
});
