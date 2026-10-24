import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { getStorageCapacity } from '../../shared/settlement.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn, seedGame } from './sign-in.mjs';
import { fundStorage, fillResources } from '../economy-fixtures.mjs';

const START = Date.UTC(2026, 9, 20, 12);
const corners = ['t0', 't1', 't2', 't3'];
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const scene = (page) => page.locator('.settlement-scene');
const frame = (page) => page.locator('.scene-wrap:has(.settlement-scene)');

async function cornerPlots(page, ids = corners) {
  const plots = scene(page).locator('.village-corner-plot');
  await expect(plots).toHaveCount(ids.length);
  expect(await plots.evaluateAll((nodes) => nodes.map((node) => node.dataset.plot).sort())).toEqual(
    [...ids].sort(),
  );
  await expect(scene(page).locator('.village-fixed-tower')).toHaveCount(0);
  for (const id of ids) {
    const plot = plots
      .filter({ has: page.locator('title') })
      .and(scene(page).locator('[data-plot="' + id + '"]'));
    await expect(plot).toBeVisible();
    await expect(plot).toHaveAttribute('data-corner-plot', 'true');
    await expect(plot).toHaveAttribute(
      'data-corner',
      ['back', 'right', 'front', 'left'][corners.indexOf(id)],
    );
  }
}

async function cornerTowers(page, count = 4) {
  const towers = scene(page).locator('.village-corner-tower');
  await expect(towers).toHaveCount(count);
  for (const tower of await towers.all()) {
    await expect(tower).toBeVisible();
    await expect(tower).toHaveAttribute('data-building', /^building-watchtower/);
    await expect(tower).not.toHaveAttribute('data-plot');
  }
}

async function fortificationArtwork(page) {
  return scene(page)
    .locator('.village-fortifications image')
    .evaluateAll(async (nodes) => {
      const sources = [...new Set(nodes.map((node) => node.getAttribute('href')))];
      return Promise.all(
        sources.map(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          return { src, width: image.naturalWidth, height: image.naturalHeight };
        }),
      );
    });
}

async function establishedVillage(page, { hall = false } = {}) {
  const state = createGame(START);
  fundStorage(state, 5, 'p14');
  // Explicit paid-tier fixture funds architectural upgrade paths.
  state.capacity = getStorageCapacity(state);
  for (const resource of Object.keys(state.resources)) state.resources[resource] = state.capacity;
  if (hall) {
    applyAction(state, { type: 'moveBuilding', id: 'building-storage', plotId: 'p10' }, START);
    applyAction(state, { type: 'build', building: 'hall', plotId: 'p7' }, START);
  }
  expect(validateGame(state)).toBe(true);
  await signIn(page);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  let revision = 0;
  const actions = [];
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const request = route.request().postDataJSON();
    expect(request.revision).toBe(revision);
    actions.push(request.action);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#village');
  await expect(scene(page)).toBeVisible();
  return { state, actions };
}

async function act(page, control) {
  const response = page.waitForResponse('**/api/action');
  await control.click();
  expect((await response).status()).toBe(200);
}

async function placeTower(page, plotId) {
  const plot = page.locator('[data-plot="' + plotId + '"]');
  await expect(plot).toHaveAttribute('data-corner-plot', 'true');
  await plot.click();
  const dialog = page.locator('.placement-dialog');
  await expect(dialog.locator('[data-corner-placement]')).toBeVisible();
  await expect(dialog.locator('[data-building-type]')).toHaveCount(1);
  await expect(dialog.locator('[data-building-type="watchtower"]')).toBeVisible();
  await act(page, dialog.locator('[data-building-type="watchtower"]'));
  await expect(dialog).toHaveCount(0);
}

