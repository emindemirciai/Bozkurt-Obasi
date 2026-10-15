import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  migrateGame,
  applyAction,
  advanceGame,
  resumeGame,
  validateGame,
  getProduction,
} from '../shared/game.mjs';
import {
  createGame as createLegacyGame,
  applyAction as applyLegacyAction,
} from '../shared/legacy-v1.mjs';
import { PLOTS, BUILDINGS, visualTier, getWallUpgradeCost } from '../shared/settlement.mjs';
import { adventureQuote, ITEM_DEFINITIONS, REGIONS } from '../shared/adventures.mjs';

const START = 1_000_000;
const fresh = () => createGame(START);
const act = (state, action) => applyAction(state, action, state.updatedAt, () => 0);
const refill = (state) => {
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
};
const expedition = (state, extra = {}) =>
  act(state, {
    type: 'expedition',
    region: 'spring',
    difficulty: 'easy',
    wolfIds: ['wolf-scout'],
    ...extra,
  });
const finish = (state) => advanceGame(state, state.adventure.active.endsAt);
const totalXp = (wolf) => (45 * wolf.level * (wolf.level - 1)) / 2 + wolf.xp;
const unchangedFailure = (state, action, code) => {
  const before = structuredClone(state);
  assert.throws(() => act(state, action), { code });
  assert.deepEqual(state, before);
};

test('fresh villages have 36 freely selectable plots and no pre-placed buildings', () => {
  const state = fresh();
  assert.deepEqual(state.buildings, []);
  assert.deepEqual(state.walls, { level: 1 });
  assert.equal(PLOTS.length, 36);
  assert.equal(new Set(PLOTS.map((p) => `${p.x},${p.y}`)).size, 36);
  assert.deepEqual(getProduction(state), { water: 0, feed: 0, herbs: 0, wood: 0, stone: 0 });
  assert.equal(state.resources.wood, 450);
  assert.equal(state.resources.stone, 350);
  assert.equal(validateGame(JSON.parse(JSON.stringify(state))), true);
  state.wolves[0].ranks.leader++;
  state.inventory.leather_vest++;
  assert.equal(fresh().wolves[0].ranks.leader, 1);
  assert.equal(fresh().inventory.leather_vest, 0);
});

test('building uses exactly the requested plot and never silently falls back to another position', () => {
  const state = fresh();
  unchangedFailure(state, { type: 'build', building: 'quarry' }, 'INVALID_PLOT');
  unchangedFailure(
    state,
    { type: 'build', building: 'quarry', plotId: '__proto__' },
    'INVALID_PLOT',
  );
  act(state, { type: 'build', building: 'quarry', plotId: 'p35' });
  assert.deepEqual(state.buildings[0], {
    id: 'building-quarry',
    type: 'quarry',
    level: 1,
    x: 5,
    y: 5,
  });
  assert.equal(state.resources.wood, 380);
  assert.equal(state.resources.stone, 320);
  unchangedFailure(state, { type: 'build', building: 'lumber', plotId: 'p35' }, 'PLOT_OCCUPIED');
  act(state, { type: 'build', building: 'lumber', plotId: 'p0' });
  assert.deepEqual(state.buildings[1], {
    id: 'building-lumber',
    type: 'lumber',
    level: 1,
    x: 0,
    y: 0,
  });
  assert.equal(validateGame(state), true);
});

test('all main producers support six independent buildings with summed production', () => {
  const state = fresh();
  let plot = 0;
  for (const definition of BUILDINGS.filter((b) => b.maxCount === 6)) {
    for (let n = 0; n < 6; n++) {
      refill(state);
      act(state, { type: 'build', building: definition.id, plotId: `p${plot++}` });
      assert.equal(validateGame(state), true);
    }
    unchangedFailure(
      state,
      { type: 'build', building: definition.id, plotId: 'p35' },
      'BUILDING_LIMIT',
    );
  }
  assert.equal(state.buildings.length, 30);
  assert.equal(new Set(state.buildings.map((b) => b.id)).size, 30);
  assert.deepEqual(getProduction(state), { water: 84, feed: 72, herbs: 36, wood: 72, stone: 54 });
  refill(state);
  act(state, { type: 'build', building: 'hall', plotId: 'p34' });
  unchangedFailure(state, { type: 'build', building: 'hall', plotId: 'p35' }, 'BUILDING_EXISTS');
});

