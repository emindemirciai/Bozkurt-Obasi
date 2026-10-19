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
  demolitionQuote,
  visualTier,
} from '../shared/settlement.mjs';

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
  const state = createGame(START);
  fund(state);
  act(state, { type: 'build', building: 'storage', plotId: 'p14' });
  fund(state);
  act(state, { type: 'upgrade', id: 'building-storage' });
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

test('the four suggested tower plots are immutable inner corners without restricting other building limits', () => {
  assert.equal(Object.isFrozen(CORNER_PLOT_IDS), true);
  assert.deepEqual(CORNER_PLOT_IDS, ['p0', 'p5', 'p30', 'p35']);
  assert.deepEqual(
    CORNER_PLOT_IDS.map((id) => {
      const { x, y } = PLOTS.find((plot) => plot.id === id);
      return [x, y];
    }),
    [
      [0, 0],
      [5, 0],
      [0, 5],
      [5, 5],
    ],
  );
  assert.equal(BUILDINGS.find((building) => building.id === 'watchtower').maxCount, 4);
  for (const building of BUILDINGS.filter((entry) => entry.id !== 'watchtower'))
    assert.equal(
      building.maxCount,
      ['lumber', 'quarry', 'well', 'pasture', 'healer'].includes(building.id) ? 6 : 1,
    );
});

test('four towers use their requested plots and existing recipes; a fifth rejects without spending', () => {
  const state = createGame(START);
  for (const plotId of CORNER_PLOT_IDS)
    act(state, { type: 'build', building: 'watchtower', plotId });
  assert.deepEqual(
    state.buildings.map(({ id }) => id),
    [
      'building-watchtower',
      'building-watchtower-2',
      'building-watchtower-3',
      'building-watchtower-4',
    ],
  );
  assert.deepEqual(
    state.buildings.map(({ x, y }) => [x, y]),
    [
      [0, 0],
      [5, 0],
      [0, 5],
      [5, 5],
    ],
  );
  assert.equal(state.resources.wood, 50);
  assert.equal(state.resources.stone, 70);
  assert.equal(
    state.buildings.every((building) => building.level === 1),
    true,
  );
  rejectUnchanged(
    state,
    { type: 'build', building: 'watchtower', plotId: 'p17' },
    'BUILDING_LIMIT',
  );
  assert.equal(validateGame(state), true);
  const forged = structuredClone(state);
  forged.buildings.push({ id: 'building-watchtower-5', type: 'watchtower', level: 1, x: 5, y: 2 });
  assert.equal(validateGame(forged), false);
});

test('earlier corner buildings and a non-corner tower survive reload without relocation or reserved plots', () => {
  const state = createGame(START);
  act(state, { type: 'build', building: 'quarry', plotId: 'p0' });
  act(state, { type: 'build', building: 'watchtower', plotId: 'p18' });
  const oldBuildings = structuredClone(state.buildings);
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.buildings, oldBuildings);
  act(restored, { type: 'build', building: 'watchtower', plotId: 'p5' });
  assert.deepEqual(restored.buildings.slice(0, 2), oldBuildings);
  rejectUnchanged(
    restored,
    { type: 'build', building: 'watchtower', plotId: 'p0' },
    'PLOT_OCCUPIED',
  );
  act(restored, { type: 'build', building: 'well', plotId: 'p30' });
  assert.deepEqual(restored.buildings.at(-1), {
    id: 'building-well',
    type: 'well',
    level: 1,
    x: 0,
    y: 5,
  });
  assert.equal(validateGame(restored), true);
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

test('moving an upgraded tower changes only its selected position and respects other occupants', () => {
  const state = supportedTowers([1, 3, 1, 1]);
  const id = 'building-watchtower-2';
  const others = structuredClone(state.buildings.filter((building) => building.id !== id));
  const resources = structuredClone(state.resources);
  act(state, { type: 'moveBuilding', id, plotId: 'p17' });
  assert.deepEqual(
    state.buildings.find((building) => building.id === id),
    {
      id,
      type: 'watchtower',
      level: 3,
      x: 5,
      y: 2,
    },
  );
  assert.deepEqual(state.resources, resources);
  assert.deepEqual(
    state.buildings.filter((building) => building.id !== id),
    others,
  );
  rejectUnchanged(state, { type: 'moveBuilding', id, plotId: 'p30' }, 'PLOT_OCCUPIED');
  assert.equal(validateGame(state), true);
});

test('demolishing one upgraded tower refunds half its actual investment and frees one reusable tower slot', () => {
  const state = supportedTowers([1, 1, 1, 1]);
  const id = 'building-watchtower-3';
  const paid = { wood: 100, stone: 70 };
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
  act(state, { type: 'build', building: 'watchtower', plotId: 'p17' });
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
