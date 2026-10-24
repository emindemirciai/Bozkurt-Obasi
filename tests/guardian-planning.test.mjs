import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, validateGame } from '../shared/game.mjs';
import { ITEM_DEFINITIONS } from '../shared/adventures.mjs';
import { establishedJourney } from './established-game.mjs';
import { fillResources } from './economy-fixtures.mjs';
import {
  TRAINING_PATHS,
  TRAINING_COST,
  guardianStats,
  trainingPlan,
  equipmentPlan,
} from '../shared/guardian-planning.mjs';

const START = 1_000_000;
const act = (state, action) => applyAction(state, action, state.updatedAt, () => 0);
const expedition = (state) =>
  act(state, {
    type: 'expedition',
    region: 'spring',
    difficulty: 'easy',
    wolfIds: ['wolf-scout'],
  });
function failedPlanMatchesCommand(state, plan, action, reason) {
  const original = structuredClone(state);
  assert.equal(plan.ready, false);
  assert.equal(plan.reason, reason);
  assert.throws(() => act(state, action), { code: reason });
  assert.deepEqual(state, original);
}

test('individual guardian stats expose actual attack, nonlinear mitigation, healing and scouting', () => {
  const state = createGame(START);
  const wolf = state.wolves[0];
  const original = structuredClone(state);
  assert.deepEqual(guardianStats(wolf), {
    attack: 5.1,
    mitigation: 0,
    healing: 0,
    scouting: 0,
    maxHp: 140,
  });
  assert.deepEqual(state, original);
  wolf.equipment = 'iron_guard';
  wolf.ranks.guardian = 2;
  wolf.ranks.healer = 1;
  assert.deepEqual(guardianStats(wolf), {
    attack: 7.1,
    mitigation: (1 - 1 / 1.48) * 100,
    healing: 3,
    scouting: 0,
    maxHp: 140,
  });
  wolf.equipment = 'scout_charm';
  assert.equal(guardianStats(wolf).scouting, 15);
  wolf.equipment = 'healer_satchel';
  assert.equal(guardianStats(wolf).healing, 6);
  assert.ok(Object.isFrozen(TRAINING_PATHS));
  assert.ok(Object.isFrozen(TRAINING_COST));
});

test('every training preview matches the real command while preserving wounds, equipment and XP', () => {
  for (const path of TRAINING_PATHS) {
    const state = createGame(START);
    fillResources(state);
    const wolf = state.wolves[0];
    wolf.hp -= 37;
    wolf.xp = 24;
    wolf.equipment = 'iron_guard';
    const original = structuredClone(state);
    const plan = trainingPlan(state, wolf.id, path);
    assert.deepEqual(state, original);
    assert.equal(plan.ready, true);
    assert.equal(plan.reason, null);
    assert.deepEqual(plan.before, guardianStats(wolf));
    act(state, { type: 'train', id: wolf.id, path });
    assert.deepEqual(guardianStats(wolf), plan.after);
    assert.equal(wolf.maxHp - wolf.hp, 37);
    assert.equal(wolf.maxHp - original.wolves[0].maxHp, plan.healthGain);
    assert.equal(wolf.points, original.wolves[0].points - 1);
    assert.equal(wolf.ranks[path], plan.nextRank);
    assert.equal(wolf.xp, 24);
    assert.equal(wolf.equipment, 'iron_guard');
    assert.deepEqual(state.inventory, original.inventory);
    assert.equal(state.resources.herbs, original.resources.herbs - plan.cost.herbs);
    assert.equal(state.resources.feed, original.resources.feed - plan.cost.feed);
    assert.equal(validateGame(state), true);
  }
});

test('training shortages handle fractional production and exact affordability without advancing time', () => {
  const state = createGame(START);
  state.resources.herbs = 39.75;
  state.resources.feed = 79.5;
  const plan = trainingPlan(state, 'wolf-alpha', 'guardian');
  assert.deepEqual(plan.shortages, [
    { resource: 'herbs', amount: 0.25 },
    { resource: 'feed', amount: 0.5 },
  ]);
  failedPlanMatchesCommand(
    state,
    plan,
    { type: 'train', id: 'wolf-alpha', path: 'guardian' },
    'INSUFFICIENT_RESOURCES',
  );
  state.resources.herbs = 40;
  state.resources.feed = 80;
  assert.equal(trainingPlan(state, 'wolf-alpha', 'guardian').ready, true);
  act(state, { type: 'train', id: 'wolf-alpha', path: 'guardian' });
  assert.equal(state.resources.herbs, 0);
  assert.equal(state.resources.feed, 0);
});