test('moving keeps building identity, upgrade level and resources and rejects occupied plots', () => {
  const state = fresh();
  act(state, { type: 'build', building: 'quarry', plotId: 'p0' });
  act(state, { type: 'upgrade', id: 'building-quarry' });
  act(state, { type: 'build', building: 'well', plotId: 'p35' });
  const resources = structuredClone(state.resources);
  act(state, { type: 'moveBuilding', id: 'building-quarry', plotId: 'p30' });
  assert.deepEqual(state.buildings[0], {
    id: 'building-quarry',
    type: 'quarry',
    level: 2,
    x: 0,
    y: 5,
  });
  assert.deepEqual(state.resources, resources);
  unchangedFailure(
    state,
    { type: 'moveBuilding', id: 'building-quarry', plotId: 'p35' },
    'PLOT_OCCUPIED',
  );
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(validateGame(restored), true);
  assert.deepEqual(restored.buildings, state.buildings);
});

test('walls spend their exact upgrade cost, retain valid state and stop at the castle tier', () => {
  const state = fresh();
  assert.deepEqual([1, 2, 3, 4, 5].map(visualTier), [1, 1, 2, 2, 3]);
  for (let level = 1; level < 5; level++) {
    refill(state);
    const cost = getWallUpgradeCost(state.walls);
    act(state, { type: 'upgradeWall' });
    assert.equal(state.walls.level, level + 1);
    assert.equal(state.resources.wood, state.capacity - cost.wood);
    assert.equal(state.resources.stone, state.capacity - cost.stone);
    assert.equal(validateGame(state), true);
  }
  assert.equal(getWallUpgradeCost(state.walls), null);
  unchangedFailure(state, { type: 'upgradeWall' }, 'MAX_LEVEL');
  const poor = fresh();
  poor.resources.stone = 0;
  unchangedFailure(poor, { type: 'upgradeWall' }, 'INSUFFICIENT_RESOURCES');
});

test('strict v1 migration preserves every old field and rejects damaged saves', () => {
  const legacy = createLegacyGame(START);
  applyLegacyAction(legacy, { type: 'build', building: 'quarry' }, START);
  applyLegacyAction(legacy, { type: 'train', id: 'wolf-alpha', path: 'guardian' }, START);
  applyLegacyAction(legacy, { type: 'travel', destination: 'highland' }, START);
  const before = structuredClone(legacy);
  const migrated = migrateGame(legacy);
  assert.deepEqual(legacy, before);
  assert.equal(migrated.version, 2);
  for (const key of Object.keys(legacy).filter((key) => !['version', 'wolves'].includes(key)))
    assert.deepEqual(migrated[key], legacy[key], key);
  assert.deepEqual(
    migrated.wolves.map(({ equipment, ...wolf }) => wolf),
    legacy.wolves,
  );
  assert.deepEqual(migrated.adventure.unlocked, ['homeland', 'spring', 'meadow', 'highland']);
  assert.ok(migrated.wolves.every((w) => w.equipment === null));
  assert.equal(validateGame(migrated), true);
  assert.equal(migrateGame(migrated), migrated);
  legacy.resources.wood = -1;
  assert.throws(() => migrateGame(legacy), { code: 'INVALID_SAVE' });
  assert.equal(legacy.version, 1);
});

