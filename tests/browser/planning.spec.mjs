import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BUILDINGS,
  RESOURCE_KEYS,
  createGame,
  advanceGame,
  applyAction,
} from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 9, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const resource = (page, key) => page.locator(`[data-economy-resource="${key}"]`);
const deficit = (page, key) => page.locator(`[data-economy-deficit="${key}"]`);

async function mockVillage(page, state) {
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
    actions.push(request);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  return actions;
}

async function pollVillage(page, milliseconds = 1000) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

test('choosing a plan is free and explicit construction and upgrades persist through the real API', async ({
  page,
}) => {
  const errors = [];
  const actions = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/action') actions.push(request.postDataJSON());
  });
  await signIn(page);
  const now = new Date();
  await page.clock.install({ time: new Date(now.getTime() - 1000) });
  await page.clock.pauseAt(now);
  const sessionResponse = page.waitForResponse('**/api/session');
  await page.goto('/#village');
  const session = await (await sessionResponse).json();
  const choice = page.locator('#construction-plan');
  const execute = page.locator('#execute-construction-plan');
  await expect(choice).toHaveValue('quarry');
  await expect(page.locator('[data-economy-resource]')).toHaveCount(RESOURCE_KEYS.length);
  expect(
    await choice.locator('option').evaluateAll((nodes) => nodes.map((node) => node.value)),
  ).toEqual(BUILDINGS.map((building) => building.id));
  expect(session.mode).toBe('online');
  expect(Number.isSafeInteger(session.revision)).toBe(true);
  expect(session.state.stats.builds).toBe(0);
  const before = await page.locator('[data-economy-stock]').allTextContents();
  const buildingCount = await page.locator('.map-chip').textContent();
  await choice.selectOption('healer');
  await expect(page.locator('[data-economy-plan-body] h3')).toHaveText('Şifa Otağı · Seviye 1');
  await expect(execute).toBeEnabled();
  expect(actions).toEqual([]);
  expect(await page.locator('[data-economy-stock]').allTextContents()).toEqual(before);
  await expect(page.locator('.map-chip')).toHaveText(buildingCount);
  await choice.selectOption('quarry');
  await expect(
    page.locator('.buildings-grid [data-action="build"][data-building-type="quarry"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-economy-plan-body] h3')).toHaveText('Taş Ocağı · Seviye 1');
  const buildResponse = page.waitForResponse('**/api/action');
  await execute.click();
  expect(actions).toHaveLength(0);
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  const builtResponse = await buildResponse;
  expect(builtResponse.status()).toBe(200);
  const built = await builtResponse.json();
  expect(actions).toEqual([
    { action: { type: 'build', building: 'quarry', plotId: 'p0' }, revision: session.revision },
  ]);
  expect(built.state.buildings.filter((building) => building.type === 'quarry')).toEqual([
    { id: 'building-quarry', type: 'quarry', level: 1, x: 0, y: 0 },
  ]);
  expect(built.state.stats.builds).toBe(1);
  expect(built.state.resources.wood).toBeCloseTo(
    session.state.resources.wood +
      ((built.state.updatedAt - session.state.updatedAt) * 0) / 60_000 -
      70,
    6,
  );
  expect(built.state.resources.stone).toBe(session.state.resources.stone - 30);
  await expect(choice).toHaveValue('quarry');
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await expect(page.locator('[data-economy-plan-body] h3')).toHaveText('Taş Ocağı · Seviye 2');
  await expect(execute).toContainText('109 Odun');
  await expect(execute).toContainText('47 Taş');
  await expect(execute).toBeEnabled();
  const upgradeResponse = page.waitForResponse('**/api/action');
  await execute.click();
  const upgradedResponse = await upgradeResponse;
  expect(upgradedResponse.status()).toBe(200);
  const upgraded = await upgradedResponse.json();
  expect(actions).toEqual([
    { action: { type: 'build', building: 'quarry', plotId: 'p0' }, revision: session.revision },
    { action: { type: 'upgrade', id: 'building-quarry' }, revision: built.revision },
  ]);
  expect(upgraded.state.buildings.find((building) => building.type === 'quarry').level).toBe(2);
  expect(upgraded.state.resources.wood).toBeCloseTo(
    built.state.resources.wood +
      ((upgraded.state.updatedAt - built.state.updatedAt) * 0) / 60_000 -
      109,
    6,
  );
  expect(upgraded.state.resources.stone).toBeCloseTo(
    built.state.resources.stone +
      ((upgraded.state.updatedAt - built.state.updatedAt) * 0.45) / 60_000 -
      47,
    6,
  );
  await expect(execute).toBeEnabled();
  await expect(page.locator('[data-economy-plan-body] h3')).toHaveText('Taş Ocağı · Seviye 3');
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  await expect(choice).toHaveValue('quarry');
  await expect(page.locator('[data-economy-plan-body] h3')).toHaveText('Stone Quarry · Level 3');
  await expect(execute).toBeEnabled();
  await pollVillage(page);
  await expect(choice).toHaveValue('quarry');
  await expect(execute).toBeEnabled();
  expect(actions).toHaveLength(2);
  const savedResponse = await page.request.get('/api/state');
  expect(savedResponse.status()).toBe(200);
  const saved = await savedResponse.json();
  expect(saved.state.buildings.filter((building) => building.type === 'quarry')).toHaveLength(1);
  expect(saved.state.buildings.find((building) => building.type === 'quarry').level).toBe(2);
  expect(saved.state.stats.builds).toBe(1);
  expect(saved.revision).toBeGreaterThanOrEqual(upgraded.revision);
  expect(errors).toEqual([]);
});

