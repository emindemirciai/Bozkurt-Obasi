import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const START = Date.UTC(2026, 9, 19, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const notice = (page) => page.locator('#arrival-notice');

function departing({ legacy = false, capped = false } = {}) {
  const state = createGame(START);
  if (capped) {
    state.resources.wood = 499.5;
    state.resources.stone = state.capacity;
    state.resources.herbs = state.capacity;
    state.inventory.leather_vest = 10000;
  }
  applyAction(
    state,
    {
      type: 'expedition',
      region: 'spring',
      difficulty: 'easy',
      plan: 'survey',
      wolfIds: ['wolf-alpha'],
    },
    START,
  );
  if (legacy) {
    delete state.adventure.active.plan;
    delete state.adventure.active.economyVersion;
    // Legacy standard journeys took 60 seconds, before purpose selection existed.
    state.adventure.active.endsAt = START + 60000;
  }
  expect(validateGame(state)).toBe(true);
  return state;
}

function completed(options) {
  const state = departing(options);
  advanceGame(state, state.adventure.active.endsAt);
  expect(validateGame(state)).toBe(true);
  return state;
}

async function mockVillage(page, state, { freeze = false } = {}) {
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  let revision = 0;
  const actions = [];
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    if (!freeze) advanceGame(state, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', (route) => {
    actions.push(route.request().postDataJSON());
    return route.abort();
  });
  return actions;
}

async function poll(page, milliseconds = 1100) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

for (const view of ['village', 'wolves']) {
  test(
    'a journey finishing on ' + view + ' shows actual credits without issuing a claim',
    async ({ page }) => {
      await signIn(page);
      const state = departing({ capped: true });
      const finishesIn = state.adventure.active.endsAt - START;
      const actions = await mockVillage(page, state);
      await page.goto('/#' + view);
      await expect(page.locator('.game-shell')).toBeVisible();
      await expect(notice(page)).toHaveCount(0);
      const focused = page.locator('[data-view="' + view + '"]');
      await focused.focus();
      await poll(page, finishesIn + 1000);
      await expect(notice(page)).toBeVisible();
      await expect(notice(page)).toHaveAttribute('data-arrival-source', 'returned');
      await expect(page.locator('#arrival-unread')).toHaveText('1');
      await expect(focused).toBeFocused();
      const report = state.adventure.history[0];
      expect(report.reward.wood).toBe(0.5);
      expect(report.reward.stone).toBe(0);
      expect(report.reward.herbs).toBe(0);
      expect(report.itemCount).toBe(0);
      for (const resource of ['water', 'feed', 'herbs', 'wood', 'stone']) {
        const amount = report.reward[resource].toLocaleString('tr-TR', {
          maximumFractionDigits: 3,
        });
        await expect(
          notice(page).locator('[data-arrival-resource="' + resource + '"]'),
        ).toContainText(amount);
        await expect(
          notice(page).locator('[data-arrival-resource="' + resource + '"]'),
        ).toContainText(translations.tr[resource]);
      }
      await expect(notice(page).locator('[data-arrival-item]')).toContainText('0');
      await expect(notice(page).locator('[data-arrival-wolf="wolf-alpha"]')).toContainText(
        String(report.xp),
      );
      await expect(notice(page).locator('[data-arrival-wolf]')).toHaveCount(1);
      await poll(page);
      await expect(page.locator('#arrival-unread')).toHaveText('1');
      expect(actions).toEqual([]);
      expect(await page.evaluate(() => localStorage.getItem('bozkurt.web.v1'))).toBeNull();
    },
  );
}

test('report navigation focuses the saved receipt, acknowledges it and stays acknowledged after reload', async ({
  page,
}) => {
  await signIn(page);
  const state = departing();
  const finishesIn = state.adventure.active.endsAt - START;
  const actions = await mockVillage(page, state);
  await page.goto('/#village');
  await expect(page.locator('.game-shell')).toBeVisible();
  await poll(page, finishesIn + 1000);
  await expect(notice(page)).toBeVisible();
  const credited = structuredClone(state);
  await page.locator('#arrival-report').click();
  await expect(page).toHaveURL('/#world');
  await expect(page.locator('[data-mission-report="outing-1"]')).toBeFocused();
  await expect(page.locator('#arrival-unread')).toBeHidden();
  await expect(notice(page)).toHaveCount(0);
  expect(state).toEqual(credited);
  await page.reload();
  await expect(page.locator('[data-mission-report="outing-1"]')).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
  await expect(page.locator('#arrival-unread')).toBeHidden();
  expect(actions).toEqual([]);
});

test('unseen history gets a neutral latest receipt and dismissing it persists without changing the game', async ({
  page,
}) => {
  await signIn(page);
  const state = completed({ legacy: true });
  const actions = await mockVillage(page, state, { freeze: true });
  const before = structuredClone(state);
  await page.goto('/#village');
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toHaveAttribute('data-arrival-source', 'existing');
  await expect(page.locator('#arrival-unread')).toHaveText('1');
  await page.reload();
  await expect(notice(page)).toHaveAttribute('data-arrival-source', 'existing');
  await page.locator('#arrival-dismiss').click();
  await expect(notice(page)).toHaveCount(0);
  await expect(page.locator('#arrival-unread')).toBeHidden();
  await page.reload();
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
  expect(state).toEqual(before);
  expect(actions).toEqual([]);
});

