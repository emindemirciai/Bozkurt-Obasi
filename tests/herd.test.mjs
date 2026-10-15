import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, validateGame, migrateGame } from '../shared/game.mjs';
import { createGame as createLegacyGame } from '../shared/legacy-v1.mjs';
import { establishedJourney } from './established-game.mjs';
import {
  HERD_LIMIT,
  REPLENISH_BATCH_LIMIT,
  HERD_REPLENISH_COST,
  herdRecoveryPlan,
  replenishHerd,
} from '../shared/herd.mjs';

const START = 1_000_000;
function damagedHerd(count = 18) {
  const state = createGame(START);
  applyAction(state, { type: 'build', building: 'pasture', plotId: 'p0' }, START);
  state.herd = { count, hp: count * 10 - 35, maxHp: count * 10, panic: 41 };
  return state;
}
function rejectWithoutChanges(state, amount, reason) {
  const before = structuredClone(state);
  assert.equal(herdRecoveryPlan(state, amount).reason, reason);
  assert.throws(() => replenishHerd(state, amount), { code: reason, message: reason });
  assert.deepEqual(state, before);
}

test('herd recovery planning is pure, exposes exact shortages and keeps returned costs isolated', () => {
  const state = damagedHerd();
  state.resources.water = 5.5;
  state.resources.feed = 10;
  const before = structuredClone(state);
  const plan = herdRecoveryPlan(state);
  assert.deepEqual(plan, {
    amount: 1,
    maxCount: 24,
    missing: 6,
    maxAmount: 5,
    cost: { water: 6, feed: 12 },
    shortages: [
      { resource: 'water', amount: 0.5 },
      { resource: 'feed', amount: 2 },
    ],
    reason: 'INSUFFICIENT_RESOURCES',
    ready: false,
  });
  assert.deepEqual(state, before);
  plan.cost.water = 999;
  assert.equal(herdRecoveryPlan(state).cost.water, 6);
  assert.equal(Object.isFrozen(HERD_REPLENISH_COST), true);
  assert.equal(HERD_LIMIT, 24);
  assert.equal(REPLENISH_BATCH_LIMIT, 5);
});

test('a batch charges once and adds healthy animals while preserving old wounds, panic and guardian progress', () => {
  const state = damagedHerd();
  state.wolves[0].hp = 17;
  state.wolves[0].xp = 20;
  const before = structuredClone(state);
  assert.equal(herdRecoveryPlan(state, 5).ready, true);
  assert.equal(replenishHerd(state, 5), state);
  const expected = structuredClone(before);
  expected.resources.water -= 30;
  expected.resources.feed -= 60;
  expected.herd.count = 23;
  expected.herd.maxHp = 230;
  expected.herd.hp += 50;
  assert.deepEqual(state, expected);
  assert.equal(state.herd.maxHp - state.herd.hp, 35);
  assert.equal(validateGame(state), true);
});

test('the remaining herd capacity limits batches and a full herd cannot spend resources', () => {
  const state = damagedHerd(22);
  const plan = herdRecoveryPlan(state, 2);
  assert.equal(plan.maxAmount, 2);
  rejectWithoutChanges(state, 3, 'HERD_LIMIT');
  replenishHerd(state, 2);
  assert.deepEqual(state.herd, { count: 24, hp: 205, maxHp: 240, panic: 41 });
  assert.equal(herdRecoveryPlan(state).maxAmount, 0);
  rejectWithoutChanges(state, 1, 'HERD_FULL');
  assert.equal(validateGame(state), true);
});

test('a pasture is required and failure precedence stays predictable', () => {
  const state = damagedHerd(23);
  state.buildings = [];
  state.resources.water = 0;
  rejectWithoutChanges(state, 2, 'PASTURE_REQUIRED');
  state.herd.count = 24;
  state.herd.maxHp = 240;
  rejectWithoutChanges(state, 1, 'HERD_FULL');
  state.battle.status = 'active';
  rejectWithoutChanges(state, 1, 'BATTLE_ACTIVE');
  rejectWithoutChanges(state, 0, 'INVALID_REPLENISH_AMOUNT');
});

