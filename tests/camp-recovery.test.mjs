import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  advanceGame,
  migrateGame,
  validateGame,
} from '../shared/game.mjs';
import { recoveryPlan, applyRecovery } from '../shared/recovery.mjs';
import { establishedJourney } from './established-game.mjs';

const START = 1_000_000;
const fresh = () => createGame(START);
function wounded() {
  const state = fresh();
  state.wolves[0].hp = 17.5;
  state.herd.hp = 139.25;
  state.herd.panic = 41.5;
  return state;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
function rejected(state, kind, reason) {
  const before = structuredClone(state);
  const plan = recoveryPlan(state, kind);
  assert.equal(plan.ready, false);
  assert.equal(plan.reason, reason);
  assert.throws(() => applyRecovery(state, kind), { code: reason, message: reason });
  assert.throws(() => applyAction(state, { type: kind }, START), { code: reason });
  assert.deepEqual(state, before);
}
function depart(state, kind) {
  if (kind === 'caravan') state.adventure.unlocked.push('spring');
  applyAction(
    state,
    { type: kind, region: 'spring', difficulty: 'easy', wolfIds: ['wolf-scout'] },
    START,
  );
  return state;
}

test('care forecasts work on frozen saves, expose fractional shortages and own their returned objects', () => {
  const state = wounded();
  state.resources.water = 24.5;
  state.resources.feed = 27.25;
  state.resources.herbs = 0.75;
  const before = structuredClone(state);
  freeze(state);
  const rest = recoveryPlan(state, 'rest');
  const heal = recoveryPlan(state, 'healHerd');
  assert.deepEqual(rest.cost, { water: 25, feed: 30 });
  assert.deepEqual(rest.shortages, [
    { resource: 'water', amount: 0.5 },
    { resource: 'feed', amount: 2.75 },
  ]);
  assert.deepEqual(heal.shortages, [{ resource: 'herbs', amount: 0.25 }]);
  assert.equal(rest.needed, true);
  assert.equal(heal.needed, true);
  assert.deepEqual(state, before);
  rest.cost.water = 0;
  rest.wolves[0].after = 1;
  rest.herd.after = 1;
  assert.deepEqual(recoveryPlan(state, 'rest').cost, { water: 25, feed: 30 });
  assert.equal(recoveryPlan(state, 'rest').wolves[0].after, 140);
  assert.equal(recoveryPlan(state, 'rest').herd.after, 164.25);
});

test('herd treatment forecasts and applies the existing one-herb partial recovery without touching wolves', () => {
  const state = wounded();
  const wolves = structuredClone(state.wolves);
  const plan = recoveryPlan(state, 'healHerd');
  assert.equal(plan.ready, true);
  assert.deepEqual(plan.cost, { herbs: 1 });
  assert.deepEqual(plan.herd, {
    before: 139.25,
    after: 214.25,
    maxHp: 240,
    gain: 75,
    panicBefore: 41.5,
    panicAfter: 16.5,
    panicReduction: 25,
  });
  assert.ok(plan.wolves.every((wolf) => wolf.gain === 0));
  const resources = structuredClone(state.resources);
  assert.equal(applyRecovery(state, 'healHerd'), state);
  assert.deepEqual(state.resources, { ...resources, herbs: resources.herbs - 1 });
  assert.deepEqual(state.wolves, wolves);
  assert.deepEqual(state.herd, { count: 24, hp: 214.25, maxHp: 240, panic: 16.5 });
  assert.equal(validateGame(state), true);
});

test('camp rest restores each guardian fully while retaining the smaller herd effect and exact supply price', () => {
  const state = wounded();
  state.wolves[1].hp = 160.25;
  const plan = recoveryPlan(state, 'rest');
  assert.equal(plan.ready, true);
  assert.equal(plan.wolves[0].gain, 122.5);
  assert.equal(plan.wolves[1].gain, 9.75);
  assert.equal(plan.wolves[2].gain, 0);
  assert.equal(plan.herd.after, 164.25);
  assert.equal(plan.herd.panicAfter, 11.5);
  const resources = structuredClone(state.resources);
  applyRecovery(state, 'rest');
  assert.deepEqual(state.resources, {
    ...resources,
    water: resources.water - 25,
    feed: resources.feed - 30,
  });
  assert.ok(state.wolves.every((wolf) => wolf.hp === wolf.maxHp));
  assert.deepEqual(state.herd, { count: 24, hp: 164.25, maxHp: 240, panic: 11.5 });
  assert.equal(validateGame(state), true);
});

test('small wounds and panic are capped without inventing missing animals or rounding fractional health', () => {
  for (const kind of ['healHerd', 'rest']) {
    const state = wounded();
    state.herd = { count: 19, hp: 189.75, maxHp: 190, panic: 0.5 };
    const plan = recoveryPlan(state, kind);
    assert.equal(plan.herd.gain, 0.25);
    assert.equal(plan.herd.panicReduction, 0.5);
    applyRecovery(state, kind);
    assert.deepEqual(state.herd, { count: 19, hp: 190, maxHp: 190, panic: 0 });
    assert.equal(validateGame(state), true);
  }
});

test('healthy saves reject care before resource checks while wolf-only wounds permit only rest', () => {
  const state = fresh();
  state.resources = { water: 0, feed: 0, herbs: 0, wood: 0, stone: 0 };
  for (const kind of ['healHerd', 'rest']) {
    assert.equal(recoveryPlan(state, kind).needed, false);
    rejected(state, kind, 'ALREADY_HEALTHY');
  }
  state.wolves[0].hp -= 1;
  rejected(state, 'healHerd', 'ALREADY_HEALTHY');
  rejected(state, 'rest', 'INSUFFICIENT_RESOURCES');
  state.resources.water = 25;
  state.resources.feed = 30;
  assert.equal(recoveryPlan(state, 'rest').ready, true);
  applyAction(state, { type: 'rest' }, START);
  assert.equal(state.wolves[0].hp, 140);
  assert.equal(state.resources.water, 0);
  assert.equal(state.resources.feed, 0);
});

test('panic alone allows either care action, and location does not restrict camp rest', () => {
  for (const kind of ['healHerd', 'rest']) {
    const state = fresh();
    state.location = 'spring';
    state.adventure.unlocked.push('spring');
    state.herd.panic = 8;
    assert.equal(recoveryPlan(state, kind).ready, true);
    assert.equal(recoveryPlan(state, kind).herd.gain, 0);
    applyAction(state, { type: kind }, START);
    assert.equal(state.herd.panic, 0);
    assert.equal(state.location, 'spring');
    assert.equal(validateGame(state), true);
  }
});

test('active battle takes precedence over health, journeys and insufficient supplies', () => {
  for (const kind of ['healHerd', 'rest']) {
    const state = fresh();
    applyAction(state, { type: 'startBattle' }, START);
    state.resources.herbs = 0;
    state.resources.water = 0;
    state.resources.feed = 0;
    rejected(state, kind, 'BATTLE_ACTIVE');
  }
  const state = depart(wounded(), 'expedition');
  state.battle.status = 'active';
  assert.equal(recoveryPlan(state, 'rest').reason, 'BATTLE_ACTIVE');
});

test('expeditions, caravans and legacy journeys block rest but retain herd treatment compatibility', () => {
  const legacy = establishedJourney(START, 'spring');
  legacy.herd.hp -= 100;
  legacy.herd.panic = 40;
  for (const state of [depart(wounded(), 'expedition'), depart(wounded(), 'caravan'), legacy]) {
    assert.equal(validateGame(state), true);
    rejected(state, 'rest', 'JOURNEY_ACTIVE');
    const journey = structuredClone(state.journey);
    const adventure = structuredClone(state.adventure);
    const wolves = structuredClone(state.wolves);
    assert.equal(recoveryPlan(state, 'healHerd').ready, true);
    const hp = state.herd.hp;
    applyAction(state, { type: 'healHerd' }, START);
    assert.equal(state.herd.hp, Math.min(state.herd.maxHp, hp + 75));
    assert.deepEqual(state.journey, journey);
    assert.deepEqual(state.adventure, adventure);
    assert.deepEqual(state.wolves, wolves);
    assert.equal(validateGame(state), true);
  }
  const healthyAway = depart(fresh(), 'expedition');
  healthyAway.resources.water = 0;
  healthyAway.resources.feed = 0;
  rejected(healthyAway, 'rest', 'JOURNEY_ACTIVE');
  rejected(healthyAway, 'healHerd', 'ALREADY_HEALTHY');
});

test('resource boundaries remain exact and failed care never spends another available supply', () => {
  const heal = wounded();
  heal.resources.herbs = 0.999;
  rejected(heal, 'healHerd', 'INSUFFICIENT_RESOURCES');
  heal.resources.herbs = 1;
  applyAction(heal, { type: 'healHerd' }, START);
  assert.equal(heal.resources.herbs, 0);
  const rest = wounded();
  rest.resources.water = 25;
  rest.resources.feed = 29.999;
  rejected(rest, 'rest', 'INSUFFICIENT_RESOURCES');
  rest.resources.feed = 30;
  rest.resources.water = 24.999;
  rejected(rest, 'rest', 'INSUFFICIENT_RESOURCES');
  rest.resources.water = 25;
  applyAction(rest, { type: 'rest' }, START);
  assert.equal(rest.resources.water, 0);
  assert.equal(rest.resources.feed, 0);
});

test('care logs, partial post-battle First Watch recovery and saved progress retain the existing contract', () => {
  const state = fresh();
  state.wolves[0].hp -= 10;
  applyAction(state, { type: 'rest' }, START);
  assert.equal(state.firstWatch.milestones.recover, null);
  applyAction(state, { type: 'startBattle' }, START);
  state.herd.hp = 1;
  advanceGame(state, START + 90_000);
  assert.equal(state.battle.status, 'lost');
  assert.equal(state.firstWatch.milestones.recover, null);
  const at = state.updatedAt;
  const before = structuredClone(state.firstWatch);
  const keys = Object.keys(state);
  applyAction(state, { type: 'healHerd' }, at);
  assert.deepEqual(state.log.at(-1), { key: 'herdHealed', at });
  assert.ok(state.wolves.some((wolf) => wolf.hp < wolf.maxHp));
  assert.deepEqual(state.firstWatch, {
    ...before,
    milestones: { ...before.milestones, recover: at },
  });
  assert.deepEqual(Object.keys(state), keys);
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(validateGame(restored), true);
  applyAction(restored, { type: 'rest' }, at);
  assert.deepEqual(restored.log.at(-1), { key: 'packRested', at });
  assert.deepEqual(restored.firstWatch, state.firstWatch);
});

test('unrecognized care kinds are rejected without granting effects or spending supplies', () => {
  const state = wounded();
  const before = structuredClone(state);
  for (const kind of [undefined, null, '', 'heal', '__proto__', ['rest'], {}, 1]) {
    const plan = recoveryPlan(state, kind);
    assert.equal(plan.reason, 'INVALID_RECOVERY');
    assert.deepEqual(plan.cost, {});
    assert.deepEqual(plan.shortages, []);
    assert.equal(plan.needed, false);
    assert.throws(() => applyRecovery(state, kind), { code: 'INVALID_RECOVERY' });
  }
  assert.deepEqual(state, before);
});
