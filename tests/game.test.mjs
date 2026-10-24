import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDINGS,
  FORMATIONS,
  TACTICS,
  advanceGame,
  applyAction,
  getProduction,
  getUpgradeCost,
  resumeGame,
  validateGame,
} from '../shared/game.mjs';
import { BASE_CAPACITY, STORAGE_CAPACITY_BONUSES } from '../shared/settlement.mjs';
import { establishedGame, establishedJourney } from './established-game.mjs';
import { fundStorage, fillResources } from './economy-fixtures.mjs';

const START = 1_000_000;
const clone = (state) => JSON.parse(JSON.stringify(state));
const fresh = () => establishedGame(START);
const command = (state, action, at = state.updatedAt) => applyAction(state, action, at);
const code = (expected) => (error) => error.code === expected && error.message === expected;

test('migrated established game is complete, serializable, isolated, and valid', () => {
  const state = fresh();
  assert.equal(validateGame(state), true);
  assert.equal(validateGame(clone(state)), true);
  assert.equal(state.wolves.length, 5);
  assert.equal(state.herd.count, 24);
  assert.deepEqual(
    state.buildings.map((building) => building.type),
    ['hall', 'pasture', 'well', 'lumber'],
  );
  assert.equal(BUILDINGS.length, 9);
  assert.equal(TACTICS.length, 5);
  assert.equal(FORMATIONS.length, 3);
  state.wolves[0].ranks.leader = 4;
  state.resources.wood = 0;
  assert.equal(fresh().wolves[0].ranks.leader, 1);
  assert.equal(fresh().resources.wood, 210);
});

test('offline production uses elapsed time, caps resources, and never rewinds the clock', () => {
  const state = fresh();
  advanceGame(state, START + 60_000);
  assert.deepEqual(state.resources, {
    water: 180.7,
    feed: 180.6,
    herbs: 80,
    wood: 210.6,
    stone: 150,
  });
  const saved = clone(state);
  advanceGame(state, START);
  assert.deepEqual(state, saved);
  advanceGame(state, START + 40 * 60 * 60_000);
  assert.equal(state.resources.wood, 210.6 + 0.6 * 8 * 60);
  state.resources.wood = state.capacity - 0.25;
  advanceGame(state, state.updatedAt + 60_000);
  assert.equal(state.resources.wood, state.capacity);
  assert.equal(state.resources.herbs, 80);
  assert.equal(state.resources.stone, 150);
  assert.equal(validateGame(state), true);
});

test('long offline periods credit only the most recent eight hours', () => {
  const eight = fresh();
  const forty = fresh();
  // Isolate the offline ceiling from the separate storage ceiling with test-only capacity.
  // Normal villages fill before eight hours, which would hide a broken offline limit.
  eight.capacity = 1_000_000;
  forty.capacity = 1_000_000;
  advanceGame(eight, START + 8 * 60 * 60_000);
  advanceGame(forty, START + 40 * 60 * 60_000);
  assert.deepEqual(forty.resources, eight.resources);
  assert.equal(forty.resources.wood, 210 + 0.6 * 8 * 60);
  assert.equal(forty.updatedAt, START + 40 * 60 * 60_000);
  const previous = clone(forty.resources);
  advanceGame(forty, forty.updatedAt);
  assert.deepEqual(forty.resources, previous);
});

