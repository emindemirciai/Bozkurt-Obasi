import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 14, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

async function buildAt(page, plotId, building = 'quarry') {
  await page.locator(`[data-plot="${plotId}"]`).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(translations.tr.placeTitle);
  const response = page.waitForResponse('**/api/action');
  await dialog.locator(`[data-action="placeBuilding"][data-building-type="${building}"]`).click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  return result.json();
}

async function mockVillage(page, state) {
  let revision = 0;
  const actions = [];
  await page.clock.install({ time: new Date(START - 1_000) });
  await page.clock.pauseAt(new Date(START));
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const request = route.request().postDataJSON();
    actions.push(request.action);
    applyAction(state, request.action, await page.evaluate(() => Date.now()));
    expect(validateGame(state)).toBe(true);
    await route.fulfill(json({ state, revision: ++revision }));
  });
  return actions;
}

async function pollVillage(page, milliseconds) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

test('chosen plots, duplicate producers and free relocation persist through the real API', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/#village');
  await expect(page.locator('.empty-plot')).toHaveCount(36);
  const first = await buildAt(page, 'p0');
  const second = await buildAt(page, 'p35');
  expect(first.state.buildings[0]).toMatchObject({ id: 'building-quarry', x: 0, y: 0 });
  expect(second.state.buildings).toEqual([
    { id: 'building-quarry', type: 'quarry', level: 1, x: 0, y: 0 },
    { id: 'building-quarry-2', type: 'quarry', level: 1, x: 5, y: 5 },
  ]);
  await expect(page.locator('.empty-plot')).toHaveCount(34);
  await expect(page.locator('.map-chip')).toHaveText('2 yapı');
  // Use the response already observed by the client. An extra direct state poll
  // would advance the server revision without updating the browser's revision.
  const before = second.state;
  await page.locator('.scene-building[data-building="building-quarry"]').click();
  await page.locator('[data-action="moveBuilding"]').click();
  const movedResponse = page.waitForResponse('**/api/action');
  await page.locator('[data-plot="p12"]').click();
  const moveResult = await movedResponse;
  expect(moveResult.status()).toBe(200);
  const moved = await moveResult.json();
  expect(moved.state.buildings[0]).toMatchObject({ id: 'building-quarry', x: 0, y: 2 });
  expect(moved.state.resources.wood).toBe(before.resources.wood);
  expect(moved.state.resources.stone).toBeCloseTo(
    before.resources.stone + ((moved.state.updatedAt - before.updatedAt) * 9) / 60_000,
    5,
  );
  await expect(page.locator('[data-plot="p0"]')).toBeVisible();
  await expect(page.locator('[data-plot="p12"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.scene-building[data-building="building-quarry"]')).toHaveAttribute(
    'transform',
    'translate(524 354)',
  );
  await expect(page.locator('.scene-building[data-building="building-quarry-2"]')).toHaveAttribute(
    'transform',
    'translate(720 810)',
  );
  await expect(page.locator('.map-chip')).toHaveText('2 yapı');
});

test('wooden walls upgrade to stone through real saved actions and unavailable upgrades are disabled', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/#village');
  const walls = page.locator('.settlement-controls');
  const upgrade = walls.locator('[data-action="upgradeWall"]');
  await expect(walls).toContainText(translations.tr.wall1);
  const firstResponse = page.waitForResponse('**/api/action');
  await upgrade.click();
  const first = await (await firstResponse).json();
  expect(first.state.walls.level).toBe(2);
  expect(first.state.resources.wood).toBe(340);
  expect(first.state.resources.stone).toBe(320);
  const secondResponse = page.waitForResponse('**/api/action');
  await upgrade.click();
  const second = await (await secondResponse).json();
  expect(second.state.walls.level).toBe(3);
  expect(second.state.resources.wood).toBe(200);
  expect(second.state.resources.stone).toBe(190);
  await expect(walls).toContainText(translations.tr.wall3);
  await expect(upgrade).toBeDisabled();
  await expect(page.locator('.settlement-scene .village-wall')).toHaveAttribute(
    'data-wall-level',
    '3',
  );
  await expect(page.locator('.settlement-scene .village-gate')).toHaveAttribute(
    'data-gate-tier',
    '2',
  );
  await page.reload();
  await expect(walls).toContainText(translations.tr.wall3);
  await expect(upgrade).toBeDisabled();
});

