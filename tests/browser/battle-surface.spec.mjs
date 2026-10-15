import { test, expect } from '@playwright/test';
import { signIn } from './sign-in.mjs';

async function expectCoveredTerrain(page) {
  const scene = page.locator('.battle-scene');
  await expect(scene).toBeVisible();
  // Compare painted SVG geometry in screen coordinates, including zoom and CSS transforms.
  // The old viewBox letterboxed on wide screens and shrank the terrain on zoom out.
  await expect
    .poll(() =>
      scene.evaluate((node) => {
        const frame = node.getBoundingClientRect();
        const terrain = node.querySelector('.battlefield-terrain').getBoundingClientRect();
        return Math.max(
          Math.abs(frame.left - terrain.left),
          Math.abs(frame.top - terrain.top),
          Math.abs(frame.right - terrain.right),
          Math.abs(frame.bottom - terrain.bottom),
        );
      }),
    )
    .toBeLessThanOrEqual(1);
  await expect(scene.locator('.battlefield-terrain')).toHaveCSS('opacity', '1');
}

for (const [name, viewport] of [
  ['wide desktop', { width: 1920, height: 1080 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  test(`battlefield fills its surface at every zoom in light and dark mode on ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto('/#village');
    await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
    const decoded = await page.locator('.battlefield-terrain').evaluate(async (node) => {
      const image = new Image();
      image.src = node.getAttribute('href');
      await image.decode();
      return image.naturalWidth > 0 && image.naturalHeight > 0;
    });
    expect(decoded).toBe(true);

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Koyu temaya geç' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.locator('[data-action="resetZoom"]').click();
      await expectCoveredTerrain(page);
      for (const action of ['zoomOut', 'zoomOut', 'zoomIn', 'zoomIn', 'zoomIn', 'zoomIn']) {
        await page.locator(`[data-action="${action}"]`).click();
        await expectCoveredTerrain(page);
      }
    }

    if (name === 'wide desktop') {
      await page.locator('[data-action="fullscreen"]').click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
      await expectCoveredTerrain(page);
      await page.evaluate(() => document.exitFullscreen());
      await expectCoveredTerrain(page);
    } else {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
    }
  });
}

test('wounded wolves stay opaque and their health bar shows an injury warning', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/#village');
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
  const wolf = page.locator('.battle-wolf').first();
  const healthyFill = await wolf
    .locator('[data-hp-bar]')
    .evaluate((node) => getComputedStyle(node).fill);
  // Exercise the visual injury state without altering a player account or starting a battle.
  await wolf.evaluate((node) => node.classList.add('is-wounded'));
  await expect(wolf.locator('.battle-animal-image')).toHaveCSS('opacity', '1');
  const warningFill = await wolf
    .locator('[data-hp-bar]')
    .evaluate((node) => getComputedStyle(node).fill);
  expect(warningFill).not.toBe(healthyFill);
  const [red, green, blue] = warningFill.match(/\d+/g).map(Number);
  expect(red).toBeGreaterThan(green);
  expect(red).toBeGreaterThan(blue);
});
