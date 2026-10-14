import {
  BUILDINGS,
  initializeSettlement,
  migrateSettlement,
  validateSettlement,
  placeBuilding,
  relocateBuilding,
  upgradeWall,
} from './settlement.mjs';
import {
  initializeAdventureState,
  migrateAdventureState,
  validateAdventureState,
  advanceAdventure,
  startExpedition,
  startCaravan,
  equipWolf,
  unequipWolf,
  isWolfBusy,
  equipmentBonuses,
  grantWolfXp,
} from './adventures.mjs';
import { validateGame as validateLegacyGame } from './legacy-v1.mjs';
export { BUILDINGS };
/** Shared, deterministic simulation. All rates are per minute; all clocks are UTC ms. */
export const RESOURCE_KEYS = Object.freeze(['water', 'feed', 'herbs', 'wood', 'stone']);
export const TACTICS = Object.freeze(['direct', 'left', 'right', 'double', 'rush']);
export const FORMATIONS = Object.freeze(['tight', 'balanced', 'wide']);
export const LOCATIONS = Object.freeze(['homeland', 'spring', 'meadow', 'highland', 'ruins']);

const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000;
const MAX_TIME = 8_640_000_000_000_000;
const PATHS = ['guardian', 'hunter', 'leader', 'healer'];
const WOLF_ROLES = ['alpha', 'guardian', 'hunter', 'scout', 'healer'];
const QUESTS = [
  { id: 'first_build', stat: 'builds', target: 1, reward: { wood: 35, stone: 25 } },
  { id: 'gatherer', stat: 'gathers', target: 3, reward: { water: 30, feed: 30, herbs: 10 } },
  { id: 'first_victory', stat: 'wins', target: 1, reward: { wood: 90, stone: 60, herbs: 25 } },
  { id: 'pack_training', stat: 'trained', target: 2, reward: { herbs: 15, feed: 40 } },
];
const TACTIC_STATS = {
  direct: { attack: 1, damage: 1, herd: 1 },
  left: { attack: 1.1, damage: 0.95, herd: 0.95 },
  right: { attack: 1.05, damage: 0.85, herd: 0.8 },
  double: { attack: 1.22, damage: 1.16, herd: 1.12 },
  rush: { attack: 1.38, damage: 1.4, herd: 1.35 },
};

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 1e6) / 1e6;
const levelOf = (state, type) =>
  state.buildings.find((building) => building.type === type)?.level || 0;

function checkClock(now) {
  if (!Number.isSafeInteger(now) || now < 0 || now > MAX_TIME) fail('INVALID_CLOCK');
}

function log(state, key, at) {
  state.log.push({ key, at });
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
}

function addResources(state, amounts) {
  for (const key of RESOURCE_KEYS)
    state.resources[key] = clamp(state.resources[key] + (amounts[key] || 0), 0, state.capacity);
}

function spend(state, amounts) {
  for (const [key, value] of Object.entries(amounts)) {
    if (state.resources[key] < value) fail('INSUFFICIENT_RESOURCES');
  }
  for (const [key, value] of Object.entries(amounts)) state.resources[key] -= value;
}

function refreshQuests(state) {
  for (const quest of state.quests) {
    const definition = QUESTS.find((entry) => entry.id === quest.id);
    quest.progress = Math.min(quest.target, state.stats[definition.stat]);
  }
}

function makeEnemies(wave) {
  const roles = wave >= 4 ? ['raider', 'brute', 'archer', 'raider'] : ['raider', 'brute', 'archer'];
  return roles.map((role, index) => {
    const maxHp = Math.round(
      (role === 'brute' ? 260 : role === 'archer' ? 170 : 210) * (1 + (wave - 1) * 0.12),
    );
    return { id: `enemy-${wave}-${index}`, role, hp: maxHp, maxHp };
  });
}

