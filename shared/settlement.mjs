/** Settlement coordinates are authoritative save data, independent of presentation. */
const RESOURCES = ['water', 'feed', 'herbs', 'wood', 'stone'];
const PRODUCERS = ['lumber', 'quarry', 'well', 'pasture', 'healer'];
export const BUILDINGS = Object.freeze(
  [
    { id: 'hall', cost: { wood: 120, stone: 90 }, production: {} },
    { id: 'lumber', cost: { wood: 60, stone: 25 }, production: { wood: 12 } },
    { id: 'quarry', cost: { wood: 70, stone: 30 }, production: { stone: 9 } },
    { id: 'well', cost: { wood: 45, stone: 20 }, production: { water: 14 } },
    { id: 'pasture', cost: { wood: 60, stone: 30 }, production: { feed: 12 } },
    { id: 'healer', cost: { wood: 95, stone: 65 }, production: { herbs: 6 } },
    { id: 'storage', cost: { wood: 80, stone: 55 }, production: {} },
    { id: 'watchtower', cost: { wood: 100, stone: 70 }, production: {} },
    { id: 'shelter', cost: { wood: 85, stone: 60 }, production: {} },
  ].map((building) =>
    Object.freeze({
      ...building,
      maxLevel: 5,
      maxCount: PRODUCERS.includes(building.id) ? 6 : 1,
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
const getPlot = (plotId) => PLOTS.find((plot) => plot.id === plotId);
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

/** Old villages already used integral coordinates within this larger map. No assets are reset. */
export function migrateSettlement(state) {
  if (!Object.hasOwn(state, 'walls')) state.walls = { level: 1 };
  return state;
}

export function visualTier(level) {
  return level >= 5 ? 3 : level >= 3 ? 2 : 1;
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
  if (occupied(state, plot)) fail('PLOT_OCCUPIED');
  if (state.buildings.filter((building) => building.type === type).length >= definition.maxCount)
    fail(definition.maxCount === 1 ? 'BUILDING_EXISTS' : 'BUILDING_LIMIT');
  let id = `building-${type}`;
  for (let suffix = 2; state.buildings.some((building) => building.id === id); suffix += 1)
    id = `building-${type}-${suffix}`;
  const building = { id, type, level: 1, x: plot.x, y: plot.y };
  spend(state, definition.cost);
  state.buildings.push(building);
  if (type === 'storage') state.capacity += 250;
  return building;
}

export function relocateBuilding(state, id, plotId) {
  peace(state);
  const building = state.buildings.find((entry) => entry.id === id);
  if (!building) fail('INVALID_BUILDING');
  const plot = getPlot(plotId);
  if (!plot) fail('INVALID_PLOT');
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
export function validateSettlement(state) {
  if (
    !Array.isArray(state.buildings) ||
    state.buildings.length > PLOTS.length ||
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
    if (
      !Number.isSafeInteger(building.x) ||
      !Number.isSafeInteger(building.y) ||
      building.x < 0 ||
      building.x > 5 ||
      building.y < 0 ||
      building.y > 5
    )
      return false;
    const spot = `${building.x},${building.y}`;
    const count = (counts.get(building.type) || 0) + 1;
    if (spots.has(spot) || count > definition.maxCount) return false;
    ids.add(building.id);
    spots.add(spot);
    counts.set(building.type, count);
  }
  return true;
}
