import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 16, 12);
const json = (value, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(value),
});
function battleAt(tick = 7) {
  const state = createGame(START);
  applyAction(state, { type: 'startBattle' }, START, () => 0.99);
  advanceGame(state, START + tick * 1000);
  expect(validateGame(state)).toBe(true);
  return state;
}
async function mockBattle(page, state, actionHandler) {
  await signIn(page);
  await page.clock.install({ time: new Date(state.updatedAt - 1000) });
  await page.clock.pauseAt(new Date(state.updatedAt));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let revision = 0;
  const requests = [];
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const request = route.request().postDataJSON();
    expect(request.revision).toBe(revision);
    requests.push(request);
    if (actionHandler) {
      const handled = await actionHandler({
        route,
        request,
        state,
        nextRevision: () => ++revision,
      });
      if (handled) return;
    }
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#battle');
  await expect(page.locator('#battle-command-panel')).toBeVisible();
  return requests;
}

test('battle orders wait for server confirmation and preserve the map, controls and keyboard focus', async ({
  page,
}) => {
  const state = battleAt(),
    held = Promise.withResolvers(),
    entered = Promise.withResolvers();
  const requests = await mockBattle(page, state, async () => {
    entered.resolve();
    await held.promise;
    return false;
  });
  const scene = await page.locator('.battle-scene').elementHandle();
  const button = await page.locator('#battle-command-brace').elementHandle();
  await expect(page.locator('#battle-command-brace')).toBeEnabled();
  await page.locator('#battle-command-brace').click();
  await entered.promise;
  await expect(page.locator('#battle-command-focus')).toBeDisabled();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', '');
  expect(state.battle.commands).toEqual([]);
  expect(await scene.evaluate((node) => node.isConnected)).toBe(true);
  expect(await button.evaluate((node) => node.isConnected)).toBe(true);
  const language = page.getByRole('button', { name: 'Switch to English', exact: true });
  await language.focus();
  const confirmed = page.waitForResponse('**/api/action');
  held.resolve();
  await (await confirmed).finished();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', 'brace');
  expect(state.battle.commands).toEqual([{ id: 'brace', tick: 7 }]);
  expect(requests.map((request) => request.action)).toEqual([
    { type: 'battleCommand', id: 'brace' },
  ]);
  await expect(language).toBeFocused();
  await page.clock.fastForward(6000);
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', '');
  await expect(page.locator('#battle-command-focus')).toBeDisabled();
  await expect(language).toBeFocused();
  await page.clock.fastForward(6000);
  await expect(page.locator('#battle-command-focus')).toBeEnabled();
  expect(await scene.evaluate((node) => node.isConnected)).toBe(true);
  expect(await button.evaluate((node) => node.isConnected)).toBe(true);
  await expect(language).toBeFocused();
  await page.locator('#battle-command-focus').click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', 'focus');
  expect(state.battle.commands.map((entry) => entry.id)).toEqual(['brace', 'focus']);
  expect(requests).toHaveLength(2);
  await expect(page.locator('#battle-command-title')).toBeFocused();
});

test('rejected orders never apply locally and a stale revision displays the authoritative command without retrying', async ({
  page,
}) => {
  const state = battleAt();
  let attempt = 0;
  const requests = await mockBattle(page, state, async ({ route, nextRevision }) => {
    attempt++;
    if (attempt === 1) {
      await route.fulfill(json({ error: 'BATTLE_COMMAND_COOLDOWN' }, 400));
    } else {
      applyAction(state, { type: 'battleCommand', id: 'brace' }, START + 7000);
      await route.fulfill(json({ error: 'stale_revision', state, revision: nextRevision() }, 409));
    }
    return true;
  });
  const scene = await page.locator('.battle-scene').elementHandle();
  await page.locator('#battle-command-focus').click();
  await expect(page.locator('#notice')).not.toBeEmpty();
  await expect(page.locator('#battle-command-focus')).toBeEnabled();
  await expect(page.locator('#battle-command-focus')).toBeFocused();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', '');
  expect(state.battle.commands).toEqual([]);
  await page.locator('#battle-command-focus').click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', 'brace');
  await expect(page.locator('#battle-command-focus')).toBeDisabled();
  expect(state.battle.commands).toEqual([{ id: 'brace', tick: 7 }]);
  expect(requests.map((request) => request.action.id)).toEqual(['focus', 'focus']);
  expect(await scene.evaluate((node) => node.isConnected)).toBe(true);
});

test('orders remain unavailable during the ambush introduction and after the battle ends', async ({
  page,
}) => {
  const state = battleAt(2);
  const requests = await mockBattle(page, state);
  for (const id of ['brace', 'focus', 'rally'])
    await expect(page.locator(`#battle-command-${id}`)).toBeDisabled();
  await page.clock.fastForward(5000);
  await expect(page.locator('#battle-command-brace')).toBeEnabled();
  await page.clock.fastForward(90000);
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', /^(won|lost)$/);
  for (const id of ['brace', 'focus', 'rally'])
    await expect(page.locator(`#battle-command-${id}`)).toBeDisabled();
  expect(requests).toEqual([]);
});

