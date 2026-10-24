import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const suggestion = (page, id) => page.locator('[data-party-suggestion="' + id + '"]');
const forecastRow = (page, id) => page.locator('[data-party-forecast="' + id + '"]');
const checkedParty = (page) =>
  page
    .locator('[name="adventure-wolf"]:checked')
    .evaluateAll((nodes) => nodes.map((node) => node.value));

async function mockAdventure(page, state) {
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
    const request = route.request().postDataJSON();
    actions.push(request.action);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  return actions;
}

test('computed party choices preserve focus and server state, then an explicit departure uses the manual roster', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  state.wolves.find((wolf) => wolf.name === 'scout').equipment = 'scout_charm';
  state.wolves.find((wolf) => wolf.name === 'hunter').xp = 44;
  state.wolves.find((wolf) => wolf.name === 'healer').xp = 43;
  const before = structuredClone(state);
  const actions = await mockAdventure(page, state);
  await page.goto('/#world');
  await expect(page.locator('[data-party-card]')).toHaveCount(3);
  await expect(page.locator('[data-party-card="scouting"] .party-suggestion-names')).toHaveText(
    translations.tr.scout,
  );
  await expect(page.locator('[data-party-card="scouting"] [data-party-seconds]')).toHaveText(
    '6 ' + translations.tr.journeyHours,
  );
  await expect(page.locator('[data-party-card="resilience"] .party-suggestion-names')).toHaveText(
    translations.tr.guardian,
  );
  await expect(page.locator('[data-party-card="training"] .party-suggestion-names')).toHaveText(
    translations.tr.hunter,
  );
  await page.evaluate(() => {
    window.partyButtons = [...document.querySelectorAll('[data-party-suggestion]')];
  });
  for (const [strategy, id] of [
    ['resilience', 'wolf-guardian'],
    ['training', 'wolf-hunter'],
    ['scouting', 'wolf-scout'],
  ]) {
    await suggestion(page, strategy).focus();
    await page.keyboard.press('Enter');
    await expect(suggestion(page, strategy)).toBeFocused();
    await expect(suggestion(page, strategy)).toHaveAttribute('aria-pressed', 'true');
    expect(await checkedParty(page)).toEqual([id]);
  }
  expect(await page.evaluate(() => window.partyButtons.every((node) => node.isConnected))).toBe(
    true,
  );
  await expect(page.locator('[data-adventure-cost]')).toContainText(
    '6 ' + translations.tr.journeyHours,
  );
  await expect(page.locator('[data-mission-plan="standard"] [data-plan-seconds]')).toHaveText(
    '6 ' + translations.tr.journeyHours,
  );
  await expect(page.locator('[data-region="spring"] .route-detail')).toContainText(
    '6 ' + translations.tr.journeyHours,
  );
  expect(actions).toEqual([]);
  expect(state).toEqual(before);

  // A visible roster update takes the full-render path, which must preserve suggestion buttons.
  state.wolves.find((wolf) => wolf.name === 'guardian').hp -= 1;
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(5000);
  await (await response).finished();
  expect(await page.evaluate(() => window.partyButtons.every((node) => node.isConnected))).toBe(
    true,
  );
  await expect(suggestion(page, 'scouting')).toBeFocused();
  expect(await checkedParty(page)).toEqual(['wolf-scout']);
  expect(state.resources).toEqual(before.resources);
  expect(actions).toEqual([]);

  await page.getByRole('button', { name: 'Switch to English' }).click();
  expect(await checkedParty(page)).toEqual(['wolf-scout']);
  await expect(suggestion(page, 'scouting')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#adventure-wolf-alpha').check();
  expect(await checkedParty(page)).toEqual(['wolf-alpha', 'wolf-scout']);
  await expect(page.locator('[data-action="startAdventure"]')).toBeEnabled();
  expect(actions).toEqual([]);
  const departure = page.waitForResponse('**/api/action');
  await page.locator('[data-action="startAdventure"]').click();
  await (await departure).finished();
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({
    type: 'expedition',
    kind: 'expedition',
    region: 'spring',
    difficulty: 'easy',
    plan: 'standard',
    wolfIds: ['wolf-alpha', 'wolf-scout'],
  });
  expect(state.adventure.active.wolfIds).toEqual(['wolf-alpha', 'wolf-scout']);
});

