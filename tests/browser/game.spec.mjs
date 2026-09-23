import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('village construction, quest reward, training and TR/EN work without runtime errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yurduna hoş geldin.' })).toBeVisible();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/village-desktop.png', fullPage: true });
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.building-detail-title h2')).toHaveText('Taş Ocağı');
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.getByRole('button', { name: 'Görevler', exact: true }).click();
  const quest = page.locator('.quest-card').filter({ hasText: 'Yurdun ilk adımı' });
  await quest.getByRole('button', { name: 'Ödülü al' }).click();
  await expect(quest.getByRole('button', { name: 'Tamamlandı' })).toBeDisabled();
  await page.getByRole('button', { name: 'Muhafızlar', exact: true }).click();
  await page.locator('.training-row').first().getByRole('button', { name: 'Eğit' }).click();
  await expect(page.locator('.training-points b')).toHaveText('1');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { name: 'Guardians', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome to your homeland.' })).toBeVisible();
  await expect(page.locator('.map-chip')).toHaveText('5 buildings');
  expect(errors).toEqual([]);
});

test('manual battle locks tactics, finishes with a real reward and keeps injuries for the next wave', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Savunma', exact: true }).click();
  await page.getByRole('button', { name: 'Sağ kanat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sağ kanat', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: 'artifacts/battle-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Savaşı başlat' }).click();
  await expect(page.getByRole('button', { name: 'Doğrudan saldırı', exact: true })).toBeDisabled();
  await page.clock.fastForward(40_000);
  await expect(page.locator('.map-location')).toContainText('Yurt güvende!');
  await page.getByRole('button', { name: 'Yeni dalga hazırla' }).click();
  await expect(page.locator('.map-chip')).toHaveText('Dalga 2');
  await page.getByRole('button', { name: /Sürüyü tedavi et/ }).click();
  await expect(page.locator('#notice')).toContainText('Sürü tedavi edildi.');
});

test('server guest state survives browser reload and remains separate from the local village', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Yerel kayıt', exact: true }).click();
  await page.getByRole('button', { name: 'Sunucuya bağlan' }).click();
  await expect(page.locator('.connection')).toContainText('Çevrim içi');
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('4 yapı');
  await page.getByRole('button', { name: 'Yerel kayıt', exact: true }).click();
  await page.getByRole('button', { name: 'Sunucuya bağlan' }).click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.getByRole('button', { name: 'Çevrim içi', exact: true }).click();
  await page.getByRole('button', { name: 'Yerel köye dön' }).click();
  await expect(page.locator('.map-chip')).toHaveText('4 yapı');
});

test('mobile layout, modal keyboard dismissal and offline file preview', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/village-mobile.png', fullPage: true });
  await page.locator('.profile').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(pathToFileURL(resolve('preview/index.html')).href);
  await expect(page.getByRole('heading', { name: 'Yurduna hoş geldin.' })).toBeVisible();
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  expect(errors).toEqual([]);
});
