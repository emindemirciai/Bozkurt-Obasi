import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createGame, applyAction, advanceGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 15, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
function injuredHerd({ pasture = true } = {}) {
  const state = createGame(START);
  if (pasture) applyAction(state, { type: 'build', building: 'pasture', plotId: 'p0' }, START);
  state.herd = { count: 20, maxHp: 200, hp: 150, panic: 30 };
  return state;
}
async function mockVillage(page, state) {
  await signIn(page);
  let revision = 0;
  const actions = [];
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body.action);
    expect(body.revision).toBe(revision);
    applyAction(state, body.action, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#village');
  await expect(page.locator('#herd-recovery-panel')).toBeVisible();
  return actions;
}

test('replenishment quotes spend nothing, explicit confirmation preserves wounds and persists', async ({
  page,
}) => {
  const state = injuredHerd();
  const actions = await mockVillage(page, state);
  const panel = page.locator('#herd-recovery-panel');
  await expect(panel.locator('[data-herd-count]')).toHaveText('20 / 24');
  const before = structuredClone(state);
  await panel.locator('select').selectOption('4');
  await expect(panel).toContainText('Maliyet: 24');
  await expect(panel).toContainText('Maliyet: 48');
  expect(actions).toEqual([]);
  expect(state).toEqual(before);
  const response = page.waitForResponse('**/api/action');
  await panel.locator('#herd-replenish-button').click();
  await (await response).finished();
  expect(actions).toEqual([{ type: 'replenishHerd', amount: 4 }]);
  expect(state.herd).toEqual({ count: 24, maxHp: 240, hp: 190, panic: 30 });
  expect(state.resources.water).toBe(before.resources.water - 24);
  expect(state.resources.feed).toBe(before.resources.feed - 48);
  expect(state.wolves).toEqual(before.wolves);
  await expect(panel).toContainText('Sürün tam');
  await expect(panel.locator('#herd-replenish-button')).toBeDisabled();
  await page.reload();
  await expect(panel.locator('[data-herd-count]')).toHaveText('24 / 24');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(panel).toContainText('Your herd is full');
  await page.goto('/#wolves');
  await expect(panel.locator('[data-herd-count]')).toHaveText('24 / 24');
  await page.goto('/#battle');
  await expect(panel.locator('[data-herd-count]')).toHaveText('24 / 24');
});

test('pasture and active journey blockers are explained without issuing a command', async ({
  page,
}) => {
  const state = injuredHerd({ pasture: false });
  const actions = await mockVillage(page, state);
  const panel = page.locator('#herd-recovery-panel');
  await expect(panel).toContainText('otlak inşa et');
  await expect(panel.locator('#herd-replenish-button')).toBeDisabled();
  applyAction(state, { type: 'build', building: 'pasture', plotId: 'p0' }, START);
  applyAction(state, { type: 'startBattle' }, START);
  await page.reload();
  await expect(panel).toContainText('Savaş sürerken');
  await expect(panel.locator('#herd-replenish-button')).toBeDisabled();
  Object.assign(state, injuredHerd());
  applyAction(
    state,
    { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-alpha'] },
    START,
  );
  await page.reload();
  await expect(panel).toContainText('keşif veya sevkiyatın bitmesini');
  await expect(panel.locator('#herd-replenish-button')).toBeDisabled();
  expect(actions).toEqual([]);
});

test('passive production enables the quote while preserving selection and focused controls', async ({
  page,
}) => {
  const state = injuredHerd();
  applyAction(state, { type: 'build', building: 'well', plotId: 'p1' }, START);
  state.resources.water = 11.9;
  state.resources.feed = 24;
  const actions = await mockVillage(page, state);
  const select = page.locator('#herd-replenish-amount');
  const button = page.locator('#herd-replenish-button');
  await select.selectOption('2');
  await expect(button).toBeDisabled();
  await expect(page.locator('#herd-recovery-panel')).toContainText('Eksik: 1');
  await select.focus();
  await page.evaluate(() => {
    window.originalHerdSelect = document.querySelector('#herd-replenish-amount');
    window.originalHerdButton = document.querySelector('#herd-replenish-button');
  });
  const polled = page.waitForResponse('**/api/state');
  await page.clock.fastForward(11_000);
  await (await polled).finished();
  await expect(button).toBeEnabled();
  await expect(select).toHaveValue('2');
  await expect(select).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        window.originalHerdSelect === document.querySelector('#herd-replenish-amount') &&
        window.originalHerdButton === document.querySelector('#herd-replenish-button'),
    ),
  ).toBe(true);
  expect(actions).toEqual([]);
  expect(state.herd.count).toBe(20);
});

test('offline recovery preview is read-only, bilingual and fits desktop and small phones', async ({
  page,
}) => {
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(resolve('preview/village.html')).href);
  const panel = page.locator('#herd-recovery-panel');
  await expect(panel).toContainText('20 / 24');
  await panel.locator('select').selectOption('4');
  await expect(panel).toContainText('Maliyet: 48');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('#theme').click();
      for (const language of ['tr', 'en']) {
        if ((await page.locator('html').getAttribute('lang')) !== language)
          await page.locator('#language').click();
        await expect(panel.locator('select')).toHaveValue('4');
        await expect(panel.locator('#herd-replenish-button')).toBeDisabled();
        await expect(panel).toContainText(
          language === 'tr' ? 'Salt okunur örnek' : 'Read-only example',
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await panel.scrollIntoViewIfNeeded();
        const box = await panel.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      if (width === 1440 && theme === 'light')
        await panel.screenshot({ path: 'artifacts/herd-recovery-desktop-v2.2.0.png' });
      if (width === 390 && theme === 'dark')
        await panel.screenshot({ path: 'artifacts/herd-recovery-mobile-v2.2.0.png' });
    }
  }
});