test('building and upgrading spend once, expose scaling costs, and increase production', () => {
  const state = fundStorage(fresh(), 1);
  const previousBuilds = state.stats.builds;
  command(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  assert.equal(state.resources.wood, 9780);
  assert.equal(state.resources.stone, 9880);
  assert.equal(state.stats.builds, previousBuilds + 1);
  assert.equal(getProduction(state).stone, 0.45);
  assert.equal(state.quests.find((quest) => quest.id === 'first_build').progress, 1);
  assert.throws(
    () => command(state, { type: 'build', building: 'quarry', plotId: 'p7' }),
    code('PLOT_OCCUPIED'),
  );
  assert.equal(state.resources.wood, 9780);
  const quarry = state.buildings.find((building) => building.type === 'quarry');
  assert.deepEqual(getUpgradeCost(quarry), { wood: 1320, stone: 720 });
  command(state, { type: 'upgrade', id: quarry.id });
  assert.equal(quarry.level, 2);
  assert.equal(getProduction(state).stone, 0.9);
  assert.equal(state.resources.wood, 8460);
  assert.equal(validateGame(state), true);
  state.resources.stone = 0;
  const before = clone(state);
  assert.throws(
    () => command(state, { type: 'upgrade', id: quarry.id }),
    code('INSUFFICIENT_RESOURCES'),
  );
  assert.deepEqual(state, before);
});

test('storage capacity follows constructed levels and levels stop at five', () => {
  const state = fresh();
  fillResources(state);
  command(state, { type: 'build', building: 'storage', plotId: 'p31' });
  assert.equal(state.capacity, 10000);
  const storage = state.buildings.find((building) => building.type === 'storage');
  for (let level = 2; level <= 5; level += 1) {
    state.resources.wood = state.capacity;
    state.resources.stone = state.capacity;
    command(state, { type: 'upgrade', id: storage.id });
    assert.equal(state.capacity, BASE_CAPACITY + STORAGE_CAPACITY_BONUSES[level]);
    assert.equal(validateGame(state), true);
  }
  assert.throws(() => command(state, { type: 'upgrade', id: storage.id }), code('MAX_LEVEL'));
});

test('gather cooldown uses authoritative monotonic time and rewards cannot repeat', () => {
  const state = fresh();
  command(state, { type: 'collect' });
  assert.equal(state.stats.gathers, 1);
  assert.equal(state.collectReadyAt, START + 90000);
  assert.throws(() => command(state, { type: 'collect' }, START - 100), code('COLLECT_COOLDOWN'));
  assert.throws(() => command(state, { type: 'collect' }, START + 89999), code('COLLECT_COOLDOWN'));
  assert.throws(
    () => command(state, { type: 'claimQuest', id: 'gatherer' }),
    code('QUEST_INCOMPLETE'),
  );
  command(state, { type: 'collect' }, START + 90000);
  command(state, { type: 'collect' }, START + 180_000);
  command(state, { type: 'claimQuest', id: 'gatherer' });
  assert.equal(state.quests.find((quest) => quest.id === 'gatherer').claimed, true);
  const before = clone(state.resources);
  assert.throws(
    () => command(state, { type: 'claimQuest', id: 'gatherer' }),
    code('QUEST_CLAIMED'),
  );
  assert.deepEqual(state.resources, before);
  assert.equal(validateGame(state), true);
});

test('training consumes points, affects ranks, advances the quest, and cannot overspend', () => {
  const state = fresh();
  const wolf = state.wolves[0];
  command(state, { type: 'train', id: wolf.id, path: 'guardian' });
  command(state, { type: 'train', id: wolf.id, path: 'hunter' });
  assert.equal(wolf.points, 0);
  assert.equal(wolf.ranks.guardian, 1);
  assert.equal(wolf.ranks.hunter, 1);
  assert.equal(wolf.maxHp, 146);
  assert.equal(wolf.hp, 146);
  assert.equal(state.resources.herbs, 0);
  assert.equal(state.quests.find((quest) => quest.id === 'pack_training').progress, 2);
  assert.throws(
    () => command(state, { type: 'train', id: wolf.id, path: 'leader' }),
    code('NO_SKILL_POINTS'),
  );
  assert.equal(validateGame(state), true);
});

test('each battle picks a random jackal tactic when it starts', () => {
  for (const [index, tactic] of TACTICS.entries()) {
    const state = fresh();
    let draws = 0;
    applyAction(state, { type: 'startBattle' }, START, () => {
      draws += 1;
      return (index + 0.5) / TACTICS.length;
    });
    assert.equal(state.battle.tactic, tactic);
    assert.equal(draws, 1);
    assert.equal(validateGame(state), true);
  }

  const state = fresh();
  assert.throws(() => command(state, { type: 'tactic', value: 'rush' }), code('INVALID_ACTION'));
  applyAction(state, { type: 'startBattle' }, START, () => 0);
  assert.equal(state.battle.tactic, 'direct');
  advanceGame(state, START + 60_000);
  command(state, { type: 'newBattle' });
  applyAction(state, { type: 'startBattle' }, state.updatedAt, () => 0.999);
  assert.equal(state.battle.tactic, 'rush');
  assert.equal(state.battle.wave, 2);
  assert.equal(validateGame(state), true);
});

test('battle outcome is deterministic across polling rates and is rewarded once', () => {
  const oneStep = fresh();
  applyAction(oneStep, { type: 'startBattle' }, START, () => 0.25);
  const frequent = clone(oneStep);
  advanceGame(oneStep, START + 60_000);
  for (let ms = 137; ms < 60_000; ms += 137) advanceGame(frequent, START + ms);
  advanceGame(frequent, START + 60_000);
  assert.equal(oneStep.battle.status, 'won');
  assert.equal(oneStep.stats.wins, 1);
  assert.deepEqual(oneStep.battle, frequent.battle);
  assert.deepEqual(oneStep.wolves, frequent.wolves);
  assert.deepEqual(oneStep.herd, frequent.herd);
  for (const key of Object.keys(oneStep.resources))
    assert.ok(Math.abs(oneStep.resources[key] - frequent.resources[key]) < 1e-8);
  const herbs = oneStep.resources.herbs;
  const xp = oneStep.wolves[0].xp;
  advanceGame(oneStep, START + 120_000);
  assert.equal(oneStep.resources.herbs, herbs);
  assert.equal(oneStep.wolves[0].xp, xp);
  assert.equal(oneStep.stats.wins, 1);
  assert.equal(validateGame(oneStep), true);
});

test('combat locks formation; victory must be acknowledged before the next wave', () => {
  const state = fresh();
  command(state, { type: 'startBattle' });
  for (const action of [
    { type: 'formation', unit: 'wolf', value: 'wide' },
    { type: 'build', building: 'quarry', plotId: 'p7' },
    { type: 'train', id: 'wolf-alpha', path: 'leader' },
    { type: 'rest' },
    { type: 'healHerd' },
    { type: 'newBattle' },
  ])
    assert.throws(() => command(state, action), code('BATTLE_ACTIVE'));
  advanceGame(state, START + 60_000);
  assert.throws(() => command(state, { type: 'startBattle' }), code('BATTLE_FINISHED'));
  command(state, { type: 'newBattle' });
  assert.equal(state.battle.status, 'preparing');
  assert.equal(state.battle.wave, 2);
  assert.equal(state.battle.tick, 0);
  assert.equal(state.battle.startedAt, null);
  assert.equal(validateGame(state), true);
});

test('defeat preserves wolves, costs herd members, and retries the same wave', () => {
  const state = fresh();
  state.herd.hp = 30;
  command(state, { type: 'startBattle' });
  advanceGame(state, START + 60_000);
  assert.equal(state.battle.status, 'lost');
  assert.equal(state.stats.wins, 0);
  assert.equal(state.herd.count, 22);
  assert.equal(state.herd.maxHp, 220);
  assert.ok(state.wolves.every((wolf) => wolf.hp >= 1 && wolf.xp === 0));
  assert.equal(validateGame(state), true);
  command(state, { type: 'newBattle' });
  assert.equal(state.battle.wave, 1);
  fillResources(state);
  command(state, { type: 'rest' });
  assert.ok(state.wolves.every((wolf) => wolf.hp === wolf.maxHp));
  const herbs = state.resources.herbs;
  const water = state.resources.water;
  command(state, { type: 'healHerd' });
  assert.equal(state.resources.herbs, herbs - 15);
  assert.equal(state.resources.water, water);
  assert.equal(validateGame(state), true);
});

test('migrated travel credits destination production only after arrival', () => {
  const state = establishedJourney(START, 'spring');
  assert.equal(state.journey.endsAt, START + 15_000);
  const frequent = clone(state);
  advanceGame(state, START + 30_000);
  advanceGame(frequent, START + 10_000);
  advanceGame(frequent, START + 20_000);
  advanceGame(frequent, START + 30_000);
  assert.equal(state.location, 'spring');
  assert.equal(state.journey, null);
  assert.equal(state.resources.water, 160.4375);
  assert.ok(Math.abs(state.resources.water - frequent.resources.water) < 1e-8);
  assert.equal(getProduction(state).water, 1.05);
  assert.throws(
    () => command(state, { type: 'travel', destination: 'spring' }),
    code('USE_CARAVAN'),
  );
  assert.equal(validateGame(state), true);
});

test('battle pauses migration, and late polling resumes it at the exact end of combat', () => {
  const oneStep = establishedJourney(START, 'highland');
  command(oneStep, { type: 'startBattle' }, START + 5000);
  const frequent = clone(oneStep);
  advanceGame(frequent, START + 10_000);
  assert.equal(frequent.journey.endsAt, START + 35_000);
  assert.equal(validateGame(frequent), true);
  for (let elapsed = 11_000; elapsed <= 60_000; elapsed += 1000)
    advanceGame(frequent, START + elapsed);
  advanceGame(oneStep, START + 60_000);
  assert.equal(oneStep.battle.status, 'won');
  assert.equal(oneStep.location, 'highland');
  assert.equal(oneStep.journey, null);
  assert.deepEqual(oneStep.battle, frequent.battle);
  assert.deepEqual(oneStep.log, frequent.log);
  for (const key of Object.keys(oneStep.resources))
    assert.ok(Math.abs(oneStep.resources[key] - frequent.resources[key]) < 1e-8);
  assert.equal(validateGame(oneStep), true);
});

test('resume abandons an unfinished battle without restoring damage or awarding XP and loot', () => {
  const state = establishedJourney(START, 'meadow');
  applyAction(state, { type: 'startBattle' }, START, () => 0.5);
  advanceGame(state, START + 3000);
  const savedWolves = clone(state.wolves);
  const savedHerd = clone(state.herd);
  const herbs = state.resources.herbs;
  const remainingTravel = state.journey.endsAt - state.updatedAt;
  const loaded = clone(state);
  resumeGame(loaded, START + 12 * 60 * 60_000);
  assert.equal(loaded.battle.status, 'preparing');
  assert.equal(loaded.battle.wave, 1);
  assert.equal(loaded.battle.tactic, 'right');
  assert.equal(loaded.battle.tick, 0);
  assert.ok(loaded.battle.enemies.every((enemy) => enemy.hp === enemy.maxHp));
  assert.deepEqual(loaded.wolves, savedWolves);
  assert.deepEqual(loaded.herd, savedHerd);
  assert.equal(loaded.resources.herbs, herbs);
  assert.equal(loaded.stats.wins, 0);
  assert.equal(loaded.journey.endsAt - loaded.updatedAt, remainingTravel);
  assert.equal(loaded.location, 'homeland');
  assert.equal(validateGame(loaded), true);
  const snapshot = clone(loaded);
  resumeGame(loaded, loaded.updatedAt);
  assert.deepEqual(loaded, snapshot);
});

test('resume keeps completed victories intact and does not pay rewards twice', () => {
  const state = fresh();
  command(state, { type: 'startBattle' });
  advanceGame(state, START + 60_000);
  const herbs = state.resources.herbs;
  const xp = state.wolves[0].xp;
  resumeGame(state, START + 120_000);
  assert.equal(state.battle.status, 'won');
  assert.equal(state.resources.herbs, herbs);
  assert.equal(state.wolves[0].xp, xp);
  assert.equal(state.stats.wins, 1);
  assert.equal(validateGame(state), true);
});

test('validation rejects corrupted nested values, inconsistent fields, and prototype names', () => {
  const corruptions = [
    (state) => {
      state.resources.water = NaN;
    },
    (state) => {
      state.resources.herbs = Infinity;
    },
    (state) => {
      state.resources.wood = -1;
    },
    (state) => {
      state.resources.stone = state.capacity + 1;
    },
    (state) => {
      state.resources.unexpected = 0;
    },
    (state) => {
      state.capacity = 600;
    },
    (state) => {
      state.updatedAt = '1000000';
    },
    (state) => {
      state.collectReadyAt = NaN;
    },
    (state) => {
      state.buildings[0].level = 1.5;
    },
    (state) => {
      state.buildings[0].x = Infinity;
    },
    (state) => {
      state.buildings.push({
        id: 'building-__proto__',
        type: '__proto__',
        level: 1,
        x: undefined,
        y: undefined,
      });
    },
    (state) => {
      state.buildings.push(clone(state.buildings[0]));
    },
    (state) => {
      state.wolves[0].hp = Infinity;
    },
    (state) => {
      state.wolves[0].maxHp = NaN;
    },
    (state) => {
      state.wolves[0].xp = -1;
    },
    (state) => {
      state.wolves[0].points = 1.5;
    },
    (state) => {
      state.wolves[0].ranks.guardian = NaN;
    },
    (state) => {
      state.wolves[0].ranks.leader = 6;
    },
    (state) => {
      state.wolves[1].name = state.wolves[0].name;
    },
    (state) => {
      state.herd.panic = NaN;
    },
    (state) => {
      state.herd.count = 0;
    },
    (state) => {
      state.herd.maxHp = 0;
    },
    (state) => {
      state.formation.herd = '__proto__';
    },
    (state) => {
      state.battle.tick = NaN;
    },
    (state) => {
      state.battle.startedAt = 0;
    },
    (state) => {
      state.battle.enemies[0].hp = NaN;
    },
    (state) => {
      state.battle.enemies[0].maxHp = -1;
    },
    (state) => {
      state.stats.wins = Infinity;
    },
    (state) => {
      state.quests[0].claimed = true;
    },
    (state) => {
      state.quests[0].target = NaN;
    },
    (state) => {
      state.quests[1] = clone(state.quests[0]);
    },
    (state) => {
      state.log[0].at = Infinity;
    },
    (state) => {
      state.log[0].key = '<script>';
    },
    (state) => {
      state.journey = { destination: 'moon', endsAt: START + 1000 };
    },
    (state) => {
      state.journey = { destination: 'spring', endsAt: NaN };
    },
    (state) => {
      state.journey = { destination: 'spring', endsAt: START - 1 };
    },
    (state) => {
      state.location = 'moon';
    },
    (state) => {
      state.injected = true;
    },
  ];
  corruptions.forEach((mutate, index) => {
    const state = fresh();
    mutate(state);
    assert.equal(validateGame(state), false, `corruption ${index} should be rejected`);
  });
  for (const state of [null, undefined, [], 42, 'state', Object.create(null)])
    assert.equal(validateGame(state), false);
});

test('invalid commands and clocks fail with stable machine codes', () => {
  const state = fresh();
  for (const action of [null, [], {}, { type: 'cheat' }])
    assert.throws(() => command(state, action), code('INVALID_ACTION'));
  for (const now of [NaN, Infinity, -1, 1.5, '1000'])
    assert.throws(() => advanceGame(state, now), code('INVALID_CLOCK'));
  assert.throws(
    () => command(state, { type: 'build', building: '__proto__' }),
    code('INVALID_BUILDING'),
  );
  assert.throws(
    () => command(state, { type: 'formation', unit: '__proto__', value: 'tight' }),
    code('INVALID_FORMATION'),
  );
  assert.throws(() => command(state, { type: 'tactic', value: 'godmode' }), code('INVALID_ACTION'));
  assert.throws(
    () => command(state, { type: 'travel', destination: 'moon' }),
    code('INVALID_DESTINATION'),
  );
  assert.throws(
    () => command(state, { type: 'train', id: 'wolf-alpha', path: '__proto__' }),
    code('INVALID_TRAINING'),
  );
  assert.throws(() => command(state, { type: 'claimQuest', id: 'unknown' }), code('INVALID_QUEST'));
  assert.equal(validateGame(state), true);
});
