import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { getConstructionCost, getUpgradeCost, demolitionQuote } from '../../shared/settlement.mjs';
import { getBattleCost } from '../../shared/economy.mjs';
import { trainingPlan } from '../../shared/guardian-planning.mjs';
import { translations } from '../../web/i18n.mjs';
import { fundStorage, fillResources } from '../economy-fixtures.mjs';
import { signIn, seedGame } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 20, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const number = (value, language = 'tr') =>
  value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US');
async function mockVillage(page, state, view = 'village') {
  await signIn(page);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
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
    const { action } = route.request().postDataJSON();
    actions.push(action);
    applyAction(state, action, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#' + view);
  return actions;
}
async function poll(page) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(1100);
  await (await response).finished();
}

test('another session buying a producer reprices an open chooser and preserves focused controls', async ({
  page,
}) => {
  const state = fillResources(createGame(START));
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p0' }, START);
  const actions = await mockVillage(page, state);
  await page.locator('[data-plot="p1"]').click();
  const choice = page.locator('.placement-dialog [data-building-type="lumber"]');
  const close = page.locator('.placement-dialog .modal-close');
  await expect(choice).toBeEnabled();
  await expect(choice.locator('[data-placement-cost]')).toContainText(
    number(getConstructionCost(state, 'lumber').wood),
  );
  await close.focus();
  const original = await close.elementHandle();
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p2' }, START);
  await poll(page);
  await expect(choice.locator('[data-placement-cost]')).toContainText(
    number(getConstructionCost(state, 'lumber').wood),
  );
  await expect(choice).toBeDisabled();
  await expect(close).toBeFocused();
  expect(
    await original.evaluate(
      (node) => node === document.querySelector('.placement-dialog .modal-close'),
    ),
  ).toBe(true);
  expect(actions).toEqual([]);
});

test('a high level construction plan names the storage expansion required before its price can fit', async ({
  page,
}) => {
  const state = fundStorage(createGame(START), 1);
  applyAction(state, { type: 'build', building: 'hall', plotId: 'p0' }, START);
  applyAction(state, { type: 'upgrade', id: 'building-hall' }, START);
  const actions = await mockVillage(page, state);
  await page.locator('#construction-plan').selectOption('hall');
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    await expect(page.locator('[data-economy-plan-status]')).toContainText(
      translations[language].planningCapacityBlocked,
    );
    await expect(page.locator('#execute-construction-plan')).toBeDisabled();
    const price = getUpgradeCost(state.buildings.find((building) => building.type === 'hall'));
    await expect(page.locator('#execute-construction-plan')).toContainText(
      number(price.wood, language),
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.locator('#economy-panel').screenshot({
        path: `artifacts/construction-costs-${language}-${width}-v2.16.0.png`,
        animations: 'disabled',
      });
    }
  }
  expect(actions).toEqual([]);
});

test('battle entry and guardian ranks display authoritative costs and only enable affordable actions', async ({
  page,
}) => {
  const state = fillResources(createGame(START));
  const battle = getBattleCost(state);
  state.resources.water = battle.water - 1;
  const actions = await mockVillage(page, state, 'battle');
  await expect(page.locator('#battle-entry-cost')).toContainText(String(battle.water));
  await expect(page.locator('[data-action="startBattle"]')).toBeDisabled();
  state.resources.water = battle.water;
  await poll(page);
  await expect(page.locator('[data-action="startBattle"]')).toBeEnabled();
  await page.locator('[data-view="wolves"]').click();
  for (const path of ['guardian', 'hunter', 'leader', 'healer']) {
    const plan = trainingPlan(state, 'wolf-alpha', path);
    const row = page
      .locator('.training-row')
      .filter({ has: page.locator('#guardian-train-' + path) });
    for (const amount of Object.values(plan.cost))
      await expect(row.locator('.guardian-action-cost')).toContainText(number(amount));
    if (plan.ready) await expect(page.locator('#guardian-train-' + path)).toBeEnabled();
    else await expect(page.locator('#guardian-train-' + path)).toBeDisabled();
  }
  expect(actions).toEqual([]);
});

