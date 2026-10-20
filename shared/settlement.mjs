/** Settlement coordinates are authoritative save data, independent of presentation. */
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
    { id: 'hall', cost: { wood: 120, stone: 90 }, production: {} },
    { id: 'lumber', cost: { wood: 60, stone: 25 }, production: { wood: 0.6 } },
    { id: 'quarry', cost: { wood: 70, stone: 30 }, production: { stone: 0.45 } },
    { id: 'well', cost: { wood: 45, stone: 20 }, production: { water: 0.7 } },
    { id: 'pasture', cost: { wood: 60, stone: 30 }, production: { feed: 0.6 } },
    { id: 'healer', cost: { wood: 95, stone: 65 }, production: { herbs: 0.3 } },
    { id: 'storage', cost: { wood: 80, stone: 55 }, production: {} },
    { id: 'watchtower', cost: { wood: 100, stone: 70 }, production: {} },
    { id: 'shelter', cost: { wood: 85, stone: 60 }, production: {} },
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
  Object.freeze({ wood: 110, stone: 30 }),
  Object.freeze({ wood: 140, stone: 130 }),
  Object.freeze({ wood: 210, stone: 230 }),
  Object.freeze({ wood: 280, stone: 380 }),
]);
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
  if (!validateSettlement(state, { allowLegacyTowerPlots: true })) fail('INVALID_SAVE');
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

/** One recipe drives upgrades and demolition refunds, including all previous levels. */
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

/** A read-only receipt for the exact building the player is about to remove. */
export function demolitionQuote(state, id) {
  const building = state.buildings.find((entry) => entry.id === id);
  if (!building) fail('INVALID_BUILDING');
  const definition = BUILDINGS.find((entry) => entry.id === building.type);
  const investment = { ...definition.cost };
  for (let level = 1; level < building.level; level += 1) {
    const cost = getUpgradeCost({ type: building.type, level });
    for (const [key, amount] of Object.entries(cost)) investment[key] += amount;
  }
  const refund = Object.fromEntries(
    Object.entries(investment).map(([key, amount]) => [key, amount / 2]),
  );
  const capacityAfter = getStorageCapacity({
    buildings: state.buildings.filter((entry) => entry.id !== id),
  });
  const overflow = Object.fromEntries(
    RESOURCES.map((key) => [
      key,
      Math.max(0, state.resources[key] + (refund[key] || 0) - capacityAfter),
    ]).filter(([, amount]) => amount > 0),
  );
  const reason =
    state.battle?.status === 'active'
      ? 'BATTLE_ACTIVE'
      : state.adventure?.active || state.journey
        ? 'JOURNEY_ACTIVE'
        : Object.keys(overflow).length
          ? 'DEMOLITION_STORAGE_FULL'
          : null;
  return {
    building: { ...building },
    expected: {
      type: building.type,
      level: building.level,
      x: building.x,
      y: building.y,
      builds: state.stats.builds,
    },
    investment,
    refund,
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
  for (const [key, amount] of Object.entries(quote.refund)) state.resources[key] += amount;
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
  const building = { id, type, level: 1, x: plot.x, y: plot.y };
  spend(state, definition.cost);
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
export function validateSettlement(state, { allowLegacyTowerPlots = false } = {}) {
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
    if (!exactKeys(building, ['id', 'type', 'level', 'x', 'y'])) return false;
    const definition = BUILDINGS.find((entry) => entry.id === building.type);
    if (
      !definition ||
      typeof building.id !== 'string' ||
      !new RegExp(`^building-${definition.id}(?:-[2-6])?$`).test(building.id) ||
      ids.has(building.id) ||
      !Number.isSafeInteger(building.level) ||
      building.level < 1 ||
      building.level > definition.maxLevel
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
