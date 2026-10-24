/** Settlement coordinates are authoritative save data, independent of presentation. */
import { REFUND_RESERVE_LIMIT } from './economy.mjs';
const RESOURCES = ['water', 'feed', 'herbs', 'wood', 'stone'];
const PRODUCERS = ['lumber', 'quarry', 'well', 'pasture', 'healer'];
export const BASE_CAPACITY = 1000;
export const STORAGE_CAPACITY_BONUSES = Object.freeze([0, 9000, 49000, 249000, 999000, 4999000]);

/** Capacity is derived from paid building levels, never supplied by a client action. */
export function getStorageCapacity(state) {
  const level = (type) => state.buildings.find((building) => building.type === type)?.level || 0;
  return (
    BASE_CAPACITY +
    STORAGE_CAPACITY_BONUSES[level('storage')] +
    Math.max(0, level('hall') - 1) * 100
  );
}
export const BUILDINGS = Object.freeze(
  [
    { id: 'hall', cost: { wood: 600, stone: 450 }, production: {} },
    { id: 'lumber', cost: { wood: 180, stone: 100 }, production: { wood: 0.6 } },
    { id: 'quarry', cost: { wood: 220, stone: 120 }, production: { stone: 0.45 } },
    { id: 'well', cost: { wood: 160, stone: 90 }, production: { water: 0.7 } },
    { id: 'pasture', cost: { wood: 200, stone: 120 }, production: { feed: 0.6 } },
    { id: 'healer', cost: { wood: 320, stone: 240 }, production: { herbs: 0.3 } },
    { id: 'storage', cost: { wood: 900, stone: 750 }, production: {} },
    { id: 'watchtower', cost: { wood: 500, stone: 400 }, production: {} },
    { id: 'shelter', cost: { wood: 420, stone: 300 }, production: {} },
  ].map((building) =>
    Object.freeze({
      ...building,
      maxLevel: 5,
      maxCount: building.id === 'watchtower' ? 4 : PRODUCERS.includes(building.id) ? 6 : 1,
      cost: Object.freeze(building.cost),
      production: Object.freeze(
        Object.fromEntries(RESOURCES.map((key) => [key, building.production[key] || 0])),
      ),
    }),
  ),
);

export const PLOTS = Object.freeze(
  Array.from({ length: 36 }, (_, index) =>
    Object.freeze({
      id: `p${index}`,
      x: index % 6,
      y: Math.floor(index / 6),
    }),
  ),
);

/** Reserved wall corners are separate from the 36 freely placed village buildings. */
export const TOWER_PLOTS = Object.freeze(
  Array.from({ length: 4 }, (_, index) => Object.freeze({ id: `t${index}`, x: 6, y: index })),
);
export const ALL_PLOTS = Object.freeze([...PLOTS, ...TOWER_PLOTS]);
export const CORNER_PLOT_IDS = Object.freeze(TOWER_PLOTS.map((plot) => plot.id));

