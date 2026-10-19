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
  test(`battlefield fills its surface at every zoom in the dark game theme on ${name}`, async ({
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

    for (const theme of ['dark']) {
      await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
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

test('dark terrain keeps wolf bodies readable without dimming them', async ({ page }) => {
  await signIn(page);
  await page.goto('/#village');
  await page.getByRole('button', { name: 'Savaş meydanı', exact: true }).click();
  const scene = page.locator('.battle-scene');
  await expect(scene).toHaveAttribute('data-phase', 'preparing');
  await scene.evaluate(async (node) => {
    await Promise.all(
      [...node.querySelectorAll('image')].map(async (element) => {
        const image = new Image();
        image.src = element.getAttribute('href');
        await image.decode();
      }),
    );
  });

  async function paintedColors() {
    const points = await scene.evaluate((node) => {
      const frame = node.getBoundingClientRect();
      const image = node.querySelector('.battle-wolf .battle-animal-image');
      // Sample the opaque torso, away from fur edges, health bars and contact shadows.
      const body = new DOMPoint(270, 150).matrixTransform(image.getScreenCTM());
      return {
        body: { x: body.x - frame.x, y: body.y - frame.y },
        terrain: { x: frame.width * 0.92, y: frame.height * 0.18 },
      };
    });
    const png = await scene.screenshot({ animations: 'disabled' });
    return page.evaluate(
      async ({ base64, points }) => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + base64;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return Object.fromEntries(
          Object.entries(points).map(([name, point]) => {
            const pixels = context.getImageData(
              Math.round(point.x) - 1,
              Math.round(point.y) - 1,
              3,
              3,
            ).data;
            const rgb = [0, 1, 2].map((channel) => {
              let total = 0;
              for (let index = channel; index < pixels.length; index += 4) total += pixels[index];
              return total / 9;
            });
            return [name, rgb];
          }),
        );
      },
      { base64: png.toString('base64'), points },
    );
  }

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
  // Temporarily remove only terrain shading as a visual reference; the game stays dark.
  const originalFilter = await scene.locator('.battlefield-terrain').evaluate((node) => {
    const filter = node.style.filter;
    node.style.filter = 'none';
    return filter;
  });
  const light = await paintedColors();
  await scene.locator('.battlefield-terrain').evaluate((node, filter) => {
    if (filter) node.style.filter = filter;
    else node.style.removeProperty('filter');
  }, originalFilter);
  const dark = await paintedColors();
  const brightness = (rgb) => rgb.reduce((sum, channel) => sum + channel, 0) / 3;
  expect(brightness(light.terrain)).toBeGreaterThan(20);
  expect(brightness(dark.terrain)).toBeLessThan(brightness(light.terrain) * 0.9);
  // The nearly opaque source may mix a little terrain color into the body pixels.
  for (let channel = 0; channel < 3; channel++) {
    expect(Math.abs(dark.body[channel] - light.body[channel])).toBeLessThanOrEqual(5);
  }
});