function makeBattle(wave = 1, tactic = 'direct') {
  return {
    status: 'preparing',
    wave,
    tactic,
    tick: 0,
    startedAt: null,
    enemies: makeEnemies(wave),
    log: [],
  };
}

export function createGame(now = Date.now()) {
  checkClock(now);
  const state = {
    version: 2,
    updatedAt: now,
    collectReadyAt: now,
    resources: { water: 180, feed: 180, herbs: 80, wood: 450, stone: 350 },
    capacity: 500,
    ...initializeSettlement(),
    wolves: WOLF_ROLES.map((name, index) => ({
      id: `wolf-${name}`,
      name,
      level: 1,
      xp: 0,
      points: 2,
      hp: [140, 170, 120, 110, 100][index],
      maxHp: [140, 170, 120, 110, 100][index],
      ranks: {
        guardian: name === 'guardian' ? 1 : 0,
        hunter: ['hunter', 'scout'].includes(name) ? 1 : 0,
        leader: name === 'alpha' ? 1 : 0,
        healer: name === 'healer' ? 1 : 0,
      },
    })),
    herd: { count: 24, hp: 240, maxHp: 240, panic: 0 },
    formation: { wolf: 'balanced', herd: 'balanced' },
    battle: makeBattle(),
    stats: { wins: 0, builds: 0, gathers: 0, trained: 0 },
    quests: QUESTS.map(({ id, target }) => ({ id, progress: 0, target, claimed: false })),
    log: [{ key: 'villageFounded', at: now }],
    location: 'homeland',
    journey: null,
  };
  return initializeAdventureState(state);
}

export function migrateGame(state) {
  if (state?.version === 2) return state;
  if (!validateLegacyGame(state)) fail('INVALID_SAVE');
  const migrated = structuredClone(state);
  migrateSettlement(migrated);
  migrateAdventureState(migrated);
  migrated.version = 2;
  if (!validateGame(migrated)) fail('INVALID_SAVE');
  return migrated;
}

export function getUpgradeCost(building) {
  const definition = BUILDINGS.find((entry) => entry.id === building.type);
  if (!definition) fail('INVALID_BUILDING');
  return Object.fromEntries(
    Object.entries(definition.cost).map(([key, cost]) => [
      key,
      Math.ceil(cost * 1.55 ** building.level),
    ]),
  );
}

export function getProduction(state) {
  const rates = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));
  for (const building of state.buildings) {
    const definition = BUILDINGS.find((entry) => entry.id === building.type);
    for (const key of RESOURCE_KEYS) rates[key] += definition.production[key] * building.level;
  }
  if (state.location === 'spring') rates.water *= 1.5;
  if (state.location === 'meadow') rates.feed *= 1.5;
  if (state.location === 'highland') rates.stone *= 1.5;
  return rates;
}

function finishBattle(state, won, at) {
  state.battle.status = won ? 'won' : 'lost';
  state.battle.log.push(won ? 'battleWon' : 'battleLost');
  log(state, won ? 'battleWon' : 'battleLost', at);
  for (const wolf of state.wolves) {
    // Wounded guardians always return; there is no permanent wolf death.
    wolf.hp = Math.max(1, wolf.hp);
    if (won) {
      grantWolfXp(wolf, 35 + state.battle.wave * 5);
    }
  }
  if (won) {
    state.stats.wins += 1;
    addResources(state, {
      wood: 45 + state.battle.wave * 10,
      stone: 25 + state.battle.wave * 8,
      herbs: 12,
      feed: 20,
    });
    state.herd.panic = Math.max(0, state.herd.panic - 15);
  } else {
    state.herd.count = Math.max(6, state.herd.count - 2);
    state.herd.maxHp = state.herd.count * 10;
    state.herd.hp = Math.max(
      Math.round(state.herd.maxHp * 0.3),
      Math.min(state.herd.hp, state.herd.maxHp),
    );
    state.herd.panic = Math.min(100, state.herd.panic + 10);
  }
  refreshQuests(state);
}

