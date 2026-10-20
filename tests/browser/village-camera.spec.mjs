import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const viewport = (page) => page.locator('.scene-wrap:has(.settlement-scene)');
const terrain = (page) => page.locator('.settlement-scene');
const plot = (page, id) => page.locator('[data-plot="' + id + '"]');

async function village(page) {
  await signIn(page);
  const state = createGame(START);
  let revision = 0;
  const actions = [];
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  const response = () => ({
    contentType: 'application/json',
    body: JSON.stringify({ state, revision, mode: 'online' }),
  });
  await page.route('**/api/session', (route) => route.fulfill(response()));
  await page.route('**/api/state', (route) => {
    revision += 1;
    return route.fulfill(response());
  });
  await page.route('**/api/action', (route) => {
    actions.push(route.request().postDataJSON().action);
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{"error":"test_no_mutation"}',
    });
  });
  await page.goto('/#village');
  await expect(plot(page, 'p0')).toBeVisible();
  return actions;
}

async function bounds(page) {
  return viewport(page).evaluate((node) => ({
    width: node.clientWidth,
    height: node.clientHeight,
    scrollWidth: node.scrollWidth,
    scrollHeight: node.scrollHeight,
    left: node.getBoundingClientRect().left,
    right: node.getBoundingClientRect().right,
    overflowX: getComputedStyle(node).overflowX,
    overflowY: getComputedStyle(node).overflowY,
  }));
}

test('village zoom changes actual parcel geometry inside the same fixed viewport and reset restores the full map', async ({
  page,
}) => {
  const actions = await village(page);
  const before = await bounds(page);
  const original = await plot(page, 'p14').locator(':scope > path').first().boundingBox();
  const originalViewBox = await terrain(page).getAttribute('viewBox');
  await expect(terrain(page).locator('.village-waterfall')).toHaveCount(1);
  await expect(viewport(page)).toHaveAttribute('data-motion', 'on');
  await page.locator('[data-camera-action="motion"]').click();
  await expect(viewport(page)).toHaveAttribute('data-motion', 'off');
  await page.locator('[data-camera-action="motion"]').click();
  await expect(viewport(page)).toHaveAttribute('data-motion', 'on');
  await page.locator('[data-camera-action="weather"]').click();
  await expect(viewport(page)).toHaveAttribute('data-weather', 'rain');
  await page.locator('[data-camera-action="weather"]').click();
  await expect(viewport(page)).toHaveAttribute('data-weather', 'clear');
  await expect(viewport(page)).toHaveAttribute('data-camera-zoom', '1');
  await expect(page.locator('[data-action="zoomOut"]')).toBeDisabled();
  await page.locator('[data-action="zoomIn"]').click();
  await expect(viewport(page)).toHaveAttribute('data-camera-zoom', '1.25');
  const enlarged = await plot(page, 'p14').locator(':scope > path').first().boundingBox();
  expect(enlarged.width).toBeGreaterThan(original.width * 1.15);
  expect(await terrain(page).getAttribute('viewBox')).not.toBe(originalViewBox);
  expect((await bounds(page)).width).toBe(before.width);
  expect((await bounds(page)).height).toBe(before.height);
  await page.locator('[data-action="zoomOut"]').click();
  await expect(viewport(page)).toHaveAttribute('data-camera-zoom', '1');
  await expect(terrain(page)).toHaveAttribute('viewBox', originalViewBox);
  await page.locator('[data-action="zoomIn"]').click();
  await page.locator('[data-action="zoomIn"]').click();
  await page.locator('[data-action="resetZoom"]').click();
  await expect(viewport(page)).toHaveAttribute('data-camera-zoom', '1');
  const reset = await plot(page, 'p14').locator(':scope > path').first().boundingBox();
  expect(reset.width).toBeCloseTo(original.width, 2);
  expect(actions).toEqual([]);
});