test('four empty wall corners reserve watchtower plots without free towers or loss of normal village space', async ({
  page,
}) => {
  const { state, actions } = await establishedVillage(page);
  const before = structuredClone(state);
  await cornerPlots(page);
  await cornerTowers(page, 0);
  await expect(scene(page).locator('.empty-plot')).toHaveCount(35);
  await expect(scene(page).locator('[data-plot]')).toHaveCount(39);
  await expect(scene(page).locator('[data-building]')).toHaveCount(1);
  await page.locator('[data-plot="p0"]').click();
  await expect(page.locator('.placement-dialog [data-building-type="watchtower"]')).toHaveCount(0);
  await expect(page.locator('.placement-dialog [data-building-type="lumber"]')).toBeVisible();
  await page.locator('.placement-dialog .modal-close').click();
  const art = await fortificationArtwork(page);
  expect(art.some((image) => image.width >= 500 && image.height >= 300)).toBe(true);
  expect(art.every((image) => image.width > 0 && image.height > 0)).toBe(true);
  await page.reload();
  await cornerPlots(page);
  await cornerTowers(page, 0);
  expect(state).toEqual(before);
  expect(actions).toEqual([]);
});

test('four purchased watchtowers occupy only their reserved corners and persist without reducing normal plots', async ({
  page,
}) => {
  const { state, actions } = await establishedVillage(page);
  const resources = { ...state.resources };
  await cornerPlots(page);
  for (const id of corners) {
    const plot = page.locator('[data-plot="' + id + '"]');
    await expect(plot).toHaveAttribute('aria-describedby', 'corner-plot-hint-' + id);
    await expect(plot.locator('title')).toHaveText(translations.tr.cornerPlotHint);
    await placeTower(page, id);
  }
  expect(state.buildings.filter((building) => building.type === 'watchtower')).toEqual([
    {
      id: 'building-watchtower',
      type: 'watchtower',
      level: 1,
      x: 6,
      y: 0,
      costBasis: { legacyLevels: 0, constructionOrdinal: 1 },
    },
    {
      id: 'building-watchtower-2',
      type: 'watchtower',
      level: 1,
      x: 6,
      y: 1,
      costBasis: { legacyLevels: 0, constructionOrdinal: 2 },
    },
    {
      id: 'building-watchtower-3',
      type: 'watchtower',
      level: 1,
      x: 6,
      y: 2,
      costBasis: { legacyLevels: 0, constructionOrdinal: 3 },
    },
    {
      id: 'building-watchtower-4',
      type: 'watchtower',
      level: 1,
      x: 6,
      y: 3,
      costBasis: { legacyLevels: 0, constructionOrdinal: 4 },
    },
  ]);
  expect(state.resources.wood).toBe(resources.wood - 5500);
  expect(state.resources.stone).toBe(resources.stone - 4400);
  await cornerTowers(page);
  await cornerPlots(page, []);
  await expect(scene(page).locator('.empty-plot')).toHaveCount(35);
  await page.reload();
  await cornerTowers(page);
  expect(actions).toEqual(
    corners.map((plotId) => ({ type: 'build', building: 'watchtower', plotId })),
  );
  const towerLabel = scene(page).locator('[data-building="building-watchtower"] .building-label');
  await towerLabel.hover();
  const labelContrast = await towerLabel.evaluate((label) => {
    const textStyle = getComputedStyle(label.querySelector('text'));
    const backgroundStyle = getComputedStyle(label.querySelector('rect'));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const color = (fill) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = fill;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const text = color(textStyle.fill);
    const background = color(backgroundStyle.fill);
    const alpha = Number(backgroundStyle.fillOpacity) * Number(backgroundStyle.opacity);
    const textAlpha = Number(textStyle.fillOpacity) * Number(textStyle.opacity);
    const luminance = (rgb) =>
      rgb
        .map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const ratios = [0, 255].map((underlay) => {
      const painted = background.map((channel) => channel * alpha + underlay * (1 - alpha));
      const foreground = text.map(
        (channel, index) => channel * textAlpha + painted[index] * (1 - textAlpha),
      );
      const values = [luminance(foreground), luminance(painted)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    });
    return {
      text: textStyle.fill,
      background: backgroundStyle.fill,
      alpha,
      ratio: Math.min(...ratios),
    };
  });
  expect(labelContrast.ratio, JSON.stringify(labelContrast)).toBeGreaterThan(4.5);
  await frame(page).screenshot({
    path: 'artifacts/village-towers-desktop-v2.14.0.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.locator('[data-action="resetZoom"]').click();
  await frame(page).screenshot({
    path: 'artifacts/village-towers-mobile-v2.14.0.png',
    animations: 'disabled',
  });
});

test('real API persists corner purchases and rejects other buildings or relocation into reserved slots', async ({
  page,
}) => {
  await signIn(page);
  await seedGame(page, fillResources);
  const now = new Date();
  await page.clock.install({ time: new Date(now.getTime() - 1000) });
  await page.clock.pauseAt(now);
  await page.goto('/#village');
  await cornerPlots(page);
  const builtResponse = page.waitForResponse('**/api/action');
  await placeTower(page, 't0');
  const built = await (await builtResponse).json();
  expect(built.state.buildings).toEqual([
    {
      id: 'building-watchtower',
      type: 'watchtower',
      level: 1,
      x: 6,
      y: 0,
      costBasis: { legacyLevels: 0, constructionOrdinal: 1 },
    },
  ]);
  await page.reload();
  await cornerTowers(page, 1);
  await cornerPlots(page, ['t1', 't2', 't3']);
  for (const [action, error] of [
    [{ type: 'build', building: 'lumber', plotId: 't1' }, 'INVALID_BUILDING_PLOT'],
    [{ type: 'build', building: 'watchtower', plotId: 'p0' }, 'INVALID_BUILDING_PLOT'],
    [{ type: 'moveBuilding', id: 'building-watchtower', plotId: 't1' }, 'TOWER_FIXED'],
    [{ type: 'moveBuilding', id: 'building-watchtower', plotId: 'p0' }, 'TOWER_FIXED'],
  ]) {
    const saved = await (await page.request.get('/api/state')).json();
    const rejected = await page.request.post('/api/action', {
      data: { action, revision: saved.revision },
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).error).toBe(error);
  }
  const saved = await (await page.request.get('/api/state')).json();
  expect(saved.state.buildings).toEqual(built.state.buildings);
  expect(saved.state.resources).toEqual(built.state.resources);
  expect(saved.state.stats.builds).toBe(1);
  await page.reload();
  await cornerTowers(page, 1);
  await cornerPlots(page, ['t1', 't2', 't3']);
});

test('a corner tower upgrades its own architecture independently of wall and gate tiers and cannot move', async ({
  page,
}) => {
  const { state } = await establishedVillage(page);
  await placeTower(page, 't0');
  const tower = scene(page).locator('[data-building="building-watchtower"]');
  const crops = [];
  for (const target of [1, 3, 5]) {
    while (state.buildings.find((building) => building.type === 'watchtower').level < target) {
      await tower.click();
      await expect(page.locator('[data-action="moveBuilding"]')).toHaveCount(0);
      await act(page, page.locator('[data-action="upgrade"][data-id="building-watchtower"]'));
    }
    await expect(tower).toHaveAttribute(
      'aria-label',
      new RegExp(
        '^' + translations.tr.watchtower + ', ' + translations.tr.level + ' ' + target + ', ',
      ),
    );
    await expect(tower).toHaveAttribute(
      'data-tower-tier',
      String(target === 5 ? 3 : target === 3 ? 2 : 1),
    );
    await expect(scene(page).locator('.village-gate')).toHaveAttribute('data-gate-tier', '1');
    crops.push(await tower.locator(':scope > svg').getAttribute('viewBox'));
  }
  expect(new Set(crops).size).toBe(3);
  await tower.click();
  await expect(page.locator('[data-action="upgrade"][data-id="building-watchtower"]')).toHaveCount(
    0,
  );
  const architecture = [];
  for (const resource of Object.keys(state.resources)) state.resources[resource] = state.capacity;
  for (const [level, tier] of [
    [1, 1],
    [3, 2],
    [5, 3],
  ]) {
    while (state.walls.level < level) await act(page, page.locator('[data-action="upgradeWall"]'));
    await expect(scene(page).locator('.village-gate')).toHaveAttribute(
      'data-gate-tier',
      String(tier),
    );
    await expect(tower).toHaveAttribute('data-tower-tier', '3');
    await cornerPlots(page, ['t1', 't2', 't3']);
    const art = await fortificationArtwork(page);
    expect(art.some((image) => image.width >= 500 && image.height >= 300)).toBe(true);
    expect(art.every((image) => image.width > 0 && image.height > 0)).toBe(true);
    architecture.push(
      art
        .map((image) => image.src)
        .sort()
        .join('|'),
    );
    await expect(scene(page).locator('.village-sentry')).toHaveCount(2);
    await expect(scene(page).locator('.village-sentry[data-sentry="left"]')).toBeVisible();
    await expect(scene(page).locator('.village-sentry[data-sentry="right"]')).toBeVisible();
  }
  expect(new Set(architecture).size).toBe(3);
  await page.reload();
  await cornerTowers(page, 1);
  await expect(tower.locator(':scope > svg')).toHaveAttribute('viewBox', crops[2]);
  await expect(scene(page).locator('.village-gate')).toHaveAttribute('data-gate-tier', '3');
});

test('corner demolition confirms the exact half-cost refund and restores a tower-only plot after reload', async ({
  page,
}) => {
  const { state, actions } = await establishedVillage(page);
  await placeTower(page, 't2');
  const tower = scene(page).locator('[data-building="building-watchtower"]');
  await tower.click();
  await expect(page.locator('[data-action="moveBuilding"]')).toHaveCount(0);
  await act(page, page.locator('[data-action="upgrade"][data-id="building-watchtower"]'));
  const before = structuredClone(state);
  await page.locator('#demolish-building-button').click();
  const dialog = page.locator('#demolition-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/(?:50%|%50)/);
  await expect(dialog.locator('[data-demolition-refund]')).toContainText(/1[.,]750/);
  await expect(dialog.locator('[data-demolition-refund]')).toContainText(/1[.,]400/);
  await page.locator('#demolition-cancel').click();
  expect(state).toEqual(before);
  expect(actions).toHaveLength(2);
  await page.locator('#demolish-building-button').click();
  await act(page, page.locator('#demolition-confirm'));
  await expect(dialog).toHaveCount(0);
  await cornerTowers(page, 0);
  await cornerPlots(page);
  expect(state.resources.wood).toBe(before.resources.wood + 1750);
  expect(state.resources.stone).toBe(before.resources.stone + 1400);
  expect(state.buildings).toEqual(
    before.buildings.filter((building) => building.type !== 'watchtower'),
  );
  expect(actions.at(-1)).toEqual({
    type: 'demolishBuilding',
    id: 'building-watchtower',
    expected: { type: 'watchtower', level: 2, x: 6, y: 2, builds: 2 },
  });
  await page.reload();
  await cornerPlots(page);
  await placeTower(page, 't2');
  expect(state.buildings.find((building) => building.type === 'watchtower')).toMatchObject({
    level: 1,
    x: 6,
    y: 2,
  });
});

test('reserved corner construction stays clickable after wheel zoom and keyboard camera navigation', async ({
  page,
}) => {
  const { actions } = await establishedVillage(page);
  await frame(page).scrollIntoViewIfNeeded();
  const target = scene(page).locator('[data-plot="t1"]');
  const bounds = await target.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -200);
  await expect
    .poll(async () => Number(await frame(page).getAttribute('data-camera-zoom')))
    .toBeGreaterThan(1);
  await target.focus();
  const viewBox = await scene(page).getAttribute('viewBox');
  await placeTower(page, 't1');
  await expect(scene(page)).toHaveAttribute('viewBox', viewBox);
  await cornerTowers(page, 1);
  await page.locator('[data-action="zoomIn"]').click();
  const next = scene(page).locator('[data-plot="t3"]');
  await next.focus();
  await placeTower(page, 't3');
  await cornerTowers(page, 2);
  expect(actions).toEqual(
    ['t1', 't3'].map((plotId) => ({ type: 'build', building: 'watchtower', plotId })),
  );
});

test('reserved corner plots, gate, sentries and realistic terrain fit mobile languages without blocking construction', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { actions } = await establishedVillage(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('[data-action="language"]').click();
      {
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
        await page.locator('[data-action="resetZoom"]').click();
        await frame(page).scrollIntoViewIfNeeded();
        await expect(scene(page).locator('.village-gate')).toBeVisible();
        await cornerPlots(page);
        const mapBounds = await frame(page).boundingBox();
        for (const tower of await scene(page).locator('.village-corner-plot').all()) {
          const towerBounds = await tower.boundingBox();
          expect(towerBounds.x).toBeGreaterThanOrEqual(mapBounds.x);
          expect(towerBounds.y).toBeGreaterThanOrEqual(mapBounds.y);
          expect(towerBounds.x + towerBounds.width).toBeLessThanOrEqual(
            mapBounds.x + mapBounds.width,
          );
          expect(towerBounds.y + towerBounds.height).toBeLessThanOrEqual(
            mapBounds.y + mapBounds.height,
          );
        }
        await expect(scene(page).locator('.village-sentry')).toHaveCount(2);
        await expect(scene(page).locator('[data-corner-plot="true"]')).toHaveCount(4);
        await expect(scene(page).locator('.village-terrain-detail')).toBeVisible();
        await expect(page.locator('[data-camera-weather-label]')).toHaveText(
          translations[language].villageClear,
        );
        await expect(frame(page)).toHaveAttribute('data-motion', 'off');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const sizes = await frame(page).evaluate((node) => ({
          width: node.clientWidth,
          scrollWidth: node.scrollWidth,
          height: node.clientHeight,
          scrollHeight: node.scrollHeight,
        }));
        expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width + 1);
        expect(sizes.scrollHeight).toBeLessThanOrEqual(sizes.height + 1);
        const hits = await scene(page)
          .locator('[data-corner-plot="true"]')
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return (
                document
                  .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
                  ?.closest('[data-plot]')?.dataset.plot === node.dataset.plot
              );
            }),
          );
        expect(hits).toEqual([true, true, true, true]);
        expect(
          await scene(page)
            .locator('.village-fortifications')
            .evaluate((node) =>
              [node, ...node.querySelectorAll('*')].every(
                (child) => getComputedStyle(child).pointerEvents === 'none',
              ),
            ),
        ).toBe(true);
      }
    }
  }
  expect(actions).toEqual([]);
});

