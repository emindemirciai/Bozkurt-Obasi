import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 8, 21, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

function heldPoll(page, state, revision) {
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  const installed = page.route('**/api/state', async (route) => {
    started.resolve();
    await release.promise;
    await route.fulfill(json({ state, revision }));
  });
  return { installed, started: started.promise, release: release.resolve };
}

async function mockVillage(page, state) {
  let revision = 0;
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    applyAction(
      state,
      route.request().postDataJSON().action,
      await page.evaluate(() => Date.now()),
    );
    await route.fulfill(json({ state, revision: ++revision }));
  });
}

test('logout ignores a delayed poll and never opens or writes a guest village', async ({
  page,
}) => {
  await signIn(page);
  await page.clock.install({ time: new Date(START) });
  const online = createGame(START);
  applyAction(online, { type: 'build', building: 'quarry', plotId: 'p0' }, START);
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state: online, revision: 1, mode: 'online' })),
  );
  const poll = heldPoll(page, online, 2);
  await poll.installed;
  await page.goto('/#village');
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.locator('.profile').click();
  await page.clock.fastForward(1000);
  await poll.started;
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(page.locator('.game-shell')).toHaveCount(0);
  const completed = page.waitForResponse('**/api/state');
  poll.release();
  await (await completed).finished();
  await page.clock.fastForward(20_000);
  await expect(page.getByRole('heading', { name: /Obanı kur.*Sürünü koru/s })).toBeVisible();
  await expect(page.locator('[data-action="play"]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.web.v1'))).toBeNull();
  await page.goto('/#village');
  await expect(page).toHaveURL('/');
  await expect(page.locator('.game-shell')).toHaveCount(0);
});

test('a user action waits for polling and sends its latest revision exactly once', async ({
  page,
}) => {
  await signIn(page);
  await page.clock.install({ time: new Date(START) });
  const online = createGame(START);
  const actions = [];
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state: online, revision: 3, mode: 'online' })),
  );
  const poll = heldPoll(page, online, 4);
  await poll.installed;
  await page.route('**/api/action', async (route) => {
    const request = route.request().postDataJSON();
    actions.push(request);
    applyAction(online, request.action, START);
    await route.fulfill(json({ state: online, revision: 5 }));
  });
  await page.goto('/#village');
  await expect(page.locator('.map-chip')).toHaveText('0 yapı');
  await page.clock.fastForward(1000);
  await poll.started;
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yola çık', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Ana Yurt', exact: true }).click();
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  expect(actions).toHaveLength(0);
  poll.release();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  expect(actions).toEqual([
    { action: { type: 'build', building: 'quarry', plotId: 'p0' }, revision: 4 },
  ]);
});

test('invalid successful village responses keep the game closed without a local fallback', async ({
  page,
}) => {
  await signIn(page);
  const online = createGame(Date.now());
  const responses = [
    { revision: 1, mode: 'online' },
    { state: online, revision: '1', mode: 'online' },
    { state: { ...online, resources: {} }, revision: 1, mode: 'online' },
  ];
  let calls = 0;
  await page.route('**/api/session', (route) => {
    calls++;
    return route.fulfill(json(responses.shift()));
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt === 1) await page.goto('/#village');
    else await page.reload();
    await expect.poll(() => calls).toBe(attempt);
    await expect(page.locator('.game-shell')).toHaveCount(0);
    await expect(page.locator('[data-action="play"]')).toHaveCount(0);
    await expect(page.locator('#notice')).toContainText('sunucu köyü');
  }
  expect(responses).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.web.v1'))).toBeNull();
});

test('server production unlocks construction without navigating or clicking', async ({ page }) => {
  await signIn(page);
  await page.clock.install({ time: new Date(START) });
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p1' }, START);
  state.resources.wood = 69;
  state.resources.stone = 30;
  await mockVillage(page, state);
  await page.goto('/#village');
  const quarry = page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'Yer seç · Taş Ocağı', exact: true });
  await quarry.click();
  await page.locator('[data-plot="p0"]').click();
  const choice = page.locator('.placement-dialog [data-building-type="quarry"]');
  await expect(choice).toBeDisabled();
  await page.locator('[data-action="close"]').click();
  await page.clock.fastForward(6100);
  await expect(quarry).toBeEnabled();
  await quarry.click();
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await expect(page.locator('.map-chip')).toHaveText('2 yapı');
});

test('battle refresh preserves keyboard focus and leaves an open account modal untouched', async ({
  page,
}) => {
  await signIn(page);
  await page.clock.install({ time: new Date(START) });
  await mockVillage(page, createGame(START));
  await page.goto('/#village');
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
  await page.getByRole('button', { name: 'Yola çık', exact: true }).click();
  const language = page.getByRole('button', { name: 'Switch to English', exact: true });
  await language.focus();
  await page.clock.fastForward(2000);
  await expect(language).toBeFocused();
  await page.locator('.profile').click();
  const logout = page.getByRole('button', { name: 'Çıkış yap', exact: true });
  await logout.focus();
  await page.clock.fastForward(2000);
  await expect(logout).toBeFocused();
});
