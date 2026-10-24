import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, RESOURCE_KEYS, applyAction } from '../shared/game.mjs';
import { fillResources, fundStorage } from './economy-fixtures.mjs';
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
    { key: 'water', amount: 180, capacity: 1000, rate: 0.7, isFull: false, fullInSeconds: 70286 },
    { key: 'feed', amount: 180, capacity: 1000, rate: 0.6, isFull: false, fullInSeconds: 82000 },
    { key: 'herbs', amount: 80, capacity: 1000, rate: 0, isFull: false, fullInSeconds: null },
    { key: 'wood', amount: 210, capacity: 1000, rate: 0.6, isFull: false, fullInSeconds: 79000 },
    { key: 'stone', amount: 150, capacity: 1000, rate: 0, isFull: false, fullInSeconds: null },
  ]);
});

test('full stores have a zero ETA even without passive production and fractional shortages round up', () => {
  const state = fresh();
  state.resources.herbs = state.capacity;
  state.resources.stone = state.capacity;
  state.resources.wood = state.capacity - 0.125;
  const outlook = resourceOutlook(state);
  for (const key of ['herbs', 'stone']) {
    const resource = outlook.find((entry) => entry.key === key);
    assert.equal(resource.rate, 0);
    assert.equal(resource.isFull, true);
    assert.equal(resource.fullInSeconds, 0);
  }
  const wood = outlook.find((entry) => entry.key === 'wood');
  assert.equal(wood.isFull, false);
  assert.equal(wood.fullInSeconds, 13);
});