test('offline village preview separates optional corner towers from wall tiers without network or save writes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const network = [],
    errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.context().setOffline(true);
  try {
    await page.goto(pathToFileURL(resolve('preview/village.html')).href);
    const stored = await page.evaluate(() => ({ ...localStorage }));
    await expect(page.locator('#preview-corners')).toHaveValue('empty');
    await cornerTowers(page, 0);
    await cornerPlots(page);
    for (const [level, tier] of [
      [1, 1],
      [3, 2],
      [5, 3],
    ]) {
      await page.locator('#preview-tier').selectOption(String(level));
      await expect(scene(page).locator('.village-gate')).toHaveAttribute(
        'data-gate-tier',
        String(tier),
      );
      await cornerTowers(page, 0);
      await cornerPlots(page);
      await expect(scene(page).locator('.village-sentry')).toHaveCount(2);
      await expect(scene(page).locator('.village-terrain-detail')).toBeVisible();
    }
    await page.locator('#preview-corners').selectOption('built');
    await cornerTowers(page);
    await cornerPlots(page, []);
    for (const [level, tier] of [
      [1, 1],
      [3, 2],
      [5, 3],
    ]) {
      await page.locator('#preview-tower-tier').selectOption(String(level));
      await expect(scene(page).locator('.village-gate')).toHaveAttribute('data-gate-tier', '3');
      for (const tower of await scene(page).locator('.village-corner-tower').all())
        await expect(tower).toHaveAttribute('data-tower-tier', String(tier));
      await frame(page).screenshot({
        path: 'artifacts/village-corner-tier-' + tier + '-v2.14.0.png',
        animations: 'disabled',
      });
    }
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const language of ['tr', 'en']) {
        if ((await page.locator('html').getAttribute('lang')) !== language)
          await page.locator('#language').click();
        for (const theme of ['light', 'dark']) {
          if ((await page.locator('html').getAttribute('data-theme')) !== theme)
            await page.locator('#theme').click();
          await page.locator('[data-action="resetZoom"]').click();
          await frame(page).scrollIntoViewIfNeeded();
          await cornerTowers(page);
          const mapBounds = await frame(page).boundingBox();
          for (const tower of await scene(page).locator('.village-corner-tower').all()) {
            const box = await tower.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(mapBounds.x);
            expect(box.y).toBeGreaterThanOrEqual(mapBounds.y);
            expect(box.x + box.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width);
            expect(box.y + box.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height);
          }
          await expect(frame(page)).toHaveAttribute('data-motion', 'off');
          await expect(page.locator('[data-action="upgradeWall"]')).toBeDisabled();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
        }
      }
    }
    if ((await page.locator('html').getAttribute('lang')) !== 'tr')
      await page.locator('#language').click();
    if ((await page.locator('html').getAttribute('data-theme')) !== 'dark')
      await page.locator('#theme').click();
    for (const mode of ['empty', 'built']) {
      await page.locator('#preview-corners').selectOption(mode);
      for (const [device, width] of [
        ['desktop', 1440],
        ['mobile', 390],
      ]) {
        await page.setViewportSize({ width, height: 1100 });
        await page.locator('[data-action="resetZoom"]').click();
        await frame(page).screenshot({
          path: 'artifacts/village-' + mode + '-' + device + '-v2.14.0.png',
          animations: 'disabled',
        });
      }
    }
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(stored);
    expect(network).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await page.context().setOffline(false);
    await page.goto('about:blank');
  }
});

