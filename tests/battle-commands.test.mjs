import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  migrateGame,
  validateGame,
  applyAction,
  advanceGame,
  resumeGame,
  TACTICS,
} from '../shared/game.mjs';
import { createGame as createLegacyGame } from '../shared/legacy-v1.mjs';
import {
  BATTLE_COMMANDS,
  battleCommandPlan,
  battleCommandStatus,
  battleCommandEffects,
} from '../shared/battle-commands.mjs';

const START = 1_000_000;
const act = (state, action, at = state.updatedAt, random = () => 0) =>
  applyAction(state, action, at, random);
const order = (state, id, at = state.updatedAt) => act(state, { type: 'battleCommand', id }, at);
const prepare = () => {
  const state = createGame(START);
  act(state, { type: 'startBattle' });
  advanceGame(state, START + 6000);
  return state;
};
const rejectsUnchanged = (state, action, code) => {
  const before = structuredClone(state);
  assert.throws(() => act(state, action), { code });
  assert.deepEqual(state, before);
};

test('orders wait for the six-second introduction and readiness never changes a save', () => {
  const state = createGame(START);
  const before = structuredClone(state);
  for (const { id } of BATTLE_COMMANDS) {
    assert.equal(battleCommandPlan(state, id).blocked, 'inactive');
    rejectsUnchanged(state, { type: 'battleCommand', id }, 'BATTLE_NOT_ACTIVE');
  }
  assert.deepEqual(state, before);
  act(state, { type: 'startBattle' });
  advanceGame(state, START + 5999);
  assert.equal(battleCommandPlan(state, 'brace').remainingTicks, 1);
  rejectsUnchanged(state, { type: 'battleCommand', id: 'brace' }, 'BATTLE_COMMAND_INTRO');
  advanceGame(state, START + 6000);
  assert.equal(battleCommandPlan(state, 'brace').ready, true);
  const ready = structuredClone(state);
  for (const { id } of BATTLE_COMMANDS) battleCommandPlan(state, id);
  battleCommandStatus(state);
  assert.deepEqual(state, ready);
});

test('brace trades damage output for wolf and herd protection in the next real exchange', () => {
  const state = prepare();
  const baseline = structuredClone(state);
  const balances = structuredClone(state.resources);
  order(state, 'brace');
  assert.deepEqual(state.resources, balances);
  assert.deepEqual(state.battle.enemies, baseline.battle.enemies);
  advanceGame(state, START + 7000);
  advanceGame(baseline, START + 7000);
  assert.equal(state.battle.enemies[0].maxHp - state.battle.enemies[0].hp, 21);
  assert.equal(baseline.battle.enemies[0].maxHp - baseline.battle.enemies[0].hp, 27);
  assert.equal(state.wolves[1].maxHp - state.wolves[1].hp, 9);
  assert.equal(baseline.wolves[1].maxHp - baseline.wolves[1].hp, 14);
  assert.equal(state.herd.maxHp - state.herd.hp, 3);
  assert.equal(baseline.herd.maxHp - baseline.herd.hp, 4);
  assert.equal(validateGame(state), true);
});

test('focus increases real attack and wolf exposure without changing herd damage or formation', () => {
  const state = prepare();
  const baseline = structuredClone(state);
  order(state, 'focus');
  advanceGame(state, START + 7000);
  advanceGame(baseline, START + 7000);
  assert.equal(state.battle.enemies[0].maxHp - state.battle.enemies[0].hp, 36);
  assert.equal(state.wolves[1].maxHp - state.wolves[1].hp, 17);
  assert.equal(state.herd.hp, baseline.herd.hp);
  assert.deepEqual(state.formation, baseline.formation);
  rejectsUnchanged(state, { type: 'formation', unit: 'wolf', value: 'tight' }, 'BATTLE_ACTIVE');
  assert.equal(validateGame(state), true);
});

