import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const dialog = (page) => page.locator('#demolition-dialog');
const open = (page) => page.locator('#demolish-building-button');
const confirm = (page) => page.locator('#demolition-confirm');
const cancel = (page) => page.locator('#demolition-cancel');

function buildVillage() {
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'well', plotId: 'p0' }, START);
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
    try {
      applyAction(state, request.action, await page.evaluate(() => Date.now()));
      expect(validateGame(state)).toBe(true);
      await route.fulfill(json({ state, revision: ++revision }));
    } catch (error) {
      await route.fulfill({ status: 400, ...json({ error: error.code || error.message }) });
    }
  });
  return actions;
}

async function pollVillage(page, milliseconds = 1100) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

async function buildAt(page, plot, building) {
  await page.locator('[data-plot="' + plot + '"]').click();
  const response = page.waitForResponse('**/api/action');
  await page.locator('.placement-dialog [data-building-type="' + building + '"]').click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return result.json();
}

test('real saved demolition asks for confirmation, refunds the upgraded selected copy once, and frees its plot after reload', async ({
  page,
}) => {
  await signIn(page);
  const actions = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/action') && request.method() === 'POST')
      actions.push(request.postDataJSON().action);
  });
  await page.goto('/#village');
  await buildAt(page, 'p0', 'quarry');
  await buildAt(page, 'p35', 'quarry');
  await page.locator('.scene-building[data-building="building-quarry"]').click();
  const upgradedResponse = page.waitForResponse('**/api/action');
  await page.locator('.upgrade-row [data-action="upgrade"]').click();
  const upgraded = await (await upgradedResponse).json();
  const before = upgraded.state;
  await open(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(/(?:50%|%50)/);
  await expect(dialog(page).locator('[data-demolition-refund]')).toContainText(/89[.,]5/);
  await expect(dialog(page).locator('[data-demolition-refund]')).toContainText(/38[.,]5/);
  await expect(cancel(page)).toBeFocused();
  await dialog(page).screenshot({ path: 'artifacts/demolition-1440-v2.8.0.png' });
  expect(actions).toHaveLength(3);
  await expect(page.locator('.empty-plot')).toHaveCount(34);
  const removedResponse = page.waitForResponse('**/api/action');
  await confirm(page).click();
  const result = await removedResponse;
  expect(result.status()).toBe(200);
  const removed = await result.json();
  expect(actions).toHaveLength(4);
  expect(actions.at(-1)).toEqual({
    type: 'demolishBuilding',
    id: 'building-quarry',
    expected: { type: 'quarry', level: 2, x: 0, y: 0, builds: 2 },
  });
  expect(removed.state.buildings).toEqual([before.buildings[1]]);
  expect(removed.state.resources.wood).toBe(before.resources.wood + 89.5);
  expect(removed.state.resources.stone).toBeCloseTo(
    before.resources.stone + ((removed.state.updatedAt - before.updatedAt) * 13.5) / 60000 + 38.5,
    5,
  );
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('[data-plot="p0"]')).toBeVisible();
  await expect(page.locator('[data-building="building-quarry-2"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-plot="p0"]')).toBeVisible();
  await expect(page.locator('.empty-plot')).toHaveCount(35);
  await expect(page.locator('[data-building="building-quarry-2"]')).toHaveCount(1);
  await buildAt(page, 'p0', 'well');
  await expect(page.locator('[data-plot="p0"]')).toHaveCount(0);
});

