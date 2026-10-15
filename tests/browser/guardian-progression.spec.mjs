import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createGame, applyAction, advanceGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';
const START = Date.UTC(2026, 9, 15, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
async function mockGuardian(page, state) {
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
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const request = route.request().postDataJSON();
    expect(request.revision).toBe(revision);
    actions.push(request.action);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#wolves');
  await expect(page.locator('#guardian-panel')).toBeVisible();
  return actions;
}

test('guardian training shows actual gains and a confirmed real API action survives reload', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/#wolves');
  await expect(page.locator('[data-guardian-stat="attack"]')).toHaveText('5,1');
  await expect(page.locator('[data-guardian-stat="mitigation"]')).toHaveText('0%');
  const guardian = page.locator('.training-row').first();
  await expect(guardian).toContainText('140 → 144');
  await expect(guardian).toContainText('0% → 10,7%');
  const response = page.waitForResponse('**/api/action');
  await guardian.getByRole('button', { name: 'Eğit', exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  const saved = await result.json();
  expect(saved.state.wolves[0]).toMatchObject({
    maxHp: 144,
    hp: 144,
    points: 1,
    ranks: { guardian: 1 },
  });
  expect(saved.state.resources.herbs).toBe(72);
  expect(saved.state.resources.feed).toBe(168);
  await expect(page.locator('[data-guardian-stat="mitigation"]')).toHaveText('10,7%');
  await page.reload();
  await expect(page.locator('[data-guardian-stat="mitigation"]')).toHaveText('10,7%');
  await expect(page.locator('.training-points b')).toHaveText('1');
});

test('equipment compares gains and losses, conserves items and disables already equipped choices', async ({
  page,
}) => {
  const state = createGame(START);
  state.inventory.iron_guard = 1;
  state.inventory.scout_charm = 1;
  state.wolves[0].equipment = 'leather_vest';
  const actions = await mockGuardian(page, state);
  const iron = page
    .locator('.guardian-item')
    .filter({ has: page.locator('[data-item="iron_guard"]') });
  await expect(iron).toContainText('5,1 → 7,1');
  await expect(iron).toContainText('10,7% → 19,4%');
  expect(actions).toEqual([]);
  const equipped = page.waitForResponse('**/api/action');
  await iron.getByRole('button').click();
  await (await equipped).finished();
  expect(actions).toEqual([{ type: 'equip', id: 'wolf-alpha', item: 'iron_guard' }]);
  expect(state.inventory.leather_vest).toBe(1);
  expect(state.inventory.iron_guard).toBe(0);
  await expect(iron.getByRole('button')).toBeDisabled();
  await expect(iron).toContainText('Kuşanılmış');
  const scout = page
    .locator('.guardian-item')
    .filter({ has: page.locator('[data-item="scout_charm"]') });
  await expect(scout).toContainText('7,1 → 6,1');
  await expect(scout.locator('.negative')).toHaveCount(2);
  const removed = page.waitForResponse('**/api/action');
  await page.locator('[data-action="unequip"]').click();
  await (await removed).finished();
  expect(state.wolves[0].equipment).toBeNull();
  expect(state.inventory.iron_guard).toBe(1);
});

test('training becomes affordable without replacing focused buttons or spending automatically', async ({
  page,
}) => {
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'healer', plotId: 'p0' }, START);
  state.resources.herbs = 7.99;
  state.resources.feed = 12;
  const actions = await mockGuardian(page, state);
  const train = page.locator('#guardian-train-guardian');
  await expect(train).toBeDisabled();
  await expect(page.locator('#guardian-training-reason-guardian')).toContainText('Eksik kaynak: 1');
  const card = page.locator('[data-wolf="wolf-alpha"]');
  await card.focus();
  await page.evaluate(() => {
    window.originalTrain = document.querySelector('#guardian-train-guardian');
    window.originalCard = document.querySelector('[data-wolf="wolf-alpha"]');
  });
  const polled = page.waitForResponse('**/api/state');
  await page.clock.fastForward(1000);
  await (await polled).finished();
  await expect(train).toBeEnabled();
  await expect(card).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        window.originalTrain === document.querySelector('#guardian-train-guardian') &&
        window.originalCard === document.querySelector('[data-wolf="wolf-alpha"]'),
    ),
  ).toBe(true);
  expect(actions).toEqual([]);
  expect(state.wolves[0].points).toBe(2);
});

test('level cap, full inventory, missions and battle explain unavailable actions', async ({
  page,
}) => {
  const state = createGame(START);
  state.wolves[0].level = 20;
  state.wolves[0].xp = 899;
  state.wolves[0].equipment = 'leather_vest';
  state.inventory.leather_vest = 10000;
  state.inventory.iron_guard = 1;
  const actions = await mockGuardian(page, state);
  await expect(page.locator('.guardian-xp')).toContainText('En yüksek seviye');
  await expect(page.locator('.guardian-xp')).not.toContainText('899 / 900');
  await expect(page.locator('#guardian-train-guardian')).toBeEnabled();
  await expect(page.locator('#guardian-equip-iron_guard')).toBeDisabled();
  await expect(page.locator('#guardian-item-reason-iron_guard')).toContainText('çantası dolu');
  applyAction(
    state,
    { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-alpha'] },
    START,
  );
  await page.reload();
  await expect(page.locator('#guardian-train-guardian')).toBeDisabled();
  await expect(page.locator('#guardian-training-reason-guardian')).toContainText('görevi bitene');
  await page.locator('[data-wolf="wolf-guardian"]').click();
  await expect(page.locator('#guardian-train-guardian')).toBeEnabled();
  state.adventure.active = null;
  applyAction(state, { type: 'startBattle' }, START);
  await page.reload();
  await expect(page.locator('#guardian-train-guardian')).toBeDisabled();
  await expect(page.locator('#guardian-training-reason-guardian')).toContainText('Savaş bitince');
  expect(actions).toEqual([]);
});

test('offline guardian preview supports read-only scenarios, role selection and narrow bilingual themes', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(resolve('preview/guardians.html')).href);
  for (const id of ['wolf-alpha', 'wolf-guardian', 'wolf-hunter', 'wolf-scout', 'wolf-healer']) {
    await page.locator('[data-wolf="' + id + '"]').click();
    await expect(page.locator('[data-wolf="' + id + '"]').first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('#guardian-train-guardian')).toBeDisabled();
  }
  for (const scenario of ['supplies', 'away', 'maximum', 'ready']) {
    await page.locator('#preview-scenario').selectOption(scenario);
    expect(await page.locator('[data-action]:enabled').count()).toBe(0);
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('#theme').click();
      for (const language of ['tr', 'en']) {
        if ((await page.locator('html').getAttribute('lang')) !== language)
          await page.locator('#language').click();
        await expect(page.locator('.guardian-readonly')).toContainText(
          language === 'tr' ? 'Salt okunur' : 'Read-only',
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
      if (width === 1440 && theme === 'light')
        await page.screenshot({ path: 'artifacts/guardians-desktop-v2.3.0.png', fullPage: true });
      if (width === 390 && theme === 'dark')
        await page.screenshot({ path: 'artifacts/guardians-mobile-v2.3.0.png', fullPage: true });
    }
  }
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
