import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  createGame,
  applyAction,
  advanceGame,
  migrateGame,
  validateGame,
} from '../../shared/game.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const journal = (page) => page.locator('#first-watch-journal');
const value = (page, name) => journal(page).locator('[data-journal-value="' + name + '"]');
const row = (page, id) => journal(page).locator('[data-journal-step="' + id + '"]');

function recordedChapter() {
  const state = createGame(START);
  const act = (action, elapsed) => applyAction(state, action, START + elapsed, () => 0);
  // Build and training precede gathering: saved objectives need not follow reward order.
  act({ type: 'build', building: 'quarry', plotId: 'p0' }, 60_000);
  act({ type: 'train', id: 'wolf-alpha', path: 'guardian' }, 90_000);
  act({ type: 'collect' }, 123_000);
  act({ type: 'claimFirstWatch', id: 'gather' }, 180_000);
  act({ type: 'claimFirstWatch', id: 'build' }, 240_000);
  act({ type: 'startBattle' }, 300_000);
  advanceGame(state, START + 390_000);
  expect(state.battle.status).toBe('won');
  act({ type: 'rest' }, 430_000);
  advanceGame(state, START + 900_000);
  expect(validateGame(state)).toBe(true);
  return state;
}

async function mockChapter(page, state, { view = 'quests', now = state.updatedAt } = {}) {
  expect(validateGame(state)).toBe(true);
  await signIn(page);
  await page.clock.install({ time: new Date(now - 1000) });
  await page.clock.pauseAt(new Date(now));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let current = state,
    revision = 0;
  const actions = [];
  await page.route('**/api/session', (route) =>
    route.fulfill(json({ state: current, revision, mode: 'online' })),
  );
  await page.route('**/api/state', async (route) => {
    advanceGame(current, await page.evaluate(() => Date.now()));
    await route.fulfill(json({ state: current, revision: ++revision }));
  });
  await page.route('**/api/action', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.revision).toBe(revision);
    actions.push(body.action);
    applyAction(current, body.action, await page.evaluate(() => Date.now()), () => 0);
    await route.fulfill(json({ state: current, revision: ++revision }));
  });
  await page.goto('/#' + view);
  await expect(page.locator('.game-shell')).toBeVisible();
  if (view === 'quests') await expect(journal(page)).toBeVisible();
  return {
    actions,
    replace(next) {
      expect(validateGame(next)).toBe(true);
      current = next;
      revision = 0;
    },
  };
}

async function poll(page, milliseconds = 1100) {
  const response = page.waitForResponse('**/api/state');
  await page.clock.fastForward(milliseconds);
  await (await response).finished();
}

test('the compact journal control opens saved action timings without spending or claiming', async ({
  page,
}) => {
  const state = recordedChapter();
  const before = structuredClone(state);
  const { actions } = await mockChapter(page, state, { view: 'village' });
  await page.locator('[data-action="firstWatchJournal"]').click();
  await expect(page).toHaveURL('/#quests');
  await expect(page.locator('#fw-journal-title')).toBeFocused();
  await expect(journal(page).locator('[data-journal-step]')).toHaveCount(8);
  await expect(value(page, 'completed-gather')).toHaveText('2 dk 03 sn');
  await expect(value(page, 'claimed-gather')).toHaveText('3 dk 00 sn');
  await expect(value(page, 'claim-delay-gather')).toHaveText('0 dk 57 sn');
  await expect(value(page, 'claim-delay-build')).toHaveText('3 dk 00 sn');
  await expect(value(page, 'claim-delay-train')).toHaveText('—');
  await expect(value(page, 'completed-build')).toHaveText('1 dk 00 sn');
  await expect(value(page, 'claimed-build')).toHaveText('4 dk 00 sn');
  await expect(value(page, 'completed-train')).toHaveText('1 dk 30 sn');
  await expect(value(page, 'claimed-train')).toHaveText('—');
  await expect(row(page, 'gather')).toHaveAttribute('data-journal-status', 'claimed');
  await expect(row(page, 'train')).toHaveAttribute('data-journal-status', 'pendingClaim');
  await expect(row(page, 'battle')).toHaveAttribute('data-journal-status', 'locked');
  await expect(value(page, 'first-win')).toHaveText('5 dk 30 sn');
  await expect(value(page, 'battle-recovery')).toHaveText('1 dk 40 sn');
  expect(actions).toEqual([]);
  expect(state).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.web.v1'))).toBeNull();
});

