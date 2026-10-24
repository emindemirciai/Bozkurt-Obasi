import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const HOUR = 60 * 60_000;
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const active = (page) => page.locator('[data-active-adventure]');
const countdown = (page) => active(page).locator(':scope > strong');
const planDuration = (page, id) =>
  page.locator('[data-mission-plan="' + id + '"] [data-plan-seconds]');

async function mockJourney(page, state) {
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
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const request = route.request().postDataJSON();
    expect(request.revision).toBe(revision);
    actions.push(request.action);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#world');
  await expect(page.locator('#adventure-region')).toBeVisible();
  return actions;
}

async function poll(page, milliseconds) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

test('every route keeps its six-to-twelve-hour duration across mission kinds, plans, difficulty and language', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const state = createGame(START);
  state.adventure.unlocked = ['homeland', 'spring', 'meadow', 'highland', 'ruins'];
  const before = structuredClone(state);
  const actions = await mockJourney(page, state);
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    for (const kind of ['expedition', 'caravan']) {
      await page.locator('#adventure-kind').selectOption(kind);
      for (const [region, hours] of [
        ...(kind === 'caravan' ? [['homeland', 6]] : []),
        ['spring', 6],
        ['meadow', 8],
        ['highland', 10],
        ['ruins', 12],
      ]) {
        await page.locator('#adventure-region').selectOption(region);
        for (const difficulty of ['easy', 'hard']) {
          await page.locator('#adventure-difficulty').selectOption(difficulty);
          for (const id of ['standard', 'survey', 'supply'])
            await expect(planDuration(page, id)).toHaveText(
              hours + ' ' + translations[language].journeyHours,
            );
          await expect(page.locator('[data-region="' + region + '"] .route-detail')).toContainText(
            hours + ' ' + translations[language].journeyHours,
          );
          const tier = difficulty === 'hard' ? 2 : 1;
          await expect(page.locator('[data-mission-plan="standard"] [data-plan-xp]')).toHaveText(
            '+' + hours * 30 * tier,
          );
          await expect(page.locator('[data-mission-plan="survey"] [data-plan-xp]')).toHaveText(
            '+' + Math.floor(hours * 30 * tier * 1.5),
          );
          await expect(page.locator('[data-mission-plan="supply"] [data-plan-xp]')).toHaveText(
            '+' + Math.floor(hours * 30 * tier * 0.75),
          );
        }
      }
    }
  }
  expect(state).toEqual(before);
  expect(actions).toEqual([]);
});

test('a twelve-hour escort retains its countdown through reload and awards selected guardians only at the exact arrival', async ({
  page,
}) => {
  const state = createGame(START);
  state.adventure.unlocked = ['homeland', 'spring', 'meadow', 'highland', 'ruins'];
  state.resources.water = state.resources.feed = state.capacity;
  for (const resource of ['wood', 'stone', 'herbs']) state.resources[resource] = 0;
  const before = structuredClone(state);
  const actions = await mockJourney(page, state);
  await page.locator('#adventure-kind').selectOption('caravan');
  await page.locator('#adventure-region').selectOption('ruins');
  await page.locator('#adventure-difficulty').selectOption('hard');
  await page.locator('#adventure-wolf-guardian').check();
  await page.locator('#adventure-wolf-hunter').check();
  await page.locator('[data-action="startAdventure"]').click();
  await expect(active(page)).toBeVisible();
  await expect(countdown(page)).toHaveText('12 sa');
  expect(state.adventure.active.endsAt).toBe(START + 12 * HOUR);
  expect(state.adventure.active.economyVersion).toBe(4);
  await poll(page, 6 * HOUR);
  await expect(countdown(page)).toHaveText('6 sa');
  await expect(active(page)).toHaveAttribute('data-mission-stage', 'middle');
  expect(state.wolves).toEqual(before.wolves);
  expect(state.adventure.history).toEqual([]);
  await page.reload();
  await expect(countdown(page)).toHaveText('6 sa');
  await poll(page, 6 * HOUR - 1000);
  await expect(countdown(page)).toHaveText('1 sn');
  expect(state.wolves).toEqual(before.wolves);
  expect(state.adventure.history).toEqual([]);
  await poll(page, 1000);
  await expect(active(page)).toHaveCount(0);
  const receipt = page.locator('[data-mission-report="outing-1"]');
  await expect(receipt).toBeVisible();
  await expect(receipt.locator('[data-report-reward]')).toContainText(
    '384 ' + translations.tr.wood,
  );
  await expect(receipt.locator('[data-report-reward]')).toContainText(
    '240 ' + translations.tr.stone,
  );
  await expect(receipt.locator('[data-report-reward]')).toContainText(
    '72 ' + translations.tr.herbs,
  );
  await expect(receipt.locator('[data-report-reward]')).toContainText('+720 ' + translations.tr.xp);
  expect(state.location).toBe('ruins');
  expect(state.adventure.history[0].completedAt).toBe(START + 12 * HOUR);
  for (const wolf of state.wolves) {
    if (['wolf-alpha', 'wolf-guardian', 'wolf-hunter'].includes(wolf.id))
      expect((45 * wolf.level * (wolf.level - 1)) / 2 + wolf.xp).toBe(720);
    else expect(wolf).toEqual(before.wolves.find((entry) => entry.id === wolf.id));
  }
  const paid = structuredClone(state);
  await page.reload();
  await expect(receipt).toBeVisible();
  expect(state).toEqual(paid);
  expect(actions).toHaveLength(1);
  expect(actions[0].type).toBe('caravan');
});

test('a saved version-two countdown and promised rewards remain short after polling, language changes and reload', async ({
  page,
}) => {
  const state = createGame(START);
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
  state.adventure.active.economyVersion = 2;
  state.adventure.active.endsAt = START + 75_000;
  const actions = await mockJourney(page, state);
  await expect(countdown(page)).toHaveText('1 dk 15 sn');
  await expect(planDuration(page, 'survey')).toHaveText('1 dk 15 sn');
  await expect(page.locator('[data-active-economy="legacy"]')).toBeVisible();
  await poll(page, 30_000);
  await expect(countdown(page)).toHaveText('45 sn');
  await page.locator('[data-action="language"]').click();
  await expect(countdown(page)).toHaveText('45 sec');
  await expect(planDuration(page, 'survey')).toHaveText('1 min 15 sec');
  await page.reload();
  await expect(countdown(page)).toHaveText('45 sec');
  await poll(page, 45_000);
  await expect(active(page)).toHaveCount(0);
  expect(state.adventure.history[0].economyVersion).toBe(2);
  expect(state.adventure.history[0].xp).toBe(45);
  expect(state.adventure.history[0].reward).toEqual({
    water: 0,
    feed: 0,
    wood: 12,
    stone: 7,
    herbs: 2,
  });
  expect(actions).toEqual([]);
});