test('training rejection precedence matches battle, invalid selection, away, points and rank checks', () => {
  const state = createGame(START);
  const command = { type: 'train', id: 'wolf-scout', path: 'guardian' };
  state.resources.herbs = 0;
  state.wolves[3].ranks.guardian = 5;
  state.wolves[3].points = 0;
  failedPlanMatchesCommand(
    state,
    trainingPlan(state, command.id, command.path),
    command,
    'NO_SKILL_POINTS',
  );
  state.wolves[3].points = 1;
  const capped = trainingPlan(state, command.id, command.path);
  assert.equal(capped.nextRank, 5);
  assert.equal(capped.healthGain, 0);
  assert.deepEqual(capped.before, capped.after);
  failedPlanMatchesCommand(state, capped, command, 'MAX_LEVEL');
  expedition(state);
  failedPlanMatchesCommand(
    state,
    trainingPlan(state, command.id, command.path),
    command,
    'WOLF_BUSY',
  );
  for (const invalid of [
    { ...command, id: 'missing' },
    { ...command, path: '__proto__' },
    { ...command, path: 1 },
  ]) {
    const plan = trainingPlan(state, invalid.id, invalid.path);
    assert.equal(plan.before, null);
    assert.equal(plan.after, null);
    failedPlanMatchesCommand(state, plan, invalid, 'INVALID_TRAINING');
  }
  const battle = createGame(START);
  act(battle, { type: 'startBattle' });
  const invalid = { ...command, id: 'missing', path: 'invalid' };
  failedPlanMatchesCommand(
    battle,
    trainingPlan(battle, invalid.id, invalid.path),
    invalid,
    'BATTLE_ACTIVE',
  );
});

test('training and equipment lock only expedition participants and retain legacy journey rules', () => {
  const state = createGame(START);
  state.inventory.leather_vest = 1;
  expedition(state);
  fillResources(state);
  assert.equal(trainingPlan(state, 'wolf-alpha', 'guardian').ready, true);
  assert.equal(equipmentPlan(state, 'wolf-alpha', 'leather_vest').ready, true);
  act(state, { type: 'train', id: 'wolf-alpha', path: 'guardian' });
  act(state, { type: 'equip', id: 'wolf-alpha', item: 'leather_vest' });
  const legacyJourney = establishedJourney(START, 'spring');
  legacyJourney.inventory.leather_vest = 1;
  assert.equal(trainingPlan(legacyJourney, 'wolf-alpha', 'guardian').ready, true);
  assert.equal(equipmentPlan(legacyJourney, 'wolf-alpha', 'leather_vest').ready, true);
  act(legacyJourney, { type: 'train', id: 'wolf-alpha', path: 'guardian' });
  act(legacyJourney, { type: 'equip', id: 'wolf-alpha', item: 'leather_vest' });
  assert.equal(validateGame(legacyJourney), true);
});

test('every candidate item preview matches the real swap and conserves equipment', () => {
  for (const item of ITEM_DEFINITIONS) {
    const state = createGame(START);
    const wolf = state.wolves[0];
    wolf.equipment = item.id === 'iron_guard' ? 'leather_vest' : 'iron_guard';
    wolf.hp -= 27;
    state.inventory[item.id] = 2;
    const original = structuredClone(state);
    const plan = equipmentPlan(state, wolf.id, item.id);
    assert.deepEqual(state, original);
    assert.equal(plan.ready, true);
    assert.equal(plan.inventoryCount, 2);
    act(state, { type: 'equip', id: wolf.id, item: item.id });
    assert.deepEqual(guardianStats(wolf), plan.after);
    for (const [key, value] of Object.entries(plan.delta))
      assert.equal(value, plan.after[key] - plan.before[key]);
    assert.equal(state.inventory[item.id], 1);
    assert.equal(
      state.inventory[original.wolves[0].equipment],
      original.inventory[original.wolves[0].equipment] + 1,
    );
    assert.deepEqual(state.resources, original.resources);
    assert.deepEqual({ ...wolf, equipment: original.wolves[0].equipment }, original.wolves[0]);
    assert.equal(validateGame(state), true);
  }
});