test('timed orders affect exactly six future ticks and share a twelve-tick cooldown', () => {
  const state = prepare();
  order(state, 'brace');
  assert.equal(battleCommandStatus(state).activeTicksLeft, 6);
  assert.deepEqual(battleCommandEffects(state.battle), { attack: 1, wolfDamage: 1, herdDamage: 1 });
  for (let tick = 7; tick <= 12; tick++) {
    advanceGame(state, START + tick * 1000);
    assert.deepEqual(battleCommandEffects(state.battle), {
      attack: 0.8,
      wolfDamage: 0.65,
      herdDamage: 0.65,
    });
  }
  assert.equal(battleCommandStatus(state).activeCommand, null);
  advanceGame(state, START + 13_000);
  assert.deepEqual(battleCommandEffects(state.battle), { attack: 1, wolfDamage: 1, herdDamage: 1 });
  advanceGame(state, START + 17_999);
  assert.equal(battleCommandStatus(state).cooldownTicksLeft, 1);
  for (const { id } of BATTLE_COMMANDS)
    rejectsUnchanged(state, { type: 'battleCommand', id }, 'BATTLE_COMMAND_COOLDOWN');
  assert.throws(() => order(state, 'focus', START - 1), { code: 'BATTLE_COMMAND_COOLDOWN' });
  advanceGame(state, START + 18_000);
  order(state, 'focus');
  assert.deepEqual(state.battle.commands, [
    { id: 'brace', tick: 6 },
    { id: 'focus', tick: 18 },
  ]);
  assert.equal(validateGame(state), true);
});

test('rally reduces existing panic once without healing, resurrecting or spending resources', () => {
  const state = prepare();
  rejectsUnchanged(state, { type: 'battleCommand', id: 'rally' }, 'BATTLE_COMMAND_NO_PANIC');
  state.herd.panic = 47.5;
  state.herd.hp -= 25;
  state.wolves[0].hp = 0;
  const before = structuredClone(state);
  order(state, 'rally');
  assert.equal(state.herd.panic, 27.5);
  assert.deepEqual(state.wolves, before.wolves);
  assert.deepEqual(state.resources, before.resources);
  assert.equal(state.herd.hp, before.herd.hp);
  assert.equal(battleCommandStatus(state).activeCommand, null);
  assert.equal(battleCommandStatus(state).cooldownTicksLeft, 12);
  rejectsUnchanged(state, { type: 'battleCommand', id: 'rally' }, 'BATTLE_COMMAND_COOLDOWN');
  const small = prepare();
  small.herd.panic = 0.5;
  order(small, 'rally');
  assert.equal(small.herd.panic, 0);
});

test('unknown IDs, missing fields, client clocks and arbitrary combat overrides are rejected', () => {
  const state = prepare();
  for (const action of [
    { type: 'battleCommand' },
    { type: 'battleCommand', id: 'retreat' },
    { type: 'battleCommand', id: '__proto__' },
    { type: 'battleCommand', id: 1 },
    { type: 'battleCommand', id: null },
    { type: 'battleCommand', id: 'brace', tick: 6 },
    { type: 'battleCommand', id: 'brace', cooldown: 0 },
    { type: 'battleCommand', id: 'focus', damage: 9999 },
    { type: 'battleCommand', id: 'rally', panic: 0 },
  ])
    rejectsUnchanged(state, action, 'INVALID_BATTLE_COMMAND');
});

test('orders produce identical combat under frequent polling, delayed polling and JSON reload', () => {
  for (let index = 0; index < TACTICS.length; index++) {
    const sparse = createGame(START);
    act(sparse, { type: 'startBattle' }, START, () => (index + 0.5) / TACTICS.length);
    const frequent = structuredClone(sparse);
    for (const [tick, id] of [
      [6, 'brace'],
      [18, 'focus'],
    ]) {
      advanceGame(sparse, START + tick * 1000);
      for (let at = frequent.updatedAt + 137; at < START + tick * 1000; at += 137)
        advanceGame(frequent, at);
      advanceGame(frequent, START + tick * 1000);
      assert.equal(sparse.battle.status, 'active');
      order(sparse, id);
      order(frequent, id);
    }
    const loaded = migrateGame(JSON.parse(JSON.stringify(sparse)));
    advanceGame(sparse, START + 90_000);
    advanceGame(loaded, START + 90_000);
    for (let at = frequent.updatedAt + 137; at < START + 90_000; at += 137)
      advanceGame(frequent, at);
    advanceGame(frequent, START + 90_000);
    assert.deepEqual(frequent, sparse, TACTICS[index]);
    assert.deepEqual(loaded, sparse, TACTICS[index]);
    assert.equal(validateGame(sparse), true);
    const finished = structuredClone(sparse);
    rejectsUnchanged(sparse, { type: 'battleCommand', id: 'brace' }, 'BATTLE_NOT_ACTIVE');
    advanceGame(sparse, START + 180_000);
    assert.deepEqual(sparse.wolves, finished.wolves);
    assert.equal(sparse.stats.wins, finished.stats.wins);
    assert.deepEqual(sparse.resources, finished.resources);
  }
});

