import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 15, 10);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

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
    const request = route.request().postDataJSON();
    actions.push(request.action);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
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

const card = (page, region) =>
  page.locator(`[data-action="selectRegion"][data-region="${region}"]`);
const check = (page, id) => page.locator(`[data-ready-check="${id}"]`);

test('route cards explain discovery order and current destinations without spending resources', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  const before = structuredClone(state.resources);
  const actions = await mockJourney(page, state);
  await page.goto('/#world');
  await expect(page.locator('.route-card')).toHaveCount(5);
  await expect(page.locator('[data-region-status="homeland"]')).toHaveText(
    translations.tr.routeCurrent,
  );
  await expect(page.locator('[data-region-status="spring"]')).toHaveText(
    translations.tr.routeDiscoverable,
  );
  await expect(page.locator('[data-region-status="meadow"]')).toHaveText(
    translations.tr.routeLocked,
  );
  await card(page, 'meadow').focus();
  await page.keyboard.press('Enter');
  await expect(card(page, 'meadow')).toBeFocused();
  await expect(card(page, 'meadow')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#adventure-region')).toHaveValue('meadow');
  await expect(check(page, 'route')).toHaveAttribute('data-ok', 'false');
  await expect(check(page, 'route')).toContainText(translations.tr.spring);
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  await page.locator('#adventure-kind').selectOption('caravan');
  await card(page, 'homeland').click();
  await expect(check(page, 'route')).toHaveText('!' + translations.tr.routeElsewhereCheck);
  expect(actions).toEqual([]);
  expect(state.resources).toEqual(before);
});

test('supplies and capacity estimates update on ticks without remounting the focused planning controls', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'well', plotId: 'p0' }, START);
  applyAction(state, { type: 'build', building: 'pasture', plotId: 'p1' }, START);
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p2' }, START);
  state.resources.water = 17.5;
  state.resources.feed = 23;
  state.resources.wood = 467.8;
  const actions = await mockJourney(page, state);
  await page.goto('/#world');
  await expect(check(page, 'supplies')).toHaveAttribute('data-ok', 'false');
  await expect(check(page, 'supplies')).toContainText('1 ' + translations.tr.water);
  const wolf = page.locator('#adventure-wolf-alpha');
  await wolf.focus();
  await page.evaluate(() => {
    window.planningNodes = [
      document.querySelector('#adventure-region'),
      document.querySelector('#adventure-wolf-alpha'),
      document.querySelector('[data-action="startAdventure"]'),
    ];
  });
  await poll(page, 5000);
  await expect(check(page, 'supplies')).toHaveAttribute('data-ok', 'true');
  await expect(page.locator('[data-action="startAdventure"]')).toBeEnabled();
  await expect(page.locator('[data-adventure-warnings]')).toContainText(
    translations.tr.storagePlanningOverflow,
  );
  await expect(wolf).toBeFocused();
  expect(await page.evaluate(() => window.planningNodes.every((node) => node.isConnected))).toBe(
    true,
  );
  expect(actions).toEqual([]);
  const response = page.waitForResponse('**/api/action');
  await page.locator('[data-action="startAdventure"]').click();
  await (await response).finished();
  expect(actions).toHaveLength(1);
  expect(state.adventure.active).toMatchObject({
    kind: 'expedition',
    region: 'spring',
    wolfIds: ['wolf-alpha'],
  });
  await expect(check(page, 'journey')).toHaveAttribute('data-ok', 'false');
  await expect(page.locator('[data-active-adventure] progress')).toHaveAccessibleName(
    translations.tr.journeyProgress,
  );
});

test('preparation states explain party size, weak guardians, herd health and limited storage in both languages', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  state.adventure.unlocked = ['homeland', 'spring'];
  state.wolves[1].hp = 19;
  state.herd.hp = 59;
  state.resources.wood = 499;
  state.inventory.leather_vest = 10000;
  const actions = await mockJourney(page, state);
  await page.goto('/#world');
  await expect(page.locator('[data-region-status="spring"]')).toHaveText(
    translations.tr.discovered,
  );
  await page.locator('#adventure-difficulty').selectOption('hard');
  await expect(check(page, 'party')).toContainText('3');
  await expect(check(page, 'party')).toHaveAttribute('data-ok', 'false');
  await expect(page.locator('#adventure-wolf-guardian')).toBeDisabled();
  await expect(page.locator('.guardian-needs-rest')).toContainText(
    translations.tr.guardianNeedsRest,
  );
  await expect(page.locator('[data-adventure-warnings]')).toContainText(
    translations.tr.inventoryPlanningFull,
  );
  await expect(page.locator('.fatigue-note')).toContainText('15');
  await page.locator('#adventure-wolf-hunter').check();
  await page.locator('#adventure-wolf-scout').check();
  await expect(check(page, 'party')).toHaveAttribute('data-ok', 'true');
  await page.locator('#adventure-kind').selectOption('caravan');
  await expect(check(page, 'herd')).toHaveAttribute('data-ok', 'false');
  await expect(check(page, 'herd')).toContainText('60');
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(check(page, 'herd')).toContainText('Heal it before an escort');
  await expect(page.locator('.guardian-needs-rest')).toContainText(
    translations.en.guardianNeedsRest,
  );
  await expect(page.locator('[data-adventure-warnings]')).toContainText(
    translations.en.storagePlanningNote,
  );
  await expect(page.locator('#adventure-kind')).toHaveValue('caravan');
  await expect(page.locator('#adventure-difficulty')).toHaveValue('hard');
  for (const id of ['alpha', 'hunter', 'scout'])
    await expect(page.locator('#adventure-wolf-' + id)).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Türkçeye geç' }).click();
  await expect(check(page, 'herd')).toContainText('Sürünün en az 60');
  expect(actions).toEqual([]);
});

test('an active battle clearly explains why route inspection and departure are unavailable', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  applyAction(state, { type: 'startBattle' }, START);
  const actions = await mockJourney(page, state);
  await page.goto('/#world');
  await expect(check(page, 'battle')).toHaveAttribute('data-ok', 'false');
  await expect(check(page, 'battle')).toContainText(translations.tr.battleReadyCheckBlocked);
  await expect(card(page, 'spring')).toBeDisabled();
  await expect(page.locator('#adventure-difficulty')).toBeDisabled();
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  expect(actions).toEqual([]);
});