function battleTick(state, at) {
  const battle = state.battle;
  battle.tick += 1;
  if (battle.tick <= 6) return;
  const livingWolves = state.wolves.filter((wolf) => wolf.hp > 0);
  const livingEnemies = battle.enemies.filter((enemy) => enemy.hp > 0);
  if (!livingWolves.length || state.herd.hp <= 0 || state.herd.panic >= 100)
    return finishBattle(state, false, at);
  if (!livingEnemies.length) return finishBattle(state, true, at);
  const tactic = TACTIC_STATS[battle.tactic];
  const formationAttack = { tight: 0.9, balanced: 1, wide: 1.15 }[state.formation.wolf];
  const formationDefense = { tight: 0.78, balanced: 1, wide: 1.2 }[state.formation.wolf];
  const teamAttack = livingWolves.reduce(
    (sum, wolf) =>
      sum +
      4 +
      wolf.level * 0.8 +
      wolf.ranks.hunter * 1.2 +
      wolf.ranks.leader * 0.3 +
      equipmentBonuses(wolf).attack,
    0,
  );
  let damage = Math.round(
    (teamAttack + levelOf(state, 'hall') + levelOf(state, 'watchtower') * 2) *
      tactic.attack *
      formationAttack,
  );
  // Cleave remaining damage into the next enemy so frame rate cannot change outcomes.
  for (const enemy of livingEnemies) {
    const hit = Math.min(enemy.hp, damage);
    enemy.hp -= hit;
    damage -= hit;
    if (damage <= 0) break;
  }
  const survivingEnemies = battle.enemies.filter((enemy) => enemy.hp > 0);
  if (!survivingEnemies.length) return finishBattle(state, true, at);
  const pressure = survivingEnemies.length / battle.enemies.length;
  const defender = livingWolves[(battle.tick - 1) % livingWolves.length];
  const reduction =
    1 /
    (1 +
      defender.ranks.guardian * 0.12 +
      levelOf(state, 'shelter') * 0.08 +
      equipmentBonuses(defender).defense * 0.04);
  defender.hp = Math.max(
    0,
    defender.hp -
      Math.max(
        1,
        Math.round(
          (14 + battle.wave * 2) * pressure * tactic.damage * formationDefense * reduction,
        ),
      ),
  );
  const herdDefense = { tight: 0.7, balanced: 1, wide: 1.25 }[state.formation.herd];
  const leaderRanks = livingWolves.reduce((sum, wolf) => sum + wolf.ranks.leader, 0);
  state.herd.hp = Math.max(
    0,
    state.herd.hp -
      Math.max(
        1,
        Math.round(
          ((3 + battle.wave) * pressure * tactic.herd * herdDefense) /
            (1 + levelOf(state, 'shelter') * 0.1),
        ),
      ),
  );
  state.herd.panic = round(
    clamp(
      state.herd.panic +
        (pressure * (state.formation.herd === 'tight' ? 1.5 : 1.1)) / (1 + leaderRanks * 0.15),
      0,
      100,
    ),
  );
  if (battle.tick % 4 === 0) {
    const heal =
      livingWolves.reduce(
        (sum, wolf) => sum + wolf.ranks.healer * 3 + equipmentBonuses(wolf).healing,
        0,
      ) +
      levelOf(state, 'healer') * 2;
    const wounded = [...state.wolves].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (wounded.hp > 0) wounded.hp = Math.min(wounded.maxHp, wounded.hp + heal);
    battle.log.push('battleExchange');
  }
  if (
    state.herd.hp <= 0 ||
    state.herd.panic >= 100 ||
    state.wolves.every((wolf) => wolf.hp <= 0) ||
    battle.tick >= 90
  )
    finishBattle(state, false, at);
}

