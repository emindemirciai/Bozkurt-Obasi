import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction } from '../shared/game.mjs';
import {
  createConstructionGoal,
  validateConstructionGoal,
  constructionGoalStatus,
  createConstructionGoalTracker,
} from '../web/construction-goal.mjs';
import { fillResources, fundStorage } from './economy-fixtures.mjs';

const NOW = Date.UTC(2026, 9, 24, 9);
const fresh = () => createGame(NOW);
const act = (state, action) => applyAction(state, action, state.updatedAt);
const freeze = (value) => {
  for (const nested of Object.values(value))
    if (nested && typeof nested === 'object') freeze(nested);
  return Object.freeze(value);
};
const goalKey = (code) => 'bozkurt-obasi:construction-goal:v1:' + encodeURIComponent(code);
function memoryStore() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
function quarryCopies() {
  const state = fundStorage(fresh());
  act(state, { type: 'build', building: 'quarry', plotId: 'p0' });
  fillResources(state);
  act(state, { type: 'build', building: 'quarry', plotId: 'p1' });
  fillResources(state);
  return state;
}

test('pinning valid unfunded next steps is read-only and never silently falls back from invalid selection', () => {
  const state = freeze(fresh());
  assert.deepEqual(createConstructionGoal(state, 'storage'), {
    version: 1,
    mode: 'build',
    type: 'storage',
    buildingId: null,
    level: 1,
    count: 1,
  });
  assert.deepEqual(createConstructionGoal(state, 'new:quarry'), {
    version: 1,
    mode: 'build',
    type: 'quarry',
    buildingId: null,
    level: 1,
    count: 1,
  });
  for (const selection of [
    undefined,
    null,
    {},
    'unknown',
    'new:unknown',
    'building:building-hall-2',
    'building:building-quarry-7',
  ])
    assert.equal(createConstructionGoal(state, selection), null);
  assert.equal(state.stats.builds, 0);
  assert.deepEqual(state.resources, { water: 180, feed: 180, herbs: 80, wood: 450, stone: 350 });
});

test('strict goal validation rejects malformed keys, cross-type IDs and impossible level/count combinations', () => {
  const build = createConstructionGoal(fresh(), 'quarry');
  const upgrade = {
    version: 1,
    mode: 'upgrade',
    type: 'quarry',
    buildingId: 'building-quarry-6',
    level: 5,
    count: 1,
  };
  assert.equal(validateConstructionGoal(build), true);
  assert.equal(validateConstructionGoal(upgrade), true);
  assert.equal(validateConstructionGoal({ ...build, [Symbol('hidden')]: true }), false);
  assert.equal(
    validateConstructionGoal(Object.defineProperty({ ...build }, 'hidden', { value: true })),
    false,
  );
  for (const invalid of [
    null,
    [],
    {},
    { ...build, extra: true },
    { ...build, version: 2 },
    { ...build, mode: 'demolish' },
    { ...build, type: 'unknown' },
    { ...build, count: 0 },
    { ...build, count: 7 },
    { ...build, count: 1.5 },
    { ...build, count: Infinity },
    { ...build, level: 2 },
    { ...build, buildingId: 'building-quarry' },
    { ...upgrade, buildingId: null },
    { ...upgrade, buildingId: 'building-lumber' },
    { ...upgrade, level: 1 },
    { ...upgrade, level: 6 },
    { ...upgrade, level: NaN },
    { ...upgrade, count: 2 },
    { ...upgrade, type: 'watchtower', buildingId: 'building-watchtower-5' },
    Object.assign(Object.create({ inherited: true }), build),
  ])
    assert.equal(validateConstructionGoal(invalid), false);
});

