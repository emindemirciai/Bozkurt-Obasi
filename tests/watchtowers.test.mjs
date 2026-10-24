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
  BUILDINGS,
  CORNER_PLOT_IDS,
  PLOTS,
  TOWER_PLOTS,
  ALL_PLOTS,
  demolitionQuote,
  visualTier,
} from '../shared/settlement.mjs';

import {
  createGame as createLegacyGame,
  applyAction as applyLegacyAction,
} from '../shared/legacy-v1.mjs';

import { fundStorage, previousSave } from './economy-fixtures.mjs';

const START = 1_000_000;
const act = (state, action) => applyAction(state, action, state.updatedAt, () => 0);
const fund = (state) => {
  for (const resource of Object.keys(state.resources)) state.resources[resource] = state.capacity;
};
const rejectUnchanged = (state, action, code) => {
  const before = structuredClone(state);
  assert.throws(() => act(state, action), { code });
  assert.deepEqual(state, before);
};
function supportedTowers(levels) {
  const state = fundStorage(createGame(START), 5, 'p14');
  for (const [index, level] of levels.entries()) {
    fund(state);
    act(state, { type: 'build', building: 'watchtower', plotId: CORNER_PLOT_IDS[index] });
    const tower = state.buildings.filter((building) => building.type === 'watchtower').at(-1);
    while (tower.level < level) {
      fund(state);
      act(state, { type: 'upgrade', id: tower.id });
    }
  }
  assert.equal(validateGame(state), true);
  return state;
}
function firstCombatDamage(state) {
  const copy = structuredClone(state);
  act(copy, { type: 'startBattle' });
  const initial = copy.battle.enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
  // The ambush entrance and formation take six ticks; tick seven is the first attack.
  advanceGame(copy, copy.updatedAt + 7000);
  return initial - copy.battle.enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
}

test('four reserved wall corners are independent of the unchanged 36 village plots', () => {
  assert.equal(Object.isFrozen(CORNER_PLOT_IDS), true);
  assert.deepEqual(CORNER_PLOT_IDS, ['t0', 't1', 't2', 't3']);
  assert.deepEqual(
    CORNER_PLOT_IDS.map((id) => {
      const { x, y } = ALL_PLOTS.find((plot) => plot.id === id);
      return [x, y];
    }),
    [
      [6, 0],
      [6, 1],
      [6, 2],
      [6, 3],
    ],
  );
  assert.equal(PLOTS.length, 36);
  assert.equal(TOWER_PLOTS.length, 4);
  assert.equal(ALL_PLOTS.length, 40);
  assert.ok(Object.isFrozen(TOWER_PLOTS) && TOWER_PLOTS.every(Object.isFrozen));
  assert.ok(Object.isFrozen(ALL_PLOTS));
  assert.equal(createGame(START).buildings.length, 0);
  assert.equal(BUILDINGS.find((building) => building.id === 'watchtower').maxCount, 4);
  for (const building of BUILDINGS.filter((entry) => entry.id !== 'watchtower'))
    assert.equal(
      building.maxCount,
      ['lumber', 'quarry', 'well', 'pasture', 'healer'].includes(building.id) ? 6 : 1,
    );
});

test('four towers charge rising copy prices at the selected corner; extra and occupied placements reject without spending', () => {
  const state = fundStorage(createGame(START), 1, 'p14');
  for (const plotId of CORNER_PLOT_IDS)
    act(state, { type: 'build', building: 'watchtower', plotId });
  assert.deepEqual(
    state.buildings.filter((building) => building.type === 'watchtower').map(({ id }) => id),
    [
      'building-watchtower',
      'building-watchtower-2',
      'building-watchtower-3',
      'building-watchtower-4',
    ],
  );
  assert.deepEqual(
    state.buildings.filter((building) => building.type === 'watchtower').map(({ x, y }) => [x, y]),
    [
      [6, 0],
      [6, 1],
      [6, 2],
      [6, 3],
    ],
  );
  assert.equal(state.resources.wood, 4500);
  assert.equal(state.resources.stone, 5600);
  assert.equal(
    state.buildings.every((building) => building.level === 1),
    true,
  );
  rejectUnchanged(
    state,
    { type: 'build', building: 'watchtower', plotId: 'p17' },
    'INVALID_BUILDING_PLOT',
  );
  rejectUnchanged(state, { type: 'build', building: 'watchtower', plotId: 't0' }, 'PLOT_OCCUPIED');
  assert.equal(validateGame(state), true);
  const forged = structuredClone(state);
  forged.buildings.push({ id: 'building-watchtower-5', type: 'watchtower', level: 1, x: 5, y: 2 });
  assert.equal(validateGame(forged), false);
});

