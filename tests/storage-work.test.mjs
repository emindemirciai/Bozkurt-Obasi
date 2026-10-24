import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  advanceGame,
  migrateGame,
  validateGame,
} from '../shared/game.mjs';
import {
  BASE_CAPACITY,
  STORAGE_CAPACITY_BONUSES,
  getStorageCapacity,
  demolitionQuote,
} from '../shared/settlement.mjs';
import { COLLECTION_TASKS, COLLECT_COOLDOWN_MS } from '../shared/economy.mjs';

import { previousSave } from './economy-fixtures.mjs';

const NOW = Date.UTC(2026, 9, 20, 12);
const act = (state, action, at = state.updatedAt) => applyAction(state, action, at, () => 0);
const fill = (state) => {
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
};
const empty = (state) => {
  for (const key of Object.keys(state.resources)) state.resources[key] = 0;
};
const buildLevel = (state, type, level, plotId) => {
  if (!level) return;
  fill(state);
  act(state, { type: 'build', building: type, plotId });
  const building = state.buildings.at(-1);
  while (building.level < level) {
    fill(state);
    act(state, { type: 'upgrade', id: building.id });
  }
};
const unchangedFailure = (state, action, code) => {
  const before = structuredClone(state);
  assert.throws(() => act(state, action), { code });
  assert.deepEqual(state, before);
};

test('paid storage levels expand each resource through 10,000, 50,000, 250,000, 1,000,000 and 5,000,000', () => {
  const state = createGame(NOW);
  assert.equal(BASE_CAPACITY, 1000);
  assert.equal(state.capacity, 1000);
  assert.deepEqual(STORAGE_CAPACITY_BONUSES, [0, 9000, 49000, 249000, 999000, 4999000]);
  fill(state);
  act(state, { type: 'build', building: 'storage', plotId: 'p0' });
  for (let level = 1; level <= 5; level++) {
    assert.equal(state.capacity, [1000, 10000, 50000, 250000, 1000000, 5000000][level]);
    assert.equal(getStorageCapacity(state), state.capacity);
    assert.equal(validateGame(state), true);
    if (level < 5) {
      fill(state);
      const before = state.capacity;
      act(state, { type: 'upgrade', id: 'building-storage', capacity: 999999 });
      assert.ok(state.capacity > before);
    }
  }
  unchangedFailure(state, { type: 'upgrade', id: 'building-storage' }, 'MAX_LEVEL');
  assert.equal(Object.isFrozen(STORAGE_CAPACITY_BONUSES), true);
});

test('every old hall/storage capacity migrates once while all existing balances and gameplay remain exact', () => {
  for (let hall = 0; hall <= 5; hall++) {
    for (let storage = 0; storage <= 5; storage++) {
      const state = previousSave(createGame(NOW));
      if (hall)
        state.buildings.push({ id: 'building-hall', type: 'hall', level: hall, x: 0, y: 0 });
      if (storage)
        state.buildings.push({
          id: 'building-storage',
          type: 'storage',
          level: storage,
          x: 1,
          y: 0,
        });
      state.capacity = 500 + Math.max(0, hall - 1) * 100 + storage * 250;
      fill(state);
      state.resources.wood -= 0.125;
      state.collectReadyAt = NOW + 20_000;
      assert.equal(validateGame(state), false);
      const before = structuredClone(state);
      const migrated = migrateGame(JSON.parse(JSON.stringify(state)));
      assert.deepEqual(state, before);
      assert.deepEqual(previousSave(migrated), { ...before, capacity: getStorageCapacity(state) });
      assert.ok(
        migrated.buildings.every((building) => building.costBasis.legacyLevels === building.level),
      );
      assert.equal(validateGame(migrated), true);
      assert.equal(migrateGame(migrated), migrated);
      assert.deepEqual(migrateGame(JSON.parse(JSON.stringify(migrated))), migrated);
    }
  }
});

test('capacity migration rejects forged bounds, overfilled legacy saves and malformed structures without mutation', () => {
  const old = createGame(NOW);
  old.capacity = 500;
  for (const change of [
    (s) => {
      s.capacity = 501;
    },
    (s) => {
      s.capacity = 999;
    },
    (s) => {
      s.capacity = BASE_CAPACITY + STORAGE_CAPACITY_BONUSES.at(-1) + 401;
    },
    (s) => {
      s.capacity = NaN;
    },
    (s) => {
      s.resources.wood = 500.001;
    },
    (s) => {
      s.buildings.push({ id: 'building-storage', type: 'storage', level: 6, x: 0, y: 0 });
    },
    (s) => {
      s.resources.stone = -1;
    },
  ]) {
    const forged = structuredClone(old);
    change(forged);
    const before = structuredClone(forged);
    assert.equal(validateGame(forged), false);
    assert.throws(() => migrateGame(forged), { code: 'INVALID_SAVE' });
    assert.deepEqual(forged, before);
  }
});

