import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { recoveryPlan } from '../../shared/recovery.mjs';
import { FIRST_WATCH_STEPS } from '../../shared/first-watch.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 15, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const option = (page, kind) => page.locator(`[data-recovery-kind="${kind}"]`);
const control = (page, kind) =>
  page.locator(kind === 'rest' ? '#recovery-rest' : '#recovery-heal-herd');

function injuredCamp() {
  const state = createGame(START);
  state.herd = { count: 20, hp: 140, maxHp: 200, panic: 35 };
  state.wolves[0].hp = 40;
  return state;
}

async function mockCamp(page, state, view = 'wolves') {
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
    const body = route.request().postDataJSON();
    expect(body.revision).toBe(revision);
    actions.push(body.action);
    applyAction(state, body.action, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state, revision: ++revision }));
  });
  await page.goto('/#' + view);
  await expect(
    page.locator(view === 'quests' ? '#first-watch-panel' : '#recovery-panel'),
  ).toBeVisible();
  return actions;
}

for (const kind of ['healHerd', 'rest']) {
  test(`${kind} previews capped effects and spends exactly once after explicit confirmation`, async ({
    page,
  }) => {
    const state = injuredCamp();
    const before = structuredClone(state);
    const quote = recoveryPlan(state, kind);
    const actions = await mockCamp(page, state);
    const card = option(page, kind);
    await expect(card.locator('[data-recovery-herd-health]')).toContainText(
      `140 → ${quote.herd.after} / 200`,
    );
    await expect(card.locator('[data-recovery-herd-panic]')).toContainText(
      `35% → ${quote.herd.panicAfter}%`,
    );
    if (kind === 'rest')
      await expect(card.locator('[data-recovery-wolf="wolf-alpha"]')).toContainText(
        '40 → 140 / 140',
      );
    else await expect(card).toContainText(translations.tr.careWolfUnchanged);
    expect(actions).toEqual([]);
    expect(state).toEqual(before);
    const response = page.waitForResponse('**/api/action');
    await control(page, kind).click();
    await (await response).finished();
    expect(actions).toEqual([{ type: kind }]);
    expect(state.herd).toEqual({
      ...before.herd,
      hp: quote.herd.after,
      panic: quote.herd.panicAfter,
    });
    expect(state.wolves.map((wolf) => wolf.hp)).toEqual(quote.wolves.map((wolf) => wolf.after));
    for (const resource of Object.keys(before.resources))
      expect(state.resources[resource]).toBe(
        before.resources[resource] - (quote.cost[resource] || 0),
      );
    await expect(page.locator('[data-care-value="current-herd-health"]')).toHaveText(
      `${quote.herd.after} / 200`,
    );
    await expect(page.locator('[data-care-value="current-herd-panic"]')).toHaveText(
      `${quote.herd.panicAfter}%`,
    );
    const saved = structuredClone(state);
    await page.reload();
    await expect(page.locator('[data-care-value="current-herd-health"]')).toHaveText(
      `${quote.herd.after} / 200`,
    );
    expect(state).toEqual(saved);
    expect(actions).toEqual([{ type: kind }]);
  });
}

for (const [scenario, kind, reasonKey] of [
  ['no herbs', 'healHerd', 'careShortage'],
  ['short water', 'rest', 'careShortage'],
  ['healthy', 'healHerd', 'careHerdHealthy'],
  ['healthy', 'rest', 'carePackHealthy'],
  ['away', 'rest', 'careJourneyBlocked'],
  ['legacy journey', 'rest', 'careJourneyBlocked'],
  ['battle', 'healHerd', 'careBattleBlocked'],
  ['battle', 'rest', 'careBattleBlocked'],
]) {
  test(`${scenario} explains unavailable ${kind} without sending an action`, async ({ page }) => {
    const state = scenario === 'healthy' ? createGame(START) : injuredCamp();
    if (scenario === 'no herbs') state.resources.herbs = 0;
    if (scenario === 'short water') state.resources.water = 24.9;
    if (scenario === 'away')
      applyAction(
        state,
        {
          type: 'expedition',
          region: 'spring',
          difficulty: 'easy',
          wolfIds: ['wolf-scout'],
        },
        START,
      );
    if (scenario === 'legacy journey')
      state.journey = { destination: 'spring', endsAt: START + 60_000 };
    if (scenario === 'battle') applyAction(state, { type: 'startBattle' }, START);
    const before = structuredClone(state);
    const actions = await mockCamp(page, state);
    await expect(control(page, kind)).toBeDisabled();
    await expect(option(page, kind).locator('[data-recovery-reason]')).toContainText(
      translations.tr[reasonKey],
    );
    await control(page, kind).evaluate((button) => button.click());
    expect(actions).toEqual([]);
    expect(state).toEqual(before);
    if (['away', 'legacy journey'].includes(scenario))
      await expect(control(page, 'healHerd')).toBeEnabled();
  });
}

