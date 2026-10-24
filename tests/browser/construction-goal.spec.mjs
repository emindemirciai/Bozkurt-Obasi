import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { demolitionQuote } from '../../shared/settlement.mjs';
import { fundStorage, fillResources } from '../economy-fixtures.mjs';
import { signIn, seedGame } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 24, 12);
const PREFIX = 'bozkurt-obasi:construction-goal:v1:';
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const panel = (page) => page.locator('#construction-goal-panel');
const storedKey = (userCode) => PREFIX + encodeURIComponent(userCode);
const goalResource = (page, key) => panel(page).locator(`[data-goal-resource="${key}"]`);
const forecastResource = (page, key) => panel(page).locator(`[data-forecast-resource="${key}"]`);

async function account(page) {
  const response = await page.request.get('/api/auth/player/status');
  expect(response.status()).toBe(200);
  const value = await response.json();
  expect(value.authenticated).toBe(true);
  return value.user.userCode;
}
function observe(page) {
  const actions = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/action')
      actions.push(request.postDataJSON().action);
  });
  return { actions, errors };
}
async function pin(page, target) {
  await page.locator('#construction-plan').selectOption(target);
  await expect(page.locator('#pin-construction-goal')).toBeEnabled();
  await page.locator('#pin-construction-goal').click();
  await expect(page.locator('#construction-goal-title')).toBeFocused();
  await expect(panel(page)).not.toHaveAttribute('data-goal-status', 'empty');
}
async function poll(page, milliseconds = 1100) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}
async function mockedVillage(page, state, { freeze = false } = {}) {
  await signIn(page);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  let revision = 0;
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    if (!freeze) advanceGame(state, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    applyAction(
      state,
      route.request().postDataJSON().action,
      await page.evaluate(() => Date.now()),
    );
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#village');
}

test('a saved homeland goal survives reload and review, gathering guidance and clearing never spend materials', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  await signIn(page);
  const userCode = await account(page);
  await page.goto('/#village');
  const before = (await (await page.request.get('/api/state')).json()).state;
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'empty');
  await pin(page, 'storage');
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'active');
  await expect(panel(page).locator('[data-goal-name]')).toContainText('Erzak Deposu');
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storedKey(userCode),
  );
  expect(saved).toEqual({
    version: 1,
    goal: { version: 1, mode: 'build', type: 'storage', buildingId: null, level: 1, count: 1 },
  });
  await page.reload();
  await expect(panel(page).locator('[data-goal-name]')).toContainText('Erzak Deposu');
  await page.locator('#construction-plan').selectOption('quarry');
  await expect(panel(page).locator('[data-goal-name]')).toContainText('Erzak Deposu');
  await panel(page).locator('[data-action="reviewConstructionGoal"]').click();
  await expect(page.locator('#construction-plan')).toHaveValue('new:storage');
  await expect(page.locator('#construction-plan')).toBeFocused();
  await panel(page).locator('[data-action="goalGather"][data-resource="wood"]').click();
  await expect(page.locator('#collection-resource')).toHaveValue('wood');
  await expect(page.locator('#collection-resource')).toBeFocused();
  await expect(page.locator('[data-work-reward]')).toContainText('+10');
  const after = (await (await page.request.get('/api/state')).json()).state;
  expect(after.resources).toEqual(before.resources);
  expect(after.stats).toEqual(before.stats);
  expect(after.collectReadyAt).toBe(before.collectReadyAt);
  expect(actions).toEqual([]);
  await panel(page).locator('[data-action="clearConstructionGoal"]').click();
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'empty');
  await page.reload();
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'empty');
  expect(
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storedKey(userCode))).goal,
  ).toBeNull();
  expect(errors).toEqual([]);
});

