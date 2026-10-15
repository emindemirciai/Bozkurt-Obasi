import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, RESOURCE_KEYS, applyAction } from '../shared/game.mjs';
import { establishedGame, establishedJourney } from './established-game.mjs';
import { constructionPlan, resourceOutlook } from '../web/planning.mjs';

const START = 1_000_000;
const fresh = () => establishedGame(START);
const act = (state, action) => applyAction(state, action, state.updatedAt);
const row = (plan, key) => plan.deficits.find((deficit) => deficit.key === key);

function freeze(value) {
  for (const nested of Object.values(value))
    if (nested && typeof nested === 'object') freeze(nested);
  return Object.freeze(value);
}

test('resource outlook uses the saved amounts, rates and order without assuming passive stone or herbs', () => {
  const state = fresh();
  const outlook = resourceOutlook(state);
  assert.deepEqual(
    outlook.map((resource) => resource.key),
    RESOURCE_KEYS,
  );
  assert.deepEqual(outlook, [
    { key: 'water', amount: 180, capacity: 500, rate: 14, isFull: false, fullInSeconds: 1372 },
    { key: 'feed', amount: 180, capacity: 500, rate: 12, isFull: false, fullInSeconds: 1600 },
    { key: 'herbs', amount: 80, capacity: 500, rate: 0, isFull: false, fullInSeconds: null },
    { key: 'wood', amount: 210, capacity: 500, rate: 12, isFull: false, fullInSeconds: 1450 },
    { key: 'stone', amount: 150, capacity: 500, rate: 0, isFull: false, fullInSeconds: null },
  ]);
});

test('full stores have a zero ETA even without passive production and fractional shortages round up', () => {
  const state = fresh();
  state.resources.herbs = state.capacity;
  state.resources.stone = state.capacity;
  state.resources.wood = state.capacity - 0.1;
  const outlook = resourceOutlook(state);
  for (const key of ['herbs', 'stone']) {
    const resource = outlook.find((entry) => entry.key === key);
    assert.equal(resource.rate, 0);
    assert.equal(resource.isFull, true);
    assert.equal(resource.fullInSeconds, 0);
  }
  const wood = outlook.find((entry) => entry.key === 'wood');
  assert.equal(wood.isFull, false);
  assert.equal(wood.fullInSeconds, 1);
});

test('resource outlook includes the existing regional production bonuses', () => {
  const state = fresh();
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  for (const [location, key, rate] of [
    ['spring', 'water', 21],
    ['meadow', 'feed', 18],
    ['highland', 'stone', 13.5],
  ]) {
    state.location = location;
    const resource = resourceOutlook(state).find((entry) => entry.key === key);
    assert.equal(resource.rate, rate);
    assert.equal(
      resource.fullInSeconds,
      Math.ceil(((state.capacity - resource.amount) / rate) * 60),
    );
  }
});

test('affordable new buildings include satisfied cost rows and agree with the construction command', () => {
  const state = fresh();
  assert.deepEqual(constructionPlan(state), {
    target: 'quarry',
    type: 'quarry',
    mode: 'build',
    buildingId: null,
    level: 1,
    cost: { wood: 70, stone: 30 },
    deficits: [
      { key: 'wood', required: 70, available: 210, missing: 0, seconds: 0 },
      { key: 'stone', required: 30, available: 150, missing: 0, seconds: 0 },
    ],
    affordable: true,
    waitSeconds: 0,
    blocked: null,
  });
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  assert.equal(state.resources.wood, 140);
  assert.equal(state.resources.stone, 120);
});

test('missing passive production reports an unobtainable cost while preserving obtainable shortages', () => {
  const state = fresh();
  state.resources.wood = 69.9;
  state.resources.stone = 29;
  const plan = constructionPlan(state);
  assert.equal(plan.affordable, false);
  assert.equal(plan.blocked, 'production');
  assert.equal(plan.waitSeconds, null);
  assert.equal(row(plan, 'wood').seconds, 1);
  assert.deepEqual(row(plan, 'stone'), {
    key: 'stone',
    required: 30,
    available: 29,
    missing: 1,
    seconds: null,
  });
});