test('a full warehouse preserves demolition refunds, claims only room available once and persists the remainder', async ({
  page,
}) => {
  await signIn(page);
  const initial = await seedGame(page, (state) => {
    fundStorage(state, 1, 'p34');
    applyAction(state, { type: 'build', building: 'quarry', plotId: 'p0' }, state.updatedAt);
    applyAction(state, { type: 'upgrade', id: 'building-quarry' }, state.updatedAt);
    fillResources(state);
  });
  const quote = demolitionQuote(initial.state, 'building-quarry');
  expect(quote.credited).toEqual({ wood: 0, stone: 0 });
  expect(quote.pending).toEqual(quote.refund);
  const actions = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/action')
      actions.push(request.postDataJSON().action);
  });
  await page.goto('/#village');
  await page.locator('[data-building="building-quarry"]').click();
  await page.locator('#demolish-building-button').click();
  for (const width of [1440, 320, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(page.locator('[data-demolition-pending]')).toContainText(
      number(quote.pending.wood),
    );
    await expect(page.locator('#demolition-confirm')).toBeEnabled();
    if (width !== 320)
      await page.locator('.demolition-dialog').screenshot({
        path: `artifacts/demolition-refund-tr-${width}-v2.16.0.png`,
        animations: 'disabled',
      });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
  await page.locator('#demolition-cancel').click();
  await page.locator('[data-action="language"]').click();
  await page.locator('#demolish-building-button').click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(page.locator('[data-demolition-pending]')).toContainText(
      number(quote.pending.wood, 'en'),
    );
    await page.locator('.demolition-dialog').screenshot({
      path: `artifacts/demolition-refund-en-${width}-v2.16.0.png`,
      animations: 'disabled',
    });
  }
  const removal = page.waitForResponse('**/api/action');
  await page.locator('#demolition-confirm').click();
  const removed = await (await removal).json();
  expect(removed.state.refundReserve).toEqual(quote.refund);
  await expect(page.locator('#claim-refund-button')).toBeDisabled();
  await page.reload();
  await expect(page.locator('#claim-refund-button')).toBeDisabled();
  await seedGame(page, (state) => {
    state.resources.wood -= 100;
    state.resources.stone -= 50;
  });
  await page.reload();
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    await expect(page.locator('[data-refund-credit]')).toContainText('100');
    await expect(page.locator('[data-refund-remaining]')).toContainText(
      number(quote.refund.wood - 100, language),
    );
    for (const width of [1440, 320, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      const bounds = await page
        .locator('#refund-reserve-panel')
        .evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.client);
      if (width !== 320)
        await page.locator('#storage-expansion').screenshot({
          path: `artifacts/refund-reserve-${language}-${width}-v2.16.0.png`,
          animations: 'disabled',
        });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
    await page.locator('#storage-expansion').screenshot({
      path: 'artifacts/refund-reserve-' + language + '-v2.16.0.png',
      animations: 'disabled',
    });
  }
  expect(actions).toHaveLength(1);
  const claim = page.waitForResponse('**/api/action');
  await page.locator('#claim-refund-button').click();
  const claimed = await (await claim).json();
  expect(claimed.state.resources.wood).toBe(claimed.state.capacity);
  expect(claimed.state.resources.stone).toBe(claimed.state.capacity);
  expect(claimed.state.refundReserve).toEqual({
    wood: quote.refund.wood - 100,
    stone: quote.refund.stone - 50,
  });
  expect(actions).toEqual([
    { type: 'demolishBuilding', id: 'building-quarry', expected: quote.expected },
    { type: 'claimRefund' },
  ]);
  await page.reload();
  await expect(page.locator('#claim-refund-button')).toBeDisabled();
  const saved = await (await page.request.get('/api/state')).json();
  expect(saved.state.refundReserve).toEqual(claimed.state.refundReserve);
  expect(actions).toHaveLength(2);
});

test('million-price warehouse and wall upgrades stay legible and require separate affordable confirmations', async ({
  page,
}) => {
  const state = fundStorage(createGame(START), 4);
  while (state.walls.level < 4) {
    fillResources(state);
    applyAction(state, { type: 'upgradeWall' }, START);
  }
  fillResources(state);
  const actions = await mockVillage(page, state);
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    await expect(page.locator('[data-storage-upgrade-cost]')).toContainText(
      number(800000, language),
    );
    await expect(page.locator('[data-storage-upgrade-cost]')).toContainText(
      number(650000, language),
    );
    await expect(page.locator('#expand-storage-button')).toBeEnabled();
    await expect(page.locator('.settlement-controls')).toContainText(number(1200000, language));
    await expect(page.locator('.settlement-controls')).toContainText(number(1500000, language));
    await expect(page.locator('[data-action="upgradeWall"]')).toBeDisabled();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const selector of ['#storage-expansion', '.settlement-controls']) {
        const bounds = await page
          .locator(selector)
          .evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.client);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      if (width !== 320)
        await page.locator('#storage-expansion').screenshot({
          path: 'artifacts/million-upgrade-' + language + '-' + width + '-v2.16.0.png',
          animations: 'disabled',
        });
    }
  }
  expect(actions).toEqual([]);
  expect(state.buildings.find((building) => building.type === 'storage').level).toBe(4);
  expect(state.walls.level).toBe(4);
});
