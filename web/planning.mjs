import { BUILDINGS, RESOURCE_KEYS, getProduction, getUpgradeCost } from '../shared/game.mjs';

// Estimates keep current production fixed; they never advance or change the authoritative save.
export function resourceOutlook(state) {
  const production = getProduction(state);
  return RESOURCE_KEYS.map((key) => {
    const amount = state.resources[key];
    const capacity = state.capacity;
    const rate = production[key];
    const isFull = amount >= capacity;
    return {
      key,
      amount,
      capacity,
      rate,
      isFull,
      fullInSeconds: isFull ? 0 : rate > 0 ? Math.ceil(((capacity - amount) / rate) * 60) : null,
    };
  });
}

export function constructionPlan(state, type = 'quarry') {
  const definition =
    BUILDINGS.find((building) => building.id === type) ||
    BUILDINGS.find((building) => building.id === 'quarry');
  const building = state.buildings.find((entry) => entry.type === definition.id);
  const mode = building ? 'upgrade' : 'build';
  const buildingId = building?.id || null;
  const level = building ? Math.min(building.level + 1, definition.maxLevel) : 1;
  if (building && building.level >= definition.maxLevel) {
    return {
      type: definition.id,
      mode,
      buildingId,
      level,
      cost: {},
      deficits: [],
      affordable: false,
      waitSeconds: null,
      blocked: 'maxLevel',
    };
  }

  const cost = building ? getUpgradeCost(building) : { ...definition.cost };
  const production = getProduction(state);
  const deficits = RESOURCE_KEYS.filter((key) => cost[key] > 0).map((key) => {
    const required = cost[key];
    const available = state.resources[key];
    const missing = Math.max(0, required - available);
    const seconds =
      missing === 0
        ? 0
        : required > state.capacity || production[key] <= 0
          ? null
          : Math.ceil((missing / production[key]) * 60);
    return { key, required, available, missing, seconds };
  });
  const shortages = deficits.filter((deficit) => deficit.missing > 0);
  const waitSeconds = shortages.some((deficit) => deficit.seconds === null)
    ? null
    : Math.max(0, ...shortages.map((deficit) => deficit.seconds));
  const blocked =
    state.battle.status === 'active'
      ? 'battle'
      : shortages.some((deficit) => deficit.required > state.capacity)
        ? 'capacity'
        : shortages.some((deficit) => production[deficit.key] <= 0)
          ? 'production'
          : null;
  return {
    type: definition.id,
    mode,
    buildingId,
    level,
    cost,
    deficits,
    affordable: shortages.length === 0 && blocked === null,
    waitSeconds,
    blocked,
  };
}