test('upgrade estimates use the target level, scaling cost, region bonus and slowest shortage', () => {
  const state = fresh();
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  state.location = 'highland';
  state.resources.wood = 108;
  state.resources.stone = 40;
  const plan = constructionPlan(state, 'quarry');
  assert.equal(plan.mode, 'upgrade');
  assert.equal(plan.buildingId, 'building-quarry');
  assert.equal(plan.level, 2);
  assert.deepEqual(plan.cost, { wood: 109, stone: 47 });
  assert.deepEqual(row(plan, 'wood'), {
    key: 'wood',
    required: 109,
    available: 108,
    missing: 1,
    seconds: 5,
  });
  assert.deepEqual(row(plan, 'stone'), {
    key: 'stone',
    required: 47,
    available: 40,
    missing: 7,
    seconds: 32,
  });
  assert.equal(plan.waitSeconds, 32);
  assert.equal(plan.blocked, null);
  assert.equal(plan.affordable, false);
  state.location = 'homeland';
  assert.equal(row(constructionPlan(state, 'quarry'), 'stone').seconds, 47);
});

test('a cost above storage capacity is unobtainable despite production and takes blocker priority', () => {
  const state = fresh();
  state.buildings.find((building) => building.type === 'hall').level = 4;
  state.resources.wood = state.capacity;
  state.resources.stone = 0;
  const plan = constructionPlan(state, 'hall');
  assert.equal(plan.level, 5);
  assert.deepEqual(plan.cost, { wood: 693, stone: 520 });
  assert.equal(plan.blocked, 'capacity');
  assert.equal(plan.waitSeconds, null);
  assert.equal(plan.affordable, false);
  assert.deepEqual(row(plan, 'wood'), {
    key: 'wood',
    required: 693,
    available: 500,
    missing: 193,
    seconds: null,
  });
  assert.equal(row(plan, 'stone').seconds, null);
});

test('a cost exactly at capacity remains reachable through passive production', () => {
  const state = fresh();
  state.capacity = 70;
  state.resources.wood = 58;
  state.resources.stone = 30;
  const plan = constructionPlan(state);
  assert.equal(row(plan, 'wood').seconds, 60);
  assert.equal(plan.waitSeconds, 60);
  assert.equal(plan.blocked, null);
});

test('active battles prevent otherwise affordable construction and upgrading', () => {
  const state = fresh();
  act(state, { type: 'startBattle' });
  for (const type of ['quarry', 'lumber']) {
    const plan = constructionPlan(state, type);
    assert.equal(plan.blocked, 'battle');
    assert.equal(plan.affordable, false);
    assert.equal(plan.waitSeconds, 0);
    assert.ok(plan.deficits.every((deficit) => deficit.missing === 0 && deficit.seconds === 0));
    const action =
      plan.mode === 'build'
        ? { type: 'build', building: plan.type, plotId: 'p7' }
        : { type: 'upgrade', id: plan.buildingId };
    assert.throws(() => act(state, action), { code: 'BATTLE_ACTIVE' });
  }
});

test('battle blockers retain the resource ETA and override production and capacity blockers', () => {
  const state = fresh();
  act(state, { type: 'startBattle' });
  state.resources.wood = 0;
  state.resources.stone = 0;
  let plan = constructionPlan(state);
  assert.equal(plan.blocked, 'battle');
  assert.equal(plan.waitSeconds, null);
  state.buildings.find((building) => building.type === 'hall').level = 4;
  plan = constructionPlan(state, 'hall');
  assert.equal(plan.blocked, 'battle');
  assert.equal(plan.waitSeconds, null);
});

test('journeys allow construction and keep estimates at the current location production', () => {
  const state = establishedJourney(START, 'highland');
  assert.ok(state.journey);
  assert.equal(constructionPlan(state).affordable, true);
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  state.resources.stone = 40;
  const plan = constructionPlan(state);
  assert.equal(plan.blocked, null);
  assert.equal(row(plan, 'stone').seconds, 47);
  assert.equal(resourceOutlook(state).find((entry) => entry.key === 'stone').rate, 9);
});

test('level-five structures return a terminal plan without a fictitious next cost', () => {
  const state = fresh();
  state.buildings.find((building) => building.type === 'lumber').level = 5;
  assert.deepEqual(constructionPlan(state, 'lumber'), {
    target: 'lumber',
    type: 'lumber',
    mode: 'upgrade',
    buildingId: 'building-lumber',
    level: 5,
    cost: {},
    deficits: [],
    affordable: false,
    waitSeconds: null,
    blocked: 'maxLevel',
  });
});

