import { test, expect } from '@playwright/test';
import { signIn } from './sign-in.mjs';

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('first steps directs players without spending, advances through real actions and survives reload', async ({
  page,
}) => {
  const actions = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/action')
      actions.push(request.postDataJSON().action.type);
  });
  await page.goto('/#village');
  const guide = page.locator('.first-steps');
  const current = guide.locator('[aria-current="step"]');
  const follow = () => guide.locator('[data-action="guide"]').click();
  const village = () => page.locator('.nav-item[data-view="village"]').click();
  await expect(guide.getByRole('heading', { name: 'İlk adımlar' })).toBeVisible();
  await expect(guide.locator('.guide-count')).toHaveText('0 / 5 tamamlandı');
  await expect(current).toContainText('Kaynak topla');
  await follow();
  await expect(page.locator('#collect-button')).toBeFocused();
  expect(actions).toEqual([]);
  await page.locator('#collect-button').click();
  await expect(current).toContainText('Yeni bir yapı kur');

  await follow();
  const quarry = page.locator('[data-building-type="quarry"]');
  await expect(quarry).toBeFocused();
  expect(actions).toEqual(['collect']);
  await quarry.click();
  await expect(guide.locator('.guide-count')).toHaveText('2 / 5 tamamlandı');
  await expect(current).toContainText('İlk görev ödülünü al');
  await page.reload();
  await expect(guide.locator('.guide-count')).toHaveText('2 / 5 tamamlandı');
  await follow();
  const reward = page.locator('[data-action="claimQuest"][data-id="first_build"]');
  await expect(reward).toBeFocused();
  await expect(reward).toBeEnabled();
  expect(actions).toEqual(['collect', 'build']);
  await reward.click();
  await expect(reward).toBeDisabled();
  await village();
  await expect(current).toContainText('İki eğitim yap');
  await follow();
  const training = page.locator('[data-action="train"]').first();
  await expect(training).toBeFocused();
  expect(actions).toEqual(['collect', 'build', 'claimQuest']);
  await training.click();
  await expect(page.locator('.training-points b')).toHaveText('1');
  await village();
  await expect(current).toContainText('1/2');
  await expect(guide.locator('.guide-count')).toHaveText('3 / 5 tamamlandı');
  await follow();
  await training.click();
  await expect(page.locator('.training-points b')).toHaveText('0');
  await village();
  await expect(guide.locator('.guide-count')).toHaveText('4 / 5 tamamlandı');
  await expect(current).toContainText('İlk savunmanı kazan');
  await follow();
  await expect(page.locator('[data-action="startBattle"]')).toBeFocused();
  await expect(page.locator('.battle-scene')).not.toHaveClass(/is-active/);
  expect(actions).toEqual(['collect', 'build', 'claimQuest', 'train', 'train']);
  expect(errors).toEqual([]);
});

test('existing out-of-order progress stays legible in both languages and themes on mobile', async ({
  page,
}) => {
  let response = await page.request.post('/api/session', { data: {} });
  expect(response.ok()).toBe(true);
  let save = await response.json();
  for (const action of [
    { type: 'build', building: 'healer' },
    { type: 'claimQuest', id: 'first_build' },
    { type: 'train', id: 'wolf-alpha', path: 'guardian' },
    { type: 'train', id: 'wolf-alpha', path: 'guardian' },
  ]) {
    response = await page.request.post('/api/action', {
      data: { action, revision: save.revision },
    });
    expect(response.ok()).toBe(true);
    save = await response.json();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#village');
  const guide = page.locator('.first-steps');
  await expect(guide.locator('.guide-count')).toHaveText('3 / 5 tamamlandı');
  await expect(guide.locator('.is-complete')).toHaveCount(3);
  await expect(guide.locator('[aria-current="step"]')).toContainText('Kaynak topla');
  await page.getByRole('button', { name: 'Koyu temaya geç', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  await expect(guide.getByRole('heading', { name: 'First steps', exact: true })).toBeVisible();
  await expect(guide.locator('.guide-count')).toHaveText('3 / 5 completed');
  await expect(guide.locator('[aria-current="step"]')).toContainText('Gather resources');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(guide.locator('.guide-count')).toHaveText('3 / 5 completed');
  await guide.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const box = await guide.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await page.getByRole('button', { name: 'Türkçeye geç', exact: true }).click();
  await expect(guide.locator('.guide-count')).toHaveText('3 / 5 tamamlandı');
  await expect(guide.locator('[data-action="guide"]')).toHaveText('Toplama düğmesine git');
});