const WALL_COSTS = Object.freeze([
  null,
  Object.freeze({ wood: 1800, stone: 1200 }),
  Object.freeze({ wood: 12000, stone: 15000 }),
  Object.freeze({ wood: 100000, stone: 120000 }),
  Object.freeze({ wood: 1200000, stone: 1500000 }),
]);
// Historic invoices must remain independent of future construction prices.
const LEGACY_BASE_COSTS = Object.freeze(
  Object.fromEntries(
    [
      ['hall', 120, 90],
      ['lumber', 60, 25],
      ['quarry', 70, 30],
      ['well', 45, 20],
      ['pasture', 60, 30],
      ['healer', 95, 65],
      ['storage', 80, 55],
      ['watchtower', 100, 70],
      ['shelter', 85, 60],
    ].map(([id, wood, stone]) => [id, Object.freeze({ wood, stone })]),
  ),
);
const CONSTRUCTION_MULTIPLIERS = Object.freeze([1, 2, 3, 5, 8, 12]);
const UPGRADE_MULTIPLIERS = Object.freeze([null, 6, 30, 150, 750]);
const STORAGE_COSTS = Object.freeze(
  [
    { wood: 900, stone: 750 },
    { wood: 8000, stone: 6000 },
    { wood: 40000, stone: 30000 },
    { wood: 200000, stone: 150000 },
    { wood: 800000, stone: 650000 },
  ].map(Object.freeze),
);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) =>
  record(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const peace = (state) => {
  if (state.battle?.status === 'active') fail('BATTLE_ACTIVE');
};
const getPlot = (plotId) => ALL_PLOTS.find((plot) => plot.id === plotId);
const fitsPlot = (type, plot) => (type === 'watchtower') === TOWER_PLOTS.includes(plot);
const validBuildingPosition = (building, allowLegacyTowerPlots = false) => {
  const plot = ALL_PLOTS.find((entry) => entry.x === building.x && entry.y === building.y);
  return (
    !!plot &&
    (fitsPlot(building.type, plot) ||
      (allowLegacyTowerPlots && building.type === 'watchtower' && PLOTS.includes(plot)))
  );
};
const occupied = (state, plot, exceptId) =>
  state.buildings.some(
    (building) => building.id !== exceptId && building.x === plot.x && building.y === plot.y,
  );
const spend = (state, cost) => {
  if (
    Object.entries(cost).some(
      ([key, amount]) => !Number.isFinite(state.resources[key]) || state.resources[key] < amount,
    )
  )
    fail('INSUFFICIENT_RESOURCES');
  for (const [key, amount] of Object.entries(cost)) state.resources[key] -= amount;
};

export function initializeSettlement() {
  return { buildings: [], walls: { level: 1 } };
}

/** Move only previously purchased towers into free wall corners, preserving their investment. */
export function migrateSettlement(state) {
  if (!Object.hasOwn(state, 'walls')) state.walls = { level: 1 };
  const legacyCostBasis = state.version !== 3;
  if (
    !validateSettlement(state, {
      allowLegacyTowerPlots: true,
      allowLegacyCostBasis: legacyCostBasis,
    })
  )
    fail('INVALID_SAVE');
  if (legacyCostBasis)
    for (const building of state.buildings)
      building.costBasis = { legacyLevels: building.level, constructionOrdinal: 1 };
  const used = new Set(
    state.buildings
      .filter((building) => building.type === 'watchtower' && building.x === 6)
      .map((building) => building.y),
  );
  const legacy = state.buildings
    .filter((building) => building.type === 'watchtower' && building.x !== 6)
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  for (const tower of legacy) {
    const plot = TOWER_PLOTS.find((entry) => !used.has(entry.y));
    if (!plot) fail('INVALID_SAVE');
    tower.x = plot.x;
    tower.y = plot.y;
    used.add(plot.y);
  }
  return state;
}

export function visualTier(level) {
  return level >= 5 ? 3 : level >= 3 ? 2 : 1;
}

/** Read-only next-copy price. At the count limit, return the final legal quote for disabled UI. */
export function getConstructionCost(state, type) {
  const definition = BUILDINGS.find((entry) => entry.id === type);
  if (!definition) fail('INVALID_BUILDING');
  const ordinal = Math.min(
    definition.maxCount,
    state.buildings.filter((entry) => entry.type === type).length + 1,
  );
  const multiplier = CONSTRUCTION_MULTIPLIERS[ordinal - 1];
  return Object.fromEntries(
    Object.entries(definition.cost).map(([key, cost]) => [key, cost * multiplier]),
  );
}

/** Current upgrade prices do not depend on the originally purchased copy's ordinal. */
export function getUpgradeCost(building) {
  const definition = BUILDINGS.find((entry) => entry.id === building.type);
  if (
    !definition ||
    !Number.isSafeInteger(building.level) ||
    building.level < 1 ||
    building.level > 5
  )
    fail('INVALID_BUILDING');
  if (building.level === 5) return {};
  if (building.type === 'storage') return { ...STORAGE_COSTS[building.level] };
  return Object.fromEntries(
    Object.entries(definition.cost).map(([key, cost]) => [
      key,
      cost * UPGRADE_MULTIPLIERS[building.level],
    ]),
  );
}

const validCostBasis = (building, definition) => {
  const basis = building.costBasis;
  return (
    exactKeys(basis, ['legacyLevels', 'constructionOrdinal']) &&
    Number.isSafeInteger(basis.legacyLevels) &&
    basis.legacyLevels >= 0 &&
    basis.legacyLevels <= building.level &&
    Number.isSafeInteger(basis.constructionOrdinal) &&
    basis.constructionOrdinal >= 1 &&
    basis.constructionOrdinal <= definition.maxCount &&
    (basis.legacyLevels === 0 || basis.constructionOrdinal === 1)
  );
};

/** Reconstruct exactly what was paid: a historic prefix followed by current-price upgrades. */
export function getBuildingInvestment(building) {
  const definition = BUILDINGS.find((entry) => entry.id === building.type);
  if (
    !definition ||
    !Number.isSafeInteger(building.level) ||
    building.level < 1 ||
    building.level > 5 ||
    !validCostBasis(building, definition)
  )
    fail('INVALID_BUILDING');
  const { legacyLevels, constructionOrdinal } = building.costBasis;
  const original = LEGACY_BASE_COSTS[building.type];
  const paid = legacyLevels
    ? { ...original }
    : Object.fromEntries(
        Object.entries(definition.cost).map(([key, cost]) => [
          key,
          cost * CONSTRUCTION_MULTIPLIERS[constructionOrdinal - 1],
        ]),
      );
  for (let target = 2; target <= building.level; target++) {
    const cost =
      target <= legacyLevels
        ? Object.fromEntries(
            Object.entries(original).map(([key, amount]) => [
              key,
              Math.ceil(amount * 1.55 ** (target - 1)),
            ]),
          )
        : getUpgradeCost({ type: building.type, level: target - 1 });
    for (const [key, amount] of Object.entries(cost)) paid[key] += amount;
  }
  return paid;
}

/** Explicitly redeem only the part of a stored refund that fits in the present warehouse. */
export function refundPlan(state) {
  const reserve = { ...state.refundReserve };
  const credited = Object.fromEntries(
    ['wood', 'stone'].map((key) => [
      key,
      Math.min(reserve[key], Math.max(0, state.capacity - state.resources[key])),
    ]),
  );
  const remaining = Object.fromEntries(
    ['wood', 'stone'].map((key) => [key, reserve[key] - credited[key]]),
  );
  const reason =
    reserve.wood + reserve.stone === 0
      ? 'REFUND_EMPTY'
      : credited.wood + credited.stone === 0
        ? 'REFUND_STORAGE_FULL'
        : null;
  return { reserve, credited, remaining, canClaim: reason === null, reason };
}

export function claimRefund(state, action) {
  if (!exactKeys(action, ['type']) || action.type !== 'claimRefund') fail('INVALID_REFUND');
  const plan = refundPlan(state);
  if (!plan.canClaim) fail(plan.reason);
  for (const key of ['wood', 'stone']) {
    state.resources[key] += plan.credited[key];
    state.refundReserve[key] = plan.remaining[key];
  }
  return plan;
}

/** A read-only receipt for the exact building the player is about to remove. */
export function demolitionQuote(state, id) {
  const building = state.buildings.find((entry) => entry.id === id);
  if (!building) fail('INVALID_BUILDING');
  const investment = getBuildingInvestment(building);
  const refund = Object.fromEntries(
    Object.entries(investment).map(([key, amount]) => [key, amount / 2]),
  );
  const capacityAfter = getStorageCapacity({
    buildings: state.buildings.filter((entry) => entry.id !== id),
  });
  const overflow = Object.fromEntries(
    RESOURCES.map((key) => [key, Math.max(0, state.resources[key] - capacityAfter)]).filter(
      ([, amount]) => amount > 0,
    ),
  );
  const credited = Object.fromEntries(
    ['wood', 'stone'].map((key) => [
      key,
      Math.min(refund[key], Math.max(0, capacityAfter - state.resources[key])),
    ]),
  );
  const pending = Object.fromEntries(
    ['wood', 'stone'].map((key) => [key, refund[key] - credited[key]]),
  );
  const reserveFull =
    state.refundReserve.wood + state.refundReserve.stone + pending.wood + pending.stone >
    REFUND_RESERVE_LIMIT;
  const reason =
    state.battle?.status === 'active'
      ? 'BATTLE_ACTIVE'
      : state.adventure?.active || state.journey
        ? 'JOURNEY_ACTIVE'
        : Object.keys(overflow).length
          ? 'DEMOLITION_STORAGE_FULL'
          : reserveFull
            ? 'REFUND_RESERVE_FULL'
            : null;
  return {
    building: { ...building, costBasis: { ...building.costBasis } },
    expected: {
      type: building.type,
      level: building.level,
      x: building.x,
      y: building.y,
      builds: state.stats.builds,
    },
    investment,
    refund,
    credited,
    pending,
    capacityBefore: state.capacity,
    capacityAfter,
    overflow,
    canDemolish: reason === null,
    reason,
  };
}

/** Credit a confirmed receipt only after every guard succeeds; no resource is discarded. */
export function demolishBuilding(state, action) {
  if (
    !record(action) ||
    typeof action.id !== 'string' ||
    !state.buildings.some((building) => building.id === action.id)
  )
    fail('INVALID_BUILDING');
  if (
    !exactKeys(action, ['type', 'id', 'expected']) ||
    action.type !== 'demolishBuilding' ||
    !exactKeys(action.expected, ['type', 'level', 'x', 'y', 'builds']) ||
    !BUILDINGS.some((building) => building.id === action.expected.type) ||
    !Number.isSafeInteger(action.expected.level) ||
    action.expected.level < 1 ||
    action.expected.level > 5 ||
    !validBuildingPosition(action.expected) ||
    !Number.isSafeInteger(action.expected.builds) ||
    action.expected.builds < 0 ||
    action.expected.builds > 1_000_000
  )
    fail('INVALID_DEMOLITION');
  const quote = demolitionQuote(state, action.id);
  if (Object.keys(quote.expected).some((key) => quote.expected[key] !== action.expected[key]))
    fail('BUILDING_CHANGED');
  if (!quote.canDemolish) fail(quote.reason);
  state.buildings.splice(
    state.buildings.findIndex((building) => building.id === action.id),
    1,
  );
  state.capacity = quote.capacityAfter;
  for (const key of ['wood', 'stone']) {
    state.resources[key] += quote.credited[key];
    state.refundReserve[key] += quote.pending[key];
  }
  return quote;
}

export function getWallUpgradeCost(walls) {
  const level = typeof walls === 'number' ? walls : walls?.level;
  if (!Number.isSafeInteger(level) || level < 1 || level > 5) fail('INVALID_WALL');
  return level === 5 ? null : { ...WALL_COSTS[level] };
}

export function placeBuilding(state, type, plotId) {
  peace(state);
  const definition = BUILDINGS.find((building) => building.id === type);
  if (!definition) fail('INVALID_BUILDING');
  const plot = getPlot(plotId);
  if (!plot) fail('INVALID_PLOT');
  if (!fitsPlot(type, plot)) fail('INVALID_BUILDING_PLOT');
  if (occupied(state, plot)) fail('PLOT_OCCUPIED');
  if (state.buildings.filter((building) => building.type === type).length >= definition.maxCount)
    fail(definition.maxCount === 1 ? 'BUILDING_EXISTS' : 'BUILDING_LIMIT');
  let id = `building-${type}`;
  for (let suffix = 2; state.buildings.some((building) => building.id === id); suffix += 1)
    id = `building-${type}-${suffix}`;
  const cost = getConstructionCost(state, type);
  const constructionOrdinal = state.buildings.filter((entry) => entry.type === type).length + 1;
  const building = {
    id,
    type,
    level: 1,
    x: plot.x,
    y: plot.y,
    costBasis: { legacyLevels: 0, constructionOrdinal },
  };
  spend(state, cost);
  state.buildings.push(building);
  state.capacity = getStorageCapacity(state);
  return building;
}

export function relocateBuilding(state, id, plotId) {
  peace(state);
  const building = state.buildings.find((entry) => entry.id === id);
  if (!building) fail('INVALID_BUILDING');
  if (building.type === 'watchtower') fail('TOWER_FIXED');
  const plot = getPlot(plotId);
  if (!plot) fail('INVALID_PLOT');
  if (!fitsPlot(building.type, plot)) fail('INVALID_BUILDING_PLOT');
  if (occupied(state, plot, id)) fail('PLOT_OCCUPIED');
  building.x = plot.x;
  building.y = plot.y;
  return building;
}

export function upgradeWall(state) {
  peace(state);
  const cost = getWallUpgradeCost(state.walls);
  if (!cost) fail('MAX_LEVEL');
  spend(state, cost);
  state.walls.level += 1;
  return state.walls.level;
}

/** Validate only the settlement portion; full game validation checks resources and capacity. */
export function validateSettlement(
  state,
  { allowLegacyTowerPlots = false, allowLegacyCostBasis = false } = {},
) {
  if (
    !Array.isArray(state.buildings) ||
    state.buildings.length > ALL_PLOTS.length ||
    !exactKeys(state.walls, ['level']) ||
    !Number.isSafeInteger(state.walls.level) ||
    state.walls.level < 1 ||
    state.walls.level > 5
  )
    return false;
  const ids = new Set();
  const spots = new Set();
  const counts = new Map();
  for (const building of state.buildings) {
    if (
      !exactKeys(building, [
        'id',
        'type',
        'level',
        'x',
        'y',
        ...(allowLegacyCostBasis ? [] : ['costBasis']),
      ])
    )
      return false;
    const definition = BUILDINGS.find((entry) => entry.id === building.type);
    if (
      !definition ||
      typeof building.id !== 'string' ||
      !new RegExp(`^building-${definition.id}(?:-[2-6])?$`).test(building.id) ||
      ids.has(building.id) ||
      !Number.isSafeInteger(building.level) ||
      building.level < 1 ||
      building.level > definition.maxLevel ||
      (!allowLegacyCostBasis && !validCostBasis(building, definition))
    )
      return false;
    if (!validBuildingPosition(building, allowLegacyTowerPlots)) return false;
    const spot = `${building.x},${building.y}`;
    const count = (counts.get(building.type) || 0) + 1;
    if (spots.has(spot) || count > definition.maxCount) return false;
    ids.add(building.id);
    spots.add(spot);
    counts.set(building.type, count);
  }
  return true;
}
