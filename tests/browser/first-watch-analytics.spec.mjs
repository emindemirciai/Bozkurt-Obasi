import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../web/analytics.mjs', import.meta.url), 'utf8');
const SITE = 'https://bozkurtobasi.com';
const COLLECTOR = 'https://analiz.bozkurtobasi.com/api/track';
const state = {
  firstWatch: {
    version: 1,
    cohort: 'new',
    startedAt: 1000,
    firstWinAt: null,
    milestones: {
      gather: null,
      build: null,
      train: null,
      battle: null,
      recover: null,
      explore: null,
      equip: null,
      escort: null,
    },
    claims: [],
  },
  resources: { private: 100 },
  email: 'must-not-send@example.test',
};

async function harness(page, { fail = false, delayConfig = false } = {}) {
  const requests = [];
  let releaseConfig;
  const gate = delayConfig
    ? new Promise((resolve) => {
        releaseConfig = resolve;
      })
    : Promise.resolve();
  await page.route(SITE + '/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/config') {
      await gate;
      return route.fulfill({
        json: {
          analytics: {
            enabled: true,
            site: 'bozkurtobasi.com',
            endpoint: COLLECTOR,
            allowedOrigins: [SITE],
          },
        },
      });
    }
    return route.fulfill({
      contentType: 'text/html',
      body: '<html><body>isolated optional telemetry</body></html>',
    });
  });
  await page.route(COLLECTOR, async (route) => {
    const headers = {
      'access-control-allow-origin': SITE,
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: fail ? 503 : 200, headers, json: { ok: !fail } });
  });
  await page.goto(SITE + '/telemetry-test');
  await page.evaluate((text) => {
    window.createTestAnalytics = new Function(
      text.replace('export function', 'function') + '\nreturn createAnalytics;',
    )();
    window.tracker = window.createTestAnalytics();
  }, source);
  return {
    requests,
    releaseConfig,
    succeed: () => {
      fail = false;
    },
  };
}
const progress = (page, key = 'player@example.test', value = state) =>
  page.evaluate(({ key, value }) => window.tracker.progress(value, key), { key, value });

test('config arriving after authenticated state still sends only one closed snapshot', async ({
  page,
}) => {
  const h = await harness(page, { delayConfig: true });
  await progress(page);
  expect(h.requests).toHaveLength(0);
  h.releaseConfig();
  await expect.poll(() => h.requests.length).toBe(1);
  for (let index = 0; index < 8; index++) await progress(page);
  expect(h.requests).toHaveLength(1);
  expect(h.requests[0].progression).toEqual({
    chapter: 'first-watch',
    cohort: 'new',
    completed: [],
    claimed: [],
    firstWin: false,
  });
  const stored = await page.evaluate(() => localStorage.getItem('bozkurt.analytics.first-watch'));
  expect(stored).not.toContain('@');
  expect(JSON.stringify(h.requests)).not.toMatch(/@|resources|startedAt|email/);
});

test('same-browser accounts are distinct and failed snapshot retries retain their id without flooding', async ({
  page,
}) => {
  await page.clock.install();
  const h = await harness(page, { fail: true });
  await progress(page, 'one@example.test');
  await expect.poll(() => h.requests.length).toBe(1);
  for (let index = 0; index < 10; index++) await progress(page, 'one@example.test');
  expect(h.requests).toHaveLength(1);
  const id = h.requests[0].id;
  h.succeed();
  await page.clock.fastForward(31_000);
  await progress(page, 'one@example.test');
  await expect.poll(() => h.requests.length).toBe(2);
  expect(h.requests[1].id).toBe(id);
  await page.evaluate(() => window.tracker.reset());
  await progress(page, 'two@example.test');
  await expect.poll(() => h.requests.length).toBe(3);
  expect(h.requests[2].id).not.toBe(id);
  expect(h.requests[2].visitorId).toBe(h.requests[0].visitorId);
  expect(JSON.stringify(h.requests)).not.toContain('@');
});

test('logout before delayed config and privacy preferences suppress chapter identifiers', async ({
  page,
}) => {
  const h = await harness(page, { delayConfig: true });
  await progress(page);
  await page.evaluate(() => window.tracker.reset());
  h.releaseConfig();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('bozkurt.analytics.visitor')))
    .not.toBeNull();
  expect(h.requests).toHaveLength(0);
  expect(
    await page.evaluate(() => localStorage.getItem('bozkurt.analytics.first-watch')),
  ).toBeNull();
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }),
  );
  await progress(page);
  expect(h.requests).toHaveLength(0);
  expect(
    await page.evaluate(() => localStorage.getItem('bozkurt.analytics.first-watch')),
  ).toBeNull();
});

test('a reload after an unacknowledged collection keeps the persisted retry identifier', async ({
  page,
}) => {
  const h = await harness(page, { fail: true });
  await progress(page);
  await expect.poll(() => h.requests.length).toBe(1);
  const id = h.requests[0].id;
  // Recreate the module instance as a reload would, while preserving browser storage.
  await page.evaluate(() => {
    window.tracker.reset();
    window.tracker = window.createTestAnalytics();
  });
  h.succeed();
  await progress(page);
  await expect.poll(() => h.requests.length).toBe(2);
  expect(h.requests[1].id).toBe(id);
});
