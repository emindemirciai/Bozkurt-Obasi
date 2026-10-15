import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function openOffline(page) {
  const network = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:\/\//, (route) => {
    network.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(resolve('preview/adventure.html')).href);
  await expect(page.locator('#offline-banner')).toContainText('Salt okunur');
  return { network, errors };
}

test('offline adventure planner shows real readiness and rewards but never enables departure', async ({
  page,
}) => {
  const { network, errors } = await openOffline(page);
  const depart = page.locator('[data-action="startAdventure"]');
  const readiness = page.locator('[data-adventure-readiness]');
  await expect(readiness).toHaveAttribute('data-ready', 'true');
  await expect(depart).toBeDisabled();
  await expect(page.locator('#adventure-region')).toHaveValue('highland');
  const initialCost = await page.locator('[data-adventure-cost]').textContent();
  await page.locator('#adventure-difficulty').selectOption('hard');
  await expect(readiness).toHaveAttribute('data-ready', 'false');
  await page.locator('#adventure-wolf-guardian').check();
  await expect(readiness).toHaveAttribute('data-ready', 'true');
  expect(await page.locator('[data-adventure-cost]').textContent()).not.toBe(initialCost);
  await expect(depart).toBeDisabled();
  await page.locator('[data-action="selectRegion"][data-region="meadow"]').click();
  await expect(page.locator('#adventure-region')).toHaveValue('meadow');
  await page.locator('[data-action="selectRegion"][data-region="ruins"]').click();
  await expect(page.locator('#adventure-region')).toHaveValue('ruins');
  await expect(readiness).toHaveAttribute('data-ready', 'false');
  await page.locator('#adventure-kind').selectOption('caravan');
  await page.locator('[data-action="selectRegion"][data-region="spring"]').click();
  await expect(readiness).toHaveAttribute('data-ready', 'true');
  await expect(depart).toBeDisabled();

  await page.locator('#preview-scenario').selectOption('lowresources');
  await expect(readiness).toHaveAttribute('data-ready', 'false');
  await expect(page.locator('#adventure-wolf-hunter')).toBeDisabled();
  await expect(depart).toBeDisabled();
  await page.locator('#preview-scenario').selectOption('activejourney');
  await expect(page.locator('[data-active-adventure]')).toBeVisible();
  await expect(page.locator('#adventure-region')).toHaveValue('meadow');
  await expect(page.locator('#adventure-kind')).toBeDisabled();
  await expect(page.locator('#adventure-region')).toBeDisabled();
  await expect(page.locator('#adventure-difficulty')).toBeDisabled();
  await expect(page.locator('[name="adventure-wolf"]:enabled')).toHaveCount(0);
  await expect(depart).toBeDisabled();
  const progress = await page.locator('[data-active-adventure] progress').getAttribute('value');
  await page.locator('#language').click();
  await expect(page.locator('[data-active-adventure] progress')).toHaveAttribute('value', progress);
  await expect(page.locator('#offline-banner')).toContainText('Read-only');
  await expect(page.locator('.adventure-preview-clock')).toContainText('does not run');
  await expect(page.locator('[data-action]:enabled:not([data-action="selectRegion"])')).toHaveCount(
    0,
  );
  const images = await page.locator('.real-wolf-portrait image').evaluateAll(async (nodes) =>
    Promise.all(
      nodes.map(
        (node) =>
          new Promise((resolveImage) => {
            const src = node.getAttribute('href');
            const image = new Image();
            image.onload = () =>
              resolveImage({ inline: src.startsWith('data:'), width: image.naturalWidth });
            image.onerror = () => resolveImage({ inline: false, width: 0 });
            image.src = src;
          }),
      ),
    ),
  );
  expect(images).toHaveLength(5);
  for (const image of images) expect(image).toEqual({ inline: true, width: 2172 });
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

test('offline adventure planner remains readable in both languages and themes at 320px', async ({
  page,
}) => {
  const { network, errors } = await openOffline(page);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('#language').click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('#theme').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width);
        await expect(page.locator('#preview-scenario')).toBeVisible();
        await expect(page.locator('[data-adventure-readiness]')).toBeVisible();
        await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
      }
    }
  }
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});