test('unequip preview predicts removal of all gear bonuses and returns the item without healing', () => {
  const state = createGame(START);
  const wolf = state.wolves[0];
  wolf.equipment = 'healer_satchel';
  wolf.hp -= 40;
  state.inventory.healer_satchel = 5;
  const original = structuredClone(state);
  const plan = equipmentPlan(state, wolf.id, null);
  assert.deepEqual(state, original);
  assert.equal(plan.ready, true);
  assert.equal(plan.inventoryCount, 5);
  assert.equal(plan.delta.healing, -3);
  act(state, { type: 'unequip', id: wolf.id });
  assert.deepEqual(guardianStats(wolf), plan.after);
  assert.equal(state.inventory.healer_satchel, 6);
  assert.equal(wolf.hp, original.wolves[0].hp);
  assert.equal(validateGame(state), true);
});

test('equipment rejection precedence matches invalid choices, battle/away, missing stock and full returns', () => {
  const state = createGame(START);
  const wolf = state.wolves[0];
  wolf.equipment = 'leather_vest';
  state.inventory.leather_vest = 10000;
  const command = { type: 'equip', id: wolf.id, item: 'iron_guard' };
  failedPlanMatchesCommand(
    state,
    equipmentPlan(state, wolf.id, command.item),
    command,
    'ITEM_UNAVAILABLE',
  );
  state.inventory.iron_guard = 1;
  failedPlanMatchesCommand(
    state,
    equipmentPlan(state, wolf.id, command.item),
    command,
    'INVENTORY_FULL',
  );
  failedPlanMatchesCommand(
    state,
    equipmentPlan(state, wolf.id, null),
    { type: 'unequip', id: wolf.id },
    'INVENTORY_FULL',
  );
  act(state, { type: 'startBattle' });
  failedPlanMatchesCommand(
    state,
    equipmentPlan(state, wolf.id, command.item),
    command,
    'WOLF_BUSY',
  );
  for (const item of ['unknown', '__proto__', undefined, 1]) {
    const plan = equipmentPlan(state, wolf.id, item);
    assert.equal(plan.before, null);
    assert.equal(plan.after, null);
    assert.equal(plan.delta, null);
    failedPlanMatchesCommand(state, plan, { ...command, item }, 'INVALID_EQUIPMENT');
  }
  failedPlanMatchesCommand(
    state,
    equipmentPlan(state, 'missing', null),
    { type: 'unequip', id: 'missing' },
    'INVALID_EQUIPMENT',
  );
  const away = createGame(START);
  expedition(away);
  failedPlanMatchesCommand(
    away,
    equipmentPlan(away, 'wolf-scout', null),
    { type: 'unequip', id: 'wolf-scout' },
    'WOLF_BUSY',
  );
});

test('already equipped and empty slots explain no-op actions without requiring stock or return capacity', () => {
  const state = createGame(START);
  const wolf = state.wolves[0];
  const empty = equipmentPlan(state, wolf.id, null);
  assert.equal(empty.ready, false);
  assert.equal(empty.reason, 'NO_EQUIPMENT');
  act(state, { type: 'unequip', id: wolf.id });
  wolf.equipment = 'iron_guard';
  for (const stock of [0, 10000]) {
    state.inventory.iron_guard = stock;
    const original = structuredClone(state);
    const plan = equipmentPlan(state, wolf.id, 'iron_guard');
    assert.equal(plan.ready, false);
    assert.equal(plan.reason, 'ALREADY_EQUIPPED');
    assert.ok(Object.values(plan.delta).every((amount) => amount === 0));
    act(state, { type: 'equip', id: wolf.id, item: 'iron_guard' });
    assert.deepEqual(state, original);
  }
});

test('returned plans contain no mutable aliases into state, definitions or later previews', () => {
  const state = createGame(START);
  state.inventory.iron_guard = 1;
  const original = structuredClone(state);
  const training = trainingPlan(state, 'wolf-alpha', 'hunter');
  training.cost.herbs = 999;
  training.before.attack = 999;
  training.after.maxHp = 999;
  const equipment = equipmentPlan(state, 'wolf-alpha', 'iron_guard');
  equipment.before.attack = 999;
  equipment.after.attack = 999;
  equipment.delta.attack = 999;
  assert.deepEqual(state, original);
  assert.equal(trainingPlan(state, 'wolf-alpha', 'hunter').cost.herbs, 40);
  assert.equal(trainingPlan(state, 'wolf-alpha', 'hunter').before.attack, 5.1);
  assert.equal(equipmentPlan(state, 'wolf-alpha', 'iron_guard').after.attack, 7.1);
});
