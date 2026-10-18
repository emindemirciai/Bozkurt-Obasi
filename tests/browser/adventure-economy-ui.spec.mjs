import { test, expect } from '@playwright/test';
import { createGame, applyAction, advanceGame, validateGame } from '../../shared/game.mjs';
import { adventureQuote, outingQuote } from '../../shared/adventures.mjs';
import { translations } from '../../web/i18n.mjs';
import { signIn } from './sign-in.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });
const rewardText = (reward, language) =>
  Object.entries(reward)
    .map(([key, amount]) => amount + ' ' + translations[language][key])
    .join(' · ');

for (const legacy of [true, false]) {
  test(
    (legacy ? 'legacy' : 'current') +
      ' active journeys display their promised material rewards after polling and language changes',
    async ({ page }) => {
      await signIn(page);
      const state = createGame(START);
      applyAction(
        state,
        {
          type: 'expedition',
          region: 'spring',
          difficulty: 'easy',
          plan: 'survey',
          wolfIds: ['wolf-alpha'],
        },
        START,
      );
      if (legacy) delete state.adventure.active.economyVersion;
      expect(validateGame(state)).toBe(true);
      const outing = structuredClone(state.adventure.active);
      const promised = outingQuote(state, outing);
      const newDeparture = adventureQuote(state, outing);
      if (legacy) expect(promised.reward.wood).toBeGreaterThan(newDeparture.reward.wood);
      else expect(promised.reward).toEqual(newDeparture.reward);
      await page.clock.install({ time: new Date(START - 1000) });
      await page.clock.pauseAt(new Date(START));
      await page.route('**/api/session', (route) =>
        route.fulfill(json({ state, revision: 0, mode: 'online' })),
      );
      await page.route('**/api/state', async (route) => {
        advanceGame(state, await page.evaluate(() => Date.now()));
        expect(validateGame(state)).toBe(true);
        await route.fulfill(json({ state, revision: 1 }));
      });
      let actions = 0;
      await page.route('**/api/action', (route) => {
        actions++;
        return route.abort();
      });
      await page.goto('/#world');
      for (const language of ['tr', 'en']) {
        if ((await page.locator('html').getAttribute('lang')) !== language)
          await page.locator('[data-action="language"]').click();
        await expect(page.locator('[data-adventure-reward]')).toHaveText(
          rewardText(promised.reward, language),
        );
        await expect(page.locator('[data-mission-plan="survey"] [data-plan-reward]')).toHaveText(
          rewardText(promised.reward, language),
        );
        const alternate = outingQuote(state, { ...outing, plan: 'supply' });
        await expect(page.locator('[data-mission-plan="supply"] [data-plan-reward]')).toHaveText(
          rewardText(alternate.reward, language),
        );
        await expect(page.locator('[data-active-economy="legacy"]')).toHaveCount(legacy ? 1 : 0);
        const response = page.waitForResponse('**/api/state');
        await page.clock.fastForward(1100);
        await (await response).finished();
        await expect(page.locator('[data-adventure-reward]')).toHaveText(
          rewardText(promised.reward, language),
        );
      }
      expect(actions).toBe(0);
    },
  );
}