test('server production counts down and unlocks a focused plan without replacing controls or sending a command', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p1' }, START);
  state.resources.wood = 69;
  state.resources.stone = 30;
  state.resources.herbs = state.capacity;
  const actions = await mockVillage(page, state);
  await page.goto('/#village');
  const choice = page.locator('#construction-plan');
  const execute = page.locator('#execute-construction-plan');
  const status = page.locator('[data-economy-plan-status]');
  await expect(resource(page, 'wood').locator('[data-economy-stock]')).toHaveText('69 / 1.000');
  await expect(resource(page, 'wood').locator('[data-economy-rate]')).toContainText('+0,6');
  await expect(resource(page, 'stone').locator('[data-economy-fill-status]')).toContainText(
    'Üretim yok',
  );
  await expect(resource(page, 'herbs').locator('[data-economy-fill-status]')).toHaveText(
    'Depo dolu',
  );
  await expect(deficit(page, 'wood').locator('.economy-deficit-missing')).toHaveText('1');
  await expect(deficit(page, 'stone').locator('.economy-deficit-missing')).toHaveText('0');
  await expect(status).toContainText('1 dk 40 sn');
  await expect(execute).toBeDisabled();
  await choice.selectOption('lumber');
  await choice.selectOption('quarry');
  const originalChoice = await choice.elementHandle();
  const originalExecute = await execute.elementHandle();
  await choice.focus();
  await pollVillage(page, 2100);
  await expect(status).toContainText('1 dk 38 sn');
  await expect(choice).toBeFocused();
  await expect(execute).toBeDisabled();
  await pollVillage(page, 98_000);
  await expect(execute).toBeEnabled();
  await expect(status).toContainText('Kaynakların hazır');
  await expect(deficit(page, 'wood').locator('.economy-deficit-missing')).toHaveText('0');
  await expect(choice).toHaveValue('quarry');
  await expect(choice).toBeFocused();
  expect(
    await originalChoice.evaluate((node) => node === document.querySelector('#construction-plan')),
  ).toBe(true);
  expect(
    await originalExecute.evaluate(
      (node) => node === document.querySelector('#execute-construction-plan'),
    ),
  ).toBe(true);
  expect(actions).toEqual([]);
  expect(state.buildings.some((building) => building.type === 'quarry')).toBe(false);
  applyAction(state, { type: 'startBattle' }, await page.evaluate(() => Date.now()));
  await pollVillage(page);
  await expect(choice).toHaveValue('quarry');
  await expect(execute).toBeDisabled();
  await expect(status).toContainText('devam eden savunmanın bitmesini bekle');
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});

test('offline village preview keeps every plan read-only with bilingual themes and narrow layouts', async ({
  page,
}) => {
  const external = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await page.goto(pathToFileURL(resolve('preview/village.html')).href);
  await expect(page.getByRole('heading', { name: 'Oba planlaması', level: 1 })).toBeVisible();
  await expect(page.locator('#offline-banner')).toContainText('Salt okunur');
  await expect(page.locator('.map-chip')).toHaveText('8 yapı');
  await expect(page.locator('[data-economy-resource]')).toHaveCount(RESOURCE_KEYS.length);
  const stock = (await page.locator('[data-economy-stock]').allTextContents()).map((text) =>
    text.replace(/[.,]/g, ''),
  );
  const choice = page.locator('#construction-plan');
  const execute = page.locator('#execute-construction-plan');
  for (const language of ['tr', 'en']) {
    if (language === 'en') await page.locator('#language').click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('#offline-banner')).toContainText(
      language === 'tr' ? 'Salt okunur' : 'Read-only',
    );
    for (const building of BUILDINGS) {
      await choice.selectOption(building.id);
      await expect(choice).toHaveValue(building.id);
      await expect(execute).toBeDisabled();
      expect(
        (await page.locator('[data-economy-stock]').allTextContents()).map((text) =>
          text.replace(/[.,]/g, ''),
        ),
      ).toEqual(stock);
    }
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('#theme').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(choice).toHaveValue('shelter');
      await expect(execute).toBeDisabled();
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width);
        const bounds = await page.locator('#economy-panel').evaluate((node) => ({
          right: node.getBoundingClientRect().right,
          content: node.clientWidth,
          scroll: node.scrollWidth,
        }));
        expect(bounds.right).toBeLessThanOrEqual(width);
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.content);
        await expect(choice).toBeVisible();
        await expect(execute).toBeVisible();
      }
    }
  }
  await expect(page.locator('[data-economy-plan-body] h3')).toHaveText('Herd Shelter · Level 5');
  await expect(page.locator('#offline-banner')).toContainText('verified account');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