test('new travel cannot bypass selected wolves or discovery, while old journeys still arrive', () => {
  const state = fresh();
  unchangedFailure(state, { type: 'travel', destination: 'spring' }, 'USE_CARAVAN');
  unchangedFailure(
    state,
    { type: 'caravan', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-alpha'] },
    'REGION_LOCKED',
  );
  unchangedFailure(
    state,
    { type: 'expedition', region: 'ruins', difficulty: 'easy', wolfIds: ['wolf-alpha'] },
    'REGION_LOCKED',
  );
  const old = createLegacyGame(START);
  applyLegacyAction(old, { type: 'travel', destination: 'spring' }, START);
  const migrated = migrateGame(old);
  advanceGame(migrated, migrated.journey.endsAt);
  assert.equal(migrated.journey, null);
  assert.equal(migrated.location, 'spring');
  assert.equal(validateGame(migrated), true);
});

test('expeditions charge once, discover regions and reward only the selected wolves exactly once', () => {
  const state = fresh();
  const quote = adventureQuote(state, { region: 'spring', wolfIds: ['wolf-scout'] });
  expedition(state);
  assert.equal(state.resources.water, 180 - quote.cost.water);
  assert.equal(state.resources.feed, 180 - quote.cost.feed);
  assert.equal(validateGame(state), true);
  advanceGame(state, state.adventure.active.endsAt - 1);
  assert.equal(state.inventory.leather_vest, 0);
  assert.equal(state.wolves[3].xp, 0);
  const endsAt = state.adventure.active.endsAt;
  finish(state);
  assert.equal(state.adventure.active, null);
  assert.deepEqual(state.adventure.unlocked, ['homeland', 'spring']);
  assert.equal(state.location, 'homeland');
  assert.equal(state.wolves[3].xp, quote.xp);
  assert.ok(state.wolves.filter((w) => w.id !== 'wolf-scout').every((w) => w.xp === 0));
  assert.equal(state.inventory.leather_vest, 1);
  assert.equal(state.adventure.history[0].completedAt, endsAt);
  const awarded = structuredClone(state);
  advanceGame(state, state.updatedAt + 10_000);
  assert.deepEqual(state.inventory, awarded.inventory);
  assert.deepEqual(state.wolves, awarded.wolves);
  assert.deepEqual(state.adventure.history, awarded.adventure.history);
  assert.equal(validateGame(state), true);
});

test('party, difficulty, health and concurrent mission failures spend no resources', () => {
  const state = fresh();
  for (const wolfIds of [[], ['wolf-scout', 'wolf-scout'], ['unknown'], 'wolf-scout'])
    unchangedFailure(
      state,
      { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds },
      'INVALID_PARTY',
    );
  unchangedFailure(
    state,
    { type: 'expedition', region: 'spring', difficulty: 'hard', wolfIds: ['wolf-scout'] },
    'PARTY_TOO_SMALL',
  );
  state.wolves[3].hp = 19;
  unchangedFailure(
    state,
    { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-scout'] },
    'INVALID_PARTY',
  );
  state.wolves[3].hp = 110;
  expedition(state);
  unchangedFailure(state, { type: 'startBattle' }, 'JOURNEY_ACTIVE');
  unchangedFailure(
    state,
    { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-alpha'] },
    'JOURNEY_ACTIVE',
  );
  unchangedFailure(state, { type: 'train', id: 'wolf-scout', path: 'guardian' }, 'WOLF_BUSY');
  act(state, { type: 'train', id: 'wolf-alpha', path: 'guardian' });
  assert.equal(validateGame(state), true);
});

test('difficulty increases party requirements and XP; progression discovers all regions and item types', () => {
  const state = fresh();
  const ids = ['wolf-alpha', 'wolf-guardian', 'wolf-hunter'];
  let expectedXp = 0;
  for (const region of REGIONS.slice(1)) {
    refill(state);
    const easy = adventureQuote(state, { region: region.id, difficulty: 'easy', wolfIds: ids });
    const hard = adventureQuote(state, { region: region.id, difficulty: 'hard', wolfIds: ids });
    assert.equal(hard.minimumWolves, 3);
    assert.equal(hard.xp, easy.xp * 3);
    assert.equal(hard.seconds, easy.seconds * 3);
    expedition(state, { region: region.id, difficulty: 'hard', wolfIds: ids });
    const saved = JSON.parse(JSON.stringify(state));
    resumeGame(saved, saved.adventure.active.endsAt + 1000);
    assert.equal(validateGame(saved), true);
    finish(state);
    expectedXp += hard.xp;
    assert.equal(totalXp(state.wolves[0]), expectedXp);
    assert.equal(state.wolves[3].xp, 0);
    assert.equal(validateGame(state), true);
  }
  assert.deepEqual(
    state.adventure.unlocked,
    REGIONS.map((r) => r.id),
  );
  assert.ok(ITEM_DEFINITIONS.every((item) => state.inventory[item.id] === 1));
});

test('caravan arrival changes location and keeps production, XP and rewards independent of polling frequency', () => {
  const state = fresh();
  act(state, { type: 'build', building: 'well', plotId: 'p0' });
  expedition(state);
  finish(state);
  act(state, {
    type: 'caravan',
    region: 'spring',
    difficulty: 'normal',
    wolfIds: ['wolf-alpha', 'wolf-guardian'],
  });
  const start = state.updatedAt;
  const end = state.adventure.active.endsAt;
  const frequent = structuredClone(state);
  advanceGame(state, end + 30_000);
  for (let now = start + 137; now < end + 30_000; now += 137) advanceGame(frequent, now);
  advanceGame(frequent, end + 30_000);
  assert.equal(state.location, 'spring');
  assert.equal(getProduction(state).water, 21);
  assert.equal(totalXp(state.wolves[0]), 60);
  assert.equal(totalXp(state.wolves[1]), 60);
  assert.equal(totalXp(state.wolves[3]), 30);
  assert.deepEqual(state.wolves, frequent.wolves);
  assert.deepEqual(state.inventory, frequent.inventory);
  for (const key of Object.keys(state.resources))
    assert.ok(Math.abs(state.resources[key] - frequent.resources[key]) < 1e-8, key);
  assert.equal(validateGame(state), true);
  assert.equal(validateGame(frequent), true);
});

test('equipment swaps conserve inventory, alter expedition time and cannot change while the wearer is away', () => {
  const state = fresh();
  state.inventory.scout_charm = 1;
  state.inventory.iron_guard = 1;
  const action = { type: 'equip', id: 'wolf-scout', item: 'scout_charm' };
  act(state, action);
  assert.equal(state.inventory.scout_charm, 0);
  assert.equal(adventureQuote(state, { wolfIds: ['wolf-scout'] }).seconds, 51);
  act(state, action);
  assert.equal(state.inventory.scout_charm, 0);
  expedition(state);
  unchangedFailure(state, { type: 'unequip', id: 'wolf-scout' }, 'WOLF_BUSY');
  unchangedFailure(state, { type: 'equip', id: 'wolf-scout', item: 'iron_guard' }, 'WOLF_BUSY');
  finish(state);
  act(state, { type: 'equip', id: 'wolf-scout', item: 'iron_guard' });
  assert.equal(state.inventory.scout_charm, 1);
  assert.equal(state.inventory.iron_guard, 0);
  act(state, { type: 'unequip', id: 'wolf-scout' });
  assert.equal(state.inventory.iron_guard, 1);
  assert.equal(state.wolves[3].equipment, null);
  assert.equal(validateGame(state), true);
});

test('full inventories never overflow or lose equipped items when a swap is rejected', () => {
  const state = fresh();
  state.inventory.leather_vest = 1;
  act(state, { type: 'equip', id: 'wolf-alpha', item: 'leather_vest' });
  state.inventory.leather_vest = 10000;
  state.inventory.iron_guard = 1;
  unchangedFailure(state, { type: 'unequip', id: 'wolf-alpha' }, 'INVENTORY_FULL');
  unchangedFailure(
    state,
    { type: 'equip', id: 'wolf-alpha', item: 'iron_guard' },
    'INVENTORY_FULL',
  );
  expedition(state);
  finish(state);
  assert.equal(state.inventory.leather_vest, 10000);
  assert.equal(state.adventure.history[0].itemCount, 0);
  assert.equal(validateGame(state), true);
});

test('battle introduction deals no damage, then armor improves attack and defense in actual combat', () => {
  const plain = fresh();
  const armored = fresh();
  armored.inventory.iron_guard = 5;
  for (const wolf of armored.wolves)
    act(armored, { type: 'equip', id: wolf.id, item: 'iron_guard' });
  act(plain, { type: 'startBattle' });
  act(armored, { type: 'startBattle' });
  const startWolves = structuredClone(plain.wolves);
  const startEnemies = structuredClone(plain.battle.enemies);
  advanceGame(plain, START + 6000);
  assert.deepEqual(plain.wolves, startWolves);
  assert.deepEqual(plain.battle.enemies, startEnemies);
  advanceGame(plain, START + 7000);
  advanceGame(armored, START + 7000);
  assert.ok(armored.battle.enemies[0].hp < plain.battle.enemies[0].hp);
  assert.ok(armored.wolves[1].hp > plain.wolves[1].hp);
  unchangedFailure(armored, { type: 'unequip', id: 'wolf-alpha' }, 'WOLF_BUSY');
  assert.equal(validateGame(plain), true);
  assert.equal(validateGame(armored), true);
});

test('healer equipment increases the real periodic combat heal', () => {
  const plain = fresh();
  plain.wolves[3].hp = 50;
  const equipped = structuredClone(plain);
  equipped.inventory.healer_satchel = 1;
  act(equipped, { type: 'equip', id: 'wolf-alpha', item: 'healer_satchel' });
  act(plain, { type: 'startBattle' });
  act(equipped, { type: 'startBattle' });
  advanceGame(plain, START + 8000);
  advanceGame(equipped, START + 8000);
  assert.equal(equipped.wolves[3].hp - plain.wolves[3].hp, 3);
});

test('combat heal reaches living wounded wolves when another guardian is down', () => {
  const plain = fresh();
  plain.wolves[3].hp = 50;
  const equipped = structuredClone(plain);
  equipped.inventory.healer_satchel = 1;
  act(equipped, { type: 'equip', id: 'wolf-guardian', item: 'healer_satchel' });
  for (const state of [plain, equipped]) {
    act(state, { type: 'startBattle' });
    state.wolves[0].hp = 0;
    assert.equal(validateGame(state), true);
    advanceGame(state, START + 7000);
  }
  const injuredScoutHp = plain.wolves[3].hp;
  advanceGame(plain, START + 8000);
  advanceGame(equipped, START + 8000);
  assert.ok(plain.wolves[3].hp > injuredScoutHp);
  assert.equal(equipped.wolves[3].hp - plain.wolves[3].hp, 3);
  for (const state of [plain, equipped]) {
    assert.equal(state.battle.status, 'active');
    assert.equal(state.wolves[0].hp, 0);
    assert.equal(validateGame(state), true);
  }
});

test('a healing tick safely ends combat when the last standing guardian falls', () => {
  const state = fresh();
  act(state, { type: 'startBattle' });
  advanceGame(state, START + 7000);
  for (const wolf of state.wolves) wolf.hp = wolf.name === 'healer' ? 1 : 0;
  assert.equal(validateGame(state), true);
  advanceGame(state, START + 8000);
  assert.equal(state.battle.status, 'lost');
  assert.equal(state.battle.tick, 8);
  // Defeat recovery returns guardians at one HP; combat healing does not revive them.
  assert.ok(state.wolves.every((wolf) => wolf.hp === 1));
  assert.equal(validateGame(state), true);
});

test('v2 validators reject forged plots, inventory, mission parties, route unlocks and reward reports', () => {
  const state = fresh();
  act(state, { type: 'build', building: 'quarry', plotId: 'p0' });
  expedition(state);
  const invalid = [
    (s) => {
      s.buildings[0].x = 6;
    },
    (s) => {
      s.buildings.push({ ...s.buildings[0], id: 'building-quarry-2' });
    },
    (s) => {
      s.walls.level = 6;
    },
    (s) => {
      s.inventory.scout_charm = 10001;
    },
    (s) => {
      s.inventory.scout_charm = 0.5;
    },
    (s) => {
      s.wolves[0].equipment = 'unlimited';
    },
    (s) => {
      s.adventure.active.wolfIds = ['wolf-scout', 'wolf-scout'];
    },
    (s) => {
      s.adventure.active.endsAt -= 1000;
    },
    (s) => {
      s.adventure.active.region = 'ruins';
    },
    (s) => {
      s.adventure.active.region = 'homeland';
    },
    (s) => {
      s.adventure.active.id = 'outing-0';
    },
    (s) => {
      s.adventure.unlocked = ['homeland', 'ruins'];
    },
  ];
  for (const [index, mutate] of invalid.entries()) {
    const corrupted = structuredClone(state);
    mutate(corrupted);
    assert.equal(validateGame(corrupted), false, `active mutation ${index}`);
  }
  finish(state);
  for (const [field, value] of [
    ['xp', 180],
    ['item', 'iron_guard'],
    ['itemCount', 2],
    ['completedAt', 0],
  ]) {
    const corrupted = structuredClone(state);
    corrupted.adventure.history[0][field] = value;
    assert.equal(validateGame(corrupted), false, field);
  }
  state.adventure.history[0].reward.wood = 499;
  assert.equal(validateGame(state), false);
});
