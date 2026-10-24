import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { adventureQuote } from '../../shared/adventures.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const START = Date.UTC(2026, 9, 16, 10);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const plan = (page, id) => page.locator('#adventure-plan-' + id);
const card = (page, id) => page.locator('[data-mission-plan="' + id + '"]');

async function mockJourney(page, state) {
  let revision = 0;
  const actions = [];
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const { action } = route.request().postDataJSON();
    actions.push(action);
    applyAction(state, action, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  return actions;
}

async function poll(page, milliseconds) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

test('mission plans compare real consequences, preserve focus and submit the selected objective', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  state.resources.water = state.resources.feed = state.capacity;
  const actions = await mockJourney(page, state);
  await page.goto('/#world');
  const selection = {
    kind: 'expedition',
    region: 'spring',
    difficulty: 'easy',
    wolfIds: ['wolf-alpha'],
  };
  for (const id of ['standard', 'survey', 'supply']) {
    const quote = adventureQuote(state, { ...selection, plan: id });
    await expect(card(page, id).locator('[data-plan-xp]')).toHaveText('+' + quote.xp);
    await expect(card(page, id).locator('[data-plan-seconds]')).toHaveText(
      '6 ' + translations.tr.journeyHours,
    );
    await expect(card(page, id).locator('[data-plan-fatigue]')).toContainText(
      String(quote.fatigue),
    );
  }
  await plan(page, 'standard').focus();
  await page.keyboard.press('ArrowRight');
  await expect(plan(page, 'survey')).toBeChecked();
  await expect(plan(page, 'survey')).toBeFocused();
  await expect(page.locator('[data-adventure-cost]')).toContainText('104 ' + translations.tr.water);
  await expect(page.locator('.fatigue-note')).toContainText('7');
  await page.evaluate(() => {
    window.planRadio = document.querySelector('#adventure-plan-survey');
  });
  await poll(page, 5000);
  await expect(plan(page, 'survey')).toBeFocused();
  expect(
    await page.evaluate(
      () => window.planRadio === document.querySelector('#adventure-plan-survey'),
    ),
  ).toBe(true);
  await page.locator('#adventure-difficulty').selectOption('normal');
  await page.locator('#adventure-wolf-scout').check();
  await expect(plan(page, 'survey')).toBeChecked();
  await expect(card(page, 'survey').locator('[data-plan-xp]')).toHaveText('+405');
  expect(actions).toEqual([]);
  const response = page.waitForResponse('**/api/action');
  await page.locator('[data-action="startAdventure"]').click();
  await (await response).finished();
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({
    type: 'expedition',
    plan: 'survey',
    difficulty: 'normal',
    wolfIds: ['wolf-alpha', 'wolf-scout'],
  });
  await expect(plan(page, 'survey')).toBeChecked();
  await expect(page.locator('[name="adventure-plan"]:enabled')).toHaveCount(0);
  await expect(page.locator('[data-active-plan]')).toHaveText(translations.tr.missionPlan_survey);
});

test('story stages follow server time, keep objectives locked and report actual fractional awards', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  state.resources.wood = state.capacity - 0.5;
  applyAction(
    state,
    {
      type: 'expedition',
      region: 'spring',
      difficulty: 'easy',
      wolfIds: ['wolf-alpha'],
      plan: 'survey',
    },
    START,
  );
  const actions = await mockJourney(page, state);
  await page.goto('/#world');
  await expect(page.locator('[data-active-adventure]')).toHaveAttribute(
    'data-mission-stage',
    'departure',
  );
  await expect(page.locator('[data-active-adventure] [data-mission-story]')).toHaveText(
    translations.tr.story_expedition_spring_departure,
  );
  await expect(plan(page, 'survey')).toBeDisabled();
  await poll(page, 7_201_000);
  await expect(page.locator('[data-active-adventure]')).toHaveAttribute(
    'data-mission-stage',
    'middle',
  );
  await expect(page.locator('.mission-stages [aria-current="step"]')).toContainText(
    translations.tr.missionStageMiddle,
  );
  await poll(page, 7_201_000);
  await expect(page.locator('[data-active-adventure]')).toHaveAttribute(
    'data-mission-stage',
    'arrival',
  );
  await expect(page.locator('[data-active-adventure] [data-mission-story]')).toHaveText(
    translations.tr.story_expedition_spring_arrival,
  );
  await expect(page.locator('[data-mission-report]')).toHaveCount(0);
  await poll(page, 7_199_000);
  await expect(page.locator('[data-active-adventure]')).toHaveCount(0);
  const report = page.locator('[data-mission-report="outing-1"]');
  await expect(report.locator('[data-report-plan]')).toHaveText(translations.tr.missionPlan_survey);
  await expect(report.locator('[data-report-reward]')).toContainText('0,5 ' + translations.tr.wood);
  await expect(report.locator('[data-mission-story]')).toHaveText(
    translations.tr.story_expedition_spring_report,
  );
  expect(state.adventure.history[0].reward.wood).toBe(0.5);
  expect(actions).toEqual([]);
});