test('every non-tower building is rejected at each tower plot, and towers reject every regular plot', () => {
  const state = createGame(START);
  for (const definition of BUILDINGS.filter((entry) => entry.id !== 'watchtower'))
    for (const { id: plotId } of TOWER_PLOTS)
      rejectUnchanged(
        state,
        { type: 'build', building: definition.id, plotId },
        'INVALID_BUILDING_PLOT',
      );
  for (const { id: plotId } of PLOTS)
    rejectUnchanged(
      state,
      { type: 'build', building: 'watchtower', plotId },
      'INVALID_BUILDING_PLOT',
    );
  act(state, { type: 'build', building: 'quarry', plotId: 'p0' });
  for (const plotId of CORNER_PLOT_IDS)
    rejectUnchanged(
      state,
      { type: 'moveBuilding', id: 'building-quarry', plotId },
      'INVALID_BUILDING_PLOT',
    );
  act(state, { type: 'moveBuilding', id: 'building-quarry', plotId: 'p35' });
  assert.equal(state.buildings[0].x, 5);
  assert.equal(state.buildings[0].y, 5);
  assert.equal(validateGame(state), true);
});

test('legacy paid towers move deterministically to free corner slots without changing any other player state', () => {
  const legacy = previousSave(supportedTowers([1, 3, 2, 5]));
  fund(legacy);
  legacy.buildings.push({ id: 'building-quarry', type: 'quarry', level: 1, x: 0, y: 0 });
  const towers = legacy.buildings.filter((building) => building.type === 'watchtower');
  for (const [index, tower] of towers.entries()) Object.assign(tower, { x: index + 1, y: 3 });
  const original = structuredClone(legacy);
  assert.equal(validateGame(legacy), false);
  const migrated = migrateGame(legacy);
  assert.notEqual(migrated, legacy);
  assert.deepEqual(legacy, original, 'migration never changes the input save');
  const expected = structuredClone(legacy);
  expected.buildings
    .filter((building) => building.type === 'watchtower')
    .forEach((tower, index) => Object.assign(tower, { x: 6, y: index }));
  assert.deepEqual(previousSave(migrated), expected);
  assert.equal(migrateGame(migrated), migrated, 'completed migration is idempotent');
  const reordered = structuredClone(legacy);
  reordered.buildings.reverse();
  const remapped = migrateGame(reordered);
  for (const tower of migrated.buildings.filter((building) => building.type === 'watchtower'))
    assert.deepEqual(
      remapped.buildings.find((entry) => entry.id === tower.id),
      tower,
    );
  assert.equal(validateGame(migrated), true);

  const mixed = structuredClone(legacy);
  Object.assign(
    mixed.buildings.find((building) => building.id === 'building-watchtower-4'),
    { x: 6, y: 0 },
  );
  const mixedMigrated = migrateGame(mixed);
  assert.deepEqual(
    mixedMigrated.buildings
      .filter((building) => building.type === 'watchtower')
      .map((tower) => tower.y),
    [1, 2, 3, 0],
  );
  assert.equal(migrateGame(mixedMigrated), mixedMigrated);
});

test('v1 and pre-tutorial v2 saves migrate paid towers while empty saves never gain free towers', () => {
  const legacy = createLegacyGame(START);
  applyLegacyAction(legacy, { type: 'build', building: 'watchtower' }, START);
  const priorTower = legacy.buildings.find((building) => building.type === 'watchtower');
  const migrated = migrateGame(legacy);
  assert.deepEqual(
    migrated.buildings.find((building) => building.type === 'watchtower'),
    {
      ...priorTower,
      x: 6,
      y: 0,
      costBasis: { legacyLevels: priorTower.level, constructionOrdinal: 1 },
    },
  );
  assert.deepEqual(migrated.resources, legacy.resources);
  assert.deepEqual(migrated.stats, legacy.stats);
  assert.equal(validateGame(migrated), true);
  const oldV2 = previousSave(supportedTowers([2]));
  Object.assign(
    oldV2.buildings.find((building) => building.type === 'watchtower'),
    { x: 3, y: 0 },
  );
  delete oldV2.firstWatch;
  delete oldV2.battle.commands;
  const upgraded = migrateGame(oldV2);
  assert.equal(validateGame(upgraded), true);
  assert.equal(upgraded.buildings.find((building) => building.type === 'watchtower').x, 6);
  const empty = createGame(START);
  assert.equal(migrateGame(empty), empty);
  assert.equal(empty.buildings.length, 0);
});

test('legacy tower migration rejects malformed coordinates, overlaps, duplicate ids and excess towers', () => {
  const legacy = previousSave(supportedTowers([1, 2, 3, 4]));
  legacy.buildings
    .filter((building) => building.type === 'watchtower')
    .forEach((tower, index) => Object.assign(tower, { x: index, y: 0 }));
  const corruptions = [
    (save) => {
      save.buildings.at(-1).x = 7;
    },
    (save) => {
      Object.assign(save.buildings.at(-1), { x: 6, y: 4 });
    },
    (save) => {
      save.buildings.at(-1).x = '3';
    },
    (save) => {
      Object.assign(save.buildings.at(-1), { x: 0, y: 0 });
    },
    (save) => {
      save.buildings.at(-1).id = 'building-watchtower';
    },
    (save) => {
      save.buildings.push({
        id: 'building-watchtower-5',
        type: 'watchtower',
        level: 1,
        x: 4,
        y: 0,
      });
    },
    (save) => {
      Object.assign(save.buildings[0], { x: 6, y: 0 });
    },
    (save) => {
      save.buildings.at(-1).level = 6;
    },
    (save) => {
      save.resources.wood = Number.NaN;
    },
  ];
  for (const corrupt of corruptions) {
    const broken = structuredClone(legacy);
    corrupt(broken);
    const before = structuredClone(broken);
    assert.equal(validateGame(broken, { allowLegacyTowerPlots: true }), false, corrupt.toString());
    assert.throws(() => migrateGame(broken), { code: 'INVALID_SAVE' }, corrupt.toString());
    assert.deepEqual(broken, before);
  }
});

