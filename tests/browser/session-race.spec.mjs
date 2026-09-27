import { test, expect } from '@playwright/test';
import { createGame, applyAction } from '../../shared/game.mjs';

const START = Date.UTC(2026, 8, 21, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

async function connect(page) {
  await page.locator('.connection').click();
  await page.getByRole('button', { name: 'Sunucuya bağlan', exact: true }).click();
  await expect(page.locator('.connection')).toContainText('Çevrim içi');
}

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

test('disconnect ignores a delayed online poll and cannot overwrite the local village', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(START) });
  const online = createGame(START);
  applyAction(online, { type: 'build', building: 'quarry' }, START);
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state: online, revision: 1, mode: 'online' })),
  );
  const poll = heldPoll(page, online, 2);
  await poll.installed;
  await page.goto('/#village');
  await connect(page);
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.locator('.connection').click();
  await page.clock.fastForward(1000);
  await poll.started;
  await page.getByRole('button', { name: 'Yerel köye dön', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('4 yapı');
  const completed = page.waitForResponse('**/api/state');
  poll.release();
  await (await completed).finished();
  await page.clock.fastForward(20_000);
  await expect(page.locator('.connection')).toContainText('Yerel kayıt');
  await expect(page.locator('.map-chip')).toHaveText('4 yapı');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('bozkurt.web.v1')).buildings.length),
  ).toBe(4);
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('4 yapı');
});

test('a user action waits for polling and sends its latest revision exactly once', async ({
  page,
}) => {
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
  await connect(page);
  await page.clock.fastForward(1000);
  await poll.started;
  await page.getByRole('button', { name: 'Savunma', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Savaşı başlat', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Ana Yurt', exact: true }).click();
  const quarry = page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true });
  await quarry.click();
  expect(actions).toHaveLength(0);
  poll.release();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  expect(actions).toEqual([{ action: { type: 'build', building: 'quarry' }, revision: 4 }]);
});

test('invalid successful API responses leave the local game and connection mode intact', async ({
  page,
}) => {
  const online = createGame(Date.now());
  applyAction(online, { type: 'build', building: 'quarry' }, online.updatedAt);
  const responses = [
    { revision: 1, mode: 'online' },
    { state: online, revision: '1', mode: 'online' },
    { state: { ...online, resources: {} }, revision: 1, mode: 'online' },
  ];
  await page.route('**/api/session', (route) => route.fulfill(json(responses.shift())));
  await page.goto('/#village');
  await page.locator('.connection').click();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole('button', { name: 'Sunucuya bağlan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sunucuya bağlan', exact: true })).toBeEnabled();
    await expect(page.locator('.connection')).toContainText('Yerel kayıt');
    await expect(page.locator('.map-chip')).toHaveText('4 yapı');
  }
  expect(responses).toHaveLength(0);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('bozkurt.web.v1')).buildings.length),
  ).toBe(4);
});

test('passive production unlocks construction without navigating or clicking', async ({ page }) => {
  await page.clock.install({ time: new Date(START) });
  const saved = createGame(START);
  saved.resources.wood = 69;
  saved.resources.stone = 30;
  await page.addInitScript(
    (state) => localStorage.setItem('bozkurt.web.v1', JSON.stringify(state)),
    saved,
  );
  await page.goto('/#village');
  const quarry = page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true });
  await expect(quarry).toBeDisabled();
  await page.clock.fastForward(6100);
  await expect(quarry).toBeEnabled();
  await quarry.click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
});

test('battle refresh preserves keyboard focus and leaves an open modal untouched', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(START) });
  await page.goto('/#village');
  await page.getByRole('button', { name: 'Savunma', exact: true }).click();
  await page.getByRole('button', { name: 'Savaşı başlat', exact: true }).click();
  const language = page.getByRole('button', { name: 'Switch to English', exact: true });
  await language.focus();
  await page.clock.fastForward(2000);
  await expect(language).toBeFocused();
  await page.locator('.profile').click();
  const exportButton = page.getByRole('button', { name: 'Yerel kayıt yedeği', exact: true });
  await exportButton.focus();
  await page.clock.fastForward(2000);
  await expect(exportButton).toBeFocused();
});
