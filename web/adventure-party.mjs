import {
  adventureQuote,
  equipmentBonuses,
  grantWolfXp,
  isWolfBusy,
} from '../shared/adventures.mjs';

const totalXp = (wolf) => (45 * wolf.level * (wolf.level - 1)) / 2 + wolf.xp;
const healthRatio = (wolf) => wolf.hp / wolf.maxHp;
const lockReason = (state) =>
  state.battle.status === 'active'
    ? 'battle'
    : state.adventure.active || state.journey
      ? 'journey'
      : null;
const eligible = (state, wolf) => wolf.hp >= 20 && !isWolfBusy(state, wolf.id);

/**
 * Read-only roster alternatives. ready means that the whole suggested party can be selected;
 * adventureReadiness remains responsible for the route, herd and supply departure checks.
 */
export function adventurePartySuggestions(state, selection) {
  const baseQuote = adventureQuote(state, selection);
  const selectedIds = new Set(selection.wolfIds);
  const proposedCount = Math.min(5, Math.max(baseQuote.minimumWolves, selectedIds.size));
  const candidates = state.wolves
    .map((wolf, index) => ({ wolf, index }))
    .filter(({ wolf }) => eligible(state, wolf));
  const reason = lockReason(state);
  const fallback = (a, b) =>
    healthRatio(b.wolf) - healthRatio(a.wolf) ||
    a.index - b.index ||
    a.wolf.id.localeCompare(b.wolf.id);
  const comparators = {
    scouting: (a, b) =>
      equipmentBonuses(b.wolf).scouting - equipmentBonuses(a.wolf).scouting || fallback(a, b),
    resilience: (a, b) =>
      Math.max(1, b.wolf.hp - baseQuote.fatigue) - Math.max(1, a.wolf.hp - baseQuote.fatigue) ||
      fallback(a, b),
    training: (a, b) =>
      Number(a.wolf.level === 20) - Number(b.wolf.level === 20) ||
      (a.wolf.level < 20 ? a.wolf.level * 45 - a.wolf.xp : 0) -
        (b.wolf.level < 20 ? b.wolf.level * 45 - b.wolf.xp : 0) ||
      fallback(a, b),
  };
  return Object.entries(comparators).map(([id, compare]) => {
    const party = [...candidates]
      .sort(compare)
      .slice(0, proposedCount)
      .map(({ wolf }) => wolf);
    const wolfIds = party.map((wolf) => wolf.id);
    const missingCount = Math.max(0, proposedCount - party.length);
    return {
      id,
      wolfIds,
      ready: !reason && missingCount === 0,
      locked: Boolean(reason),
      reason: reason || (missingCount ? 'party' : null),
      proposedCount,
      eligibleCount: candidates.length,
      missingCount,
      scouting: party.reduce((sum, wolf) => sum + equipmentBonuses(wolf).scouting, 0),
      quote: adventureQuote(state, { ...selection, wolfIds }),
      sameAsSelection:
        wolfIds.length === selection.wolfIds.length &&
        wolfIds.every((wolfId) => selectedIds.has(wolfId)),
    };
  });
}

/** Predict the existing arrival transition, including fatigue before level-up healing. */
export function adventurePartyForecast(state, selection) {
  const quote = adventureQuote(state, selection);
  const seen = new Set();
  const invalidIds = [];
  const duplicateIds = [];
  const wolves = [];
  for (const id of selection.wolfIds) {
    if (seen.has(id)) {
      if (!duplicateIds.includes(id)) duplicateIds.push(id);
      continue;
    }
    seen.add(id);
    const wolf = state.wolves.find((entry) => entry.id === id);
    if (!wolf) {
      invalidIds.push(id);
      continue;
    }
    const predicted = structuredClone(wolf);
    const postFatigueHp = Math.max(1, wolf.hp - quote.fatigue);
    predicted.hp = postFatigueHp;
    grantWolfXp(predicted, quote.xp);
    wolves.push({
      id,
      eligible: eligible(state, wolf),
      currentHp: wolf.hp,
      postFatigueHp,
      hp: predicted.hp,
      maxHp: predicted.maxHp,
      level: predicted.level,
      xp: predicted.xp,
      points: predicted.points,
      levelsGained: predicted.level - wolf.level,
      xpGained: totalXp(predicted) - totalXp(wolf),
      nominalXp: quote.xp,
    });
  }
  return {
    quote,
    locked: Boolean(lockReason(state)),
    wolves,
    invalidIds,
    duplicateIds,
  };
}
