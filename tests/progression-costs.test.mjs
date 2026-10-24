import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  advanceGame,
  migrateGame,
  validateGame,
  refundPlan,
} from '../shared/game.mjs';
import {
  createGame as createLegacyGame,
  applyAction as legacyAction,
} from '../shared/legacy-v1.mjs';
import {
  BUILDINGS,
  getConstructionCost,
  getUpgradeCost,
  getBuildingInvestment,
  getWallUpgradeCost,
  demolitionQuote,
} from '../shared/settlement.mjs';
import { getTrainingCost, getBattleCost, REFUND_RESERVE_LIMIT } from '../shared/economy.mjs';
import { adventureQuote, outingQuote } from '../shared/adventures.mjs';
import { trainingPlan } from '../shared/guardian-planning.mjs';
import { recoveryPlan } from '../shared/recovery.mjs';

const NOW = Date.UTC(2026, 9, 20, 12);
const act = (state, action) => applyAction(state, action, state.updatedAt, () => 0);
const fill = (state) => {
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
};
const empty = (state) => {
  for (const key of Object.keys(state.resources)) state.resources[key] = 0;
};
const unchanged = (state, action, code) => {
  const before = structuredClone(state);
  assert.throws(() => act(state, action), { code });
  assert.deepEqual(state, before);
};
const remove = (state, id) =>
  act(state, { type: 'demolishBuilding', id, expected: demolitionQuote(state, id).expected });
function stored(level = 5) {
  const state = createGame(NOW);
  fill(state);
  act(state, { type: 'build', building: 'storage', plotId: 'p35' });
  for (let current = 1; current < level; current++) {
    fill(state);
    act(state, { type: 'upgrade', id: 'building-storage' });
  }
  empty(state);
  assert.equal(validateGame(state), true);
  return state;
}

const BASE = {
  hall: [600, 450],
  lumber: [180, 100],
  quarry: [220, 120],
  well: [160, 90],
  pasture: [200, 120],
  healer: [320, 240],
  storage: [900, 750],
  watchtower: [500, 400],
  shelter: [420, 300],
};

test('new construction and all upgrade costs match the long-term economy independently of current recipes', () => {
  const state = createGame(NOW);
  assert.deepEqual(state.resources, { water: 180, feed: 180, herbs: 80, wood: 450, stone: 350 });
  assert.equal(state.version, 3);
  assert.deepEqual(state.refundReserve, { wood: 0, stone: 0 });
  for (const [type, [wood, stone]] of Object.entries(BASE)) {
    assert.deepEqual(getConstructionCost(state, type), { wood, stone });
    if (type === 'storage') continue;
    for (const [index, factor] of [6, 30, 150, 750].entries())
      assert.deepEqual(getUpgradeCost({ type, level: index + 1 }), {
        wood: wood * factor,
        stone: stone * factor,
      });
  }
  const storage = [
    [8000, 6000],
    [40000, 30000],
    [200000, 150000],
    [800000, 650000],
  ];
  for (const [index, [wood, stone]] of storage.entries())
    assert.deepEqual(getUpgradeCost({ type: 'storage', level: index + 1 }), { wood, stone });
  for (const [index, [wood, stone]] of [
    [1800, 1200],
    [12000, 15000],
    [100000, 120000],
    [1200000, 1500000],
  ].entries())
    assert.deepEqual(getWallUpgradeCost({ level: index + 1 }), { wood, stone });
});