test('offline battle sandbox runs real commands without network or storage in both languages and themes', async ({
  page,
}) => {
  const external = [],
    errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear'])
      Storage.prototype[method] = () => {
        throw new Error('Offline sandbox attempted browser storage: ' + method);
      };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pathToFileURL(resolve('preview/battle.html')).href);
  await expect(page.locator('#offline-banner')).toContainText('Çevrimdışı deneme');
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', 'clash');
  await expect(page.locator('#battle-command-brace')).toBeEnabled();
  const scene = await page.locator('.battle-scene').elementHandle();
  await page.locator('#battle-command-brace').click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', 'brace');
  await expect(page.locator('#battle-command-focus')).toBeDisabled();
  for (let tick = 0; tick < 6; tick++) await page.locator('#preview-step').click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', '');
  await expect(page.locator('#battle-command-focus')).toBeDisabled();
  expect(await scene.evaluate((node) => node.isConnected)).toBe(true);
  for (let tick = 0; tick < 6; tick++) await page.locator('#preview-step').click();
  await expect(page.locator('#battle-command-focus')).toBeEnabled();
  await page.locator('#battle-command-focus').click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-command', 'focus');
  await page.locator('#preview-scenario').selectOption('rally');
  await expect(page.locator('[data-preview-panic]')).toHaveText('0%');
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-rally', 'true');
  await page.locator('#preview-scenario').selectOption('completed');
  await expect(page.locator('#preview-step')).toBeDisabled();
  await expect(page.locator('#battle-command-brace')).toBeDisabled();
  await page.locator('#preview-scenario').selectOption('preparing');
  await expect(page.locator('#battle-command-brace')).toBeDisabled();
  await page.locator('#preview-step').click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', 'march');
  await page.locator('#preview-scenario').selectOption('brace');
  await mkdir('artifacts', { recursive: true });
  for (const language of ['tr', 'en']) {
    if (language === 'en') await page.locator('#language').click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('#theme').click();
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const sizes = await page
          .locator('#battle-command-panel')
          .evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
        expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
        await expect(page.locator('#battle-command-brace')).toBeVisible();
        if (language === 'tr' && theme === 'dark' && [390, 1440].includes(width))
          await page.screenshot({
            path: `artifacts/battle-commands-${width}-v2.5.0.png`,
            fullPage: true,
          });
      }
    }
  }
  await page.locator('#zoom').click();
  await expect(page.locator('.battle-actors')).toHaveAttribute('viewBox', '140 95 570 455');
  await page.locator('#motion').click();
  await expect(page.locator('.battle-scene')).toHaveClass(/is-active/);
  await page.locator('#preview-reset').click();
  await expect(page.locator('[data-preview-tick]')).toHaveText('7');
  await expect(page.locator('.battle-actors')).toHaveAttribute('viewBox', '140 95 570 455');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('mobile quick orders send one request and refresh both command panels without replacing the battlefield', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = battleAt();
  const requests = await mockBattle(page, state);
  const scene = await page.locator('.battle-scene').elementHandle();
  const quick = await page.locator('#battle-command-quickbar').elementHandle();
  const detailed = await page.locator('#battle-command-panel').elementHandle();
  for (const id of ['brace', 'focus', 'rally'])
    await expect(page.locator(`#battle-command-quick-${id}`)).toBeVisible();
  const placement = await page.locator('#battle-command-quickbar').evaluate((node) => ({
    withinMap: Boolean(node.closest('.map-card')),
    height: node.getBoundingClientRect().height,
    overflow: node.scrollWidth > node.clientWidth,
  }));
  expect(placement.withinMap).toBe(true);
  expect(placement.height).toBeLessThan(250);
  expect(placement.overflow).toBe(false);
  await page.locator('#battle-command-quick-rally').click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-rally', 'true');
  await expect(page.locator('#battle-command-quick-title')).toBeFocused();
  for (const prefix of ['#battle-command-', '#battle-command-quick-'])
    for (const id of ['brace', 'focus', 'rally'])
      await expect(page.locator(prefix + id)).toBeDisabled();
  await page.clock.fastForward(12000);
  await expect(page.locator('#battle-command-brace')).toBeEnabled();
  await expect(page.locator('#battle-command-quick-brace')).toBeEnabled();
  for (const node of [scene, quick, detailed])
    expect(await node.evaluate((element) => element.isConnected)).toBe(true);
  expect(requests.map((request) => request.action)).toEqual([
    { type: 'battleCommand', id: 'rally' },
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