test('upgrade goals bind the selected copy and stop at their frozen target level', () => {
  const state = quarryCopies();
  const goal = createConstructionGoal(state, 'building:building-quarry-2');
  assert.deepEqual(goal, {
    version: 1,
    mode: 'upgrade',
    type: 'quarry',
    buildingId: 'building-quarry-2',
    level: 2,
    count: 1,
  });
  const before = structuredClone(state);
  const ready = constructionGoalStatus(freeze(structuredClone(state)), goal);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.plan.buildingId, 'building-quarry-2');
  assert.deepEqual(ready.plan.cost, { wood: 1320, stone: 720 });
  assert.deepEqual(state, before);
  act(state, { type: 'upgrade', id: 'building-quarry' });
  assert.equal(constructionGoalStatus(state, goal).status, 'ready');
  act(state, { type: 'upgrade', id: 'building-quarry-2' });
  assert.equal(constructionGoalStatus(state, goal).status, 'completed');
  assert.equal(constructionGoalStatus(state, goal).plan, null);
  fillResources(state);
  act(state, { type: 'upgrade', id: 'building-quarry-2' });
  assert.equal(constructionGoalStatus(state, goal).goal.level, 2);
});

test('removal and a lower-level rebuild cannot redirect a pinned upgrade to another copy', () => {
  const state = quarryCopies();
  act(state, { type: 'upgrade', id: 'building-quarry-2' });
  const goal = createConstructionGoal(state, 'building:building-quarry-2');
  assert.equal(goal.level, 3);
  state.buildings = state.buildings.filter((building) => building.id !== goal.buildingId);
  const missing = constructionGoalStatus(state, goal);
  assert.equal(missing.status, 'missing');
  assert.equal(missing.plan, null);
  assert.deepEqual(missing.progress, { current: 0, target: 3 });
  fillResources(state);
  act(state, { type: 'build', building: 'quarry', plotId: 'p1' });
  const changed = constructionGoalStatus(state, goal);
  assert.equal(changed.status, 'changed');
  assert.equal(changed.plan, null);
  assert.deepEqual(changed.progress, { current: 1, target: 3 });
});

test('new-copy goals keep their owned-count target and current recipe, then complete without selecting another build', () => {
  const state = quarryCopies();
  const goal = createConstructionGoal(state, 'new:quarry');
  assert.equal(goal.count, 3);
  assert.deepEqual(constructionGoalStatus(state, goal).plan.cost, { wood: 660, stone: 360 });
  act(state, { type: 'build', building: 'quarry', plotId: 'p2' });
  const complete = constructionGoalStatus(state, goal);
  assert.equal(complete.status, 'completed');
  assert.equal(complete.plan, null);
  assert.equal(complete.goal.count, 3);
  state.buildings = state.buildings.filter((building) => building.type !== 'quarry');
  assert.equal(constructionGoalStatus(state, goal).status, 'changed');
  assert.equal(constructionGoalStatus(state, goal).plan, null);
});

test('shortages, capacity and combat keep a goal active while exact funding enables readiness', () => {
  const state = fresh();
  const storage = createConstructionGoal(state, 'storage');
  assert.equal(constructionGoalStatus(state, storage).status, 'active');
  state.resources.wood = 900;
  state.resources.stone = 750;
  assert.equal(constructionGoalStatus(state, storage).status, 'ready');
  state.battle.status = 'active';
  assert.equal(constructionGoalStatus(state, storage).status, 'active');
  state.battle.status = 'preparing';
  act(state, { type: 'build', building: 'lumber', plotId: 'p0' });
  const lumber = createConstructionGoal(state, 'lumber');
  assert.equal(constructionGoalStatus(state, lumber).plan.blocked, 'capacity');
  assert.equal(constructionGoalStatus(state, lumber).status, 'active');
});

test('maximum levels, maximum counts and vanished targets cannot replace a prior valid pin', () => {
  const state = quarryCopies();
  const storage = memoryStore();
  const tracker = createConstructionGoalTracker({ storage });
  tracker.activate('alfa#3131');
  const previous = tracker.pin(state, 'new:lumber');
  assert.equal(tracker.pin(state, 'building:building-quarry-3'), null);
  const first = state.buildings.find((building) => building.id === 'building-quarry');
  while (first.level < 5) {
    fillResources(state);
    act(state, { type: 'upgrade', id: first.id });
  }
  assert.equal(tracker.pin(state, 'quarry'), null);
  for (let index = 2; index < 6; index++) {
    fillResources(state);
    act(state, { type: 'build', building: 'quarry', plotId: `p${index}` });
  }
  assert.equal(tracker.pin(state, 'new:quarry'), null);
  assert.deepEqual(tracker.get(), previous);
});

