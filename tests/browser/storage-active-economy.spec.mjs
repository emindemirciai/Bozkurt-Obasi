import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { getStorageCapacity } from '../../shared/settlement.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 20, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const work = (page) => page.locator('#resource-work-panel');
const store = (page) => page.locator('#storage-expansion');
const choice = (page) => page.locator('#collection-resource');
const collect = (page) => page.locator('#collect-button');
const expand = (page) => page.locator('#expand-storage-button');
const format = (value, language = 'tr') =>
  value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US');

async function mockVillage(page, state) {
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
    const request = route.request().postDataJSON();
    actions.push(request.action);
    try {
      applyAction(state, request.action, await page.evaluate(() => Date.now()));
      expect(validateGame(state)).toBe(true);
      await route.fulfill(json({ state, revision: ++revision }));
    } catch (error) {
      await route.fulfill({ status: 400, ...json({ error: error.code || error.message }) });
    }
  });
  await page.goto('/#village');
  return actions;
}

async function poll(page, milliseconds) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

async function command(page, button) {
  const response = page.waitForResponse('**/api/action');
  await button.click();
  const result = await response;
  expect(result.status()).toBe(200);
  return result.json();
}

test('focused collection credits only the chosen material and the real server retains one cooldown after reload', async ({
  page,
}) => {
  await signIn(page);
  const now = new Date();
  await page.clock.install({ time: new Date(now.getTime() - 1000) });
  await page.clock.pauseAt(now);
  const sessionResponse = page.waitForResponse('**/api/session');
  await page.goto('/#village');
  const initial = await (await sessionResponse).json();
  const actions = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/action')
      actions.push(request.postDataJSON().action);
  });
  await expect(choice(page)).toHaveValue('mixed');
  await choice(page).selectOption('herbs');
  await expect(work(page).locator('[data-work-reward]')).toContainText('2');
  await choice(page).selectOption('wood');
  await expect(work(page).locator('[data-work-reward]')).toContainText('10');
  expect(actions).toEqual([]);
  const first = await command(page, collect(page));
  expect(actions).toEqual([{ type: 'collect', resource: 'wood' }]);
  expect(first.state.resources).toEqual({
    ...initial.state.resources,
    wood: initial.state.resources.wood + 10,
  });
  expect(first.state.stats.gathers).toBe(1);
  expect(first.state.collectReadyAt - first.state.updatedAt).toBe(90_000);
  await expect(collect(page)).toBeDisabled();
  await choice(page).selectOption('herbs');
  await expect(collect(page)).toBeDisabled();
  await page.reload();
  await expect(collect(page)).toBeDisabled();
  const latest = await (await page.request.get('/api/state')).json();
  const replay = await page.request.post('/api/action', {
    data: {
      revision: latest.revision,
      action: {
        type: 'collect',
        resource: 'herbs',
        reward: { herbs: 9999 },
        now: first.state.collectReadyAt,
      },
    },
  });
  expect(replay.status()).toBe(400);
  expect((await replay.json()).error).toBe('COLLECT_COOLDOWN');
  const saved = await (await page.request.get('/api/state')).json();
  expect(saved.state.resources).toEqual(first.state.resources);
  expect(saved.state.stats.gathers).toBe(1);
  expect(saved.state.collectReadyAt).toBe(first.state.collectReadyAt);
});

test('storage expansion uses real construction and upgrades and preserves expanded capacity after reload', async ({
  page,
}) => {
  await signIn(page);
  const now = new Date();
  await page.clock.install({ time: new Date(now.getTime() - 1000) });
  await page.clock.pauseAt(now);
  await page.goto('/#village');
  const actions = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/action')
      actions.push(request.postDataJSON().action);
  });
  await expect(store(page).locator('[data-storage-capacity]')).toContainText('1.000');
  await expect(store(page).locator('[data-storage-next-capacity]')).toContainText('10.000');
  await expect(expand(page)).toBeEnabled();
  await expand(page).click();
  expect(actions).toEqual([]);
  await page.locator('[data-plot="p0"]').click();
  const built = await command(
    page,
    page.locator('.placement-dialog [data-building-type="storage"]'),
  );
  expect(built.state.capacity).toBe(10000);
  await expect(store(page).locator('[data-storage-next-capacity]')).toContainText('50.000');
  const upgraded = await command(page, expand(page));
  expect(upgraded.state.capacity).toBe(50000);
  await expect(store(page).locator('[data-storage-next-capacity]')).toContainText('250.000');
  const mature = await command(page, expand(page));
  expect(mature.state.capacity).toBe(250000);
  expect(mature.state.buildings).toEqual([
    { id: 'building-storage', type: 'storage', level: 3, x: 0, y: 0 },
  ]);
  expect(actions).toEqual([
    { type: 'build', building: 'storage', plotId: 'p0' },
    { type: 'upgrade', id: 'building-storage' },
    { type: 'upgrade', id: 'building-storage' },
  ]);
  await expect(store(page).locator('[data-storage-capacity]')).toContainText('250.000');
  await expect(expand(page)).toBeDisabled();
  await page.reload();
  await expect(store(page).locator('[data-storage-capacity]')).toContainText('250.000');
  await expect(page.locator('[data-resource="wood"] small')).toContainText('250.000');
  await page.locator('[data-action="language"]').click();
  await expect(store(page).locator('[data-storage-capacity]')).toContainText('250,000');
  await expect(store(page).locator('[data-storage-next-capacity]')).toContainText('1,000,000');
});