/** Advance once from the last server timestamp. Earlier clocks never rewind state. */
export function advanceGame(state, now = Date.now()) {
  checkClock(now);
  if (now <= state.updatedAt) return state;
  const elapsed = Math.min(now - state.updatedAt, MAX_OFFLINE_MS);
  const start = now - elapsed;
  if (state.battle.status === 'active') {
    const dueTicks = Math.min(90, Math.floor((now - state.battle.startedAt) / 1000));
    while (state.battle.status === 'active' && state.battle.tick < dueTicks)
      battleTick(state, state.battle.startedAt + (state.battle.tick + 1) * 1000);
    // Migration resumes at the actual battle end, even if the browser polls late.
    const activeUntil =
      state.battle.status === 'active' ? now : state.battle.startedAt + state.battle.tick * 1000;
    if (state.journey) state.journey.endsAt += Math.max(0, activeUntil - state.updatedAt);
  }
  if (state.adventure.active && state.adventure.active.endsAt <= now) {
    const arrival = state.adventure.active.endsAt;
    const before = Math.max(0, Math.min(elapsed, arrival - start));
    const rates = getProduction(state);
    addResources(
      state,
      Object.fromEntries(RESOURCE_KEYS.map((key) => [key, (rates[key] * before) / 60000])),
    );
    advanceAdventure(state, now);
    const afterRates = getProduction(state);
    addResources(
      state,
      Object.fromEntries(
        RESOURCE_KEYS.map((key) => [key, (afterRates[key] * (elapsed - before)) / 60000]),
      ),
    );
    state.updatedAt = now;
    return state;
  }
  // Split production at arrival so polling frequency cannot grant destination bonuses early.
  if (state.journey && state.journey.endsAt <= now) {
    const beforeArrival = Math.max(0, Math.min(elapsed, state.journey.endsAt - start));
    const beforeRates = getProduction(state);
    addResources(
      state,
      Object.fromEntries(
        RESOURCE_KEYS.map((key) => [key, (beforeRates[key] * beforeArrival) / 60_000]),
      ),
    );
    state.location = state.journey.destination;
    const afterRates = getProduction(state);
    addResources(
      state,
      Object.fromEntries(
        RESOURCE_KEYS.map((key) => [key, (afterRates[key] * (elapsed - beforeArrival)) / 60_000]),
      ),
    );
    log(state, 'journeyArrived', state.journey.endsAt);
    state.journey = null;
  } else {
    const rates = getProduction(state);
    addResources(
      state,
      Object.fromEntries(RESOURCE_KEYS.map((key) => [key, (rates[key] * elapsed) / 60_000])),
    );
  }
  state.updatedAt = now;
  return state;
}

/** Restore a saved session without replaying an unattended combat encounter. */
export function resumeGame(state, now = Date.now()) {
  checkClock(now);
  const at = Math.max(now, state.updatedAt);
  const interrupted = state.battle.status === 'active';
  if (interrupted) {
    if (state.journey) state.journey.endsAt += at - state.updatedAt;
    state.battle = makeBattle(state.battle.wave, state.battle.tactic);
  }
  advanceGame(state, at);
  if (interrupted) log(state, 'battleInterrupted', at);
  return state;
}

function requirePeace(state) {
  if (state.battle.status === 'active') fail('BATTLE_ACTIVE');
}

function requireHome(state) {
  if (state.journey || state.adventure.active) fail('JOURNEY_ACTIVE');
}

