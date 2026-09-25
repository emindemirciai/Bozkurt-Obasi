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

test('battle reveals a random jackal tactic at start, animates both sides and resolves', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Savunma', exact: true }).click();
  await expect(page.locator('.tactic-reveal')).toContainText('Savaş başlayınca belli olacak');
  await expect(page.locator('.tactic-list')).toHaveCount(0);
  await expect(page.locator('[data-action="tactic"]')).toHaveCount(0);
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-tactic', '');

  await page.getByRole('button', { name: 'Geniş', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Geniş', exact: true }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/battle-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Savaşı başlat' }).click();

  await expect(page.locator('.tactic-reveal')).toContainText(
    /Doğrudan saldırı|Sol kanat|Sağ kanat|Çift kanat|Sürü hücumu/,
  );
  await expect(page.locator('.tactic-reveal')).not.toContainText('Savaş başlayınca belli olacak');
  await expect(page.locator('.battle-scene')).toHaveClass(/is-active/);
  await expect(page.locator('.battle-scene')).toHaveAttribute(
    'data-tactic',
    /^(direct|left|right|double|rush)$/,
  );
  await expect(page.locator('.battle-jackal')).toHaveCount(3);
  await expect(page.locator('.battle-wolf')).toHaveCount(5);
  const jackalAnimation = await page
    .locator('.battle-jackal .battle-motion')
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);
  const wolfAnimation = await page
    .locator('.battle-wolf .battle-motion')
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);
  expect(jackalAnimation).not.toBe('none');
  expect(wolfAnimation).not.toBe('none');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/battle-active-desktop.png', fullPage: true });

  const activeScene = await page.locator('.battle-scene').elementHandle();
  const elapsedBefore = Number(
    (await page.locator('.battle-elapsed').textContent()).match(/\d+/)[0],
  );
  await page.clock.fastForward(1_500);
  const elapsedAfter = Number(
    (await page.locator('.battle-elapsed').textContent()).match(/\d+/)[0],
  );
  expect(elapsedAfter).toBeGreaterThan(elapsedBefore);
  expect(await activeScene.evaluate((node) => node.isConnected)).toBe(true);

  await page.clock.fastForward(100_000);
  await expect(page.locator('.map-location')).toContainText(/Yurt güvende!|Sürü geri çekildi/);
  await page.getByRole('button', { name: 'Yeni dalga hazırla' }).click();
  await expect(page.locator('.tactic-reveal')).toContainText('Savaş başlayınca belli olacak');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('.tactic-reveal')).toContainText('Revealed when battle begins');
  expect(errors).toEqual([]);
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
  await page.getByRole('button', { name: 'Savunma', exact: true }).click();
  await expect(page.locator('.tactic-reveal')).toContainText('Savaş başlayınca belli olacak');
  await page.getByRole('button', { name: 'Savaşı başlat' }).click();
  await expect(page.locator('.tactic-reveal')).toContainText(
    /Doğrudan saldırı|Sol kanat|Sağ kanat|Çift kanat|Sürü hücumu/,
  );
  await expect(page.locator('.battle-scene.is-active')).toBeVisible();
  expect(errors).toEqual([]);
});