test('plain mouse wheel and keyboard plus minus zoom the village without scrolling the page or submitting actions', async ({
  page,
}) => {
  const actions = await village(page);
  const frame = viewport(page);
  await frame.scrollIntoViewIfNeeded();
  const box = await frame.boundingBox();
  const scrollY = await page.evaluate(() => scrollY);
  const original = await terrain(page).getAttribute('viewBox');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -160);
  await expect
    .poll(async () => Number(await frame.getAttribute('data-camera-zoom')))
    .toBeGreaterThan(1);
  expect(await terrain(page).getAttribute('viewBox')).not.toBe(original);
  expect(await page.evaluate(() => scrollY)).toBe(scrollY);
  await page.mouse.wheel(0, 10000);
  await expect(frame).toHaveAttribute('data-camera-zoom', '1');
  expect(await page.evaluate(() => scrollY)).toBe(scrollY);
  await page.mouse.wheel(0, 160);
  await expect(frame).toHaveAttribute('data-camera-zoom', '1');
  expect(await page.evaluate(() => scrollY)).toBe(scrollY);
  await page.locator('[data-action="zoomIn"]').focus();
  await page.keyboard.press('+');
  await expect(frame).toHaveAttribute('data-camera-zoom', '1.25');
  await page.keyboard.press('-');
  await expect(frame).toHaveAttribute('data-camera-zoom', '1');
  await plot(page, 'p14').focus();
  await page.keyboard.press('=');
  await expect(frame).toHaveAttribute('data-camera-zoom', '1.25');
  await page.keyboard.press('-');
  await expect(frame).toHaveAttribute('data-camera-zoom', '1');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(actions).toEqual([]);
});

test('pointer dragging pans the zoomed village without opening a plot and keyboard focus brings distant plots into reach', async ({
  page,
}) => {
  const actions = await village(page);
  for (let index = 0; index < 4; index++) await page.locator('[data-action="zoomIn"]').click();
  const before = await terrain(page).getAttribute('viewBox');
  const box = await viewport(page).boundingBox();
  const x = box.x + box.width * 0.6,
    y = box.y + box.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.min(100, box.width * 0.2), y + 60, { steps: 8 });
  await page.mouse.up();
  expect(await terrain(page).getAttribute('viewBox')).not.toBe(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await viewport(page).focus();
  const panned = await terrain(page).getAttribute('viewBox');
  await page.keyboard.press('ArrowRight');
  expect(await terrain(page).getAttribute('viewBox')).not.toBe(panned);
  await plot(page, 'p35').focus();
  await expect(plot(page, 'p35')).toBeFocused();
  const distant = await plot(page, 'p35').boundingBox();
  const frame = await viewport(page).boundingBox();
  expect(distant.x + distant.width / 2).toBeGreaterThan(frame.x);
  expect(distant.x + distant.width / 2).toBeLessThan(frame.x + frame.width);
  expect(distant.y + distant.height / 2).toBeGreaterThan(frame.y);
  expect(distant.y + distant.height / 2).toBeLessThan(frame.y + frame.height);
  await page.keyboard.press('Enter');
  await expect(page.locator('.placement-dialog')).toBeVisible();
  await expect(page.locator('.placement-dialog .eyebrow')).toContainText('36');
  expect(actions).toEqual([]);
});

test('village view fits all parcels on 320, 390 and 1440 pixels without inner scrollbars or page overflow', async ({
  page,
}) => {
  const actions = await village(page);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('[data-action="resetZoom"]').click();
    const frame = await bounds(page);
    expect(frame.right).toBeLessThanOrEqual(width);
    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.scrollWidth).toBeLessThanOrEqual(frame.width + 1);
    expect(frame.scrollHeight).toBeLessThanOrEqual(frame.height + 1);
    expect(['hidden', 'clip']).toContain(frame.overflowX);
    expect(['hidden', 'clip']).toContain(frame.overflowY);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const frameBox = await viewport(page).boundingBox();
    for (const id of ['p0', 'p5', 'p30', 'p35']) {
      const box = await plot(page, id).boundingBox();
      expect(box.x + box.width / 2).toBeGreaterThanOrEqual(frameBox.x);
      expect(box.x + box.width / 2).toBeLessThanOrEqual(frameBox.x + frameBox.width);
      expect(box.y + box.height / 2).toBeGreaterThanOrEqual(frameBox.y);
      expect(box.y + box.height / 2).toBeLessThanOrEqual(frameBox.y + frameBox.height);
    }
    await page.locator('[data-action="zoomIn"]').click();
    expect((await bounds(page)).width).toBe(frame.width);
    expect((await bounds(page)).height).toBe(frame.height);
    if (width === 390)
      await viewport(page).screenshot({ path: 'artifacts/village-camera-390-v2.8.0.png' });
  }
  expect(actions).toEqual([]);
});

