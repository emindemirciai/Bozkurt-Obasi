import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  advanceGame,
  getProduction,
  getUpgradeCost,
  migrateGame,
  resumeGame,
  validateGame,
} from '../shared/game.mjs';
import { ADVENTURE_PLANS, REGIONS, adventureQuote, outingQuote } from '../shared/adventures.mjs';

const NOW = Date.UTC(2026, 9, 19, 12);
const selection = (extra = {}) => ({
  kind: 'expedition',
  region: 'spring',
  difficulty: 'easy',
  plan: 'standard',
  wolfIds: ['wolf-scout'],
  ...extra,
});
const act = (state, action, at = state.updatedAt) => applyAction(state, action, at, () => 0);
const depart = (state, choice) => act(state, { ...choice, type: choice.kind });
const totalXp = (wolf) => (45 * wolf.level * (wolf.level - 1)) / 2 + wolf.xp;
const emptyMaterials = (state) => {
  for (const key of ['wood', 'stone', 'herbs']) state.resources[key] = 0;
};

test('production is slower for every resource and still scales with buildings, levels and regions', () => {
  const state = createGame(NOW);
  for (const [index, type] of ['lumber', 'quarry', 'well', 'pasture', 'healer'].entries()) {
    for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
    act(state, { type: 'build', building: type, plotId: 'p' + index });
  }
  assert.deepEqual(getProduction(state), { water: 7, feed: 6, herbs: 3, wood: 6, stone: 4.5 });
  act(state, { type: 'upgrade', id: 'building-quarry' });
  assert.equal(getProduction(state).stone, 9);
  state.location = 'highland';
  assert.equal(getProduction(state).stone, 13.5);
  act(state, { type: 'build', building: 'lumber', plotId: 'p5' });
  assert.equal(getProduction(state).wood, 12);
  assert.equal(validateGame(state), true);
});

test('gathering yields the smaller bundle at exactly 20 seconds and cannot be spammed', () => {
  const state = createGame(NOW);
  for (const key of Object.keys(state.resources)) state.resources[key] = 0;
  act(state, { type: 'collect' });
  assert.deepEqual(state.resources, { water: 4, feed: 4, herbs: 0, wood: 7, stone: 4 });
  assert.equal(state.collectReadyAt, NOW + 20_000);
  for (const at of [NOW, NOW + 8000, NOW + 19_999])
    assert.throws(() => act(state, { type: 'collect' }, at), { code: 'COLLECT_COOLDOWN' });
  assert.equal(state.stats.gathers, 1);
  act(state, { type: 'collect' }, NOW + 20_000);
  assert.deepEqual(state.resources, { water: 8, feed: 8, herbs: 0, wood: 14, stone: 8 });
  assert.equal(state.stats.gathers, 2);
  assert.equal(state.collectReadyAt, NOW + 40_000);
  assert.equal(validateGame(state), true);
});

test('a saved gathering timer remains intact and its next successful collection adopts 20 seconds', () => {
  const state = createGame(NOW);
  state.collectReadyAt = NOW + 8000;
  const before = structuredClone(state);
  assert.deepEqual(migrateGame(state), before);
  resumeGame(state, NOW + 7999);
  assert.throws(() => act(state, { type: 'collect' }), { code: 'COLLECT_COOLDOWN' });
  act(state, { type: 'collect' }, NOW + 8000);
  assert.equal(state.collectReadyAt, NOW + 28_000);
});

test('battle victories give half the repeatable material loot while guardian XP remains unchanged', () => {
  const state = createGame(NOW);
  const before = structuredClone(state);
  act(state, { type: 'startBattle' });
  advanceGame(state, NOW + 90_000);
  assert.equal(state.battle.status, 'won');
  assert.deepEqual(state.resources, {
    water: before.resources.water - 12,
    feed: before.resources.feed - 16 + 10,
    herbs: before.resources.herbs + 6,
    wood: before.resources.wood + 27,
    stone: before.resources.stone + 16,
  });
  for (const [index, wolf] of state.wolves.entries())
    assert.equal(totalXp(wolf) - totalXp(before.wolves[index]), 40);
  const paid = structuredClone(state);
  advanceGame(state, NOW + 180_000);
  assert.deepEqual(state.resources, paid.resources);
  assert.deepEqual(state.wolves, paid.wolves);
  assert.equal(state.stats.wins, 1);
  assert.equal(validateGame(state), true);
});

test('persisted version-two routes halve legacy materials and preserve their original supplies, XP, fatigue and time', () => {
  const state = createGame(NOW);
  for (const region of REGIONS) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      for (const plan of ADVENTURE_PLANS) {
        for (const kind of ['expedition', 'caravan']) {
          const choice = selection({ region: region.id, difficulty, plan, kind });
          const legacy = adventureQuote(state, choice, { economyVersion: 1 });
          const current = adventureQuote(state, choice, { economyVersion: 2 });
          assert.deepEqual(current, {
            ...legacy,
            reward: Object.fromEntries(
              Object.entries(legacy.reward).map(([key, amount]) => [key, Math.floor(amount / 2)]),
            ),
          });
        }
      }
    }
  }
});