/** Apply one command. The authoritative caller supplies time and persists the result. */
export function applyAction(state, action, now = Date.now(), random = Math.random) {
  checkClock(now);
  if (
    !action ||
    typeof action !== 'object' ||
    Array.isArray(action) ||
    typeof action.type !== 'string'
  )
    fail('INVALID_ACTION');
  advanceGame(state, now);
  const at = state.updatedAt;
  switch (action.type) {
    case 'build': {
      placeBuilding(state, action.building, action.plotId);
      state.stats.builds += 1;
      log(state, 'buildingBuilt', at);
      break;
    }
    case 'moveBuilding':
      relocateBuilding(state, action.id, action.plotId);
      log(state, 'buildingMoved', at);
      break;
    case 'upgradeWall':
      upgradeWall(state);
      log(state, 'wallUpgraded', at);
      break;
    case 'expedition':
      startExpedition(state, action, at);
      log(state, 'expeditionStarted', at);
      break;
    case 'caravan':
      startCaravan(state, action, at);
      log(state, 'caravanStarted', at);
      break;
    case 'equip':
      equipWolf(state, action);
      break;
    case 'unequip':
      unequipWolf(state, action);
      break;
    case 'upgrade': {
      requirePeace(state);
      const building = state.buildings.find((entry) => entry.id === action.id);
      if (!building) fail('INVALID_BUILDING');
      if (building.level >= 5) fail('MAX_LEVEL');
      spend(state, getUpgradeCost(building));
      building.level += 1;
      if (building.type === 'storage') state.capacity += 250;
      if (building.type === 'hall') state.capacity += 100;
      log(state, 'buildingUpgraded', at);
      break;
    }
    case 'collect':
      if (at < state.collectReadyAt) fail('COLLECT_COOLDOWN');
      addResources(state, { wood: 14, stone: 9, water: 8, feed: 8 });
      state.collectReadyAt = at + 8000;
      state.stats.gathers += 1;
      log(state, 'resourcesCollected', at);
      break;
    case 'formation':
      requirePeace(state);
      if (!['wolf', 'herd'].includes(action.unit) || !FORMATIONS.includes(action.value))
        fail('INVALID_FORMATION');
      state.formation[action.unit] = action.value;
      log(state, 'formationChanged', at);
      break;
    case 'startBattle':
      if (state.adventure.active) fail('JOURNEY_ACTIVE');
      if (state.battle.status !== 'preparing')
        fail(state.battle.status === 'active' ? 'BATTLE_ACTIVE' : 'BATTLE_FINISHED');
      if (
        state.herd.hp < 30 ||
        state.herd.panic >= 85 ||
        state.wolves.filter((wolf) => wolf.hp >= 20).length < 3
      )
        fail('PACK_EXHAUSTED');
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) fail('INVALID_RANDOM');
      spend(state, { water: 12, feed: 16 });
      state.battle.tactic = TACTICS[Math.floor(draw * TACTICS.length)];
      state.battle.status = 'active';
      state.battle.startedAt = at;
      state.battle.log = ['battleStarted'];
      log(state, 'battleStarted', at);
      break;
    case 'newBattle':
      requirePeace(state);
      if (!['won', 'lost'].includes(state.battle.status)) fail('BATTLE_NOT_FINISHED');
      if (state.battle.wave >= 100 && state.battle.status === 'won') fail('CAMPAIGN_COMPLETE');
      state.battle = makeBattle(
        state.battle.wave + (state.battle.status === 'won' ? 1 : 0),
        state.battle.tactic,
      );
      log(state, 'battlePrepared', at);
      break;
    case 'healHerd':
      requirePeace(state);
      if (state.herd.hp === state.herd.maxHp && state.herd.panic === 0) fail('ALREADY_HEALTHY');
      spend(state, { herbs: 1 });
      state.herd.hp = Math.min(state.herd.maxHp, state.herd.hp + 75);
      state.herd.panic = Math.max(0, state.herd.panic - 25);
      log(state, 'herdHealed', at);
      break;
    case 'rest':
      requirePeace(state);
      requireHome(state);
      if (
        state.wolves.every((wolf) => wolf.hp === wolf.maxHp) &&
        state.herd.hp === state.herd.maxHp &&
        state.herd.panic === 0
      )
        fail('ALREADY_HEALTHY');
      spend(state, { water: 25, feed: 30 });
      for (const wolf of state.wolves) wolf.hp = wolf.maxHp;
      state.herd.hp = Math.min(state.herd.maxHp, state.herd.hp + 25);
      state.herd.panic = Math.max(0, state.herd.panic - 30);
      log(state, 'packRested', at);
      break;
    case 'train': {
      requirePeace(state);
      const wolf = state.wolves.find((entry) => entry.id === action.id);
      if (!wolf || !PATHS.includes(action.path)) fail('INVALID_TRAINING');
      if (isWolfBusy(state, wolf.id)) fail('WOLF_BUSY');
      if (wolf.points <= 0) fail('NO_SKILL_POINTS');
      if (wolf.ranks[action.path] >= 5) fail('MAX_LEVEL');
      spend(state, { herbs: 8, feed: 12 });
      wolf.points -= 1;
      wolf.ranks[action.path] += 1;
      const health = action.path === 'guardian' ? 4 : 2;
      wolf.maxHp += health;
      wolf.hp += health;
      state.stats.trained += 1;
      log(state, 'wolfTrained', at);
      break;
    }
    case 'travel': {
      if (!LOCATIONS.includes(action.destination)) fail('INVALID_DESTINATION');
      // Existing saved journeys finish above, but new travel must select an escort party.
      fail('USE_CARAVAN');
    }
    case 'claimQuest': {
      const quest = state.quests.find((entry) => entry.id === action.id);
      if (!quest) fail('INVALID_QUEST');
      if (quest.claimed) fail('QUEST_CLAIMED');
      if (quest.progress < quest.target) fail('QUEST_INCOMPLETE');
      quest.claimed = true;
      addResources(state, QUESTS.find((entry) => entry.id === quest.id).reward);
      log(state, 'questClaimed', at);
      break;
    }
    default:
      fail('INVALID_ACTION');
  }
  refreshQuests(state);
  return state;
}