test('offline village camera uses the same zoom controls, weather and reduced-motion preference without network traffic', async ({
  page,
}) => {
  const network = [],
    errors = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:\/\//, (route) => {
    network.push(route.request().url());
    return route.abort();
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(pathToFileURL(resolve('preview/village.html')).href);
  await expect(viewport(page)).toHaveAttribute('data-camera-zoom', '1');
  await expect(viewport(page)).toHaveAttribute('data-motion', 'off');
  await page.locator('[data-action="zoomIn"]').click();
  await expect(viewport(page)).toHaveAttribute('data-camera-zoom', '1.25');
  await page.locator('[data-action="resetZoom"]').click();
  await expect(viewport(page)).toHaveAttribute('data-camera-zoom', '1');
  await page.locator('[data-camera-action="weather"]').click();
  await expect(viewport(page)).toHaveAttribute('data-weather', 'rain');
  const motion = page.locator('[data-camera-action="motion"]');
  await expect(motion).toBeDisabled();
  await motion.evaluate((node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(viewport(page)).toHaveAttribute('data-motion', 'off');
  expect(
    await viewport(page).evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running').length,
    ),
  ).toBe(0);
  const frame = await bounds(page);
  expect(frame.scrollWidth).toBeLessThanOrEqual(frame.width + 1);
  expect(frame.scrollHeight).toBeLessThanOrEqual(frame.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

test('ordinary and zoomed plot clicks open their own placement dialog while dragging from a plot never opens one', async ({
  page,
}) => {
  const actions = await village(page);
  await plot(page, 'p14').click();
  await expect(page.locator('.placement-dialog')).toBeVisible();
  await expect(page.locator('.placement-dialog .eyebrow')).toContainText('15');
  await page.locator('.placement-dialog .modal-close').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (let index = 0; index < 4; index++) await page.locator('[data-action="zoomIn"]').click();
  await plot(page, 'p14').focus();
  await plot(page, 'p14').click();
  await expect(page.locator('.placement-dialog')).toBeVisible();
  await expect(page.locator('.placement-dialog .eyebrow')).toContainText('15');
  await page.locator('.placement-dialog .modal-close').click();
  await plot(page, 'p14').focus();
  const box = await plot(page, 'p14').boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const before = await terrain(page).getAttribute('viewBox');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 85, y + 45, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await terrain(page).getAttribute('viewBox')).not.toBe(before);
  expect(actions).toEqual([]);
});

test('clear weather visibly includes a river, waterfall and clouds without intercepting plots', async ({
  page,
}) => {
  const actions = await village(page);
  const frame = viewport(page);
  await frame.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute('data-weather', 'clear');
  await expect(page.locator('[data-camera-action="weather"] svg')).toBeVisible();
  await expect(page.locator('[data-camera-weather-label]')).toHaveText('Açık');
  const backdrop = terrain(page).locator('.village-terrain-detail');
  await expect(backdrop).toHaveAttribute('data-river-source', 'mountain-foothills');
  await expect(backdrop).toHaveAttribute('width', '1440');
  await expect(backdrop).toHaveAttribute('height', '980');
  expect(
    await backdrop.evaluate(async (node) => {
      const image = new Image();
      image.src = node.getAttribute('href');
      await image.decode();
      return image.naturalWidth > 1000 && image.naturalHeight > 600;
    }),
  ).toBe(true);
  await expect(backdrop).toBeVisible();
  await expect(terrain(page).locator('.village-river-channel')).toHaveCount(0);
  await expect(terrain(page).locator('.village-river')).toBeVisible();
  await expect(terrain(page).locator('.village-waterfall-flow')).toHaveCount(2);
  await expect(terrain(page).locator('.village-cloud')).toBeVisible();
  const river = await terrain(page).locator('.village-river').boundingBox();
  const scene = await frame.boundingBox();
  expect(river.height).toBeGreaterThan(scene.height * 0.6);
  expect(river.width).toBeGreaterThan(scene.width * 0.1);
  const hitTargets = await terrain(page)
    .locator('[data-plot]')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          expected: node.dataset.plot,
          actual: document
            .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            ?.closest('[data-plot]')?.dataset.plot,
        };
      }),
    );
  expect(hitTargets).toHaveLength(40);
  expect(hitTargets.every((entry) => entry.actual === entry.expected)).toBe(true);
  const riverPoint = await terrain(page).evaluate((svg) => {
    const point = new DOMPoint(1397, 559).matrixTransform(svg.getScreenCTM());
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(riverPoint.x, riverPoint.y);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await terrain(page)
      .locator('.village-weather')
      .evaluate((node) =>
        [node, ...node.querySelectorAll('*')].every(
          (child) => getComputedStyle(child).pointerEvents === 'none',
        ),
      ),
  ).toBe(true);
  expect(actions).toEqual([]);
});