test('an explicit reward claim updates its journal receipt and survives reload without changing completion time', async ({
  page,
}) => {
  const state = createGame(START);
  applyAction(state, { type: 'collect' }, START + 123_000);
  advanceGame(state, START + 180_000);
  const { actions } = await mockChapter(page, state);
  await expect(row(page, 'gather')).toHaveAttribute('data-journal-status', 'pendingClaim');
  await expect(value(page, 'claimed-gather')).toHaveText('—');
  await page.locator('#fw-action-gather').click();
  await expect(row(page, 'gather')).toHaveAttribute('data-journal-status', 'claimed');
  await expect(value(page, 'completed-gather')).toHaveText('2 dk 03 sn');
  await expect(value(page, 'claimed-gather')).toHaveText('3 dk 00 sn');
  expect(actions).toEqual([{ type: 'claimFirstWatch', id: 'gather' }]);
  const saved = structuredClone(state);
  await page.reload();
  await expect(value(page, 'claimed-gather')).toHaveText('3 dk 00 sn');
  await expect(value(page, 'completed-gather')).toHaveText('2 dk 03 sn');
  expect(state).toEqual(saved);
  expect(actions).toHaveLength(1);
});

test('the fifteen-minute comparison includes exactly 900 seconds and separates later saved milestones', async ({
  page,
}) => {
  const state = createGame(START);
  applyAction(state, { type: 'collect' }, START + 900_000);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p0' }, START + 900_001);
  advanceGame(state, START + 901_000);
  const { actions } = await mockChapter(page, state);
  await expect(value(page, 'completed-gather')).toHaveText('15 dk 00 sn');
  await expect(value(page, 'completed-build')).toHaveText('15 dk 00,001 sn');
  await expect(row(page, 'gather')).toHaveAttribute('data-journal-window', 'within');
  await expect(row(page, 'build')).toHaveAttribute('data-journal-window', 'after');
  await expect(value(page, 'window-gather')).toHaveText('İlk 15 dakika içinde');
  await expect(value(page, 'window-build')).toHaveText('15 dakikadan sonra');
  await expect(value(page, 'window-state')).toHaveText('İlk 15 dakika tamamlandı');
  await expect(value(page, 'window-explore')).toHaveText('—');
  await page.locator('[data-action="language"]').click();
  await expect(value(page, 'completed-gather')).toHaveText('15 min 00 sec');
  await expect(value(page, 'completed-build')).toHaveText('15 min 00.001 sec');
  await expect(value(page, 'window-gather')).toHaveText('Within first 15 minutes');
  await expect(value(page, 'window-build')).toHaveText('After 15 minutes');
  expect(actions).toEqual([]);
});

test('polling refreshes elapsed wall time while preserving the journal and its focused heading', async ({
  page,
}) => {
  const state = createGame(START);
  advanceGame(state, START + 60_000);
  const { actions } = await mockChapter(page, state);
  const heading = page.locator('#fw-journal-title');
  await heading.focus();
  await expect(value(page, 'elapsed')).toHaveText('1 dk 00 sn');
  await page.evaluate(() => {
    window.originalJournal = document.querySelector('#first-watch-journal');
    window.originalJournalHeading = document.querySelector('#fw-journal-title');
  });
  await poll(page, 1000);
  await expect(value(page, 'elapsed')).toHaveText('1 dk 01 sn');
  await expect(heading).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        window.originalJournal === document.querySelector('#first-watch-journal') &&
        window.originalJournalHeading === document.querySelector('#fw-journal-title'),
    ),
  ).toBe(true);
  await poll(page, 1000);
  await expect(value(page, 'elapsed')).toHaveText('1 dk 02 sn');
  await expect(heading).toBeFocused();
  expect(actions).toEqual([]);
  expect(state.firstWatch.milestones.gather).toBeNull();
});

