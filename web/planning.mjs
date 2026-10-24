import {
  BUILDINGS,
  RESOURCE_KEYS,
  getProduction,
  getUpgradeCost,
  MAX_OFFLINE_MS,
} from '../shared/game.mjs';
import { PLOTS, TOWER_PLOTS, getConstructionCost } from '../shared/settlement.mjs';

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

export function constructionPlan(state, selection = 'quarry') {
  let definition = BUILDINGS.find((entry) => entry.id === selection);
  let target = definition?.id;
  let building = definition && state.buildings.find((entry) => entry.type === definition.id);
  let missing = false;
  if (!definition && typeof selection === 'string' && selection.startsWith('new:')) {
    definition = BUILDINGS.find((entry) => entry.id === selection.slice(4));
    if (definition) target = selection;
  } else if (!definition && typeof selection === 'string' && selection.startsWith('building:')) {
    const id = selection.slice(9);
    definition = BUILDINGS.find((entry) =>
      new RegExp(`^building-${entry.id}(?:-[2-6])?$`).test(id),
    );
    if (definition) {
      target = selection;
      building = state.buildings.find((entry) => entry.id === id && entry.type === definition.id);
      missing = !building;
    }
  }
  if (!definition) {
    definition = BUILDINGS.find((entry) => entry.id === 'quarry');
    target = definition.id;
    building = state.buildings.find((entry) => entry.type === definition.id);
  }
  const mode = building || missing ? 'upgrade' : 'build';
  const buildingId = building?.id || null;
  const level = building ? Math.min(building.level + 1, definition.maxLevel) : 1;
  if (missing || (building && building.level >= definition.maxLevel)) {
    return {
      target,
      type: definition.id,
      mode,
      buildingId,
      level,
      cost: {},
      deficits: [],
      affordable: false,
      waitSeconds: null,
      blocked: missing ? 'targetMissing' : 'maxLevel',
    };
  }

  const cost = building ? getUpgradeCost(building) : getConstructionCost(state, definition.id);
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
  const atLimit =
    !building &&
    state.buildings.filter((entry) => entry.type === definition.id).length >= definition.maxCount;
  const hasEmptyPlot = (definition.id === 'watchtower' ? TOWER_PLOTS : PLOTS).some(
    (plot) => !state.buildings.some((entry) => entry.x === plot.x && entry.y === plot.y),
  );
  const blocked =
    state.battle.status === 'active'
      ? 'battle'
      : atLimit
        ? 'buildingLimit'
        : !building && !hasEmptyPlot
          ? 'plotsFull'
          : shortages.some((deficit) => deficit.required > state.capacity)
            ? 'capacity'
            : shortages.some((deficit) => production[deficit.key] <= 0)
              ? 'production'
              : null;
  return {
    target,
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

export const PRODUCTION_FORECAST_HOURS = Object.freeze([1, 4, 8, 12, 24]);

/** A read-only, fixed-rate estimate; journeys, rewards and future spending are excluded. */
export function productionForecast(state, hours = 8) {
  const requestedSeconds = (PRODUCTION_FORECAST_HOURS.includes(hours) ? hours : 8) * 3600;
  const creditedSeconds = Math.min(requestedSeconds, MAX_OFFLINE_MS / 1000);
  const production = getProduction(state);
  return {
    requestedSeconds,
    creditedSeconds,
    capped: creditedSeconds < requestedSeconds,
    resources: RESOURCE_KEYS.map((key) => {
      const amount = state.resources[key];
      const produced = (production[key] * creditedSeconds) / 60;
      const credited = Math.min(produced, Math.max(0, state.capacity - amount));
      return {
        key,
        rate: production[key],
        amount,
        capacity: state.capacity,
        produced,
        credited,
        overflow: Math.max(0, produced - credited),
        projected: amount + credited,
      };
    }),
  };
}