test('account-scoped pins survive reload, remain isolated and contain only bounded planning data', () => {
  const storage = memoryStore();
  const tracker = createConstructionGoalTracker({ storage });
  const a = 'alfa#3131',
    b = 'izci#424242';
  assert.equal(tracker.pin(fresh(), 'storage'), null);
  assert.equal(tracker.activate(a), null);
  const aGoal = tracker.pin(fresh(), 'storage');
  assert.deepEqual(JSON.parse(storage.values.get(goalKey(a))), { version: 1, goal: aGoal });
  assert.equal(tracker.activate(b), null);
  const bGoal = tracker.pin(fresh(), 'quarry');
  assert.deepEqual(tracker.activate(a), aGoal);
  const reloaded = createConstructionGoalTracker({ storage });
  assert.deepEqual(reloaded.activate(b), bGoal);
  assert.deepEqual(reloaded.activate(a), aGoal);
  assert.equal(storage.values.size, 2);
});

test('returned copies cannot mutate an active or saved goal and clear persists only for its current account', () => {
  const storage = memoryStore();
  const tracker = createConstructionGoalTracker({ storage });
  tracker.activate('alfa#3131');
  const pinned = tracker.pin(fresh(), 'storage');
  pinned.type = 'quarry';
  const fetched = tracker.get();
  fetched.level = 5;
  assert.equal(tracker.get().type, 'storage');
  assert.equal(tracker.get().level, 1);
  tracker.activate('izci#4242');
  tracker.pin(fresh(), 'quarry');
  tracker.clear();
  assert.equal(createConstructionGoalTracker({ storage }).activate('izci#4242'), null);
  assert.equal(tracker.activate('alfa#3131').type, 'storage');
  tracker.activate(null);
  tracker.clear();
  assert.equal(JSON.parse(storage.values.get(goalKey('alfa#3131'))).goal.type, 'storage');
});

test('private browsing and quota failures keep the active goal in memory without throwing or leaking it to another account', () => {
  const storage = {
    getItem() {
      throw Error('denied');
    },
    setItem() {
      throw Error('quota');
    },
  };
  const tracker = createConstructionGoalTracker({ storage });
  assert.equal(tracker.activate('alfa#3131'), null);
  const goal = tracker.pin(fresh(), 'storage');
  assert.deepEqual(tracker.get(), goal);
  assert.deepEqual(tracker.activate('alfa#3131'), goal);
  assert.equal(tracker.activate('izci#4242'), null);
  assert.equal(tracker.activate('alfa#3131'), null);
  assert.equal(tracker.clear(), null);
  assert.equal(createConstructionGoalTracker().activate('alfa#3131'), null);
});

test('untrusted saved records and invalid account identifiers are ignored without using email or arbitrary storage keys', () => {
  const storage = memoryStore();
  const goal = createConstructionGoal(fresh(), 'storage');
  const key = goalKey('alfa#3131');
  const load = (raw) => {
    storage.values.set(key, raw);
    return createConstructionGoalTracker({ storage }).activate('alfa#3131');
  };
  for (const raw of [
    '{',
    'null',
    '[]',
    'x'.repeat(2049),
    JSON.stringify(goal),
    JSON.stringify({ version: 2, goal }),
    JSON.stringify({ version: 1, goal, secret: 'ignored' }),
    JSON.stringify({ version: 1, goal: { ...goal, count: 99 } }),
  ])
    assert.equal(load(raw), null);
  assert.deepEqual(load(JSON.stringify({ version: 1, goal })), goal);
  const tracker = createConstructionGoalTracker({ storage });
  tracker.activate('alfa#3131');
  for (const account of [
    null,
    undefined,
    '',
    'person@example.com',
    '../alfa#3131',
    'Alfa#3131',
    'alfa#0000',
    'a'.repeat(21) + '#3131',
    'alfa#12345',
  ]) {
    assert.equal(tracker.activate(account), null);
    assert.equal(tracker.get(), null);
    assert.equal(tracker.pin(fresh(), 'storage'), null);
  }
  assert.equal(storage.values.size, 1);
});