test('rain and complete animation pause remain selected across camera reset, language and navigation in the dark game theme', async ({
  page,
}) => {
  const actions = await village(page);
  const frame = viewport(page);
  const weather = page.locator('[data-camera-action="weather"]');
  const motion = page.locator('[data-camera-action="motion"]');
  await expect(terrain(page).locator('.village-rain')).toBeHidden();
  await weather.click();
  await expect(frame).toHaveAttribute('data-weather', 'rain');
  await expect(weather).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-camera-weather-label]')).toHaveText('Yağmur');
  await expect(terrain(page).locator('.village-rain')).toBeVisible();
  await expect
    .poll(() =>
      terrain(page)
        .locator('.village-rain-haze')
        .evaluate((node) => Number(getComputedStyle(node).opacity)),
    )
    .toBeGreaterThan(0.8);
  expect(
    await terrain(page)
      .locator('.village-river-current')
      .first()
      .evaluate((node) =>
        node.getAnimations().some((animation) => animation.playState === 'running'),
      ),
  ).toBe(true);
  await motion.click();
  await expect(frame).toHaveAttribute('data-motion', 'off');
  expect(
    await terrain(page)
      .locator('.village-weather')
      .evaluate(
        (node) =>
          node
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === 'running').length,
      ),
  ).toBe(0);
  await page.locator('[data-action="zoomIn"]').click();
  await page.locator('[data-action="zoomIn"]').click();
  await page.locator('[data-action="resetZoom"]').click();
  await expect(frame).toHaveAttribute('data-camera-zoom', '1');
  await expect(frame).toHaveAttribute('data-weather', 'rain');
  await expect(frame).toHaveAttribute('data-motion', 'off');
  await page.locator('[data-action="language"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
  await expect(page.locator('[data-camera-weather-label]')).toHaveText('Rain');
  await expect(frame).toHaveAttribute('data-weather', 'rain');
  await expect(frame).toHaveAttribute('data-motion', 'off');
  await page.locator('[data-view="wolves"]').click();
  await page.locator('[data-view="village"]').click();
  await expect(frame).toHaveAttribute('data-weather', 'rain');
  await expect(frame).toHaveAttribute('data-motion', 'off');
  expect(
    await terrain(page)
      .locator('.village-weather')
      .evaluate(
        (node) =>
          node
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === 'running').length,
      ),
  ).toBe(0);
  await motion.click();
  await expect(frame).toHaveAttribute('data-motion', 'on');
  expect(
    await terrain(page)
      .locator('.village-river-current')
      .first()
      .evaluate((node) =>
        node.getAnimations().some((animation) => animation.playState === 'running'),
      ),
  ).toBe(true);
  expect(actions).toEqual([]);
});
