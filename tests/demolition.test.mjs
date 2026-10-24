import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  advanceGame,
  getProduction,
  getUpgradeCost,
  migrateGame,
  validateGame,
} from '../shared/game.mjs';
import {
  createGame as createLegacyGame,
  applyAction as legacyAction,
} from '../shared/legacy-v1.mjs';
import {
  BUILDINGS,
  demolitionQuote,
  demolishBuilding,
  STORAGE_CAPACITY_BONUSES,
} from '../shared/settlement.mjs';

import { fundedGame } from './economy-fixtures.mjs';

const START = 1_000_000;
const act = (state, action) => applyAction(state, action, state.updatedAt, () => 0);
const refill = (state) => {
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
};
const clearResources = (state) => {
  for (const key of Object.keys(state.resources)) state.resources[key] = 0;
};
const buildToLevel = (state, type, level, plotId) => {
  refill(state);
  const before = { ...state.resources };
  act(state, { type: 'build', building: type, plotId });
  const building = state.buildings.find((entry) => entry.type === type);
  const paid = {
    wood: before.wood - state.resources.wood,
    stone: before.stone - state.resources.stone,
  };
  while (building.level < level) {
    refill(state);
    const balance = { ...state.resources };
    act(state, { type: 'upgrade', id: building.id });
    paid.wood += balance.wood - state.resources.wood;
    paid.stone += balance.stone - state.resources.stone;
  }
  return { building, paid };
};
const supported = (type = 'quarry', level = 1) => {
  const state = createGame(START);
  if (type === 'storage') {
    // A retained, previously paid hall supplies capacity without adding a second store.
    state.buildings.push({
      id: 'building-hall',
      type: 'hall',
      level: 5,
      x: 5,
      y: 5,
      costBasis: { legacyLevels: 5, constructionOrdinal: 1 },
    });
    state.capacity = 1400;
  } else buildToLevel(state, 'storage', 5, 'p35');
  const result = buildToLevel(state, type, level, type === 'watchtower' ? 't0' : 'p0');
  clearResources(state);
  assert.equal(validateGame(state), true);
  return { state, ...result };
};
const actionFor = (state, id) => ({
  type: 'demolishBuilding',
  id,
  expected: demolitionQuote(state, id).expected,
});
const unchangedFailure = (state, action, code) => {
  const before = structuredClone(state);
  assert.throws(() => act(state, action), { code });
  assert.deepEqual(state, before);
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

test('every building at every level refunds exactly half of all resources actually charged', () => {
  for (const definition of BUILDINGS) {
    for (let level = 1; level <= 5; level += 1) {
      const { state, building, paid } = supported(definition.id, level);
      const quote = demolitionQuote(state, building.id);
      assert.deepEqual(quote.investment, paid, definition.id + ' level ' + level);
      assert.deepEqual(quote.refund, { wood: paid.wood / 2, stone: paid.stone / 2 });
      assert.equal(quote.canDemolish, true);
      const beforeCapacity = state.capacity;
      act(state, actionFor(state, building.id));
      assert.equal(state.resources.wood + state.refundReserve.wood, paid.wood / 2);
      assert.equal(state.resources.stone + state.refundReserve.stone, paid.stone / 2);
      assert.equal(
        state.buildings.some((entry) => entry.id === building.id),
        false,
      );
      const capacityRemoved =
        definition.id === 'storage'
          ? STORAGE_CAPACITY_BONUSES[level]
          : definition.id === 'hall'
            ? (level - 1) * 100
            : 0;
      assert.equal(state.capacity, beforeCapacity - capacityRemoved);
      assert.equal(validateGame(JSON.parse(JSON.stringify(state))), true);
    }
  }
});

test('known upgrade recipes accumulate once and retain fractional half refunds', () => {
  const { state, building } = supported('quarry', 3);
  assert.deepEqual(getUpgradeCost({ type: 'quarry', level: 1 }), { wood: 1320, stone: 720 });
  assert.deepEqual(demolitionQuote(state, building.id).investment, { wood: 8140, stone: 4440 });
  act(state, actionFor(state, building.id));
  assert.equal(state.resources.wood, 4070);
  assert.equal(state.resources.stone, 2220);
  const well = supported('well', 1);
  well.state.resources.wood = 0.123456789;
  act(well.state, actionFor(well.state, well.building.id));
  assert.equal(well.state.resources.wood, 80.123456789);
  assert.equal(well.state.resources.stone, 45);
});

test('a quote is pure on frozen state and returns independent building and snapshot copies', () => {
  const { state, building } = supported('well', 2);
  const before = structuredClone(state);
  freeze(state);
  const quote = demolitionQuote(state, building.id);
  assert.deepEqual(state, before);
  assert.notEqual(quote.building, building);
  quote.building.level = 5;
  quote.expected.x = 4;
  quote.refund.wood = 99999;
  assert.equal(building.level, 2);
  assert.equal(building.x, 0);
  assert.deepEqual(demolitionQuote(state, building.id).expected, {
    type: 'well',
    level: 2,
    x: 0,
    y: 0,
    builds: state.stats.builds,
  });
});

test('only the selected producer is removed and its plot and building-count slot become reusable', () => {
  const state = fundedGame(START, 1);
  for (let index = 0; index < 6; index += 1) {
    refill(state);
    act(state, { type: 'build', building: 'lumber', plotId: 'p' + index });
  }
  clearResources(state);
  const selected = state.buildings.filter((building) => building.type === 'lumber')[2];
  const retained = state.buildings.filter((entry) => entry.id !== selected.id);
  const historicalBuilds = state.stats.builds;
  const chapter = structuredClone(state.firstWatch);
  const quests = structuredClone(state.quests);
  const rates = getProduction(state);
  act(state, actionFor(state, selected.id));
  assert.deepEqual(state.buildings, retained);
  assert.equal(state.buildings[0], retained[0]);
  assert.equal(getProduction(state).wood, rates.wood - 0.6);
  assert.equal(state.stats.builds, historicalBuilds);
  assert.deepEqual(state.firstWatch, chapter);
  assert.deepEqual(state.quests, quests);
  assert.equal(state.log.at(-1).key, 'buildingDemolished');
  refill(state);
  act(state, { type: 'build', building: 'lumber', plotId: 'p2' });
  assert.equal(state.buildings.length, 7);
  assert.equal(state.buildings.at(-1).id, selected.id);
  assert.equal(state.stats.builds, historicalBuilds + 1);
  assert.equal(validateGame(state), true);
});

test('demolition rejects overflow atomically for each of the five stored resources', () => {
  for (const key of ['water', 'feed', 'herbs', 'wood', 'stone']) {
    const { state, building } = supported('storage', 1);
    const quote = demolitionQuote(state, building.id);
    state.resources[key] = quote.capacityAfter + 1;
    const blocked = demolitionQuote(state, building.id);
    assert.equal(blocked.reason, 'DEMOLITION_STORAGE_FULL');
    assert.deepEqual(blocked.overflow, { [key]: 1 });
    unchangedFailure(state, actionFor(state, building.id), 'DEMOLITION_STORAGE_FULL');
  }
});

test('storage reduction accepts the exact post-removal capacity boundary without truncating any resource', () => {
  const { state, building } = supported('storage', 1);
  const quote = demolitionQuote(state, building.id);
  for (const key of Object.keys(state.resources))
    state.resources[key] = quote.capacityAfter - (quote.refund[key] || 0);
  assert.equal(demolitionQuote(state, building.id).canDemolish, true);
  act(state, actionFor(state, building.id));
  assert.equal(state.capacity, 1400);
  assert.deepEqual(state.resources, {
    water: 1400,
    feed: 1400,
    herbs: 1400,
    wood: 1400,
    stone: 1400,
  });
  assert.equal(validateGame(state), true);
});

test('sub-micro resource overflow is rejected instead of rounded away or silently discarded', () => {
  const { state, building } = supported('storage', 1);
  const quote = demolitionQuote(state, building.id);
  state.resources.wood = quote.capacityAfter + 0.00000001;
  assert.equal(demolitionQuote(state, building.id).overflow.wood > 0, true);
  unchangedFailure(state, actionFor(state, building.id), 'DEMOLITION_STORAGE_FULL');
});

test('a normal building queues the refund instead of blocking when unchanged storage is full', () => {
  const { state, building } = supported('well', 1);
  state.resources.wood = state.capacity;
  const quote = demolitionQuote(state, building.id);
  assert.equal(quote.capacityBefore, quote.capacityAfter);
  assert.deepEqual(quote.overflow, {});
  assert.equal(quote.pending.wood, 80);
  act(state, actionFor(state, building.id));
  assert.equal(state.resources.wood, state.capacity);
  assert.equal(state.refundReserve.wood, 80);
});

test('confirmation snapshots reject moves, upgrades, different targets and intervening construction', () => {
  for (const change of ['move', 'upgrade', 'build']) {
    const { state, building } = supported('quarry', 1);
    const confirmed = actionFor(state, building.id);
    refill(state);
    if (change === 'move') act(state, { type: 'moveBuilding', id: building.id, plotId: 'p1' });
    if (change === 'upgrade') act(state, { type: 'upgrade', id: building.id });
    if (change === 'build') act(state, { type: 'build', building: 'well', plotId: 'p1' });
    clearResources(state);
    unchangedFailure(state, confirmed, 'BUILDING_CHANGED');
  }
  const { state, building } = supported('quarry', 1);
  const confirmed = actionFor(state, building.id);
  confirmed.expected.type = 'well';
  unchangedFailure(state, confirmed, 'BUILDING_CHANGED');
});

test('a confirmed building can be demolished once and cannot remove a later same-id replacement', () => {
  const { state, building } = supported('quarry', 1);
  const confirmed = actionFor(state, building.id);
  act(state, confirmed);
  unchangedFailure(state, confirmed, 'INVALID_BUILDING');
  refill(state);
  act(state, { type: 'build', building: 'quarry', plotId: 'p0' });
  clearResources(state);
  assert.equal(state.buildings.at(-1).id, confirmed.id);
  unchangedFailure(state, confirmed, 'BUILDING_CHANGED');
  act(state, actionFor(state, confirmed.id));
  assert.equal(state.resources.wood, 110);
});

test('client-provided refunds, extra fields and malformed snapshots are rejected atomically', () => {
  const { state, building } = supported('quarry', 1);
  const good = actionFor(state, building.id);
  const invalid = [
    { ...good, refund: { wood: 10000 } },
    { ...good, expected: { ...good.expected, capacity: state.capacity } },
    { type: good.type, id: good.id },
    { ...good, expected: null },
    { ...good, expected: { ...good.expected, level: '1' } },
    { ...good, expected: { ...good.expected, level: 0 } },
    { ...good, expected: { ...good.expected, x: 6 } },
    { ...good, expected: { ...good.expected, y: -1 } },
    { ...good, expected: { ...good.expected, builds: NaN } },
    { ...good, expected: { ...good.expected, builds: -1 } },
    { ...good, expected: { ...good.expected, type: '__proto__' } },
  ];
  for (const action of invalid) unchangedFailure(state, action, 'INVALID_DEMOLITION');
  unchangedFailure(
    state,
    { type: 'demolishBuilding', expected: good.expected },
    'INVALID_BUILDING',
  );
  unchangedFailure(state, { ...good, id: 'building-missing' }, 'INVALID_BUILDING');
  const before = structuredClone(state);
  assert.throws(() => demolishBuilding(state, { ...good, type: 'build' }), {
    code: 'INVALID_DEMOLITION',
  });
  assert.deepEqual(state, before);
});

test('active combat blocks both the quote and the confirmed action', () => {
  const { state, building } = supported('quarry', 1);
  const confirmed = actionFor(state, building.id);
  refill(state);
  act(state, { type: 'startBattle' });
  assert.equal(demolitionQuote(state, building.id).reason, 'BATTLE_ACTIVE');
  unchangedFailure(state, confirmed, 'BATTLE_ACTIVE');
});

test('expeditions and caravans block removal until the assigned wolves have returned', () => {
  for (const kind of ['expedition', 'caravan']) {
    const { state, building } = supported('well', 1);
    refill(state);
    act(state, {
      type: 'expedition',
      region: 'spring',
      difficulty: 'easy',
      wolfIds: ['wolf-scout'],
    });
    if (kind === 'caravan') {
      advanceGame(state, state.adventure.active.endsAt);
      act(state, {
        type: 'caravan',
        region: 'spring',
        difficulty: 'easy',
        wolfIds: ['wolf-scout'],
      });
    }
    const confirmed = actionFor(state, building.id);
    assert.equal(demolitionQuote(state, building.id).reason, 'JOURNEY_ACTIVE');
    unchangedFailure(state, confirmed, 'JOURNEY_ACTIVE');
    advanceGame(state, state.adventure.active.endsAt);
    clearResources(state);
    act(state, confirmed);
    assert.equal(validateGame(state), true);
  }
});

test('legacy villages retain their assets and journey lock without requiring a save migration', () => {
  const legacy = createLegacyGame(START);
  legacyAction(legacy, { type: 'build', building: 'quarry' }, START);
  legacyAction(legacy, { type: 'travel', destination: 'spring' }, START);
  const before = structuredClone(legacy);
  const state = migrateGame(legacy);
  assert.deepEqual(legacy, before);
  const id = state.buildings.find((building) => building.type === 'quarry').id;
  const confirmed = actionFor(state, id);
  unchangedFailure(state, confirmed, 'JOURNEY_ACTIVE');
  advanceGame(state, state.journey.endsAt);
  clearResources(state);
  act(state, confirmed);
  assert.equal(state.resources.wood, 35);
  assert.equal(state.resources.stone, 15);
  assert.equal(validateGame(state), true);
  assert.equal(migrateGame(state), state);
});

test('repeat building and demolition always consumes half the recipe and never rewinds progress', () => {
  const state = createGame(START);
  refill(state);
  const original = { ...state.resources };
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    act(state, { type: 'build', building: 'quarry', plotId: 'p0' });
    act(state, actionFor(state, 'building-quarry'));
    assert.equal(state.resources.wood, original.wood - cycle * 110);
    assert.equal(state.resources.stone, original.stone - cycle * 60);
    assert.equal(state.stats.builds, cycle);
    assert.equal(state.quests.find((quest) => quest.id === 'first_build').progress, 1);
    assert.equal(validateGame(state), true);
  }
});