test('cancel, close, Escape and backdrop preserve all buildings and restore the remove control without sending an action', async ({
  page,
}) => {
  await signIn(page);
  const state = buildVillage();
  const before = structuredClone(state);
  const actions = await mockVillage(page, state);
  await page.goto('/#village');
  for (const method of ['cancel', 'close', 'escape', 'backdrop']) {
    await open(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(cancel(page)).toBeFocused();
    await expect(dialog(page).locator('[data-demolition-refund]')).toContainText(/22[.,]5/);
    if (method === 'cancel') await cancel(page).click();
    if (method === 'close') await dialog(page).locator('.modal-close').click();
    if (method === 'escape') await page.keyboard.press('Escape');
    if (method === 'backdrop')
      await page.locator('.modal-backdrop').click({ position: { x: 4, y: 4 } });
    await expect(dialog(page)).toHaveCount(0);
    await expect(open(page)).toBeFocused();
    expect(actions).toEqual([]);
    expect(state).toEqual(before);
  }
});

test('polling updates storage safety in the open dialog while retaining the focused cancel button', async ({
  page,
}) => {
  await signIn(page);
  const state = buildVillage();
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p1' }, START);
  state.resources.wood = 477.4;
  state.resources.stone = 100;
  const actions = await mockVillage(page, state);
  await page.goto('/#village');
  await page.locator('.scene-building[data-building="building-well"]').click();
  await open(page).click();
  await expect(confirm(page)).toBeEnabled();
  await expect(cancel(page)).toBeFocused();
  const originalCancel = await cancel(page).elementHandle();
  await pollVillage(page);
  await expect(confirm(page)).toBeDisabled();
  await expect(dialog(page).locator('[data-demolition-reason]')).not.toBeEmpty();
  await expect(cancel(page)).toBeFocused();
  expect(
    await originalCancel.evaluate(
      (node) => node === document.querySelector('#demolition-cancel') && node.isConnected,
    ),
  ).toBe(true);
  expect(actions).toEqual([]);
  await cancel(page).click();
  expect(state.buildings).toHaveLength(2);
});

for (const change of ['upgraded', 'rebuilt']) {
  test(
    'an open confirmation never retargets a building that another session has ' + change,
    async ({ page }) => {
      await signIn(page);
      const state = buildVillage();
      const actions = await mockVillage(page, state);
      await page.goto('/#village');
      await open(page).click();
      await expect(confirm(page)).toBeEnabled();
      if (change === 'upgraded')
        applyAction(state, { type: 'upgrade', id: 'building-well' }, START);
      else {
        applyAction(
          state,
          {
            type: 'demolishBuilding',
            id: 'building-well',
            expected: { type: 'well', level: 1, x: 0, y: 0, builds: 1 },
          },
          START,
        );
        applyAction(state, { type: 'build', building: 'well', plotId: 'p0' }, START);
      }
      const changed = structuredClone(state.buildings);
      await pollVillage(page);
      await expect(dialog(page)).toBeVisible();
      await expect(confirm(page)).toBeDisabled();
      await expect(dialog(page).locator('[data-demolition-reason]')).not.toBeEmpty();
      // A synthetic click also exercises the handler's stale-target guard.
      await confirm(page).evaluate((node) =>
        node.dispatchEvent(new MouseEvent('click', { bubbles: true })),
      );
      expect(actions).toEqual([]);
      expect(state.buildings).toEqual(changed);
      await cancel(page).click();
      await open(page).click();
      await expect(confirm(page)).toBeEnabled();
    },
  );
}

test('the demolition confirmation remains legible at 320 and 390 pixels in TR/EN and both themes', async ({
  page,
}) => {
  await signIn(page);
  const state = buildVillage();
  const actions = await mockVillage(page, state);
  await page.goto('/#village');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 850 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('[data-action="language"]').click();
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('[data-action="theme"]').click();
        await open(page).click();
        await expect(dialog(page)).toBeVisible();
        await expect(confirm(page)).toBeVisible();
        await expect(cancel(page)).toBeVisible();
        await expect(dialog(page).locator('[data-demolition-refund]')).toContainText(/22[.,]5/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const bounds = await dialog(page).evaluate((node) => ({
          left: node.getBoundingClientRect().left,
          right: node.getBoundingClientRect().right,
          client: node.clientWidth,
          scroll: node.scrollWidth,
        }));
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(width);
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
        if (width === 390 && language === 'tr' && theme === 'light')
          await dialog(page).screenshot({ path: 'artifacts/demolition-390-v2.8.0.png' });
        await cancel(page).click();
      }
    }
  }
  expect(actions).toEqual([]);
});

test('offline village preview explains demolition refunds but never enables or submits removal', async ({
  page,
}) => {
  const network = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:\/\//, (route) => {
    network.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(resolve('preview/village.html')).href);
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('#language').click();
    await page.locator('#preview-demolition-open').click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('[data-demolition-refund]')).not.toBeEmpty();
    await expect(confirm(page)).toBeDisabled();
    await expect(cancel(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('#preview-demolition-open')).toBeFocused();
  }
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

test('a stale server response keeps confirmation open with an explanation and never retries removal automatically', async ({
  page,
}) => {
  await signIn(page);
  const state = buildVillage();
  await mockVillage(page, state);
  let posts = 0;
  await page.route('**/api/action', async (route) => {
    posts += 1;
    applyAction(state, { type: 'upgrade', id: 'building-well' }, START);
    await route.fulfill({ status: 409, ...json({ error: 'stale_revision', state, revision: 99 }) });
  });
  await page.goto('/#village');
  await open(page).click();
  const response = page.waitForResponse('**/api/action');
  await confirm(page).click();
  expect((await response).status()).toBe(409);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('[data-demolition-error]')).not.toBeEmpty();
  await expect(dialog(page).locator('[data-demolition-reason]')).not.toBeEmpty();
  await expect(confirm(page)).toBeDisabled();
  await expect(cancel(page)).toBeFocused();
  expect(posts).toBe(1);
  expect(state.buildings).toHaveLength(1);
  expect(state.buildings[0].level).toBe(2);
});