test('active battles, expeditions, escorts and migrated journeys prevent replenishment', () => {
  const battle = damagedHerd();
  applyAction(battle, { type: 'startBattle' }, START, () => 0);
  rejectWithoutChanges(battle, 1, 'BATTLE_ACTIVE');
  const expedition = damagedHerd();
  applyAction(
    expedition,
    {
      type: 'expedition',
      region: 'spring',
      difficulty: 'easy',
      wolfIds: ['wolf-scout'],
    },
    START,
  );
  rejectWithoutChanges(expedition, 1, 'JOURNEY_ACTIVE');
  const escort = damagedHerd();
  escort.adventure.unlocked.push('spring');
  applyAction(
    escort,
    {
      type: 'caravan',
      region: 'spring',
      difficulty: 'easy',
      wolfIds: ['wolf-scout'],
    },
    START,
  );
  rejectWithoutChanges(escort, 1, 'JOURNEY_ACTIVE');
  const legacy = establishedJourney(START, 'spring');
  legacy.herd = { count: 18, hp: 145, maxHp: 180, panic: 41 };
  rejectWithoutChanges(legacy, 1, 'JOURNEY_ACTIVE');
  for (const state of [battle, expedition, escort, legacy]) assert.equal(validateGame(state), true);
});

test('exact resource balances work and a shortage never deducts the other resource', () => {
  const state = damagedHerd();
  state.resources.water = 12;
  state.resources.feed = 23.999;
  rejectWithoutChanges(state, 2, 'INSUFFICIENT_RESOURCES');
  state.resources.feed = 24;
  replenishHerd(state, 2);
  assert.equal(state.resources.water, 0);
  assert.equal(state.resources.feed, 0);
  assert.equal(state.herd.count, 20);
  assert.equal(validateGame(state), true);
});

test('replenishment amounts are strict safe integers and commands never default missing amounts', () => {
  const state = damagedHerd();
  for (const amount of [
    0,
    -1,
    1.5,
    6,
    NaN,
    Infinity,
    -Infinity,
    '1',
    null,
    true,
    {},
    [],
    Number.MAX_SAFE_INTEGER,
  ]) {
    const plan = herdRecoveryPlan(state, amount);
    assert.deepEqual(plan.cost, {});
    assert.deepEqual(plan.shortages, []);
    rejectWithoutChanges(state, amount, 'INVALID_REPLENISH_AMOUNT');
  }
  const before = structuredClone(state);
  assert.throws(() => replenishHerd(state), { code: 'INVALID_REPLENISH_AMOUNT' });
  assert.throws(() => applyAction(state, { type: 'replenishHerd' }, START), {
    code: 'INVALID_REPLENISH_AMOUNT',
  });
  assert.deepEqual(state, before);
});

test('the game command records recovery without new save fields and works for migrated wounded herds', () => {
  const legacy = createLegacyGame(START);
  legacy.herd = { count: 20, hp: 123, maxHp: 200, panic: 56 };
  const original = structuredClone(legacy);
  const state = migrateGame(legacy);
  const keys = Object.keys(state);
  const wolves = structuredClone(state.wolves);
  const stats = structuredClone(state.stats);
  const quests = structuredClone(state.quests);
  const inventory = structuredClone(state.inventory);
  applyAction(state, { type: 'replenishHerd', amount: 4 }, START);
  assert.deepEqual(state.herd, { count: 24, hp: 163, maxHp: 240, panic: 56 });
  assert.deepEqual(state.log.at(-1), { key: 'herdReplenished', at: START });
  assert.deepEqual(Object.keys(state), keys);
  assert.deepEqual(state.wolves, wolves);
  assert.deepEqual(state.stats, stats);
  assert.deepEqual(state.quests, quests);
  assert.deepEqual(state.inventory, inventory);
  assert.deepEqual(legacy, original);
  assert.equal(validateGame(JSON.parse(JSON.stringify(state))), true);
});
