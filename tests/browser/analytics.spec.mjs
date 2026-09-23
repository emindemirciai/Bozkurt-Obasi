import { test, expect } from '@playwright/test';

const SITE = 'https://bozkurtobasi.com';
const COLLECTOR = 'https://analiz.bozkurtobasi.com/api/track';

async function productionSite(page, options = {}) {
  const events = [];
  await page.route(`${SITE}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:4173${url.pathname}${url.search}`,
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
    events.push({ body: route.request().postDataJSON(), headers: route.request().headers() });
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
  await page.goto(`${SITE}/?token=private-value#secret`);
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
  await page.getByRole('button', { name: 'Savunma', exact: true }).click();
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
  await page.getByRole('button', { name: 'Sağ kanat', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.clock.fastForward(3000);
  expect(events).toHaveLength(3); // Rendering, tactics and translation do not count as visits.
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

test('analytics failure does not interrupt gameplay', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await productionSite(page, { fail: true });
  await page.goto(SITE);
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
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
    await page.goto(SITE);
    await page.getByRole('button', { name: 'Savunma', exact: true }).click();
    await expect(page.locator('.map-title')).toContainText('Savunma hattı');
    expect(events).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('bozkurt.analytics.visitor'))).toBeNull();
  });
}

test('localhost never sends analytics traffic', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('analiz.bozkurtobasi.com')) requests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Savunma', exact: true }).click();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.analytics.visitor'))).toBeNull();
});