test('migrated returning villages show achievement status without inventing historical durations', async ({
  page,
}) => {
  const old = recordedChapter();
  delete old.firstWatch;
  const state = migrateGame(old);
  expect(state.firstWatch.cohort).toBe('returning');
  const before = structuredClone(state);
  const { actions } = await mockChapter(page, state);
  await expect(value(page, 'window-state')).toHaveText('Süre karşılaştırması yok');
  for (const name of [
    'elapsed',
    'first-win',
    'battle-recovery',
    'completed-gather',
    'claimed-gather',
    'claim-delay-gather',
    'completed-build',
    'window-build',
  ])
    await expect(value(page, name)).toHaveText('—');
  await expect(row(page, 'gather')).toHaveAttribute('data-journal-status', 'pendingClaim');
  expect(await journal(page).textContent()).not.toMatch(/\d+ dk \d+ sn/);
  expect(state).toEqual(before);
  expect(actions).toEqual([]);
});

test('a delayed old journal poll cannot reappear after logout or leak timings into another account', async ({
  page,
}) => {
  const state = recordedChapter();
  const fixture = await mockChapter(page, state);
  await expect(value(page, 'completed-gather')).toHaveText('2 dk 03 sn');
  const started = Promise.withResolvers(),
    released = Promise.withResolvers();
  await page.route(
    '**/api/state',
    async (route) => {
      started.resolve();
      await released.promise;
      await route.fulfill(json({ state, revision: 1 }));
    },
    { times: 1 },
  );
  await page.clock.fastForward(1100);
  await started.promise;
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(journal(page)).toHaveCount(0);
  const response = page.waitForResponse('**/api/state');
  released.resolve();
  await (await response).finished();
  await page.clock.fastForward(1000);
  await expect(journal(page)).toHaveCount(0);
  await expect(page.locator('.game-shell')).toHaveCount(0);
  const next = createGame(START + 900_000);
  fixture.replace(next);
  await signIn(page);
  await page.goto('/?auth=success#quests');
  await expect(journal(page)).toBeVisible();
  await expect(value(page, 'completed-gather')).toHaveText('—');
  await expect(row(page, 'gather')).toHaveAttribute('data-journal-status', 'current');
  await expect(journal(page)).not.toContainText('2 dk 03 sn');
  expect(fixture.actions).toEqual([]);
});

test('journal timings and labels remain readable on narrow phones in both languages and the dark game theme', async ({
  page,
}) => {
  const state = recordedChapter();
  const { actions } = await mockChapter(page, state);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const language of ['tr', 'en']) {
      if ((await page.locator('html').getAttribute('lang')) !== language)
        await page.locator('[data-action="language"]').click();
      for (const theme of ['dark']) {
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
        await expect(journal(page)).toBeVisible();
        await expect(value(page, 'completed-gather')).toHaveText(
          language === 'tr' ? '2 dk 03 sn' : '2 min 03 sec',
        );
        await expect(value(page, 'claimed-build')).toHaveText(
          language === 'tr' ? '4 dk 00 sn' : '4 min 00 sec',
        );
        expect(
          await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        ).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const box = await journal(page).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
  }
  expect(actions).toEqual([]);
});

test('offline journal uses all saved-story scenarios without HTTP requests or storage writes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const requests = [],
    errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.context().setOffline(true);
  try {
    await page.goto(pathToFileURL(resolve('preview/first-watch.html')).href);
    const before = await page.evaluate(() => ({ ...localStorage }));
    for (const scenario of [
      'beginning',
      'reward',
      'ambush',
      'recovery',
      'blocked',
      'complete',
      'returning',
      'boundary',
    ]) {
      await page.locator('#preview-scenario').selectOption(scenario);
      await expect(journal(page)).toBeVisible();
      await expect(journal(page).locator('[data-journal-step]')).toHaveCount(8);
      expect(await page.locator('[data-action]:not(:disabled)').count()).toBe(0);
    }
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const language of ['tr', 'en']) {
        if ((await page.locator('html').getAttribute('lang')) !== language)
          await page.locator('#language').click();
        for (const theme of ['light', 'dark']) {
          if ((await page.locator('html').getAttribute('data-theme')) !== theme)
            await page.locator('#theme').click();
          await expect(journal(page)).toBeVisible();
          await expect(journal(page)).toContainText(translations[language].fwJournalTitle);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          const box = await journal(page).boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
      }
    }
    expect(
      await page
        .locator('[id]')
        .evaluateAll((nodes) => new Set(nodes.map((node) => node.id)).size === nodes.length),
    ).toBe(true);
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await page.context().setOffline(false);
    await page.goto('about:blank');
  }
});
