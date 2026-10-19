import { test, expect } from '@playwright/test';
import { signIn } from './sign-in.mjs';
import { mkdir } from 'node:fs/promises';

test('profile photo, immutable identity, nickname and logos persist across reload and resize', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/#world');
  await page.locator('.wordmark').click();
  await expect(page).toHaveURL(/#village$/);
  await page.getByRole('button', { name: 'Arkadaşlar', exact: true }).click();
  await page.locator('a.brand-mark').click();
  await expect(page).toHaveURL(/#village$/);
  await page.goto('/');
  await page.locator('.landing-brand').click();
  await expect(page).toHaveURL(/#village$/);
  await page.locator('.profile').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('E-posta', { exact: true })).toHaveAttribute('readonly', '');
  await expect(dialog.getByLabel('Ad soyad', { exact: true })).toHaveAttribute('readonly', '');
  const email = await dialog.getByLabel('E-posta', { exact: true }).inputValue(),
    code = await dialog.getByLabel('Oyuncu kodun', { exact: true }).inputValue();
  await dialog.getByLabel('Takma ad', { exact: true }).fill('Bozkır Reisi');
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'avatar.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
  });
  await expect(dialog.locator('.profile-photo img')).toBeVisible();
  await dialog.getByRole('button', { name: 'Değişiklikleri kaydet', exact: true }).click();
  await expect(page.locator('#notice')).toContainText('Profilin güncellendi');
  await expect(dialog.getByLabel('Oyuncu kodun', { exact: true })).toHaveValue(code);
  await expect(dialog.getByLabel('E-posta', { exact: true })).toHaveValue(email);
  await page.reload();
  await page.locator('.profile').click();
  await expect(dialog.getByLabel('Takma ad', { exact: true })).toHaveValue('Bozkır Reisi');
  await expect(dialog.locator('.profile-photo img')).toHaveAttribute('src', /api\/player\/avatar/);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/profile-dark-desktop-v2.12.0.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Kapat', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-action=theme]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.profile').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/profile-dark-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Kaldır', exact: true }).click();
  await dialog.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(dialog.locator('.profile-photo img')).toHaveCount(0);
});

test('two players accept a friendship and send stone without duplicate deductions', async ({
  browser,
}) => {
  const first = await browser.newContext(),
    second = await browser.newContext();
  try {
    const alice = await first.newPage(),
      bob = await second.newPage();
    await signIn(alice);
    await signIn(bob);
    const a = (await (await alice.request.get('/api/player/profile')).json()).user,
      b = (await (await bob.request.get('/api/player/profile')).json()).user;
    await alice.goto('/#friends');
    await alice.getByLabel('Oyuncu koduyla arkadaş ekle').fill(b.userCode);
    await alice.getByRole('button', { name: 'İstek gönder', exact: true }).click();
    await expect(
      alice
        .locator('.friend-section')
        .filter({ has: alice.getByRole('heading', { name: /Gönderilen istekler/ }) }),
    ).toContainText(b.userCode);
    await bob.goto('/#friends');
    await bob.getByRole('button', { name: 'Kabul et', exact: true }).click();
    await alice.reload();
    await expect(alice.locator('.stone-transfer')).toBeVisible();
    const before = (await (await alice.request.get('/api/state')).json()).state.resources.stone;
    await alice.getByLabel('Maden miktarı', { exact: true }).fill('25');
    await alice.getByRole('button', { name: 'Maden gönder', exact: true }).click();
    await expect(alice.locator('#notice')).toContainText('Maden gönderildi');
    await expect(alice.locator('.transfer-row')).toContainText('−25');
    expect(
      (await (await alice.request.get('/api/state')).json()).state.resources.stone,
    ).toBeLessThan(before);
    await bob.reload();
    await expect(bob.locator('.transfer-row')).toContainText('+25');
    await mkdir('artifacts', { recursive: true });
    await alice.screenshot({ path: 'artifacts/friends-light-desktop.png', fullPage: true });
    await bob.getByRole('button', { name: 'Arkadaşlıktan çıkar', exact: true }).click();
    await expect(bob.locator('.stone-transfer')).toHaveCount(0);
  } finally {
    await first.close();
    await second.close();
  }
});