test('device goals stay separate for two accounts and returning to the first account restores its own target', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  const identity = 'c6823510-c9b1-48c1-bcb5-a8b6e3eb5501';
  await signIn(page, { identity });
  const first = await account(page);
  await page.goto('/#village');
  await pin(page, 'storage');
  const firstGoal = await page.evaluate((key) => localStorage.getItem(key), storedKey(first));
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await signIn(page);
  const second = await account(page);
  expect(second).not.toBe(first);
  await page.goto('/?auth=success#village');
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'empty');
  await pin(page, 'quarry');
  expect(await page.evaluate((key) => localStorage.getItem(key), storedKey(first))).toBe(firstGoal);
  const secondGoal = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storedKey(second),
  );
  expect(secondGoal.goal.type).toBe('quarry');
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await signIn(page, { identity });
  expect(await account(page)).toBe(first);
  await page.goto('/?auth=success#village');
  await expect(panel(page).locator('[data-goal-name]')).toContainText('Erzak Deposu');
  expect(await page.evaluate((key) => localStorage.getItem(key), storedKey(second))).toBe(
    JSON.stringify(secondGoal),
  );
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});

test('malformed saved goals are ignored and denied device storage leaves a working in-memory goal', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  await signIn(page);
  const userCode = await account(page);
  await page.goto('/#village');
  await page.evaluate(
    (key) =>
      localStorage.setItem(key, '{"version":1,"goal":{"type":"<img src=x onerror=alert(1)>"}}'),
    storedKey(userCode),
  );
  await page.reload();
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'empty');
  await expect(page.locator('.game-shell')).toBeVisible();
  await page.addInitScript((prefix) => {
    const read = Storage.prototype.getItem,
      write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (String(key).startsWith(prefix)) throw new DOMException('Denied', 'SecurityError');
      return read.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (String(key).startsWith(prefix)) throw new DOMException('Denied', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  }, PREFIX);
  await page.reload();
  await pin(page, 'storage');
  await page.locator('[data-action="language"]').click();
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'active');
  await expect(panel(page).locator('[data-goal-name]')).toContainText('Storehouse');
  await page.reload();
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'empty');
  await expect(page.locator('.game-shell')).toBeVisible();
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});

test('a pinned upgrade remains completed at its original level and a removed target never redirects to another building', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  await signIn(page);
  const userCode = await account(page);
  await seedGame(page, (state) => {
    fundStorage(state, 1);
    applyAction(state, { type: 'build', building: 'quarry', plotId: 'p0' }, state.updatedAt);
    fillResources(state);
  });
  await page.goto('/#village');
  await pin(page, 'quarry');
  const savedGoal = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).goal,
    storedKey(userCode),
  );
  expect(savedGoal).toMatchObject({ mode: 'upgrade', buildingId: 'building-quarry', level: 2 });
  const response = page.waitForResponse('**/api/action');
  await page.locator('#execute-construction-plan').click();
  expect((await response).status()).toBe(200);
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'completed');
  await page.reload();
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'completed');
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).goal.level,
      storedKey(userCode),
    ),
  ).toBe(2);
  expect(actions).toEqual([{ type: 'upgrade', id: 'building-quarry' }]);
  await pin(page, 'quarry');
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).goal.level,
      storedKey(userCode),
    ),
  ).toBe(3);
  await seedGame(page, (state) => {
    const quote = demolitionQuote(state, 'building-quarry');
    applyAction(
      state,
      { type: 'demolishBuilding', id: 'building-quarry', expected: quote.expected },
      state.updatedAt,
    );
  });
  await page.reload();
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'missing');
  await expect(panel(page).locator('[data-action="reviewConstructionGoal"]')).toBeDisabled();
  await expect(panel(page).locator('[data-action="clearConstructionGoal"]')).toBeEnabled();
  expect(actions).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('polling preserves a focused goal control and an altered copy count requires a new explicit target', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  const state = fundStorage(createGame(START), 1);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p0' }, START);
  state.resources.wood = 100;
  state.resources.stone = 100;
  state.collectReadyAt = START + 90_000;
  await mockedVillage(page, state, { freeze: true });
  await pin(page, 'new:quarry');
  const gather = panel(page).locator('[data-action="goalGather"][data-resource="wood"]');
  await gather.focus();
  const original = await gather.elementHandle();
  await expect(goalResource(page, 'wood').locator('[data-goal-missing]')).toContainText('340');
  state.resources.wood = 120;
  await poll(page);
  await expect(goalResource(page, 'wood').locator('[data-goal-missing]')).toContainText('320');
  await expect(gather).toBeFocused();
  expect(
    await original.evaluate(
      (node) =>
        node ===
        document.querySelector(
          '#construction-goal-panel [data-action="goalGather"][data-resource="wood"]',
        ),
    ),
  ).toBe(true);
  await gather.click();
  await expect(page.locator('#collection-resource')).toHaveValue('wood');
  await expect(page.locator('#collection-resource')).toBeFocused();
  await expect(page.locator('#collect-button')).toBeDisabled();
  expect(state.collectReadyAt).toBe(START + 90_000);
  const quote = demolitionQuote(state, 'building-quarry');
  applyAction(
    state,
    { type: 'demolishBuilding', id: 'building-quarry', expected: quote.expected },
    START,
  );
  await poll(page);
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'changed');
  await expect(panel(page).locator('[data-action="reviewConstructionGoal"]')).toBeDisabled();
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});