test('unknown selections including prototype names safely fall back to quarry', () => {
  const state = fresh();
  const expected = constructionPlan(state);
  for (const type of ['missing', '__proto__', 'constructor', 'toString', null, {}, []])
    assert.deepEqual(constructionPlan(state, type), expected);
});

test('planning accepts frozen saves and changing returned rows cannot modify state or definitions', () => {
  const state = fresh();
  const snapshot = JSON.stringify(state);
  freeze(state);
  const outlook = resourceOutlook(state);
  const build = constructionPlan(state);
  const upgrade = constructionPlan(state, 'lumber');
  outlook[0].amount = 0;
  build.cost.wood = 0;
  build.deficits[0].available = 0;
  upgrade.cost.wood = 0;
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(BUILDINGS.find((building) => building.id === 'quarry').cost.wood, 70);
  assert.equal(constructionPlan(state).cost.wood, 70);
  assert.equal(constructionPlan(state, 'lumber').cost.wood, 93);
  assert.equal(resourceOutlook(state)[0].amount, 180);
});

test('explicit duplicate targets plan and upgrade the chosen building independently', () => {
  const state = fresh();
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  act(state, { type: 'build', building: 'quarry', plotId: 'p35' });
  state.buildings.find((entry) => entry.id === 'building-quarry').level = 5;
  for (const key of RESOURCE_KEYS) state.resources[key] = state.capacity;
  const before = JSON.stringify(state);
  const plan = constructionPlan(state, 'building:building-quarry-2');
  assert.equal(plan.target, 'building:building-quarry-2');
  assert.equal(plan.buildingId, 'building-quarry-2');
  assert.equal(plan.type, 'quarry');
  assert.equal(plan.level, 2);
  assert.equal(plan.affordable, true);
  assert.equal(constructionPlan(state, 'quarry').blocked, 'maxLevel');
  assert.equal(JSON.stringify(state), before);
  act(state, { type: 'upgrade', id: plan.buildingId });
  assert.equal(state.buildings.find((entry) => entry.id === 'building-quarry').level, 5);
  assert.equal(state.buildings.find((entry) => entry.id === 'building-quarry-2').level, 2);
  assert.equal(state.resources.wood, 500 - plan.cost.wood);
  assert.equal(state.resources.stone, 500 - plan.cost.stone);
});

test('new copy planning uses base cost, remains a new copy after construction and obeys limits', () => {
  const state = fresh();
  let plan;
  for (let n = 0; n < 6; n++) {
    for (const key of RESOURCE_KEYS) state.resources[key] = state.capacity;
    const snapshot = JSON.stringify(state);
    plan = constructionPlan(state, 'new:quarry');
    assert.equal(plan.target, 'new:quarry');
    assert.equal(plan.mode, 'build');
    assert.equal(plan.buildingId, null);
    assert.equal(plan.level, 1);
    assert.deepEqual(plan.cost, { wood: 70, stone: 30 });
    assert.equal(plan.affordable, true);
    assert.equal(JSON.stringify(state), snapshot);
    act(state, { type: 'build', building: plan.type, plotId: `p${24 + n}` });
  }
  assert.equal(constructionPlan(state, 'new:quarry').blocked, 'buildingLimit');
  assert.equal(constructionPlan(state, 'new:quarry').affordable, false);
  assert.equal(constructionPlan(state, 'new:hall').blocked, 'buildingLimit');
  act(state, { type: 'startBattle' });
  assert.equal(constructionPlan(state, 'new:quarry').blocked, 'battle');
});

test('new copy planning rejects a full grid and stale instance targets never upgrade another copy', () => {
  const state = fresh();
  // The placement limit is below 36 today; full-grid handling also protects future plot limits.
  state.buildings = Array.from({ length: 36 }, (_, index) => ({
    id: `occupied-${index}`,
    type: 'lumber',
    level: 1,
    x: index % 6,
    y: Math.floor(index / 6),
  }));
  const plan = constructionPlan(state, 'new:quarry');
  assert.equal(plan.blocked, 'plotsFull');
  assert.equal(plan.affordable, false);
  const stale = constructionPlan(fresh(), 'building:building-quarry-2');
  assert.equal(stale.target, 'building:building-quarry-2');
  assert.equal(stale.blocked, 'targetMissing');
  assert.equal(stale.buildingId, null);
  assert.equal(stale.affordable, false);
});