test('resource outlook includes the existing regional production bonuses', () => {
  const state = fillResources(fresh());
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  for (const [location, key, rate] of [
    ['spring', 'water', 1.05],
    ['meadow', 'feed', 0.9],
    ['highland', 'stone', 0.675],
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
  state.resources.wood = 220;
  assert.deepEqual(constructionPlan(state), {
    target: 'quarry',
    type: 'quarry',
    mode: 'build',
    buildingId: null,
    level: 1,
    cost: { wood: 220, stone: 120 },
    deficits: [
      { key: 'wood', required: 220, available: 220, missing: 0, seconds: 0 },
      { key: 'stone', required: 120, available: 150, missing: 0, seconds: 0 },
    ],
    affordable: true,
    waitSeconds: 0,
    blocked: null,
  });
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  assert.equal(state.resources.wood, 0);
  assert.equal(state.resources.stone, 30);
});

test('missing passive production reports an unobtainable cost while preserving obtainable shortages', () => {
  const state = fresh();
  state.resources.wood = 219.9;
  state.resources.stone = 119;
  const plan = constructionPlan(state);
  assert.equal(plan.affordable, false);
  assert.equal(plan.blocked, 'production');
  assert.equal(plan.waitSeconds, null);
  assert.equal(row(plan, 'wood').seconds, 10);
  assert.deepEqual(row(plan, 'stone'), {
    key: 'stone',
    required: 120,
    available: 119,
    missing: 1,
    seconds: null,
  });
});

test('upgrade estimates use the target level, scaling cost, region bonus and slowest shortage', () => {
  const state = fundStorage(fresh(), 1);
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  state.location = 'highland';
  state.resources.wood = 1319;
  state.resources.stone = 713;
  const plan = constructionPlan(state, 'quarry');
  assert.equal(plan.mode, 'upgrade');
  assert.equal(plan.buildingId, 'building-quarry');
  assert.equal(plan.level, 2);
  assert.deepEqual(plan.cost, { wood: 1320, stone: 720 });
  assert.deepEqual(row(plan, 'wood'), {
    key: 'wood',
    required: 1320,
    available: 1319,
    missing: 1,
    seconds: 100,
  });
  assert.deepEqual(row(plan, 'stone'), {
    key: 'stone',
    required: 720,
    available: 713,
    missing: 7,
    seconds: 623,
  });
  assert.equal(plan.waitSeconds, 623);
  assert.equal(plan.blocked, null);
  assert.equal(plan.affordable, false);
  state.location = 'homeland';
  assert.equal(row(constructionPlan(state, 'quarry'), 'stone').seconds, 934);
});

test('a cost above storage capacity is unobtainable despite production and takes blocker priority', () => {
  const state = fresh();
  // The next real hall upgrade requires purchasing a warehouse first.
  state.resources.wood = state.capacity;
  state.resources.stone = 0;
  const plan = constructionPlan(state, 'hall');
  assert.equal(plan.level, 2);
  assert.deepEqual(plan.cost, { wood: 3600, stone: 2700 });
  assert.equal(plan.blocked, 'capacity');
  assert.equal(plan.waitSeconds, null);
  assert.equal(plan.affordable, false);
  assert.deepEqual(row(plan, 'wood'), {
    key: 'wood',
    required: 3600,
    available: 1000,
    missing: 2600,
    seconds: null,
  });
  assert.equal(row(plan, 'stone').seconds, null);
});

test('a cost exactly at capacity remains reachable through passive production', () => {
  const state = fresh();
  fillResources(state);
  act(state, { type: 'build', building: 'watchtower', plotId: 't0' });
  state.resources.wood = 988;
  state.resources.stone = 800;
  const plan = constructionPlan(state, 'new:watchtower');
  assert.equal(plan.cost.wood, state.capacity);
  assert.equal(row(plan, 'wood').seconds, 1200);
  assert.equal(plan.waitSeconds, 1200);
  assert.equal(plan.blocked, null);
});

test('active battles prevent otherwise affordable construction and upgrading', () => {
  const state = fundStorage(fresh(), 1);
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
  const state = fundStorage(establishedJourney(START, 'highland'), 1);
  assert.ok(state.journey);
  assert.equal(constructionPlan(state).affordable, true);
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  state.resources.stone = 713;
  const plan = constructionPlan(state);
  assert.equal(plan.blocked, null);
  assert.equal(row(plan, 'stone').seconds, 934);
  assert.equal(resourceOutlook(state).find((entry) => entry.key === 'stone').rate, 0.45);
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
  assert.equal(BUILDINGS.find((building) => building.id === 'quarry').cost.wood, 220);
  assert.equal(constructionPlan(state).cost.wood, 220);
  assert.equal(constructionPlan(state, 'lumber').cost.wood, 1080);
  assert.equal(resourceOutlook(state)[0].amount, 180);
});

test('explicit duplicate targets plan and upgrade the chosen building independently', () => {
  const state = fundStorage(fresh(), 1, 'p34');
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
  assert.equal(state.resources.wood, state.capacity - plan.cost.wood);
  assert.equal(state.resources.stone, state.capacity - plan.cost.stone);
});

test('new copy planning uses rising paid ordinals, remains a new copy after construction and obeys limits', () => {
  const state = fundStorage(fresh(), 1);
  let plan;
  for (let n = 0; n < 6; n++) {
    for (const key of RESOURCE_KEYS) state.resources[key] = state.capacity;
    const snapshot = JSON.stringify(state);
    plan = constructionPlan(state, 'new:quarry');
    assert.equal(plan.target, 'new:quarry');
    assert.equal(plan.mode, 'build');
    assert.equal(plan.buildingId, null);
    assert.equal(plan.level, 1);
    const multiplier = [1, 2, 3, 5, 8, 12][n];
    assert.deepEqual(plan.cost, { wood: 220 * multiplier, stone: 120 * multiplier });
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

test('construction availability keeps corner tower slots separate from the normal village grid', () => {
  const state = fillResources(fresh());
  // A full synthetic grid exercises future capacity without altering the current per-type caps.
  state.buildings = Array.from({ length: 36 }, (_, index) => ({
    id: `occupied-${index}`,
    type: 'lumber',
    level: 1,
    x: index % 6,
    y: Math.floor(index / 6),
  }));
  assert.equal(constructionPlan(state, 'new:quarry').blocked, 'plotsFull');
  assert.equal(constructionPlan(state, 'new:watchtower').affordable, true);
  assert.equal(constructionPlan(state, 'new:watchtower').blocked, null);
  for (let index = 0; index < 4; index++) {
    state.buildings.push({
      id: index ? `building-watchtower-${index + 1}` : 'building-watchtower',
      type: 'watchtower',
      level: 1,
      x: 6,
      y: index,
    });
  }
  assert.equal(constructionPlan(state, 'new:watchtower').blocked, 'buildingLimit');
  state.buildings.shift();
  assert.equal(constructionPlan(state, 'new:quarry').affordable, true);
  assert.equal(constructionPlan(state, 'new:watchtower').affordable, false);
});