test('dismissing one account receipt never hides another account receipt with the same outing id', async ({
  page,
}) => {
  await signIn(page);
  const first = await (await page.request.get('/api/auth/player/status')).json();
  const state = completed();
  const actions = await mockVillage(page, state, { freeze: true });
  await page.goto('/#village');
  await expect(notice(page)).toBeVisible();
  await page.locator('#arrival-dismiss').click();
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await signIn(page);
  const second = await (await page.request.get('/api/auth/player/status')).json();
  expect(second.user.userCode).not.toBe(first.user.userCode);
  // A real OAuth callback performs a document navigation, rather than a hash-only change.
  await page.goto('/?auth=success#village');
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toHaveAttribute('data-arrival-source', 'existing');
  await expect(page.locator('#arrival-unread')).toHaveText('1');
  expect(actions).toEqual([]);
});

test('older history stays in reports while only the latest receipt is announced', async ({
  page,
}) => {
  await signIn(page);
  const state = completed();
  const secondStart = state.updatedAt + 1000;
  applyAction(
    state,
    {
      type: 'expedition',
      region: 'spring',
      difficulty: 'easy',
      wolfIds: ['wolf-alpha'],
    },
    secondStart,
  );
  advanceGame(state, state.adventure.active.endsAt);
  expect(validateGame(state)).toBe(true);
  const actions = await mockVillage(page, state, { freeze: true });
  await page.goto('/#village');
  await expect(notice(page)).toBeVisible();
  await expect(page.locator('#arrival-unread')).toHaveText('1');
  await page.locator('#arrival-report').click();
  await expect(page.locator('[data-mission-report="outing-2"]')).toBeFocused();
  await expect(page.locator('[data-mission-report]')).toHaveCount(2);
  await expect(notice(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-mission-report]')).toHaveCount(2);
  await expect(notice(page)).toHaveCount(0);
  expect(actions).toEqual([]);
});

test('a delayed completed-journey poll cannot restore a notice after logout', async ({ page }) => {
  await signIn(page);
  const state = departing();
  const finished = structuredClone(state);
  advanceGame(finished, finished.adventure.active.endsAt);
  await mockVillage(page, state, { freeze: true });
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  await page.route('**/api/state', async (route) => {
    started.resolve();
    await release.promise;
    await route.fulfill(json({ state: finished, revision: 1 }));
  });
  await page.goto('/#village');
  await expect(page.locator('.game-shell')).toBeVisible();
  await page.clock.fastForward(1100);
  await started.promise;
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(page.locator('.game-shell')).toHaveCount(0);
  const response = page.waitForResponse('**/api/state');
  release.resolve();
  await (await response).finished();
  await page.clock.fastForward(1100);
  await expect(notice(page)).toHaveCount(0);
  await expect(page.locator('#arrival-unread')).toHaveCount(0);
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await signIn(page);
  await page.goto('/?auth=success#village');
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test('an unchanged receipt preserves its report control and keyboard focus over polling', async ({
  page,
}) => {
  await signIn(page);
  const state = completed();
  const actions = await mockVillage(page, state, { freeze: true });
  await page.goto('/#village');
  const control = page.locator('#arrival-report');
  await expect(control).toBeVisible();
  await control.focus();
  await page.evaluate(() => {
    window.arrivalReportControl = document.querySelector('#arrival-report');
  });
  await poll(page);
  await expect(control).toBeFocused();
  expect(
    await page.evaluate(
      () => window.arrivalReportControl === document.querySelector('#arrival-report'),
    ),
  ).toBe(true);
  await poll(page);
  await expect(control).toBeFocused();
  expect(actions).toEqual([]);
});

test('the receipt stays readable on narrow phones in both languages, themes and reduced motion', async ({
  page,
}) => {
  await signIn(page);
  const state = completed({ capped: true });
  const actions = await mockVillage(page, state, { freeze: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#wolves');
  await expect(notice(page)).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('[data-action="language"]').click();
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('[data-action="theme"]').click();
        await expect(notice(page)).toBeVisible();
        await expect(notice(page).locator('[data-arrival-resource="wood"]')).toContainText(
          translations[language].wood,
        );
        await expect(notice(page).locator('[data-arrival-resource="wood"]')).toContainText(
          language === 'tr' ? '0,5' : '0.5',
        );
        await expect(page.locator('#arrival-report')).toBeEnabled();
        await expect(page.locator('#arrival-dismiss')).toBeEnabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const box = await notice(page).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
  }
  expect(actions).toEqual([]);
});

test('offline completed-journey preview uses the receipt component without network, game writes or dismissal', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const network = [],
    errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().setOffline(true);
  try {
    await page.goto(pathToFileURL(resolve('preview/adventure.html')).href);
    await page.locator('#preview-scenario').selectOption('completedjourney');
    await expect(notice(page)).toBeVisible();
    await expect(page.locator('#arrival-dismiss')).toBeDisabled();
    const before = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('#arrival-report').click();
    await expect(page.locator('[data-mission-report]')).toBeFocused();
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('#language').click();
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('#theme').click();
        await page.setViewportSize({ width: 320, height: 950 });
        await expect(notice(page)).toBeVisible();
        await expect(page.locator('#arrival-dismiss')).toBeDisabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          320,
        );
      }
    }
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
    expect(network).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await page.context().setOffline(false);
    await page.goto('about:blank');
  }
});
