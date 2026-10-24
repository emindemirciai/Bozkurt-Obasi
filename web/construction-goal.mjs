import { BUILDINGS } from '../shared/settlement.mjs';
import { constructionPlan } from './planning.mjs';

const GOAL_KEYS = ['version', 'mode', 'type', 'buildingId', 'level', 'count'];
const STORAGE_PREFIX = 'bozkurt-obasi:construction-goal:v1:';
const MAX_STORED_LENGTH = 2048;
const copy = (goal) => (goal ? { ...goal } : null);
const record = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) =>
  record(value) &&
  Object.keys(value).length === keys.length &&
  Reflect.ownKeys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const buildingDefinition = (type) => BUILDINGS.find((entry) => entry.id === type);
const validBuildingId = (id, definition) => {
  if (typeof id !== 'string') return false;
  if (id === `building-${definition.id}`) return true;
  if (definition.maxCount < 2) return false;
  const match = new RegExp(`^building-${definition.id}-([2-6])$`).exec(id);
  return Boolean(match && Number(match[1]) <= definition.maxCount);
};
const publicAccount = (value) =>
  typeof value === 'string' && /^[a-z0-9]{1,20}#[1-9]\d{3}(?:\d{2})?$/.test(value) ? value : null;

/** Validate local planning data independently of the strict, authoritative game save. */
export function validateConstructionGoal(goal) {
  try {
    if (!exact(goal, GOAL_KEYS) || goal.version !== 1) return false;
    const definition = buildingDefinition(goal.type);
    if (!definition || !Number.isSafeInteger(goal.level) || !Number.isSafeInteger(goal.count))
      return false;
    if (goal.mode === 'build')
      return (
        goal.buildingId === null &&
        goal.level === 1 &&
        goal.count >= 1 &&
        goal.count <= definition.maxCount
      );
    return (
      goal.mode === 'upgrade' &&
      goal.count === 1 &&
      goal.level >= 2 &&
      goal.level <= definition.maxLevel &&
      validBuildingId(goal.buildingId, definition)
    );
  } catch {
    return false;
  }
}

function validSelection(selection) {
  if (typeof selection !== 'string') return false;
  if (buildingDefinition(selection)) return true;
  if (selection.startsWith('new:')) return Boolean(buildingDefinition(selection.slice(4)));
  if (!selection.startsWith('building:')) return false;
  const id = selection.slice(9);
  return BUILDINGS.some((definition) => validBuildingId(id, definition));
}

/** Freeze one explicitly selected next step. Pinning never spends or advances game time. */
export function createConstructionGoal(state, selection) {
  try {
    // constructionPlan deliberately has a UI fallback; invalid pins must never use it.
    if (!validSelection(selection)) return null;
    const plan = constructionPlan(state, selection);
    if (['maxLevel', 'targetMissing', 'buildingLimit'].includes(plan.blocked)) return null;
    const goal = {
      version: 1,
      mode: plan.mode,
      type: plan.type,
      buildingId: plan.buildingId,
      level: plan.level,
      count:
        plan.mode === 'build'
          ? state.buildings.filter((building) => building.type === plan.type).length + 1
          : 1,
    };
    return validateConstructionGoal(goal) ? goal : null;
  } catch {
    return null;
  }
}

/**
 * Goals describe current ownership, not achievements or queued commands. The target
 * stays fixed after completion. Missing/regressed targets never select another copy.
 * All statuses have { goal, status, plan, progress: { current, target } }; only active
 * and ready statuses expose the current authoritative construction quote.
 */
export function constructionGoalStatus(state, goal) {
  try {
    if (!validateConstructionGoal(goal) || !Array.isArray(state?.buildings)) return null;
    let current, target, selection;
    if (goal.mode === 'upgrade') {
      target = goal.level;
      const building = state.buildings.find(
        (entry) => entry.id === goal.buildingId && entry.type === goal.type,
      );
      if (!building)
        return {
          goal: copy(goal),
          status: 'missing',
          plan: null,
          progress: { current: 0, target },
        };
      current = building.level;
      if (!Number.isSafeInteger(current) || current < 1 || current > 5) return null;
      selection = `building:${goal.buildingId}`;
    } else {
      target = goal.count;
      current = state.buildings.filter((entry) => entry.type === goal.type).length;
      selection = `new:${goal.type}`;
    }
    const progress = { current, target };
    if (current >= target) return { goal: copy(goal), status: 'completed', plan: null, progress };
    if (current < target - 1) return { goal: copy(goal), status: 'changed', plan: null, progress };
    const plan = constructionPlan(state, selection);
    return {
      goal: copy(goal),
      status: plan.affordable && !plan.blocked ? 'ready' : 'active',
      plan,
      progress,
    };
  } catch {
    return null;
  }
}

/**
 * Account-scoped, device-local preferences. A denied/quota-limited store falls back
 * to this account's current in-memory choice; switching accounts clears that memory.
 * activate/get/pin return copies or null. An invalid pin preserves the previous goal.
 */
export function createConstructionGoalTracker({ storage } = {}) {
  let currentAccount = null;
  let currentGoal = null;
  const key = () => STORAGE_PREFIX + encodeURIComponent(currentAccount);
  function persist() {
    if (!currentAccount) return;
    try {
      storage?.setItem(key(), JSON.stringify({ version: 1, goal: currentGoal }));
    } catch {
      // Storage failures must not block the live game or lose the active in-memory pin.
    }
  }
  return {
    activate(userCode) {
      const account = publicAccount(userCode);
      if (account && account === currentAccount) return copy(currentGoal);
      currentAccount = account;
      currentGoal = null;
      if (!currentAccount) return null;
      try {
        const raw = storage?.getItem(key());
        if (typeof raw === 'string' && raw.length <= MAX_STORED_LENGTH) {
          const saved = JSON.parse(raw);
          if (
            exact(saved, ['version', 'goal']) &&
            saved.version === 1 &&
            validateConstructionGoal(saved.goal)
          )
            currentGoal = copy(saved.goal);
        }
      } catch {
        // Malformed, unavailable and oversized local data never becomes a game action.
      }
      return copy(currentGoal);
    },
    get() {
      return copy(currentGoal);
    },
    pin(state, selection) {
      if (!currentAccount) return null;
      const goal = createConstructionGoal(state, selection);
      if (!goal) return null;
      currentGoal = copy(goal);
      persist();
      return copy(currentGoal);
    },
    clear() {
      currentGoal = null;
      persist();
      return null;
    },
  };
}
