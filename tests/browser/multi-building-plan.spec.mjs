import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn, seedGame } from './sign-in.mjs';
import { fundStorage, fillResources } from '../economy-fixtures.mjs';

const START = Date.UTC(2026, 9, 15, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

function villageWithQuarries(count) {
  const state = fundStorage(createGame(START), 2, 'p34');
  for (let index = 0; index < count; index++) {
    for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
    applyAction(state, { type: 'build', building: 'quarry', plotId: `p${index}` }, START);
  }
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
  return state;
}

async function mockVillage(page, state) {
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

async function pollVillage(page) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(1100);
  await (await response).finished();
}

test('a maxed first producer does not block planning and upgrading another copy or placing a new one', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  const state = villageWithQuarries(2);
  state.buildings.find((building) => building.type === 'quarry').level = 5;
  const actions = await mockVillage(page, state);
  await page.goto('/#village');
  const choice = page.locator('#construction-plan');
  const execute = page.locator('#execute-construction-plan');
  await expect(choice).toHaveValue('quarry');
  await expect(execute).toBeDisabled();
  await expect(choice.locator('option[value="quarry"]')).toContainText('Arsa 1');
  await expect(choice.locator('option[value="building:building-quarry-2"]')).toContainText(
    'Arsa 2',
  );
  await expect(choice.locator('option[value="building:building-quarry-2"]')).toContainText(
    'Seviye 1',
  );
  const before = JSON.stringify(state);
  await choice.selectOption('building:building-quarry-2');
  await expect(execute).toBeEnabled();
  await expect(execute).toContainText('1.320 Odun');
  expect(JSON.stringify(state)).toBe(before);
  expect(actions).toEqual([]);
  const originalChoice = await choice.elementHandle();
  await choice.focus();
  await pollVillage(page);
  await expect(choice).toBeFocused();
  await expect(choice).toHaveValue('building:building-quarry-2');
  expect(
    await originalChoice.evaluate((node) => node === document.querySelector('#construction-plan')),
  ).toBe(true);
  expect(actions).toEqual([]);
  const upgraded = page.waitForResponse('**/api/action');
  await execute.click();
  await (await upgraded).finished();
  expect(actions).toEqual([{ type: 'upgrade', id: 'building-quarry-2' }]);
  expect(
    state.buildings
      .filter((building) => building.type === 'quarry')
      .map((building) => building.level),
  ).toEqual([5, 2]);
  await expect(choice).toHaveValue('building:building-quarry-2');
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  await expect(choice).toHaveValue('building:building-quarry-2');
  await expect(choice.locator('option[value="building:building-quarry-2"]')).toContainText(
    'Plot 2',
  );
  await choice.selectOption('new:quarry');
  await expect(execute).toContainText('660 Wood');
  await expect(execute).toContainText('360 Stone');
  const stock = { ...state.resources };
  await execute.click();
  expect(actions).toHaveLength(1);
  expect(state.resources).toEqual(stock);
  await page.locator('[data-plot="p17"]').click();
  const built = page.waitForResponse('**/api/action');
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await (await built).finished();
  expect(actions.at(-1)).toEqual({ type: 'build', building: 'quarry', plotId: 'p17' });
  expect(state.buildings.at(-1)).toMatchObject({ id: 'building-quarry-3', x: 5, y: 2 });
  await expect(choice).toHaveValue('new:quarry');
  await expect(execute).toContainText('1,100 Wood');
  await expect(execute).toBeEnabled();
  expect(errors).toEqual([]);
});

test('the sixth producer retains the selected new-copy plan with an explicit limit and no implicit upgrade', async ({
  page,
}) => {
  await signIn(page);
  const state = villageWithQuarries(5);
  const actions = await mockVillage(page, state);
  await page.goto('/#village');
  const choice = page.locator('#construction-plan');
  const execute = page.locator('#execute-construction-plan');
  await choice.selectOption('new:quarry');
  await expect(execute).toBeEnabled();
  await execute.click();
  expect(actions).toEqual([]);
  await page.locator('[data-plot="p35"]').click();
  const built = page.waitForResponse('**/api/action');
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await (await built).finished();
  await expect(choice).toHaveValue('new:quarry');
  await expect(execute).toBeDisabled();
  await expect(page.locator('[data-economy-plan-status]')).toContainText(
    translations.tr.buildingLimit,
  );
  expect(state.buildings.filter((building) => building.type === 'quarry')).toHaveLength(6);
  expect(actions).toEqual([{ type: 'build', building: 'quarry', plotId: 'p35' }]);
  await choice.focus();
  await pollVillage(page);
  await expect(choice).toBeFocused();
  await expect(choice).toHaveValue('new:quarry');
  await expect(execute).toBeDisabled();
  expect(actions).toHaveLength(1);
  await choice.selectOption('building:building-quarry-6');
  await expect(execute).toBeEnabled();
  await expect(choice.locator('option[value="new:quarry"]')).toHaveCount(0);
});