test('changing work never bypasses its shared timer and polling keeps the choice focused without automatic collection', async ({
  page,
}) => {
  const state = createGame(START);
  const initial = { ...state.resources };
  const actions = await mockVillage(page, state);
  await choice(page).selectOption('wood');
  await command(page, collect(page));
  await choice(page).selectOption('herbs');
  await choice(page).focus();
  const original = await choice(page).elementHandle();
  await poll(page, 89_000);
  await expect(collect(page)).toBeDisabled();
  await expect(choice(page)).toBeFocused();
  await expect(choice(page)).toHaveValue('herbs');
  expect(
    await original.evaluate((node) => node === document.querySelector('#collection-resource')),
  ).toBe(true);
  expect(state.resources).toEqual({ ...initial, wood: initial.wood + 10 });
  expect(actions).toHaveLength(1);
  await poll(page, 1_100);
  await expect(collect(page)).toBeEnabled();
  expect(actions).toHaveLength(1);
  await page.locator('[data-action="language"]').click();
  await expect(choice(page)).toHaveValue('herbs');
  await command(page, collect(page));
  expect(state.resources).toEqual({
    ...initial,
    wood: initial.wood + 10,
    herbs: initial.herbs + 2,
  });
  expect(actions).toEqual([
    { type: 'collect', resource: 'wood' },
    { type: 'collect', resource: 'herbs' },
  ]);
  await poll(page, 120_000);
  await expect(collect(page)).toBeEnabled();
  expect(actions).toHaveLength(2);
  state.resources.herbs = state.capacity;
  await poll(page, 1_100);
  await expect(collect(page)).toBeDisabled();
  await choice(page).selectOption('stone');
  await expect(collect(page)).toBeEnabled();
});

test('million-scale maximum storage and active work remain readable in TR and EN on desktop and narrow mobile screens', async ({
  page,
}) => {
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'storage', plotId: 'p0' }, START);
  applyAction(state, { type: 'build', building: 'hall', plotId: 'p1' }, START);
  for (const building of state.buildings) building.level = 5;
  state.capacity = getStorageCapacity(state);
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
  state.resources.wood = state.capacity - 2;
  const actions = await mockVillage(page, state);
  await choice(page).selectOption('herbs');
  await expect(collect(page)).toBeDisabled();
  await choice(page).selectOption('wood');
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    await expect(choice(page)).toHaveValue('wood');
    await expect(store(page).locator('[data-storage-capacity]')).toContainText(
      format(5000400, language),
    );
    await expect(expand(page)).toBeDisabled();
    await expect(collect(page)).toBeEnabled();
    await expect(work(page).locator('[data-work-reward]')).toContainText(
      translations[language].wood,
    );
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const selector of ['#storage-expansion', '#resource-work-panel', '.resource-bar']) {
        const bounds = await page.locator(selector).evaluate((node) => ({
          left: node.getBoundingClientRect().left,
          right: node.getBoundingClientRect().right,
          content: node.clientWidth,
          scroll: node.scrollWidth,
        }));
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(width);
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.content);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const stocks = await page
        .locator('.resource-bar [data-resource]')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({ content: node.clientWidth, scroll: node.scrollWidth })),
        );
      for (const stock of stocks) expect(stock.scroll).toBeLessThanOrEqual(stock.content);
      if (width !== 320) {
        await store(page).screenshot({
          path: `artifacts/storage-${language}-${width}-v2.15.0.png`,
          animations: 'disabled',
        });
        await page.locator('.resource-bar').screenshot({
          path: `artifacts/resource-header-${language}-${width}-v2.15.0.png`,
          animations: 'disabled',
        });
        await work(page).screenshot({
          path: `artifacts/resource-work-${language}-${width}-v2.15.0.png`,
          animations: 'disabled',
        });
      }
    }
  }
  expect(actions).toEqual([]);
});

test('offline village exposes bilingual work choices and storage growth without enabling mutations', async ({
  page,
}) => {
  const network = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  await page.goto(pathToFileURL(resolve('preview/village.html')).href);
  const stock = (await page.locator('[data-economy-stock]').allTextContents()).map((text) =>
    text.replace(/[.,]/g, ''),
  );
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('#language').click();
    for (const selected of ['mixed', 'wood', 'stone', 'water', 'feed', 'herbs']) {
      await choice(page).selectOption(selected);
      await expect(choice(page)).toHaveValue(selected);
      await expect(work(page).locator('[data-work-reward]')).not.toBeEmpty();
      await expect(collect(page)).toBeDisabled();
      await expect(expand(page)).toBeDisabled();
    }
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(store(page)).toBeVisible();
      await expect(work(page)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
    expect(
      (await page.locator('[data-economy-stock]').allTextContents()).map((text) =>
        text.replace(/[.,]/g, ''),
      ),
    ).toEqual(stock);
  }
  expect(network).toEqual([]);
});