const record = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const number = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const exactKeys = (value, keys) =>
  record(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const time = (value) => integer(value, 0, MAX_TIME);
const machineKey = (value) =>
  typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);

/** Reject corrupted/imported states, including every nested non-finite numeric value. */
export function validateGame(state) {
  try {
    if (
      !exactKeys(state, [
        'version',
        'updatedAt',
        'collectReadyAt',
        'resources',
        'capacity',
        'buildings',
        'wolves',
        'herd',
        'formation',
        'battle',
        'stats',
        'quests',
        'log',
        'location',
        'journey',
        'walls',
        'inventory',
        'adventure',
      ])
    )
      return false;
    if (
      state.version !== 2 ||
      !time(state.updatedAt) ||
      !time(state.collectReadyAt) ||
      !integer(state.capacity, 500, 2150)
    )
      return false;
    if (
      !exactKeys(state.resources, RESOURCE_KEYS) ||
      !RESOURCE_KEYS.every((key) => number(state.resources[key], 0, state.capacity))
    )
      return false;
    if (!validateSettlement(state) || !validateAdventureState(state)) return false;
    if (
      state.capacity !==
      500 + Math.max(0, levelOf(state, 'hall') - 1) * 100 + levelOf(state, 'storage') * 250
    )
      return false;
    if (!Array.isArray(state.wolves) || state.wolves.length !== 5) return false;
    const names = new Set();
    for (const wolf of state.wolves) {
      if (
        !exactKeys(wolf, [
          'id',
          'name',
          'level',
          'xp',
          'points',
          'hp',
          'maxHp',
          'ranks',
          'equipment',
        ]) ||
        !WOLF_ROLES.includes(wolf.name) ||
        names.has(wolf.name) ||
        wolf.id !== `wolf-${wolf.name}`
      )
        return false;
      if (
        !integer(wolf.level, 1, 20) ||
        !integer(wolf.xp, 0, wolf.level * 45 - 1) ||
        !integer(wolf.points, 0, 21) ||
        !integer(wolf.maxHp, 100, 500) ||
        !number(wolf.hp, 0, wolf.maxHp)
      )
        return false;
      if (!exactKeys(wolf.ranks, PATHS) || !PATHS.every((path) => integer(wolf.ranks[path], 0, 5)))
        return false;
      names.add(wolf.name);
    }
    if (
      !exactKeys(state.herd, ['count', 'hp', 'maxHp', 'panic']) ||
      !integer(state.herd.count, 6, 24) ||
      state.herd.maxHp !== state.herd.count * 10 ||
      !number(state.herd.hp, 0, state.herd.maxHp) ||
      !number(state.herd.panic, 0, 100)
    )
      return false;
    if (
      !exactKeys(state.formation, ['wolf', 'herd']) ||
      !FORMATIONS.includes(state.formation.wolf) ||
      !FORMATIONS.includes(state.formation.herd)
    )
      return false;
    const battle = state.battle;
    if (
      !exactKeys(battle, ['status', 'wave', 'tactic', 'tick', 'startedAt', 'enemies', 'log']) ||
      !['preparing', 'active', 'won', 'lost'].includes(battle.status) ||
      !integer(battle.wave, 1, 100) ||
      !TACTICS.includes(battle.tactic) ||
      !integer(battle.tick, 0, 90)
    )
      return false;
    if (
      battle.status === 'preparing'
        ? battle.startedAt !== null || battle.tick !== 0
        : !time(battle.startedAt) || battle.startedAt > state.updatedAt
    )
      return false;
    if (!Array.isArray(battle.enemies) || battle.enemies.length !== (battle.wave >= 4 ? 4 : 3))
      return false;
    const expectedEnemies = makeEnemies(battle.wave);
    for (let index = 0; index < battle.enemies.length; index += 1) {
      const enemy = battle.enemies[index];
      const expected = expectedEnemies[index];
      if (
        !exactKeys(enemy, ['id', 'role', 'hp', 'maxHp']) ||
        enemy.id !== expected.id ||
        enemy.role !== expected.role ||
        enemy.maxHp !== expected.maxHp ||
        !integer(enemy.hp, 0, enemy.maxHp)
      )
        return false;
      if (battle.status === 'preparing' && enemy.hp !== enemy.maxHp) return false;
    }
    if (battle.status === 'won' && battle.enemies.some((enemy) => enemy.hp > 0)) return false;
    if (!Array.isArray(battle.log) || battle.log.length > 25 || !battle.log.every(machineKey))
      return false;
    if (
      !exactKeys(state.stats, ['wins', 'builds', 'gathers', 'trained']) ||
      !Object.values(state.stats).every((value) => integer(value, 0, 1_000_000))
    )
      return false;
    if (!Array.isArray(state.quests) || state.quests.length !== QUESTS.length) return false;
    const questIds = new Set();
    for (const quest of state.quests) {
      const definition = QUESTS.find((entry) => entry.id === quest?.id);
      if (
        !exactKeys(quest, ['id', 'progress', 'target', 'claimed']) ||
        !definition ||
        questIds.has(quest.id) ||
        quest.target !== definition.target ||
        quest.progress !== Math.min(quest.target, state.stats[definition.stat]) ||
        typeof quest.claimed !== 'boolean' ||
        (quest.claimed && quest.progress !== quest.target)
      )
        return false;
      questIds.add(quest.id);
    }
    if (
      !Array.isArray(state.log) ||
      state.log.length > 60 ||
      !state.log.every(
        (entry) =>
          exactKeys(entry, ['key', 'at']) &&
          machineKey(entry.key) &&
          time(entry.at) &&
          entry.at <= state.updatedAt,
      )
    )
      return false;
    if (!LOCATIONS.includes(state.location)) return false;
    if (
      state.journey !== null &&
      (!exactKeys(state.journey, ['destination', 'endsAt']) ||
        !LOCATIONS.includes(state.journey.destination) ||
        state.journey.destination === state.location ||
        !time(state.journey.endsAt) ||
        state.journey.endsAt <= state.updatedAt)
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