test('each purchased producer copy uses its own paid ordinal while removing an earlier copy cannot rewrite history', () => {
  for (const definition of BUILDINGS.filter((entry) => entry.maxCount === 6)) {
    const state = stored();
    const [wood, stone] = BASE[definition.id];
    const copies = [];
    for (const [index, factor] of [1, 2, 3, 5, 8, 12].entries()) {
      fill(state);
      const before = { ...state.resources };
      assert.deepEqual(getConstructionCost(state, definition.id), {
        wood: wood * factor,
        stone: stone * factor,
      });
      act(state, { type: 'build', building: definition.id, plotId: `p${index}` });
      const building = state.buildings.at(-1);
      copies.push(building);
      assert.deepEqual(building.costBasis, { legacyLevels: 0, constructionOrdinal: index + 1 });
      assert.deepEqual(getBuildingInvestment(building), {
        wood: wood * factor,
        stone: stone * factor,
      });
      assert.equal(before.wood - state.resources.wood, wood * factor);
      assert.equal(before.stone - state.resources.stone, stone * factor);
    }
    empty(state);
    remove(state, copies[0].id);
    assert.deepEqual(getBuildingInvestment(copies[5]), { wood: wood * 12, stone: stone * 12 });
    fill(state);
    const before = { ...state.resources };
    act(state, { type: 'upgrade', id: copies[5].id });
    assert.equal(before.wood - state.resources.wood, wood * 6);
    assert.deepEqual(getBuildingInvestment(copies[5]), { wood: wood * 18, stone: stone * 18 });
    assert.equal(validateGame(state), true);
  }
});

test('every storage step is reachable inside the previous capacity and expensive non-storage upgrades require expansion', () => {
  const state = createGame(NOW);
  unchanged(state, { type: 'build', building: 'storage', plotId: 'p35' }, 'INSUFFICIENT_RESOURCES');
  fill(state);
  act(state, { type: 'build', building: 'storage', plotId: 'p35' });
  for (const capacity of [10000, 50000, 250000, 1000000]) {
    assert.equal(state.capacity, capacity);
    const cost = getUpgradeCost(state.buildings[0]);
    assert.ok(Object.values(cost).every((amount) => amount <= state.capacity));
    fill(state);
    act(state, { type: 'upgrade', id: 'building-storage' });
  }
  assert.equal(state.capacity, 5000000);
  assert.equal(validateGame(state), true);
  const early = createGame(NOW);
  act(early, { type: 'build', building: 'lumber', plotId: 'p0' });
  fill(early);
  unchanged(early, { type: 'upgrade', id: 'building-lumber' }, 'INSUFFICIENT_RESOURCES');
});

test('exact funding succeeds and a fractional shortage rejects authoritative construction and upgrades atomically', () => {
  const state = stored();
  state.resources.wood = 219.999;
  state.resources.stone = 120;
  unchanged(state, { type: 'build', building: 'quarry', plotId: 'p0' }, 'INSUFFICIENT_RESOURCES');
  state.resources.wood = 220;
  act(state, { type: 'build', building: 'quarry', plotId: 'p0', cost: { wood: 0, stone: 0 } });
  assert.equal(state.resources.wood, 0);
  assert.equal(state.resources.stone, 0);
  state.resources.wood = 1320;
  state.resources.stone = 719.999;
  unchanged(state, { type: 'upgrade', id: 'building-quarry', cost: {} }, 'INSUFFICIENT_RESOURCES');
  state.resources.stone = 720;
  act(state, { type: 'upgrade', id: 'building-quarry', cost: {} });
  assert.equal(state.resources.wood, 0);
  assert.equal(state.resources.stone, 0);
  assert.deepEqual(getBuildingInvestment(state.buildings.at(-1)), { wood: 1540, stone: 840 });
});

test('legacy construction and upgrade investment stays frozen after migration and only new upgrades use new prices', () => {
  const old = createLegacyGame(NOW);
  legacyAction(old, { type: 'build', building: 'quarry' }, NOW);
  legacyAction(old, { type: 'upgrade', id: 'building-quarry' }, NOW);
  const before = structuredClone(old);
  const state = migrateGame(old);
  assert.deepEqual(old, before);
  const quarry = state.buildings.find((building) => building.type === 'quarry');
  assert.deepEqual(quarry.costBasis, { legacyLevels: 2, constructionOrdinal: 1 });
  assert.deepEqual(getBuildingInvestment(quarry), { wood: 179, stone: 77 });
  assert.deepEqual(state.resources, before.resources);
  fill(state);
  act(state, { type: 'build', building: 'storage', plotId: 'p35' });
  fill(state);
  act(state, { type: 'upgrade', id: quarry.id });
  assert.deepEqual(getBuildingInvestment(quarry), { wood: 6779, stone: 3677 });
  assert.deepEqual(quarry.costBasis, { legacyLevels: 2, constructionOrdinal: 1 });
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  empty(restored);
  remove(restored, quarry.id);
  assert.equal(restored.resources.wood, 3389.5);
  assert.equal(restored.resources.stone, 1838.5);
  assert.equal(validateGame(restored), true);
});