test('expanded storage demolition refuses every overflowing resource and removes only its own level contribution', () => {
  for (let level = 1; level <= 5; level++) {
    const state = createGame(NOW);
    state.buildings.push({
      id: 'building-hall',
      type: 'hall',
      level: 5,
      x: 1,
      y: 0,
      costBasis: { legacyLevels: 5, constructionOrdinal: 1 },
    });
    state.capacity = 1400;
    buildLevel(state, 'storage', level, 'p0');
    empty(state);
    const quote = demolitionQuote(state, 'building-storage');
    assert.equal(quote.capacityBefore, 1400 + STORAGE_CAPACITY_BONUSES[level]);
    assert.equal(quote.capacityAfter, 1400);
    for (const key of Object.keys(state.resources)) {
      const crowded = structuredClone(state);
      crowded.resources[key] = quote.capacityAfter + 0.125;
      unchangedFailure(
        crowded,
        { type: 'demolishBuilding', id: 'building-storage', expected: quote.expected },
        'DEMOLITION_STORAGE_FULL',
      );
    }
    act(state, { type: 'demolishBuilding', id: 'building-storage', expected: quote.expected });
    assert.equal(state.capacity, 1400);
    assert.equal(state.resources.wood + state.refundReserve.wood, quote.refund.wood);
    assert.equal(state.resources.stone + state.refundReserve.stone, quote.refund.stone);
    assert.equal(validateGame(state), true);
  }
});

test('all active work choices credit only their authoritative recipe and share one ninety-second clock', () => {
  assert.equal(COLLECT_COOLDOWN_MS, 90_000);
  assert.deepEqual(
    COLLECTION_TASKS.map((task) => task.id),
    ['mixed', 'wood', 'stone', 'water', 'feed', 'herbs'],
  );
  const expected = [
    { wood: 3, stone: 2, water: 2, feed: 2 },
    { wood: 10 },
    { stone: 7 },
    { water: 8 },
    { feed: 8 },
    { herbs: 2 },
  ];
  for (const [index, task] of COLLECTION_TASKS.entries()) {
    assert.equal(Object.isFrozen(task.reward), true);
    const state = createGame(NOW);
    empty(state);
    act(state, { type: 'collect', resource: task.id, reward: { wood: 999999 }, cooldown: 0 });
    assert.deepEqual(state.resources, {
      water: 0,
      feed: 0,
      herbs: 0,
      wood: 0,
      stone: 0,
      ...expected[index],
    });
    assert.equal(state.collectReadyAt, NOW + 90_000);
    assert.equal(state.stats.gathers, 1);
    for (const next of COLLECTION_TASKS)
      unchangedFailure(state, { type: 'collect', resource: next.id }, 'COLLECT_COOLDOWN');
    const restored = migrateGame(JSON.parse(JSON.stringify(state)));
    assert.throws(() => act(restored, { type: 'collect', resource: task.id }, NOW + 89_999), {
      code: 'COLLECT_COOLDOWN',
    });
    act(restored, { type: 'collect', resource: task.id }, NOW + 90_000);
    assert.equal(restored.stats.gathers, 2);
    assert.equal(restored.collectReadyAt, NOW + 180_000);
    assert.equal(validateGame(restored), true);
  }
});

test('explicit invalid work selections never become mixed work or charge a timer', () => {
  const state = createGame(NOW);
  for (const resource of [null, undefined, '', 'WOOD', 'unknown', '__proto__', 0, false, {}, []])
    unchangedFailure(state, { type: 'collect', resource }, 'INVALID_COLLECTION');
  const before = structuredClone(state.resources);
  act(state, { type: 'collect' });
  assert.deepEqual(state.resources, {
    ...before,
    wood: before.wood + 3,
    stone: before.stone + 2,
    water: before.water + 2,
    feed: before.feed + 2,
  });
});

test('fully stocked work is rejected without consuming a cooldown, objective or gather count', () => {
  for (const task of COLLECTION_TASKS) {
    const state = createGame(NOW);
    for (const key of Object.keys(task.reward)) state.resources[key] = state.capacity;
    unchangedFailure(state, { type: 'collect', resource: task.id }, 'COLLECT_STORAGE_FULL');
    assert.equal(state.stats.gathers, 0);
    assert.equal(state.firstWatch.milestones.gather, null);
  }
});

test('partly full work credits only remaining capacity and starts the cooldown once', () => {
  const state = createGame(NOW);
  fill(state);
  state.resources.wood -= 0.25;
  act(state, { type: 'collect', resource: 'mixed' });
  for (const key of Object.keys(state.resources))
    assert.equal(state.resources[key], state.capacity);
  assert.equal(state.stats.gathers, 1);
  assert.equal(state.collectReadyAt, NOW + 90_000);
  assert.equal(validateGame(state), true);
});

test('a village with no buildings or supplies can earn the first producer through free focused work', () => {
  const state = createGame(NOW);
  empty(state);
  for (const resource of [...Array(18).fill('wood'), ...Array(15).fill('stone')])
    act(state, { type: 'collect', resource }, state.collectReadyAt);
  assert.equal(state.resources.wood, 180);
  assert.equal(state.resources.stone, 105);
  act(state, { type: 'build', building: 'lumber', plotId: 'p0' });
  assert.equal(state.resources.wood, 0);
  assert.equal(state.resources.stone, 5);
  const before = state.updatedAt;
  advanceGame(state, before + 60_000);
  assert.equal(state.resources.wood, 0.6);
  assert.equal(validateGame(state), true);
});

test('fully developed producers cannot fill mature stores during one offline allowance', () => {
  const state = createGame(NOW);
  buildLevel(state, 'storage', 5, 'p35');
  for (let index = 0; index < 6; index++) buildLevel(state, 'lumber', 5, 'p' + index);
  empty(state);
  advanceGame(state, NOW + 40 * 3_600_000);
  assert.equal(state.resources.wood, 8640);
  assert.equal(state.capacity, 5000000);
  assert.ok(state.resources.wood < state.capacity / 4);
  assert.equal(validateGame(state), true);
});

test('work cannot create a cooldown beyond the valid server-clock range', () => {
  const state = createGame(8_640_000_000_000_000);
  unchangedFailure(state, { type: 'collect', resource: 'wood' }, 'INVALID_CLOCK');
});