test('the production forecast caps a 24-hour absence at eight hours and stays readable in TR/EN without issuing actions', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p0' }, START);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p1' }, START);
  await mockedVillage(page, state, { freeze: true });
  await pin(page, 'storage');
  const hours = page.locator('#goal-absence-hours');
  await hours.selectOption('8');
  await expect(forecastResource(page, 'wood').locator('[data-forecast-gain]')).toContainText('288');
  await expect(forecastResource(page, 'wood').locator('[data-forecast-projected]')).toContainText(
    '338',
  );
  await expect(forecastResource(page, 'stone').locator('[data-forecast-gain]')).toContainText(
    '216',
  );
  await expect(forecastResource(page, 'stone').locator('[data-forecast-projected]')).toContainText(
    '346',
  );
  const projected = await panel(page).locator('[data-forecast-projected]').allTextContents();
  await hours.selectOption('24');
  expect(await panel(page).locator('[data-forecast-projected]').allTextContents()).toEqual(
    projected,
  );
  await expect(panel(page).locator('[data-forecast-cap-warning]')).toBeVisible();
  await expect(panel(page).locator('[data-forecast-credited-time]')).toContainText('8');
  await hours.focus();
  const original = await hours.elementHandle();
  await poll(page);
  await expect(hours).toBeFocused();
  expect(
    await original.evaluate((node) => node === document.querySelector('#goal-absence-hours')),
  ).toBe(true);
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    await expect(hours).toHaveValue('24');
    await expect(panel(page).locator('[data-forecast-cap-warning]')).toBeVisible();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const size = await panel(page).evaluate((node) => ({
        client: node.clientWidth,
        scroll: node.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.client);
      if (width !== 320)
        await panel(page).screenshot({
          path: `artifacts/construction-goal-${language}-${width}-v2.17.0.png`,
          animations: 'disabled',
          style: '.rail { visibility: hidden !important; }',
        });
    }
  }
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});

test('logging out discards a delayed poll before another account can see the previous goal', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  await signIn(page);
  const first = await account(page);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  const state = createGame(START);
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision: 1, mode: 'online' })),
  );
  const started = Promise.withResolvers(),
    release = Promise.withResolvers();
  await page.route('**/api/state', async (route) => {
    started.resolve();
    await release.promise;
    await route.fulfill(json({ state, revision: 2 }));
  });
  await page.goto('/#village');
  await pin(page, 'storage');
  await page.locator('.profile').click();
  await page.clock.fastForward(1100);
  await started.promise;
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(page.locator('.game-shell')).toHaveCount(0);
  const completed = page.waitForResponse('**/api/state');
  release.resolve();
  await (await completed).finished();
  await page.clock.fastForward(1100);
  await expect(panel(page)).toHaveCount(0);
  await signIn(page);
  const second = await account(page);
  expect(second).not.toBe(first);
  await page.goto('/?auth=success#village');
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'empty');
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).goal.type, storedKey(first)),
  ).toBe('storage');
  expect(await page.evaluate((key) => localStorage.getItem(key), storedKey(second))).toBeNull();
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});

