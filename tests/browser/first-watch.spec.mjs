import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { FIRST_WATCH_STEPS } from '../../shared/first-watch.mjs';
import { signIn } from './sign-in.mjs';
const START = Date.UTC(2026, 9, 15, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
async function mockChapter(page, state) {
  const legacyStats = {
    first_build: 'builds',
    gatherer: 'gathers',
    first_victory: 'wins',
    pack_training: 'trained',
  };
  for (const quest of state.quests)
    quest.progress = Math.min(quest.target, state.stats[legacyStats[quest.id]]);
  expect(validateGame(state)).toBe(true);
  await signIn(page);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let revision = 0;
  const actions = [];
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const request = route.request().postDataJSON();
    expect(request.revision).toBe(revision);
    actions.push(request.action);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#quests');
  await expect(page.locator('#first-watch-panel')).toBeVisible();
  return actions;
}

test('exploration, equipment and caravan guidance advances only after confirmed outcomes', async ({
  page,
}) => {
  const state = createGame(START);
  state.stats.gathers = 1;
  state.stats.builds = 1;
  state.stats.trained = 1;
  state.stats.wins = 1;
  applyAction(state, { type: 'build', building: 'storage', plotId: 'p0' }, START);
  for (const step of FIRST_WATCH_STEPS.slice(0, 5)) {
    state.firstWatch.milestones[step.id] = START;
    state.firstWatch.claims.push({ id: step.id, at: START });
  }
  state.firstWatch.firstWinAt = START;
  const actions = await mockChapter(page, state);
  await page.locator('#fw-action-explore').click();
  await expect(page.locator('#adventure-kind')).toHaveValue('expedition');
  await expect(page.locator('#adventure-difficulty')).toBeFocused();
  expect(actions).toEqual([]);
  await page.locator('[data-action="startAdventure"]').click();
  await expect(page.locator('[data-active-adventure]')).toBeVisible();
  expect(state.firstWatch.milestones.explore).toBeNull();
  let polled = page.waitForResponse('**/api/state');
  await page.clock.fastForward(61000);
  await (await polled).finished();
  await page.locator('.nav-item[data-view="quests"]').click();
  await expect(page.locator('#fw-action-explore')).toHaveAttribute(
    'data-action',
    'claimFirstWatch',
  );
  await page.locator('#fw-action-explore').click();
  await page.locator('#fw-action-equip').click();
  await expect(page.locator('#guardian-equip-leather_vest')).toBeFocused();
  await page.locator('#guardian-equip-leather_vest').click();
  await page.locator('.nav-item[data-view="quests"]').click();
  await page.locator('#fw-action-equip').click();
  await page.locator('#fw-action-escort').click();
  await expect(page.locator('#adventure-kind')).toHaveValue('caravan');
  await expect(page.locator('#adventure-difficulty')).toBeFocused();
  expect(state.firstWatch.milestones.escort).toBeNull();
  await page.locator('[data-action="startAdventure"]').click();
  await expect(page.locator('[data-active-adventure]')).toBeVisible();
  polled = page.waitForResponse('**/api/state');
  await page.clock.fastForward(61000);
  await (await polled).finished();
  await page.locator('.nav-item[data-view="quests"]').click();
  await page.locator('#fw-action-escort').click();
  await expect(page.locator('.first-watch-count')).toHaveText('8 / 8 ödül alındı');
  await expect(page.locator('.first-watch-hero')).toContainText('İlk nöbet tamamlandı');
  expect(actions.map((action) => action.type)).toEqual([
    'expedition',
    'claimFirstWatch',
    'equip',
    'claimFirstWatch',
    'caravan',
    'claimFirstWatch',
  ]);
  expect(state.location).toBe('spring');
  await page.reload();
  await expect(page.locator('.first-watch-claimed')).toHaveCount(8);
});

test('full reward storage is explained and polling changes availability without moving focus', async ({
  page,
}) => {
  const state = createGame(START);
  state.stats.gathers = 1;
  state.firstWatch.milestones.gather = START;
  state.resources.wood = state.capacity;
  const actions = await mockChapter(page, state);
  const reward = page.locator('#fw-action-gather');
  await expect(reward).toBeDisabled();
  await expect(page.locator('#fw-reason-gather')).toContainText('depoda yer aç');
  await page.locator('#fw-storage-gather').click();
  await expect(page.locator('#economy-panel')).toBeFocused();
  expect(actions).toEqual([]);
  await page.locator('.nav-item[data-view="quests"]').click();
  const language = page.getByRole('button', { name: 'Switch to English', exact: true });
  await language.focus();
  state.resources.wood = state.capacity - 100;
  const polled = page.waitForResponse('**/api/state');
  await page.clock.fastForward(1000);
  await (await polled).finished();
  await expect(reward).toBeEnabled();
  await expect(language).toBeFocused();
  expect(actions).toEqual([]);
  await reward.click();
  await expect(page.locator('[data-step="gather"] .first-watch-claimed')).toBeVisible();
  expect(state.firstWatch.claims).toHaveLength(1);
});

test('offline First Watch is read-only, self-contained and readable in both languages at narrow widths', async ({
  page,
}) => {
  const requests = [],
    errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('preview/first-watch.html')).href);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('#language').click();
      await page.locator('#theme').click();
      for (const scenario of ['beginning', 'reward', 'ambush', 'recovery', 'blocked', 'complete']) {
        await page.locator('#preview-scenario').selectOption(scenario);
        await expect(page.locator('#chapter-example .first-watch-steps>li')).toHaveCount(8);
        expect(await page.locator('[data-action]:not(:disabled)').count()).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
    }
  }
  expect(
    await page
      .locator('[id]')
      .evaluateAll((nodes) => new Set(nodes.map((node) => node.id)).size === nodes.length),
  ).toBe(true);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
