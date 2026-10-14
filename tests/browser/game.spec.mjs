import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { signIn } from './sign-in.mjs';

const releaseHistory = JSON.parse(
  await readFile(new URL('../../releases.json', import.meta.url), 'utf8'),
);

test.beforeEach(async ({ page }) => signIn(page));

async function buildQuarry(page, plotId = 'p0') {
  await page.locator(`[data-plot="${plotId}"]`).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-action="placeBuilding"][data-building-type="quarry"]').click();
  await expect(dialog).toHaveCount(0);
}

test('village construction, quest reward, training and TR/EN work without runtime errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#village');
  await expect(page.getByRole('heading', { name: 'Yurduna hoş geldin.' })).toBeVisible();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/village-desktop.png', fullPage: true });
  await buildQuarry(page);
  await expect(page.locator('.building-detail-title h2')).toHaveText('Taş Ocağı');
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
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
  await expect(page.locator('.map-chip')).toHaveText('1 buildings');
  expect(errors).toEqual([]);
});
test('realistic battle cutouts load with alpha, face opponents and remain selectable on mobile', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#village');
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
  const images = page.locator('.battle-scene image[data-animal-kind]');
  await expect(images).toHaveCount(32);
  const decoded = await images.evaluateAll(async (nodes) => {
    const urls = [...new Set(nodes.map((node) => node.getAttribute('href')))];
    return Promise.all(
      urls.map(async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) painted++;
        return {
          webp: url.includes('.webp'),
          width: canvas.width,
          height: canvas.height,
          transparentCorner: pixels[3] === 0,
          painted,
        };
      }),
    );
  });
  expect(decoded).toHaveLength(4);
  for (const image of decoded) {
    expect(image).toMatchObject({ webp: true, width: 512, height: 341, transparentCorner: true });
    expect(image.painted).toBeGreaterThan(10_000);
    expect(image.painted).toBeLessThan(512 * 341);
  }
  for (const group of ['.battle-wolf', '.battle-herd'])
    for (const direction of await page
      .locator(`${group} .battle-animal`)
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.facing)))
      expect(direction).toBe('-1');
  for (const direction of await page
    .locator('.battle-jackal .battle-animal')
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.facing)))
    expect(direction).toBe('1');
  await mkdir('artifacts', { recursive: true });
  await page.locator('.map-card').screenshot({ path: 'artifacts/battle-realistic-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Koyu temaya geç' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page
    .locator('.map-card')
    .screenshot({ path: 'artifacts/battle-realistic-dark-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const wolf = page.locator('.battle-wolf').first();
  const wolfId = await wolf.getAttribute('data-wolf');
  await wolf.locator('image').click();
  await expect(page.locator(`.guardian-card[data-wolf="${wolfId}"]`)).toHaveClass(/selected/);
  await expect(page.locator('.wolf-detail')).toBeVisible();
  expect(errors).toEqual([]);
});

test('battle reveals a random jackal tactic at start and animates both sides', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#village');
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
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
  await page.getByRole('button', { name: 'Yola çık', exact: true }).click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', 'march');
  await expect(page.locator('.battle-narrative [data-battle-story]')).not.toBeEmpty();
  await expect(page.locator('.battle-jackal').first()).toHaveCSS('opacity', '0');
  await expect(page.locator('.battle-wolf .battle-motion').first()).toHaveCSS(
    'animation-name',
    'none',
  );

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
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', 'ambush', {
    timeout: 6_000,
  });
  await expect(page.locator('.battle-jackal').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', 'forming', {
    timeout: 6_000,
  });
  await expect(page.locator('.formation-guide')).toHaveCSS('opacity', '1');
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', 'clash', {
    timeout: 6_000,
  });
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
  for (const language of ['en', 'tr']) {
    if (language === 'tr') await page.getByRole('button', { name: 'Türkçeye geç' }).click();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      const longNote = page
        .locator('.release-card li')
        .filter({ hasText: 'ADMIN_BOOTSTRAP_PASSWORD' })
        .first();
      await expect(longNote).toBeVisible();
      const textBounds = await longNote.evaluate((node) => ({
        content: node.clientWidth,
        scroll: node.scrollWidth,
        right: node.getBoundingClientRect().right,
      }));
      expect(textBounds.scroll).toBeLessThanOrEqual(textBounds.content);
      expect(textBounds.right).toBeLessThanOrEqual(width);
    }
  }
  await page.getByRole('button', { name: 'Switch to English' }).click();
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
  await buildQuarry(page);
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
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
  const external = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await page.goto(pathToFileURL(resolve('preview/battle.html')).href);
  await expect(page.getByRole('heading', { name: 'Savaş meydanı' })).toBeVisible();
  await expect(page.locator('.battle-animal')).toHaveCount(32);
  await expect(page.locator('.battle-scene defs image')).toHaveCount(4);
  const offlineImages = await page.locator('.battle-scene defs image').evaluateAll((nodes) =>
    Promise.all(
      nodes.map(async (node) => {
        const image = new Image();
        image.src = node.getAttribute('href');
        await image.decode();
        return image.naturalWidth;
      }),
    ),
  );
  expect(offlineImages).toEqual([512, 512, 512, 512]);
  await expect(page.locator('.battlefield-terrain')).toHaveAttribute(
    'href',
    /^data:image\/webp;base64,/,
  );
  await expect(page.locator('.battle-scene')).toHaveAttribute('data-phase', 'clash');
  await page.locator('#language').click();
  await expect(page.getByRole('heading', { name: 'Battlefield' })).toBeVisible();
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await expect(page.locator('.battle-scene')).toHaveClass(/is-active/);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.battle-scene')).toHaveAttribute('viewBox', '140 95 570 455');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/battle-preview-dark-mobile.png', fullPage: true });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