test('the offline goal example is read-only and changes forecast hours without networking or device storage', async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.addInitScript(() => {
    window.goalStorageWrites = [];
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      window.goalStorageWrites.push(key);
      return write.call(this, key, value);
    };
  });
  await page.goto(pathToFileURL(resolve('preview/village.html')).href);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).not.toHaveAttribute('data-goal-status', 'empty');
  await expect(page.locator('#pin-construction-goal')).toBeDisabled();
  await expect(panel(page).locator('[data-action="clearConstructionGoal"]')).toBeDisabled();
  await expect(panel(page).locator('[data-action="reviewConstructionGoal"]')).toBeDisabled();
  for (const button of await panel(page).locator('[data-action="goalGather"]').all())
    await expect(button).toBeDisabled();
  await page.locator('#goal-absence-hours').selectOption('24');
  await expect(panel(page).locator('[data-forecast-cap-warning]')).toBeVisible();
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('#language').click();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  }
  for (const [scenario, status] of [
    ['completed', 'completed'],
    ['missing', 'missing'],
    ['empty', 'empty'],
    ['planned', 'active'],
  ]) {
    await page.locator('#preview-goal-scenario').selectOption(scenario);
    await expect(panel(page)).toHaveAttribute('data-goal-status', status);
    await expect(page.locator('#pin-construction-goal')).toBeDisabled();
    if (status !== 'empty')
      await expect(panel(page).locator('[data-action="clearConstructionGoal"]')).toBeDisabled();
  }
  expect(await page.evaluate(() => window.goalStorageWrites)).toEqual([]);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('a million-capacity storage goal preserves six-digit fractional balances in TR/EN on small and large screens without spending', async ({
  page,
}) => {
  const { actions, errors } = observe(page);
  const state = fundStorage(createGame(START), 4);
  state.resources.wood = 799999.875;
  state.resources.stone = 649999.5;
  const before = structuredClone(state);
  await mockedVillage(page, state, { freeze: true });
  await pin(page, 'storage');
  await expect(panel(page)).toHaveAttribute('data-goal-status', 'active');
  const hours = page.locator('#goal-absence-hours');
  const original = await hours.elementHandle();
  await hours.focus();
  await poll(page);
  await expect(hours).toBeFocused();
  expect(
    await original.evaluate((node) => node === document.querySelector('#goal-absence-hours')),
  ).toBe(true);
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    const number = (value) =>
      value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 6 });
    for (const [key, available, required, missing] of [
      ['wood', 799999.875, 800000, 0.125],
      ['stone', 649999.5, 650000, 0.5],
    ]) {
      const row = goalResource(page, key);
      await expect(row.locator('[data-goal-available]')).toHaveText(number(available));
      await expect(row.locator('[data-goal-required]')).toHaveText(number(required));
      await expect(row.locator('[data-goal-missing]')).toHaveText(number(missing));
      await expect(row.locator('[role="progressbar"]')).toHaveAttribute(
        'aria-valuemax',
        String(required),
      );
      await expect(row.locator('[role="progressbar"]')).toHaveAttribute(
        'aria-valuenow',
        String(available),
      );
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const size = await panel(page).evaluate((node) => ({
        client: node.clientWidth,
        scroll: node.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.client);
      for (const key of ['wood', 'stone']) {
        const bounds = await goalResource(page, key).evaluate((node) => ({
          client: node.clientWidth,
          scroll: node.scrollWidth,
        }));
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.client);
      }
      if (width !== 320)
        await panel(page).screenshot({
          path: `artifacts/construction-goal-million-${language}-${width}-v2.17.0.png`,
          animations: 'disabled',
          style: '.rail { visibility: hidden !important; }',
        });
    }
  }
  expect(state).toEqual(before);
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});