test('passive production enables rest while preserving selected guardian, controls and focus', async ({
  page,
}) => {
  const state = injuredCamp();
  applyAction(state, { type: 'build', building: 'well', plotId: 'p0' }, START);
  state.resources.water = 24.99;
  state.resources.feed = 30;
  const actions = await mockCamp(page, state);
  const rest = control(page, 'rest');
  await expect(rest).toBeDisabled();
  const wolf = page.locator('[data-wolf="wolf-guardian"]');
  await wolf.click();
  await wolf.focus();
  await expect(wolf).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    window.originalCarePanel = document.querySelector('#recovery-panel');
    window.originalRestControl = document.querySelector('#recovery-rest');
    window.originalHealControl = document.querySelector('#recovery-heal-herd');
    window.originalCareGuardian = document.querySelector('[data-wolf="wolf-guardian"]');
  });
  const polled = page.waitForResponse('**/api/state');
  await page.clock.fastForward(1000);
  await (await polled).finished();
  await expect(rest).toBeEnabled();
  await expect(wolf).toBeFocused();
  await expect(wolf).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(
      () =>
        window.originalCarePanel === document.querySelector('#recovery-panel') &&
        window.originalRestControl === document.querySelector('#recovery-rest') &&
        window.originalHealControl === document.querySelector('#recovery-heal-herd') &&
        window.originalCareGuardian === document.querySelector('[data-wolf="wolf-guardian"]'),
    ),
  ).toBe(true);
  expect(actions).toEqual([]);
  expect(state.wolves[0].hp).toBe(40);
  expect(state.herd.hp).toBe(140);
});

for (const [scenario, expectedFocus] of [
  ['wounded guardians', '#recovery-rest'],
  ['herd only', '#recovery-heal-herd'],
  ['rest unaffordable', '#recovery-heal-herd'],
  ['no available care', '#recovery-title'],
]) {
  test(`First Watch recovery guidance focuses ${scenario} without performing care`, async ({
    page,
  }) => {
    const state = injuredCamp();
    state.stats.gathers = 1;
    state.stats.builds = 1;
    state.stats.trained = 1;
    for (const step of FIRST_WATCH_STEPS.slice(0, 4)) {
      state.firstWatch.milestones[step.id] = START;
      state.firstWatch.claims.push({ id: step.id, at: START });
    }
    for (const quest of state.quests)
      quest.progress = ['first_build', 'gatherer', 'pack_training'].includes(quest.id) ? 1 : 0;
    if (scenario === 'herd only') for (const wolf of state.wolves) wolf.hp = wolf.maxHp;
    if (['rest unaffordable', 'no available care'].includes(scenario)) state.resources.water = 0;
    if (scenario === 'no available care') state.resources.herbs = 0;
    const before = structuredClone(state);
    const actions = await mockCamp(page, state, 'quests');
    await page.locator('#fw-action-recover').click();
    await expect(page.locator('#recovery-panel')).toBeVisible();
    await expect(page.locator(expectedFocus)).toBeFocused();
    expect(actions).toEqual([]);
    expect(state).toEqual(before);
  });
}

test('offline actual care component is bilingual, read-only and fits small phones in both themes', async ({
  page,
}) => {
  // Allow the large inline portrait fixture and its browser cleanup a local time budget.
  test.setTimeout(60_000);
  const requests = [],
    errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().setOffline(true);
  try {
    await page.goto(pathToFileURL(resolve('preview/guardians.html')).href);
    const panel = page.locator('#recovery-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-readonly', 'true');
    const storedBefore = await page.evaluate(() => ({ ...localStorage }));
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('#theme').click();
        for (const language of ['tr', 'en']) {
          if ((await page.locator('html').getAttribute('lang')) !== language)
            await page.locator('#language').click();
          await expect(panel).toContainText(translations[language].careTitle);
          await expect(panel).toContainText(translations[language].careReadOnly);
          await expect(control(page, 'rest')).toBeDisabled();
          await expect(control(page, 'healHerd')).toBeDisabled();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          const box = await panel.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
        if (width === 1440 && theme === 'light')
          await panel.screenshot({ path: 'artifacts/camp-care-desktop-v2.9.0.png' });
        if (width === 390 && theme === 'dark')
          await panel.screenshot({ path: 'artifacts/camp-care-mobile-v2.9.0.png' });
      }
    }
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storedBefore);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    // Product assertions run offline; then release the large document before fixture teardown.
    await page.context().setOffline(false);
    await page.goto('about:blank');
  }
});