test('each of four tower identities upgrades independently through all five levels and survives serialization', () => {
  const state = supportedTowers([1, 1, 1, 1]);
  const ids = state.buildings.filter((building) => building.type === 'watchtower').map((b) => b.id);
  for (let level = 2; level <= 5; level++) {
    for (const id of ids) {
      const others = structuredClone(state.buildings.filter((building) => building.id !== id));
      fund(state);
      act(state, { type: 'upgrade', id });
      const tower = state.buildings.find((building) => building.id === id);
      assert.equal(tower.level, level);
      assert.equal(visualTier(tower.level), level >= 5 ? 3 : level >= 3 ? 2 : 1);
      assert.deepEqual(
        state.buildings.filter((building) => building.id !== id),
        others,
      );
      assert.equal(validateGame(state), true);
    }
  }
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  for (const id of ids) rejectUnchanged(restored, { type: 'upgrade', id }, 'MAX_LEVEL');
});

test('built towers cannot move to regular plots, other corners, or even their own corner', () => {
  const state = supportedTowers([1, 3, 1, 1]);
  const id = 'building-watchtower-2';
  for (const plotId of ['p17', ...CORNER_PLOT_IDS])
    rejectUnchanged(state, { type: 'moveBuilding', id, plotId }, 'TOWER_FIXED');
  assert.equal(validateGame(state), true);
});

test('demolishing one upgraded tower refunds half its actual investment and frees one reusable tower slot', () => {
  const state = supportedTowers([1, 1, 1, 1]);
  const id = 'building-watchtower-3';
  const paid = { wood: 1500, stone: 1200 };
  for (let level = 2; level <= 5; level++) {
    fund(state);
    const before = { ...state.resources };
    act(state, { type: 'upgrade', id });
    paid.wood += before.wood - state.resources.wood;
    paid.stone += before.stone - state.resources.stone;
  }
  for (const resource of Object.keys(state.resources)) state.resources[resource] = 0;
  const others = structuredClone(state.buildings.filter((building) => building.id !== id));
  const quote = demolitionQuote(state, id);
  assert.equal(quote.canDemolish, true);
  assert.deepEqual(quote.investment, paid);
  act(state, { type: 'demolishBuilding', id, expected: quote.expected });
  assert.equal(state.resources.wood, paid.wood / 2);
  assert.equal(state.resources.stone, paid.stone / 2);
  assert.deepEqual(state.buildings, others);
  assert.equal(state.buildings.filter((building) => building.type === 'watchtower').length, 3);
  act(state, { type: 'build', building: 'watchtower', plotId: 't2' });
  assert.equal(state.buildings.at(-1).id, id);
  assert.equal(state.buildings.at(-1).level, 1);
  assert.equal(state.buildings.filter((building) => building.type === 'watchtower').length, 4);
  assert.equal(validateGame(state), true);
});

test('tower battle strength uses the highest level regardless of count or saved building order', () => {
  const four = supportedTowers([1, 4, 2, 3]);
  const fourDamage = firstCombatDamage(four);
  const singleDamage = firstCombatDamage(supportedTowers([4]));
  assert.ok(fourDamage > 0);
  assert.ok(singleDamage > 0);
  assert.equal(fourDamage, singleDamage);
  const reversed = structuredClone(four);
  reversed.buildings.reverse();
  assert.equal(firstCombatDamage(reversed), fourDamage);
  for (const level of [1, 5]) {
    const one = firstCombatDamage(supportedTowers([level]));
    const several = firstCombatDamage(supportedTowers([level, level, level, level]));
    assert.ok(one > 0);
    assert.ok(several > 0);
    assert.equal(several, one);
  }
});

test('upgrading a later tower improves combat without adding the levels of all towers together', () => {
  const state = supportedTowers([2, 1, 1, 1]);
  const before = firstCombatDamage(state);
  assert.ok(before > 0);
  fund(state);
  act(state, { type: 'upgrade', id: 'building-watchtower-4' });
  fund(state);
  act(state, { type: 'upgrade', id: 'building-watchtower-4' });
  const after = firstCombatDamage(state);
  assert.ok(after > before);
  assert.equal(after, firstCombatDamage(supportedTowers([3])));
  assert.equal(validateGame(state), true);
});
