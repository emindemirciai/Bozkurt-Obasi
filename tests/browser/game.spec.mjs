import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { signIn } from './sign-in.mjs';

const releaseHistory = JSON.parse(
  await readFile(new URL('../../releases.json', import.meta.url), 'utf8'),
);

test.beforeEach(async ({ page }) => signIn(page));

test('village construction, quest reward, training and TR/EN work without runtime errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#village');
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
  await expect(page.getByRole('heading', { name: 'Guardians', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Homeland', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to your homeland.' })).toBeVisible();
  await expect(page.locator('.map-chip')).toHaveText('5 buildings');
  expect(errors).toEqual([]);
});

test('battle reveals a random jackal tactic at start and animates both sides', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#village');
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
  await expect
    .poll(async () => Number((await page.locator('.battle-elapsed').textContent()).match(/\d+/)[0]))
    .toBeGreaterThan(elapsedBefore);
  expect(await activeScene.evaluate((node) => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('.tactic-reveal')).toContainText(
    /Direct attack|Left flank|Right flank|Double flank|Herd rush/,
  );
  expect(errors).toEqual([]);
});
test('appearance persists and the bilingual release history remains readable on mobile', async ({
  page,
}) => {
  await page.goto('/#village');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const lightBackground = await page
    .locator('html')
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.getByRole('button', { name: 'Koyu temaya geç' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const darkBackground = await page
    .locator('html')
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(darkBackground).not.toBe(lightBackground);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Açık temaya geç' })).toBeVisible();

  await page.getByRole('button', { name: 'Yenilikler', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yenilikler', exact: true })).toBeVisible();
  await expect(page.locator('.release-card')).toHaveCount(releaseHistory.releases.length);
  await expect(page.locator('.release-card').first()).toHaveAttribute(
    'data-release-version',
    releaseHistory.version,
  );
  for (const change of releaseHistory.releases[0].changes.tr)
    await expect(page.locator('.release-card').first()).toContainText(change);
  await expect(page.locator('[data-release-version="1.1.0"]')).toContainText('tema seçimi');
  await expect(page.locator('.release-card').last()).toContainText('Köy kurma');

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { name: 'What’s new', exact: true })).toBeVisible();
  for (const change of releaseHistory.releases[0].changes.en)
    await expect(page.locator('.release-card').first()).toContainText(change);
  await expect(page.locator('[data-release-version="1.1.0"]')).toContainText('light/dark theme');
  await expect(page.locator('.release-card').last()).toContainText('village builder');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/updates-dark-mobile.png', fullPage: true });

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('authenticated village survives browser reload without a guest-mode switch', async ({
  page,
}) => {
  await page.goto('/#village');
  await expect(page.locator('.connection')).toContainText('Çevrim içi');
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await expect(page.getByRole('button', { name: 'Yerel köye dön' })).toHaveCount(0);
});

test('mobile layout, modal keyboard dismissal and offline file preview', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#village');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/village-mobile.png', fullPage: true });
  await page.locator('.profile').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(pathToFileURL(resolve('preview/index.html')).href + '#village');
  await expect(page.getByRole('heading', { name: /Obanı kur.*Sürünü koru/s })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Yurduna hoş geldin.' })).toHaveCount(0);
  await expect(page.locator('.game-shell')).toHaveCount(0);
  expect(errors).toEqual([]);
});
