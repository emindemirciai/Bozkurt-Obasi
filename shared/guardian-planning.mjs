import { equipmentBonuses, isWolfBusy, ITEM_DEFINITIONS } from './adventures.mjs';

export const TRAINING_PATHS = Object.freeze(['guardian', 'hunter', 'leader', 'healer']);
export const TRAINING_COST = Object.freeze({ herbs: 8, feed: 12 });

/** Individual contributions, excluding buildings, formations and other guardians. */
export function guardianStats(wolf) {
  const gear = equipmentBonuses(wolf);
  return {
    attack: 4 + wolf.level * 0.8 + wolf.ranks.hunter * 1.2 + wolf.ranks.leader * 0.3 + gear.attack,
    mitigation: (1 - 1 / (1 + wolf.ranks.guardian * 0.12 + gear.defense * 0.04)) * 100,
    healing: wolf.ranks.healer * 3 + gear.healing,
    scouting: gear.scouting,
    maxHp: wolf.maxHp,
  };
}

/** Preview the existing train command without spending resources or advancing time. */
export function trainingPlan(state, id, path) {
  const wolf = state.wolves.find((entry) => entry.id === id);
  const valid = Boolean(wolf && TRAINING_PATHS.includes(path));
  const cost = { ...TRAINING_COST };
  const shortages = Object.entries(cost)
    .filter(([resource, amount]) => state.resources[resource] < amount)
    .map(([resource, amount]) => ({ resource, amount: amount - state.resources[resource] }));
  const rank = valid ? wolf.ranks[path] : null;
  const nextRank = valid ? Math.min(5, rank + 1) : null;
  const healthGain = valid && rank < 5 ? (path === 'guardian' ? 4 : 2) : 0;
  const before = valid ? guardianStats(wolf) : null;
  const after = valid
    ? guardianStats({
        ...wolf,
        ranks: { ...wolf.ranks, [path]: nextRank },
        maxHp: wolf.maxHp + healthGain,
      })
    : null;
  // Match applyAction's validation order, including battle before invalid selections.
  const reason =
    state.battle.status === 'active'
      ? 'BATTLE_ACTIVE'
      : !valid
        ? 'INVALID_TRAINING'
        : isWolfBusy(state, id)
          ? 'WOLF_BUSY'
          : wolf.points <= 0
            ? 'NO_SKILL_POINTS'
            : rank >= 5
              ? 'MAX_LEVEL'
              : shortages.length
                ? 'INSUFFICIENT_RESOURCES'
                : null;
  return {
    ready: reason === null,
    reason,
    cost,
    shortages,
    rank,
    nextRank,
    healthGain,
    before,
    after,
  };
}

/** Compare a candidate item (null removes equipment); selection never changes inventory. */
export function equipmentPlan(state, id, item) {
  const wolf = state.wolves.find((entry) => entry.id === id);
  const valid = Boolean(
    wolf && (item === null || ITEM_DEFINITIONS.some((entry) => entry.id === item)),
  );
  const before = valid ? guardianStats(wolf) : null;
  const after = valid ? guardianStats({ ...wolf, equipment: item }) : null;
  const delta = valid
    ? Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key]]))
    : null;
  const inventoryCount = valid ? state.inventory[item === null ? wolf.equipment : item] || 0 : 0;
  const reason = !valid
    ? 'INVALID_EQUIPMENT'
    : state.battle.status === 'active' || isWolfBusy(state, id)
      ? 'WOLF_BUSY'
      : item === wolf.equipment
        ? item === null
          ? 'NO_EQUIPMENT'
          : 'ALREADY_EQUIPPED'
        : item !== null && inventoryCount < 1
          ? 'ITEM_UNAVAILABLE'
          : wolf.equipment && state.inventory[wolf.equipment] >= 10000
            ? 'INVENTORY_FULL'
            : null;
  return { ready: reason === null, reason, before, after, delta, inventoryCount };
}
