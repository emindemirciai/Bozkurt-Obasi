import { test, expect } from '@playwright/test';
import { signIn } from './sign-in.mjs';

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('First Watch directs without spending, claims real rewards once and survives reload', async ({
  page,
}) => {
  const actions = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/action')
      actions.push(request.postDataJSON().action);
  });
  await page.goto('/#village');
  const guide = page.locator('#first-watch-panel');
  const current = guide.locator('[aria-current="step"]');
  await expect(guide.getByRole('heading', { name: 'İlk Nöbet', exact: true })).toBeVisible();
  await expect(guide.locator('.first-watch-count')).toHaveText('0 / 8 ödül alındı');
  await guide.locator('[data-action="firstWatchGo"]').click();
  await expect(page.locator('#collect-button')).toBeFocused();
  expect(actions).toEqual([]);
  await page.locator('#collect-button').click();
  await expect(current).toHaveAttribute('data-step', 'gather');
  await expect(guide.locator('[data-action="claimFirstWatch"]')).toBeEnabled();
  await guide.locator('[data-action="claimFirstWatch"]').click();
  await expect(guide.locator('.first-watch-count')).toHaveText('1 / 8 ödül alındı');
  await expect(page.locator('#fw-action-build')).toBeFocused();
  await guide.locator('[data-action="firstWatchGo"]').click();
  await expect(page.locator('[data-plot="p0"]')).toBeFocused();
  expect(actions.map((action) => action.type)).toEqual(['collect', 'claimFirstWatch']);
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await guide.locator('[data-action="claimFirstWatch"]').click();
  await expect(guide.locator('.first-watch-count')).toHaveText('2 / 8 ödül alındı');
  await page.reload();
  await expect(guide.locator('.first-watch-count')).toHaveText('2 / 8 ödül alındı');
  await guide.locator('[data-action="firstWatchGo"]').click();
  const training = page.locator('[data-action="train"]').first();
  await expect(training).toBeFocused();
  expect(actions.map((action) => action.type)).toEqual([
    'collect',
    'claimFirstWatch',
    'build',
    'claimFirstWatch',
  ]);
  await training.click();
  await expect(page.locator('.training-points b')).toHaveText('1');
  await page.locator('.nav-item[data-view="quests"]').click();
  await expect(page.locator('.first-watch-steps>li')).toHaveCount(8);
  await expect(page.locator('[data-step="gather"] .first-watch-claimed')).toHaveText('Ödül alındı');
  await expect(page.locator('[data-action="claimQuest"][data-id="first_build"]')).toBeEnabled();
  await expect(page.locator('.quest-grid .quest-card')).toHaveCount(4);
  await page.locator('#fw-action-train').click();
  await expect(guide.locator('.first-watch-count')).toHaveText('3 / 8 ödül alındı');
  await page.locator('#fw-action-battle').click();
  await expect(page.locator('[data-action="startBattle"]')).toBeFocused();
  await expect(page.locator('.battle-scene')).not.toHaveClass(/is-active/);
  expect(
    actions.filter((action) => action.type === 'claimFirstWatch').map((action) => action.id),
  ).toEqual(['gather', 'build', 'train']);
  expect(errors).toEqual([]);
});

test('earlier out-of-order actions remain completed while chapter rewards stay sequential in both themes', async ({
  page,
}) => {
  let response = await page.request.post('/api/session', { data: {} });
  expect(response.ok()).toBe(true);
  let save = await response.json();
  for (const action of [
    { type: 'build', building: 'healer', plotId: 'p0' },
    { type: 'claimQuest', id: 'first_build' },
    { type: 'train', id: 'wolf-alpha', path: 'guardian' },
  ]) {
    response = await page.request.post('/api/action', {
      data: { action, revision: save.revision },
    });
    expect(response.ok()).toBe(true);
    save = await response.json();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#quests');
  const chapter = page.locator('#first-watch-panel');
  await expect(chapter.locator('.first-watch-count')).toHaveText('0 / 8 ödül alındı');
  await expect(chapter.locator('[aria-current="step"]')).toHaveAttribute('data-step', 'gather');
  await expect(chapter.locator('[data-step="build"]')).toContainText('Hedef tamamlandı');
  await expect(chapter.locator('#fw-action-build')).toBeDisabled();
  await expect(chapter.locator('[data-step="train"]')).toContainText('Hedef tamamlandı');
  await page.getByRole('button', { name: 'Koyu temaya geç', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: 'First Watch', exact: true })).toBeVisible();
  await expect(chapter.locator('.first-watch-count')).toHaveText('0 / 8 rewards claimed');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(chapter.locator('[data-step="build"]')).toContainText('Objective complete');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await page.getByRole('button', { name: 'Türkçeye geç', exact: true }).click();
  await expect(chapter.locator('#fw-action-gather')).toHaveText('Kaynak toplamaya git');
});

test('a rejected chapter claim retains focus and the successful retry focuses the next objective', async ({
  page,
}) => {
  await page.goto('/#village');
  await page.locator('#collect-button').click();
  const reward = page.locator('#fw-action-gather');
  await expect(reward).toHaveAttribute('data-action', 'claimFirstWatch');
  await page.route(
    '**/api/action',
    (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'FIRST_WATCH_INCOMPLETE' }),
      }),
    { times: 1 },
  );
  await reward.click();
  await expect(page.locator('#notice')).toContainText('Görev güncellendi');
  await expect(reward).toBeFocused();
  await expect(page.locator('.first-watch-count')).toHaveText('0 / 8 ödül alındı');
  await reward.click();
  await expect(page.locator('.first-watch-count')).toHaveText('1 / 8 ödül alındı');
  await expect(page.locator('#fw-action-build')).toBeFocused();
});