test('three building tiers and role portraits load, with the mobile village contained in a fixed viewport', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'hall', plotId: 'p0' }, START);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p5' }, START);
  await mockVillage(page, state);
  const tiers = [];
  for (const level of [1, 3, 5]) {
    while (state.buildings[0].level < level) {
      for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
      applyAction(state, { type: 'upgrade', id: 'building-hall' }, START);
    }
    state.walls.level = level;
    expect(validateGame(state)).toBe(true);
    if (level === 1) await page.goto('/#village');
    else await page.reload();
    const building = page.locator('.settlement-scene [data-building="building-hall"]');
    await expect(building).toHaveAttribute('aria-label', `Bey Otağı, Seviye ${level}`);
    const hallSprite = building.locator('.hall-building-sprite > svg');
    tiers.push(await hallSprite.getAttribute('viewBox'));
    const hallBounds = await hallSprite.boundingBox();
    const quarryBounds = await page
      .locator('.settlement-scene [data-building="building-quarry"] > svg')
      .boundingBox();
    expect(hallBounds.width).toBeGreaterThan(quarryBounds.width * 1.2);
    expect(hallBounds.height).toBeGreaterThan(quarryBounds.height * 1.2);
    await expect(page.locator('.settlement-controls')).toContainText(
      translations.tr[`wall${level}`],
    );
  }
  expect(new Set(tiers).size).toBe(3);
  await expect(page.locator('[data-action="upgradeWall"]')).toBeDisabled();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const bounds = await page.locator('.scene-wrap').evaluate((node) => ({
      content: node.clientWidth,
      scroll: node.scrollWidth,
      right: node.getBoundingClientRect().right,
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.content + 1);
    expect(bounds.right).toBeLessThanOrEqual(width);
    await expect(page.locator('.scene-wrap')).toHaveAttribute('data-camera-zoom', '1');
  }
  await page.locator('[data-view="wolves"]').click();
  await expect(page.locator('.guardian-portrait .real-wolf-portrait')).toHaveCount(5);
  const cropBoxes = await page
    .locator('.guardian-portrait .real-wolf-portrait')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('viewBox')));
  expect(new Set(cropBoxes).size).toBe(5);
  const decoded = await page.locator('.large-wolf image').evaluate(async (node) => {
    const image = new Image();
    image.src = node.getAttribute('href');
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(decoded).toEqual([2172, 724]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/wolf-roles-v2-mobile.png', fullPage: true });
});

test('selected expedition and escort parties receive story progress, experience, discoveries and usable items', async ({
  page,
}) => {
  await signIn(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = createGame(START);
  const actions = await mockVillage(page, state);
  await page.goto('/#world');
  await page.locator('#adventure-difficulty').selectOption('normal');
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  await page.locator('[name="adventure-wolf"][value="wolf-scout"]').check();
  expect(actions).toEqual([]);
  const startResponse = page.waitForResponse('**/api/action');
  await page.locator('[data-action="startAdventure"]').click();
  await (await startResponse).finished();
  expect(state.adventure.active).toMatchObject({
    kind: 'expedition',
    region: 'spring',
    difficulty: 'normal',
    wolfIds: ['wolf-alpha', 'wolf-scout'],
  });
  await expect(page.locator('[data-active-adventure]')).toContainText(
    translations.tr.story_expedition_spring_departure,
  );
  await page.locator('[data-view="wolves"]').click();
  await expect(page.locator('.training-row button').first()).toBeDisabled();
  await expect(page.locator('.equipment-panel')).toContainText(translations.tr.away);
  await page.locator('[data-view="world"]').click();
  const expedition = structuredClone(state.adventure.active);
  expect(expedition.endsAt - expedition.startedAt).toBe(6 * 60 * 60_000);
  await pollVillage(page, Math.floor((expedition.endsAt - expedition.startedAt) / 2));
  await expect(page.locator('[data-active-adventure]')).toContainText(
    translations.tr.story_expedition_spring_middle,
  );
  expect(state.adventure.history).toHaveLength(0);
  await pollVillage(page, expedition.endsAt - state.updatedAt + 1000);
  await expect(page.locator('[data-active-adventure]')).toHaveCount(0);
  await expect(page.locator('.adventure-reports article')).toHaveCount(1);
  await expect(page.locator('.adventure-reports')).toContainText(
    translations.tr.story_expedition_spring_report,
  );
  expect(state.adventure.unlocked).toEqual(['homeland', 'spring']);
  expect(state.inventory.leather_vest).toBe(1);
  expect(state.adventure.history[0]).toMatchObject({ xp: 270, completedAt: expedition.endsAt });
  for (const wolf of state.wolves) {
    expect({ level: wolf.level, xp: wolf.xp }).toEqual(
      ['wolf-alpha', 'wolf-scout'].includes(wolf.id) ? { level: 4, xp: 0 } : { level: 1, xp: 0 },
    );
  }
  await page.locator('[data-view="wolves"]').click();
  await page.locator('[data-action="equip"][data-item="leather_vest"]').click();
  await expect(page.locator('[data-action="unequip"]')).toBeEnabled();
  expect(state.wolves[0].equipment).toBe('leather_vest');
  expect(state.inventory.leather_vest).toBe(0);
  await page.locator('[data-view="world"]').click();
  await page.locator('#adventure-kind').selectOption('caravan');
  await page.locator('[data-action="startAdventure"]').click();
  await expect(page.locator('[data-active-adventure]')).toBeVisible();
  expect(state.adventure.active.kind).toBe('caravan');
  const escort = structuredClone(state.adventure.active);
  expect(escort.endsAt - escort.startedAt).toBe(6 * 60 * 60_000);
  await pollVillage(page, escort.endsAt - state.updatedAt + 1000);
  await expect(page.locator('.adventure-reports article')).toHaveCount(2);
  expect(state.location).toBe('spring');
  expect(state.inventory.leather_vest).toBe(1);
  expect(state.adventure.history[0]).toMatchObject({ xp: 270, completedAt: escort.endsAt });
  expect(state.wolves[0]).toMatchObject({ level: 5, xp: 90, equipment: 'leather_vest' });
  expect(state.wolves[3]).toMatchObject({ level: 5, xp: 90 });
  await pollVillage(page, 5_000);
  expect(state.inventory.leather_vest).toBe(1);
  expect(state.adventure.history).toHaveLength(2);
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('.adventure-reports')).toContainText(
    translations.en.story_expedition_spring_report,
  );
  await expect(page.locator('.adventure-reports article').first()).toContainText(
    translations.en.story_caravan_spring_report,
  );
  expect(errors).toEqual([]);
});

test('wall upgrade becomes available when passive production crosses its own cost threshold', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p0' }, START);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p1' }, START);
  applyAction(state, { type: 'upgradeWall' }, START);
  state.resources.wood = 139.95;
  state.resources.stone = 130;
  await mockVillage(page, state);
  await page.goto('/#village');
  const upgrade = page.locator('[data-action="upgradeWall"]');
  await expect(upgrade).toBeDisabled();
  await pollVillage(page, 1_000);
  await expect(upgrade).toBeEnabled();
  expect(state.resources.wood).toBeGreaterThan(140);
  const response = page.waitForResponse('**/api/action');
  await upgrade.click();
  await (await response).finished();
  expect(state.walls.level).toBe(3);
});