test('arrival rows show real fatigue, level-up healing and only accepted XP at the level cap', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  state.resources.water = state.resources.feed = state.capacity;
  state.adventure.unlocked = ['homeland', 'spring', 'meadow', 'highland', 'ruins'];
  state.wolves[0].hp = 20;
  state.wolves[0].xp = 44;
  state.wolves[1].level = 20;
  state.wolves[1].xp = 898;
  const before = structuredClone(state);
  const actions = await mockAdventure(page, state);
  await page.goto('/#world');
  await page.locator('#adventure-region').selectOption('ruins');
  await page.locator('#adventure-difficulty').selectOption('normal');
  await page.locator('#adventure-plan-survey').check();
  await page.locator('#adventure-wolf-guardian').check();
  const actual = structuredClone(state);
  applyAction(
    actual,
    {
      type: 'expedition',
      region: 'ruins',
      difficulty: 'normal',
      plan: 'survey',
      wolfIds: ['wolf-alpha', 'wolf-guardian'],
    },
    START,
  );
  advanceGame(actual, actual.adventure.active.endsAt);
  expect(validateGame(actual)).toBe(true);
  for (const id of ['wolf-alpha', 'wolf-guardian']) {
    const arrived = actual.wolves.find((wolf) => wolf.id === id);
    await expect(forecastRow(page, id).locator('[data-party-arrival-hp] strong')).toHaveText(
      arrived.hp + ' / ' + arrived.maxHp,
    );
    await expect(forecastRow(page, id).locator('[data-party-arrival-xp] strong')).toHaveText(
      arrived.level >= 20
        ? translations.tr.partyForecastMaxXp.replace('{xp}', String(arrived.xp))
        : arrived.xp + ' / ' + arrived.level * 45,
    );
  }
  await expect(forecastRow(page, 'wolf-alpha').locator('.party-level-up')).toContainText('6');
  await expect(forecastRow(page, 'wolf-alpha')).toContainText(
    translations.tr.partyForecastHealing.replace('{count}', '5').replace('{points}', '5'),
  );
  await expect(forecastRow(page, 'wolf-guardian').locator('[data-party-arrival-xp]')).toContainText(
    '+1 ' + translations.tr.xp,
  );
  await expect(forecastRow(page, 'wolf-guardian')).toContainText(
    translations.tr.partyForecastXpCapped,
  );
  await expect(forecastRow(page, 'wolf-guardian').locator('.party-level-up')).toHaveCount(0);
  expect(actions).toEqual([]);
  expect(state).toEqual(before);
});

test('party shortages and active battle or journey locks disable suggestions with specific explanations', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  state.wolves[0].hp = 20;
  for (const wolf of state.wolves.slice(1)) wolf.hp = 19;
  const actions = await mockAdventure(page, state);
  await page.goto('/#world');
  await page.locator('#adventure-difficulty').selectOption('hard');
  for (const strategy of ['scouting', 'resilience', 'training']) {
    await expect(suggestion(page, strategy)).toBeDisabled();
    await expect(page.locator('#party-suggestion-reason-' + strategy)).toContainText(
      translations.tr.partySuggestionBlocked_party
        .replace('{eligible}', '1')
        .replace('{required}', '3'),
    );
  }
  await expect(page.locator('[name="adventure-wolf"]:enabled')).toHaveCount(1);
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  expect(actions).toEqual([]);
  for (const activity of ['battle', 'adventure', 'legacy']) {
    Object.assign(state, createGame(START));
    if (activity === 'battle') applyAction(state, { type: 'startBattle' }, START);
    if (activity === 'adventure')
      applyAction(
        state,
        {
          type: 'expedition',
          region: 'spring',
          difficulty: 'easy',
          wolfIds: ['wolf-alpha'],
        },
        START,
      );
    if (activity === 'legacy') state.journey = { destination: 'spring', endsAt: START + 60000 };
    expect(validateGame(state), activity + ' fixture must be a valid save').toBe(true);
    const refreshedSession = page.waitForResponse('**/api/session');
    await page.reload();
    await (await refreshedSession).finished();
    for (const strategy of ['scouting', 'resilience', 'training']) {
      await expect(suggestion(page, strategy)).toBeDisabled();
      await expect(page.locator('#party-suggestion-reason-' + strategy)).toHaveText(
        translations.tr['partySuggestionBlocked_' + (activity === 'battle' ? 'battle' : 'journey')],
      );
    }
    await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
    expect(actions).toEqual([]);
  }
});

test('offline party planning uses no network or browser storage and fits both themes and languages on mobile', async ({
  page,
}) => {
  // Eight responsive/theme/language combinations re-render the inline portrait atlas.
  test.setTimeout(60_000);
  const network = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:\/\//, (route) => {
    network.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(() => {
    window.partyStorageCalls = [];
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          window.partyStorageCalls.push(name);
          throw new Error('Offline preview must not access ' + name);
        },
      });
    }
  });
  await page.goto(pathToFileURL(resolve('preview/adventure.html')).href);
  await expect(page.locator('#adventure-party-suggestions')).toBeVisible();
  await suggestion(page, 'scouting').click();
  expect(await checkedParty(page)).toEqual(['wolf-alpha', 'wolf-scout']);
  await suggestion(page, 'training').click();
  expect(await checkedParty(page)).toEqual(['wolf-hunter', 'wolf-healer']);
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('#language').click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('#theme').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await checkedParty(page)).toEqual(['wolf-hunter', 'wolf-healer']);
        await expect(page.locator('#adventure-party-forecast')).toBeVisible();
        await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
    }
  }
  await page.locator('#preview-scenario').selectOption('activejourney');
  for (const strategy of ['scouting', 'resilience', 'training'])
    await expect(suggestion(page, strategy)).toBeDisabled();
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  expect(await page.evaluate(() => window.partyStorageCalls)).toEqual([]);
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});
