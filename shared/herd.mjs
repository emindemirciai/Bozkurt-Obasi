/** Resource-backed recovery for animals lost in battle; no new save fields. */
export const HERD_LIMIT = 24;
export const REPLENISH_BATCH_LIMIT = 5;
export const HERD_REPLENISH_COST = Object.freeze({ water: 6, feed: 12 });

const validAmount = (amount) =>
  Number.isSafeInteger(amount) && amount >= 1 && amount <= REPLENISH_BATCH_LIMIT;

/** Readiness and price are shared by the UI and authoritative command. */
export function herdRecoveryPlan(state, amount = 1) {
  const valid = validAmount(amount);
  const missing = Math.max(0, HERD_LIMIT - state.herd.count);
  const cost = valid
    ? Object.fromEntries(
        Object.entries(HERD_REPLENISH_COST).map(([key, value]) => [key, value * amount]),
      )
    : {};
  const shortages = Object.entries(cost)
    .filter(([resource, value]) => state.resources[resource] < value)
    .map(([resource, value]) => ({ resource, amount: value - state.resources[resource] }));
  const reason = !valid
    ? 'INVALID_REPLENISH_AMOUNT'
    : state.battle.status === 'active'
      ? 'BATTLE_ACTIVE'
      : state.adventure.active || state.journey
        ? 'JOURNEY_ACTIVE'
        : state.herd.count >= HERD_LIMIT
          ? 'HERD_FULL'
          : !state.buildings.some((building) => building.type === 'pasture')
            ? 'PASTURE_REQUIRED'
            : amount > missing
              ? 'HERD_LIMIT'
              : shortages.length
                ? 'INSUFFICIENT_RESOURCES'
                : null;
  return {
    amount,
    maxCount: HERD_LIMIT,
    missing,
    maxAmount: Math.min(REPLENISH_BATCH_LIMIT, missing),
    cost,
    shortages,
    reason,
    ready: reason === null,
  };
}

export function replenishHerd(state, amount) {
  // The read-only planner defaults to one; commands must supply an explicit amount.
  const plan = herdRecoveryPlan(state, amount === undefined ? null : amount);
  if (plan.reason) {
    const error = new Error(plan.reason);
    error.code = plan.reason;
    throw error;
  }
  for (const [resource, cost] of Object.entries(plan.cost)) state.resources[resource] -= cost;
  state.herd.count += amount;
  state.herd.maxHp = state.herd.count * 10;
  state.herd.hp = Math.min(state.herd.maxHp, state.herd.hp + amount * 10);
  return state;
}