test('commands are cleared on interrupted resume and next battle without clearing injuries or story', () => {
  const state = prepare();
  order(state, 'brace');
  advanceGame(state, START + 8000);
  const wolves = structuredClone(state.wolves);
  const herd = structuredClone(state.herd);
  const story = structuredClone(state.firstWatch);
  resumeGame(state, START + 60_000);
  assert.equal(state.battle.status, 'preparing');
  assert.deepEqual(state.battle.commands, []);
  assert.deepEqual(state.wolves, wolves);
  assert.deepEqual(state.herd, herd);
  assert.deepEqual(state.firstWatch, story);
  const completed = prepare();
  order(completed, 'focus');
  advanceGame(completed, START + 90_000);
  const chapter = structuredClone(completed.firstWatch);
  assert.ok(completed.battle.commands.length);
  act(completed, { type: 'newBattle' });
  assert.deepEqual(completed.battle.commands, []);
  assert.deepEqual(completed.firstWatch, chapter);
  assert.equal(validateGame(completed), true);
});

test('v1 and all valid additive v2 field combinations migrate without replacing existing data', () => {
  const legacy = createLegacyGame(START);
  const migratedLegacy = migrateGame(legacy);
  assert.deepEqual(migratedLegacy.battle, { ...legacy.battle, commands: [] });
  assert.equal(validateGame(migratedLegacy), true);
  for (const removeFirstWatch of [false, true]) {
    for (const removeCommands of [false, true]) {
      const old = prepare();
      if (removeFirstWatch) delete old.firstWatch;
      if (removeCommands) delete old.battle.commands;
      const before = structuredClone(old);
      const migrated = migrateGame(old);
      assert.deepEqual(old, before);
      assert.equal(validateGame(migrated), true);
      assert.deepEqual(migrated.battle, { ...before.battle, commands: [] });
      const comparable = structuredClone(migrated);
      if (removeFirstWatch) delete comparable.firstWatch;
      if (removeCommands) delete comparable.battle.commands;
      assert.deepEqual(comparable, before);
      assert.equal(migrateGame(migrated), migrated);
    }
  }
});

test('strict validation and migration reject malformed history even when older fields are missing', () => {
  const state = prepare();
  order(state, 'brace');
  advanceGame(state, START + 18_000);
  order(state, 'focus');
  const invalid = [
    null,
    {},
    ['brace'],
    [{ id: 'brace' }],
    [{ id: 'missing', tick: 6 }],
    [{ id: 'brace', tick: 5 }],
    [{ id: 'brace', tick: 6.5 }],
    [{ id: 'brace', tick: NaN }],
    [{ id: 'brace', tick: 19 }],
    [{ id: 'brace', tick: 6, duration: 99 }],
    [
      { id: 'brace', tick: 6 },
      { id: 'focus', tick: 17 },
    ],
    [
      { id: 'brace', tick: 18 },
      { id: 'focus', tick: 6 },
    ],
    Array.from({ length: 9 }, () => ({ id: 'brace', tick: 6 })),
  ];
  for (const commands of invalid) {
    for (const removeFirstWatch of [false, true]) {
      const broken = structuredClone(state);
      broken.battle.commands = commands;
      if (removeFirstWatch) delete broken.firstWatch;
      assert.equal(validateGame(broken), false);
      assert.throws(() => migrateGame(broken), { code: 'INVALID_SAVE' });
    }
  }
  const noCommands = structuredClone(state);
  delete noCommands.battle.commands;
  assert.equal(validateGame(noCommands), false);
  const preparing = createGame(START);
  preparing.battle.commands = [{ id: 'brace', tick: 6 }];
  assert.equal(validateGame(preparing), false);
  const extra = structuredClone(noCommands);
  extra.battle.unrecognized = true;
  assert.throws(() => migrateGame(extra), { code: 'INVALID_SAVE' });
});

test('orders arriving after automatic combat has ended cannot affect results or grant rewards', () => {
  const state = prepare();
  const expected = structuredClone(state);
  advanceGame(expected, START + 90_000);
  assert.throws(() => order(state, 'focus', START + 90_000), { code: 'BATTLE_NOT_ACTIVE' });
  assert.deepEqual(state, expected);
  assert.deepEqual(state.battle.commands, []);
  assert.equal(validateGame(state), true);
});