test('expedition start becomes available at its route and difficulty price without reselecting a field', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'well', plotId: 'p0' }, START);
  applyAction(state, { type: 'build', building: 'pasture', plotId: 'p1' }, START);
  state.adventure.unlocked = ['homeland', 'spring', 'meadow', 'highland'];
  state.resources.water = 36.9;
  state.resources.feed = 49;
  await mockVillage(page, state);
  await page.goto('/#world');
  await page.locator('#adventure-region').selectOption('ruins');
  await page.locator('#adventure-difficulty').selectOption('hard');
  await page.locator('[name="adventure-wolf"][value="wolf-guardian"]').check();
  await page.locator('[name="adventure-wolf"][value="wolf-hunter"]').check();
  const start = page.locator('[data-action="startAdventure"]');
  await expect(start).toBeDisabled();
  await pollVillage(page, 1_000);
  await expect(start).toBeEnabled();
  expect(state.resources.water).toBeGreaterThan(37);
  const response = page.waitForResponse('**/api/action');
  await start.click();
  await (await response).finished();
  expect(state.adventure.active).toMatchObject({
    region: 'ruins',
    difficulty: 'hard',
    wolfIds: ['wolf-alpha', 'wolf-guardian', 'wolf-hunter'],
  });
});

test('placement choices refresh affordability while an open dialog retains its focused control', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p0' }, START);
  state.resources.wood = 59.9;
  state.resources.stone = 25;
  await mockVillage(page, state);
  await page.goto('/#village');
  await page.locator('[data-plot="p1"]').click();
  const dialog = page.getByRole('dialog');
  const choice = dialog.locator('[data-action="placeBuilding"][data-building-type="lumber"]');
  const close = dialog.locator('[data-action="close"]');
  await expect(choice).toBeDisabled();
  await close.focus();
  await pollVillage(page, 1_000);
  await expect(choice).toBeEnabled();
  await expect(close).toBeFocused();
  await expect(dialog).toBeVisible();
  const response = page.waitForResponse('**/api/action');
  await choice.click();
  await (await response).finished();
  expect(state.buildings[1]).toMatchObject({ id: 'building-lumber-2', x: 1, y: 0 });
});