test('demolishing a fully upgraded paid store preserves the complete half investment in a reserve and claims only available space', () => {
  const state = stored();
  const quote = demolitionQuote(state, 'building-storage');
  assert.deepEqual(quote.refund, { wood: 524450, stone: 418375 });
  assert.deepEqual(quote.credited, { wood: 1000, stone: 1000 });
  assert.deepEqual(quote.pending, { wood: 523450, stone: 417375 });
  assert.deepEqual(quote.overflow, {});
  assert.equal(quote.canDemolish, true);
  const confirmation = {
    type: 'demolishBuilding',
    id: 'building-storage',
    expected: quote.expected,
  };
  act(state, confirmation);
  assert.equal(state.capacity, 1000);
  assert.deepEqual(state.refundReserve, quote.pending);
  unchanged(state, confirmation, 'INVALID_BUILDING');
  unchanged(state, { type: 'claimRefund' }, 'REFUND_STORAGE_FULL');
  state.resources.wood -= 125.5;
  state.resources.stone -= 70;
  assert.deepEqual(refundPlan(state).credited, { wood: 125.5, stone: 70 });
  act(state, { type: 'claimRefund' });
  assert.equal(state.resources.wood, 1000);
  assert.equal(state.resources.stone, 1000);
  assert.deepEqual(state.refundReserve, { wood: 523324.5, stone: 417305 });
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  act(restored, { type: 'build', building: 'storage', plotId: 'p35' });
  act(restored, { type: 'claimRefund' });
  assert.equal(restored.resources.wood, 10000);
  assert.equal(restored.resources.stone, 10000);
  assert.deepEqual(restored.refundReserve, { wood: 513424.5, stone: 407555 });
  assert.equal(validateGame(restored), true);
});

test('refund reserve cannot be forged, overflowed or claimed twice, and existing stored assets still block storage demolition', () => {
  const state = stored(1);
  state.resources.water = 1000.001;
  const quote = demolitionQuote(state, 'building-storage');
  assert.deepEqual(quote.overflow, { water: state.resources.water - 1000 });
  unchanged(
    state,
    { type: 'demolishBuilding', id: 'building-storage', expected: quote.expected },
    'DEMOLITION_STORAGE_FULL',
  );
  empty(state);
  state.refundReserve = { wood: REFUND_RESERVE_LIMIT, stone: REFUND_RESERVE_LIMIT };
  // Existing balances fit but a pending refund must never overflow the reserve ceiling.
  state.resources.wood = 1000;
  state.resources.stone = 1000;
  unchanged(
    state,
    { type: 'demolishBuilding', id: 'building-storage', expected: quote.expected },
    'REFUND_RESERVE_FULL',
  );
  state.refundReserve = { wood: 5.5, stone: 7.25 };
  empty(state);
  unchanged(state, { type: 'claimRefund', amount: 999999 }, 'INVALID_REFUND');
  act(state, { type: 'claimRefund' });
  assert.deepEqual(state.refundReserve, { wood: 0, stone: 0 });
  assert.equal(state.resources.wood, 5.5);
  assert.equal(state.resources.stone, 7.25);
  unchanged(state, { type: 'claimRefund' }, 'REFUND_EMPTY');
});