test('legacy missions keep the standard label and a full store gives an explicit zero-material receipt', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
  applyAction(
    state,
    { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-alpha'] },
    START,
  );
  delete state.adventure.active.plan;
  delete state.adventure.active.economyVersion;
  state.adventure.active.endsAt = START + 60_000;
  await mockJourney(page, state);
  await page.goto('/#world');
  await expect(plan(page, 'standard')).toBeChecked();
  await expect(page.locator('[data-active-plan]')).toHaveText(translations.tr.missionPlan_standard);
  await poll(page, 61000);
  const report = page.locator('[data-mission-report="outing-1"]');
  await expect(report.locator('[data-report-plan]')).toHaveText(
    translations.tr.missionPlan_standard,
  );
  await expect(report.locator('[data-report-reward]')).toContainText(
    translations.tr.missionNoMaterials,
  );
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(report.locator('[data-report-plan]')).toHaveText(
    translations.en.missionPlan_standard,
  );
  await expect(report.locator('[data-report-reward]')).toContainText(
    translations.en.missionNoMaterials,
  );
});

test('regional briefs distinguish exploration from herd escort in both languages without issuing actions', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  const actions = await mockJourney(page, state);
  await page.goto('/#world');
  for (const language of ['tr', 'en']) {
    if (language === 'en') await page.getByRole('button', { name: 'Switch to English' }).click();
    for (const kind of ['expedition', 'caravan']) {
      await page.locator('#adventure-kind').selectOption(kind);
      for (const region of kind === 'caravan'
        ? ['homeland', 'spring', 'meadow', 'highland', 'ruins']
        : ['spring', 'meadow', 'highland', 'ruins']) {
        await page.locator('#adventure-region').selectOption(region);
        await expect(page.locator('[data-mission-brief]')).toHaveText(
          translations[language]['story_' + kind + '_' + region + '_departure'],
        );
      }
    }
  }
  expect(actions).toEqual([]);
});

test('offline mission previews support plan selection and completed reports without network or mobile overflow', async ({
  page,
}) => {
  const network = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:\/\//, (route) => {
    network.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(resolve('preview/adventure.html')).href);
  await plan(page, 'supply').check();
  await expect(plan(page, 'supply')).toBeFocused();
  await expect(page.locator('.adventure-brief .mission-plan-badge')).toHaveText(
    translations.tr.missionPlan_supply,
  );
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('#language').click();
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('#theme').click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await expect(plan(page, 'supply')).toBeChecked();
      }
    }
  }
  await page.locator('#preview-scenario').selectOption('activejourney');
  await expect(plan(page, 'survey')).toBeDisabled();
  await expect(plan(page, 'survey')).toBeChecked();
  await expect(page.locator('[data-active-adventure]')).toHaveAttribute(
    'data-mission-stage',
    'middle',
  );
  await page.locator('#preview-scenario').selectOption('completedjourney');
  await expect(page.locator('[data-mission-report]')).toHaveCount(1);
  await expect(page.locator('[data-report-plan]')).toHaveText(translations.en.missionPlan_supply);
  await expect(page.locator('[data-mission-report] [data-mission-story]')).toHaveText(
    translations.en.story_caravan_meadow_report,
  );
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});
