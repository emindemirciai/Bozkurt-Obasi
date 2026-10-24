/** Existing camp care, shared by forecasts and authoritative commands. No save fields. */
const RECOVERY_COSTS = Object.freeze({
  healHerd: Object.freeze({ herbs: 15 }),
  rest: Object.freeze({ water: 100, feed: 125 }),
});

/** Forecast care without advancing time, spending supplies or changing the village. */
export function recoveryPlan(state, kind) {
  const valid = kind === 'healHerd' || kind === 'rest';
  const resting = kind === 'rest';
  const cost = valid ? { ...RECOVERY_COSTS[kind] } : {};
  const shortages = Object.entries(cost)
    .filter(([resource, amount]) => state.resources[resource] < amount)
    .map(([resource, amount]) => ({ resource, amount: amount - state.resources[resource] }));
  const wolves = state.wolves.map((wolf) => {
    const after = resting ? wolf.maxHp : wolf.hp;
    return { id: wolf.id, before: wolf.hp, after, maxHp: wolf.maxHp, gain: after - wolf.hp };
  });
  const before = state.herd.hp;
  const after = valid ? Math.min(state.herd.maxHp, before + (resting ? 25 : 75)) : before;
  const panicBefore = state.herd.panic;
  const panicAfter = valid ? Math.max(0, panicBefore - (resting ? 30 : 25)) : panicBefore;
  const herd = {
    before,
    after,
    maxHp: state.herd.maxHp,
    gain: after - before,
    panicBefore,
    panicAfter,
    panicReduction: panicBefore - panicAfter,
  };
  const needed = Boolean(
    valid &&
    (state.herd.hp !== state.herd.maxHp ||
      state.herd.panic !== 0 ||
      (resting && state.wolves.some((wolf) => wolf.hp !== wolf.maxHp))),
  );
  // Keep the existing game commands' rejection order and their different journey rules.
  const reason = !valid
    ? 'INVALID_RECOVERY'
    : state.battle.status === 'active'
      ? 'BATTLE_ACTIVE'
      : resting && (state.journey || state.adventure.active)
        ? 'JOURNEY_ACTIVE'
        : !needed
          ? 'ALREADY_HEALTHY'
          : shortages.length
            ? 'INSUFFICIENT_RESOURCES'
            : null;
  return { kind, cost, shortages, reason, ready: reason === null, needed, wolves, herd };
}

/** Apply only fully affordable care. Game callers retain their existing log/milestone events. */
export function applyRecovery(state, kind) {
  const plan = recoveryPlan(state, kind);
  if (plan.reason) {
    const error = new Error(plan.reason);
    error.code = plan.reason;
    throw error;
  }
  for (const [resource, amount] of Object.entries(plan.cost)) state.resources[resource] -= amount;
  if (kind === 'rest') for (const wolf of state.wolves) wolf.hp = wolf.maxHp;
  state.herd.hp = plan.herd.after;
  state.herd.panic = plan.herd.panicAfter;
  return state;
}
