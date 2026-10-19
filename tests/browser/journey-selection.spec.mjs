import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { adventureQuote } from '../../shared/adventures.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 20, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const routeCard = (page, region) => page.locator('.route-card[data-region="' + region + '"]');
const plan = (page, value) => page.locator('#adventure-plan-' + value);
const guardian = (page, value) => page.locator('#adventure-' + value);

async function journey(page, { open = true } = {}) {
  const state = createGame(START);
  state.adventure.unlocked = ['homeland', 'spring', 'meadow', 'highland', 'ruins'];
  state.wolves[3].equipment = 'scout_charm';
  expect(validateGame(state)).toBe(true);
  await signIn(page);
  await page.clock.install({ time: new Date(START - 1000) });
  await page.clock.pauseAt(new Date(START));
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  if (open) {
    await page.goto('/#world');
    await expect(page.locator('.adventure-preparation')).toBeVisible();
  }
  return { state, actions };
}

async function loadedImage(locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() => locator.evaluate((image) => image.complete && image.naturalWidth > 0))
    .toBe(true);
}

async function expectQuote(page, state, selection, language = 'tr') {
  const quote = adventureQuote(state, selection);
  for (const [resource, amount] of Object.entries(quote.cost))
    await expect(page.locator('[data-adventure-cost]')).toContainText(
      amount + ' ' + translations[language][resource],
    );
  const chosen = page.locator('[data-mission-plan="' + selection.plan + '"]');
  await expect(chosen.locator('[data-plan-xp]')).toHaveText('+' + quote.xp);
  await expect(chosen.locator('[data-plan-seconds]')).toHaveText(
    quote.seconds / 3600 + ' ' + translations[language].journeyHours,
  );
  for (const [resource, amount] of Object.entries(quote.reward))
    await expect(page.locator('[data-adventure-reward]')).toContainText(
      amount + ' ' + translations[language][resource],
    );
}

test('regional images load, native choices refresh the real quote and selecting a party never spends supplies', async ({
  page,
}) => {
  const { state, actions } = await journey(page);
  const before = structuredClone(state);
  const sources = [];
  for (const [region, hours] of [
    ['spring', 6],
    ['meadow', 8],
    ['highland', 10],
    ['ruins', 12],
  ]) {
    const image = routeCard(page, region).locator('img.route-landscape');
    await loadedImage(image);
    sources.push(await image.getAttribute('src'));
    await expect(routeCard(page, region).locator('.route-detail')).toContainText(hours + ' sa');
  }
  expect(new Set(sources).size).toBe(4);
  await page.locator('#adventure-region').selectOption('highland');
  await expect(page.locator('#adventure-region')).toBeFocused();
  await expect(routeCard(page, 'highland')).toHaveAttribute('aria-pressed', 'true');
  const hero = page.locator('[data-region-visual="highland"] > img');
  await loadedImage(hero);
  expect(await hero.getAttribute('src')).toBe(sources[2]);
  await page.locator('#adventure-difficulty').selectOption('normal');
  await expect(page.locator('#adventure-difficulty')).toBeFocused();
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  await plan(page, 'survey').check();
  await expect(plan(page, 'survey')).toBeFocused();
  await expect(plan(page, 'survey')).toBeChecked();
  await expect(page.locator('[data-mission-plan="survey"] .choice-selected')).toBeVisible();
  await guardian(page, 'wolf-scout').check();
  await expect(guardian(page, 'wolf-scout')).toBeFocused();
  await expect(page.locator('[data-guardian-choice="wolf-scout"] .choice-selected')).toBeVisible();
  const selection = {
    kind: 'expedition',
    region: 'highland',
    difficulty: 'normal',
    plan: 'survey',
    wolfIds: ['wolf-alpha', 'wolf-scout'],
  };
  await expectQuote(page, state, selection);
  await expect(page.locator('[data-action="startAdventure"]')).toBeEnabled();
  await expect(page.locator('[data-party-forecast]')).toHaveCount(2);
  await expect(page.locator('[data-party-card="scouting"] .party-suggestion-names')).toContainText(
    translations.tr.scout,
  );
  expect(actions).toEqual([]);
  expect(state).toEqual(before);
  await page.screenshot({
    path: 'artifacts/journey-desktop-v2.12.0.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({
    path: 'artifacts/journey-mobile-v2.12.0.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('polling preserves native control identity and focus, while one explicit start locks the submitted choices', async ({
  page,
}) => {
  const { state, actions } = await journey(page);
  await page.locator('#adventure-region').selectOption('highland');
  await page.locator('#adventure-difficulty').selectOption('normal');
  await plan(page, 'survey').check();
  await guardian(page, 'wolf-scout').check();
  await plan(page, 'survey').focus();
  await page.evaluate(() => {
    window.nativeJourneyRadio = document.querySelector('#adventure-plan-survey');
    window.nativeJourneyGuardian = document.querySelector('#adventure-wolf-scout');
  });
  const polled = page.waitForResponse('**/api/state');
  await page.clock.fastForward(1100);
  await (await polled).finished();
  await expect(plan(page, 'survey')).toBeFocused();
  await expect(guardian(page, 'wolf-scout')).toBeChecked();
  expect(
    await page.evaluate(
      () =>
        window.nativeJourneyRadio === document.querySelector('#adventure-plan-survey') &&
        window.nativeJourneyGuardian === document.querySelector('#adventure-wolf-scout'),
    ),
  ).toBe(true);
  const before = structuredClone(state.resources);
  const selection = {
    kind: 'expedition',
    region: 'highland',
    difficulty: 'normal',
    plan: 'survey',
    wolfIds: ['wolf-alpha', 'wolf-scout'],
  };
  const quote = adventureQuote(state, selection);
  expect(actions).toEqual([]);
  await page.locator('[data-action="startAdventure"]').click();
  await expect(page.locator('[data-active-adventure]')).toBeVisible();
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ type: 'expedition', ...selection });
  expect(state.resources.water).toBe(before.water - quote.cost.water);
  expect(state.resources.feed).toBe(before.feed - quote.cost.feed);
  expect(state.adventure.active.endsAt - state.adventure.active.startedAt).toBe(10 * 60 * 60_000);
  await expect(page.locator('.adventure-fields select:enabled')).toHaveCount(0);
  await expect(page.locator('[name="adventure-plan"]:enabled')).toHaveCount(0);
  await expect(page.locator('[name="adventure-wolf"]:enabled')).toHaveCount(0);
  await expect(page.locator('.route-card:enabled')).toHaveCount(0);
  await page.reload();
  await expect(plan(page, 'survey')).toBeChecked();
  await expect(guardian(page, 'wolf-scout')).toBeChecked();
  await expect(page.locator('#adventure-region')).toHaveValue('highland');
  await expect(page.locator('[data-action="startAdventure"]')).toBeDisabled();
  expect(actions).toHaveLength(1);
});