test('new departures always persist the current economy and client legacy markers cannot increase payouts', () => {
  for (const economyVersion of [1, null, undefined, '1', 2]) {
    const state = createGame(NOW);
    const choice = selection({ economyVersion });
    const quote = adventureQuote(state, choice);
    assert.deepEqual(quote.reward, { wood: 96, stone: 60, herbs: 18 });
    depart(state, choice);
    assert.equal(state.adventure.active.economyVersion, 3);
    emptyMaterials(state);
    advanceGame(state, state.adventure.active.endsAt);
    assert.deepEqual(state.adventure.history[0].reward, {
      water: 0,
      feed: 0,
      herbs: 18,
      wood: 96,
      stone: 60,
    });
    assert.equal(state.adventure.history[0].economyVersion, 3);
    assert.equal(validateGame(state), true);
  }
});

test('legacy active missions retain promised full rewards through reload for every plan and mission kind', () => {
  for (const plan of [undefined, ...ADVENTURE_PLANS]) {
    for (const kind of ['expedition', 'caravan']) {
      const state = createGame(NOW);
      if (kind === 'caravan') state.adventure.unlocked.push('spring');
      const choice = selection({ kind });
      if (plan === undefined) delete choice.plan;
      else choice.plan = plan;
      depart(state, choice);
      delete state.adventure.active.economyVersion;
      if (plan === undefined) delete state.adventure.active.plan;
      emptyMaterials(state);
      const promised = adventureQuote(state, choice, { economyVersion: 1 });
      state.adventure.active.endsAt = NOW + promised.seconds * 1000;
      const before = structuredClone(state);
      assert.deepEqual(outingQuote(state, state.adventure.active), promised);
      assert.equal(validateGame(state), true);
      const restored = migrateGame(JSON.parse(JSON.stringify(state)));
      assert.deepEqual(restored, before);
      resumeGame(restored, state.adventure.active.endsAt);
      const receipt = restored.adventure.history[0];
      assert.deepEqual(receipt.reward, { water: 0, feed: 0, ...promised.reward });
      assert.equal(Object.hasOwn(receipt, 'economyVersion'), false);
      assert.equal(Object.hasOwn(receipt, 'plan'), plan !== undefined);
      assert.equal(receipt.xp, promised.xp);
      assert.equal(restored.inventory.leather_vest, 1);
      assert.equal(validateGame(restored), true);
      const once = structuredClone(restored);
      resumeGame(restored, restored.updatedAt + 60_000);
      assert.deepEqual(restored.resources, once.resources);
      assert.deepEqual(restored.wolves, once.wolves);
      assert.deepEqual(restored.adventure.history, once.adventure.history);
    }
  }
});

test('legacy full-value receipts remain valid beside new long-journey receipts without rewriting balances', () => {
  const state = createGame(NOW);
  depart(state, selection({ plan: 'supply' }));
  delete state.adventure.active.economyVersion;
  state.adventure.active.endsAt =
    NOW +
    adventureQuote(state, selection({ plan: 'supply' }), { economyVersion: 1 }).seconds * 1000;
  emptyMaterials(state);
  advanceGame(state, state.adventure.active.endsAt);
  const oldReceipt = structuredClone(state.adventure.history[0]);
  assert.deepEqual(oldReceipt.reward, { water: 0, feed: 0, herbs: 10, wood: 48, stone: 31 });
  const original = structuredClone(state);
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, original);
  depart(restored, selection({ plan: 'supply' }));
  advanceGame(restored, restored.adventure.active.endsAt);
  assert.deepEqual(restored.adventure.history[1], oldReceipt);
  assert.deepEqual(restored.adventure.history[0].reward, {
    water: 0,
    feed: 0,
    herbs: 27,
    wood: 144,
    stone: 90,
  });
  assert.equal(restored.adventure.history[0].economyVersion, 3);
  assert.equal(validateGame(restored), true);
});

test('invalid persisted economy markers and oversized current receipts fail strict save validation', () => {
  const state = createGame(NOW);
  depart(state, selection());
  for (const marker of [1, 2, 0, 4, null, undefined, '2', false, {}]) {
    const forged = structuredClone(state);
    forged.adventure.active.economyVersion = marker;
    assert.equal(validateGame(forged), false);
    assert.throws(() => migrateGame(forged), { code: 'INVALID_SAVE' });
  }
  advanceGame(state, state.adventure.active.endsAt);
  for (const marker of [1, 2, null, undefined, '2']) {
    const forged = structuredClone(state);
    forged.adventure.history[0].economyVersion = marker;
    assert.equal(validateGame(forged), false);
  }
  const forged = structuredClone(state);
  forged.adventure.history[0].reward.wood = 97;
  assert.equal(validateGame(forged), false);
});

test('initial stocks and building recipes remain intact while offline production keeps its eight-hour ceiling', () => {
  const state = createGame(NOW);
  assert.deepEqual(state.resources, { water: 180, feed: 180, herbs: 80, wood: 450, stone: 350 });
  assert.deepEqual(getUpgradeCost({ type: 'quarry', level: 1 }), { wood: 109, stone: 47 });
  act(state, { type: 'build', building: 'lumber', plotId: 'p0' });
  assert.equal(state.resources.wood, 390);
  assert.equal(state.resources.stone, 325);
  // Test-only capacity isolates elapsed-time capping from the storage ceiling.
  state.capacity = 1_000_000;
  const before = structuredClone(state.resources);
  advanceGame(state, NOW + 40 * 60 * 60_000);
  assert.equal(state.resources.wood, before.wood + 6 * 8 * 60);
  assert.equal(state.resources.stone, before.stone);
});
