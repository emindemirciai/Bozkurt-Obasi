import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, getProduction } from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

test('building costs name resources on touch screens and expose current and required amounts on hover and focus', async ({
  page,
}) => {
  await signIn(page);
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'well', plotId: 'p31' }, START);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state, revision: 0, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(state, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: 1 }));
  });
  const actions = [];
  await page.route('**/api/action', (route) => {
    actions.push(route.request().postDataJSON());
    return route.fulfill({ status: 400, ...json({ error: 'unexpected_action' }) });
  });
  await page.goto('/#village');
  for (const language of ['tr', 'en']) {
    if ((await page.locator('html').getAttribute('lang')) !== language)
      await page.locator('[data-action="language"]').click();
    const copy = translations[language];
    const card = page
      .locator('.build-card')
      .filter({ has: page.getByRole('heading', { name: copy.well, exact: true }) });
    await expect(card.locator('[data-action="selectBuilding"]')).toHaveText(
      copy.level + ' 1 · ' + copy.plot + ' 32',
    );
    await expect(card.locator('.building-cost-caption')).toHaveText(copy.buildingConstructionCost);
    await expect(card.locator('.building-owned-count')).toContainText(copy.buildingOwnedCount);
    const wood = card.locator('[data-cost-resource="wood"]');
    await expect(wood.locator('.cost-resource-name')).toBeVisible();
    await expect(wood.locator('.cost-resource-name')).toHaveText(copy.wood);
    await expect(wood).toHaveAccessibleName(new RegExp(copy.buildingCostRequired + ': 320'));
    await wood.hover();
    await expect(wood.getByRole('tooltip')).toBeVisible();
    await expect(wood.getByRole('tooltip')).toContainText(copy.buildingCostAvailable);
    await page.mouse.move(0, 0);
    await wood.focus();
    await expect(wood).toBeFocused();
    await expect(wood.getByRole('tooltip')).toBeVisible();
    const rates = getProduction({ ...state, buildings: [state.buildings[0]] });
    await expect(page.locator('.detail-stats')).toContainText(
      rates.water.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US') + ' ' + copy.perMinute,
    );
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await card.scrollIntoViewIfNeeded();
      await expect(wood.locator('.cost-resource-name')).toBeVisible();
      const box = await card.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  }
  expect(actions).toEqual([]);
});