test('visual route and party selections stay legible and selected on small TR/EN phones in the fixed dark game theme', async ({
  page,
}) => {
  const { state, actions } = await journey(page);
  await page.locator('#adventure-region').selectOption('meadow');
  await plan(page, 'supply').check();
  await guardian(page, 'wolf-scout').check();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('[data-action="language"]').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
      await expect(plan(page, 'supply')).toBeChecked();
      await expect(guardian(page, 'wolf-scout')).toBeChecked();
      await expect(page.locator('[data-mission-plan="supply"] .choice-selected')).toBeVisible();
      await expect(
        page.locator('[data-guardian-choice="wolf-scout"] .choice-selected'),
      ).toBeVisible();
      await expectQuote(
        page,
        state,
        {
          kind: 'expedition',
          region: 'meadow',
          difficulty: 'easy',
          plan: 'supply',
          wolfIds: ['wolf-alpha', 'wolf-scout'],
        },
        language,
      );
      await loadedImage(page.locator('[data-region-visual="meadow"] > img'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      for (const selector of [
        '.adventure-preparation',
        '.adventure-brief',
        '.route-card.selected',
      ]) {
        const box = await page.locator(selector).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
  }
  expect(actions).toEqual([]);
});

test('entering the game keeps a light homepage preference intact and shows the site name below its logo at desktop and mobile sizes', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('bozkurt.theme', 'light'));
  await journey(page, { open: false });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.landing-header [data-action="theme"]')).toBeVisible();
  const landingLogo = await page.locator('.landing-brand-symbol').boundingBox();
  const landingName = await page.locator('.landing-brand .brand-name').boundingBox();
  expect(landingName.y).toBeGreaterThanOrEqual(landingLogo.y + landingLogo.height - 1);
  await page.locator('[data-action="play"]').first().click();
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.theme'))).toBe('light');
  await expect(page.locator('.topbar .wordmark-symbol')).toBeHidden();
  const topbar = await page.locator('.topbar').boundingBox();
  const desktopWordmark = await page.locator('.topbar .wordmark').boundingBox();
  expect(desktopWordmark.y).toBeGreaterThanOrEqual(topbar.y);
  expect(desktopWordmark.y + desktopWordmark.height).toBeLessThanOrEqual(
    topbar.y + topbar.height + 1,
  );
  const railLogo = await page.locator('.brand-mark > svg').boundingBox();
  const railName = page.locator('.rail-brand-name');
  await expect(railName).toContainText('Bozkurt');
  await expect(railName).toContainText('Obası');
  const railNameBox = await railName.boundingBox();
  expect(railNameBox.y).toBeGreaterThanOrEqual(railLogo.y + railLogo.height - 1);
  await page.setViewportSize({ width: 320, height: 1000 });
  await expect(page.locator('.topbar .wordmark .brand-name')).toBeVisible();
  const mobileLogo = await page.locator('.topbar .wordmark-symbol').boundingBox();
  const mobileName = await page.locator('.topbar .wordmark .brand-name').boundingBox();
  expect(mobileName.y).toBeGreaterThanOrEqual(mobileLogo.y + mobileLogo.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.landing-header [data-action="theme"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.theme'))).toBe('light');
});