test('strict v3 validation rejects missing or malformed economic history without downgrading it to a legacy save', () => {
  const good = stored(1);
  for (const corrupt of [
    (s) => delete s.refundReserve,
    (s) => delete s.buildings[0].costBasis,
    (s) => (s.refundReserve.wood = -1),
    (s) => (s.refundReserve.stone = REFUND_RESERVE_LIMIT + 1),
    (s) => (s.refundReserve.feed = 1),
    (s) => (s.buildings[0].costBasis.legacyLevels = 2),
    (s) => (s.buildings[0].costBasis.constructionOrdinal = 2),
    (s) => (s.buildings[0].costBasis.refund = 99999),
    (s) => (s.version = 2),
  ]) {
    const forged = structuredClone(good);
    corrupt(forged);
    const before = structuredClone(forged);
    assert.equal(validateGame(forged), false);
    assert.throws(() => migrateGame(forged), { code: 'INVALID_SAVE' });
    assert.deepEqual(forged, before);
  }
  assert.equal(migrateGame(good), good);
});

test('training ranks, wave supplies and care costs use the same authoritative quotes as execution', () => {
  const state = stored();
  const wolf = state.wolves[0];
  for (const [index, herbs] of [40, 140, 450, 1400, 4200].entries()) {
    wolf.ranks.hunter = index;
    wolf.points = 1;
    const cost = { herbs, feed: herbs * 2 };
    assert.deepEqual(getTrainingCost(wolf, 'hunter'), cost);
    assert.deepEqual(trainingPlan(state, wolf.id, 'hunter').cost, cost);
    empty(state);
    Object.assign(state.resources, cost);
    act(state, { type: 'train', id: wolf.id, path: 'hunter', cost: {} });
    assert.equal(state.resources.herbs, 0);
    assert.equal(state.resources.feed, 0);
  }
  for (const wave of [1, 2, 10, 100]) {
    state.battle.wave = wave;
    assert.deepEqual(getBattleCost(state), {
      water: 60 + 12 * (wave - 1),
      feed: 80 + 16 * (wave - 1),
    });
  }
  assert.deepEqual(recoveryPlan(state, 'rest').cost, { water: 100, feed: 125 });
  assert.deepEqual(recoveryPlan(state, 'healHerd').cost, { herbs: 15 });
});

test('new six-hour departures scale supplies by party and purpose while saved version-three promises stay intact', () => {
  const state = createGame(NOW);
  const selection = {
    kind: 'expedition',
    region: 'spring',
    difficulty: 'easy',
    wolfIds: ['wolf-scout'],
    plan: 'standard',
  };
  assert.deepEqual(adventureQuote(state, selection).cost, { water: 83, feed: 111 });
  const trio = {
    ...selection,
    wolfIds: ['wolf-scout', 'wolf-alpha', 'wolf-guardian'],
    plan: 'survey',
  };
  assert.deepEqual(adventureQuote(state, trio).cost, { water: 145, feed: 194 });
  const old = adventureQuote(state, selection, { economyVersion: 3 });
  assert.deepEqual(old.cost, { water: 18, feed: 23 });
  const current = adventureQuote(state, selection);
  assert.equal(current.seconds, old.seconds);
  assert.equal(current.xp, old.xp);
  assert.deepEqual(current.reward, old.reward);
  act(state, { type: 'expedition', ...selection });
  assert.equal(state.adventure.active.economyVersion, 4);
  const legacy = structuredClone(state);
  legacy.adventure.active.economyVersion = 3;
  assert.equal(validateGame(legacy), true);
  const promise = outingQuote(legacy, legacy.adventure.active);
  advanceGame(legacy, legacy.adventure.active.endsAt);
  assert.equal(legacy.adventure.history[0].economyVersion, 3);
  assert.equal(legacy.adventure.history[0].xp, promise.xp);
  assert.deepEqual(legacy.adventure.history[0].reward, {
    water: 0,
    feed: 0,
    herbs: 18,
    wood: 96,
    stone: 60,
  });
  assert.equal(validateGame(legacy), true);
});