test('the enlarged hall keeps neighboring plot centers clickable at normal and zoomed views while its body and name select it', async ({
  page,
}) => {
  const { actions } = await establishedVillage(page, { hall: true });
  const hall = scene(page).locator('[data-building="building-hall"]');
  const storage = scene(page).locator('[data-building="building-storage"]');
  const clickWorld = async (x, y, plotId) => {
    const viewBox = await scene(page).getAttribute('viewBox');
    const point = await scene(page).evaluate(
      (svg, [worldX, worldY]) => {
        const screen = new DOMPoint(worldX, worldY).matrixTransform(svg.getScreenCTM());
        return {
          x: screen.x,
          y: screen.y,
          plot: document.elementFromPoint(screen.x, screen.y)?.closest('[data-plot]')?.dataset.plot,
        };
      },
      [x, y],
    );
    expect(point.plot).toBe(plotId);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    try {
      // Native pointer focus must not pan the camera out from under the held mouse.
      await expect(scene(page)).toHaveAttribute('viewBox', viewBox);
    } finally {
      await page.mouse.up();
    }
  };
  for (const zoom of [1, 2]) {
    await page.locator('[data-action="resetZoom"]').click();
    for (let count = 1; count < zoom; count += 0.25)
      await page.locator('[data-action="zoomIn"]').click();
    await expect(frame(page)).toHaveAttribute('data-camera-zoom', String(zoom));
    await storage.click();
    await expect(hall).not.toHaveClass(/selected/);
    for (const [plotId, x, y, number] of [
      ['p1', 818, 297, 2],
      ['p6', 622, 297, 7],
    ]) {
      await expect(scene(page).locator('[data-plot="' + plotId + '"]')).toBeVisible();
      await clickWorld(x, y, plotId);
      await expect(page.locator('.placement-dialog')).toBeVisible();
      await expect(page.locator('.placement-dialog .eyebrow')).toHaveText(
        translations.tr.plot + ' ' + number,
      );
      await expect(hall).not.toHaveClass(/selected/);
      await page.locator('.placement-dialog .modal-close').click();
    }
    const body = await hall.locator('.hall-building-hit').boundingBox();
    await page.mouse.click(body.x + body.width / 2, body.y + body.height * 0.65);
    await expect(hall).toHaveClass(/selected/);
    await expect(page.locator('.building-detail-title h2')).toHaveText(translations.tr.hall);
    await storage.click();
    await expect(hall).not.toHaveClass(/selected/);
    await hall.locator('.hall-building-label text').click();
    await expect(hall).toHaveClass(/selected/);
    await expect(page.locator('.building-detail-title h2')).toHaveText(translations.tr.hall);
    await expect(page.locator('.placement-dialog')).toHaveCount(0);
  }
  expect(actions).toEqual([]);
});
