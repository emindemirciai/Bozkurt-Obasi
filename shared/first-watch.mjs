/** First Watch is an additive chapter. It never replaces the four legacy quests. */
export const FIRST_WATCH_STEPS = Object.freeze(
  [
    { id: 'gather', view: 'village', reward: { wood: 20, stone: 10 } },
    { id: 'build', view: 'village', reward: { water: 15, feed: 15 } },
    { id: 'train', view: 'wolves', reward: { herbs: 8, feed: 12 } },
    { id: 'battle', view: 'battle', reward: { water: 25, feed: 30 } },
    { id: 'recover', view: 'wolves', reward: { herbs: 8, water: 12 } },
    { id: 'explore', view: 'world', reward: { herbs: 10, feed: 15 } },
    { id: 'equip', view: 'wolves', reward: { wood: 25, stone: 15 } },
    { id: 'escort', view: 'world', reward: { wood: 40, stone: 25, herbs: 10 } },
  ].map((step) => Object.freeze({ ...step, reward: Object.freeze(step.reward) })),
);
const IDS = FIRST_WATCH_STEPS.map((step) => step.id);
const MAX_TIME = 8_640_000_000_000_000;
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const time = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const healthy = (state) =>
  state.battle.status !== 'active' &&
  state.wolves.every((wolf) => wolf.hp === wolf.maxHp) &&
  state.herd.hp === state.herd.maxHp &&
  state.herd.panic === 0;

export function initializeFirstWatch(state, cohort = 'new') {
  state.firstWatch = {
    version: 1,
    cohort,
    startedAt: state.updatedAt,
    firstWinAt: null,
    milestones: Object.fromEntries(IDS.map((id) => [id, null])),
    claims: [],
  };
  return state;
}

/** Record only successful authoritative events. Earlier achievements are never overwritten. */
export function recordFirstWatch(state, id, at) {
  if (!IDS.includes(id)) fail('FIRST_WATCH_INVALID_STEP');
  const chapter = state.firstWatch;
  if (!time(at, chapter.startedAt, MAX_TIME)) fail('INVALID_CLOCK');
  if (id === 'recover' && chapter.milestones.battle === null) return state;
  if (chapter.milestones[id] === null) chapter.milestones[id] = at;
  return state;
}

export function recordFirstWatchBattle(state, won, at) {
  recordFirstWatch(state, 'battle', at);
  if (won && state.firstWatch.firstWinAt === null) state.firstWatch.firstWinAt = at;
  if (healthy(state)) recordFirstWatch(state, 'recover', at);
  return state;
}

/** Infer only observable previous activity; migration itself never awards resources. */
export function migrateFirstWatch(state) {
  if (Object.hasOwn(state, 'firstWatch')) return state;
  initializeFirstWatch(state, 'returning');
  const at = state.updatedAt;
  for (const [id, stat] of [
    ['gather', 'gathers'],
    ['build', 'builds'],
    ['train', 'trained'],
  ]) {
    if (state.stats[stat] > 0) recordFirstWatch(state, id, at);
  }
  const battles = state.log.filter((entry) => ['battleWon', 'battleLost'].includes(entry.key));
  const battleFinished = ['won', 'lost'].includes(state.battle.status);
  if (battles.length || battleFinished || state.stats.wins > 0) {
    recordFirstWatchBattle(state, state.stats.wins > 0, at);
    const earliestBattle = battles.length
      ? Math.min(...battles.map((entry) => entry.at))
      : battleFinished
        ? state.battle.startedAt + state.battle.tick * 1000
        : null;
    if (
      earliestBattle !== null &&
      state.log.some(
        (entry) => ['packRested', 'herdHealed'].includes(entry.key) && entry.at >= earliestBattle,
      )
    ) {
      recordFirstWatch(state, 'recover', at);
    }
  }
  for (const [id, kind] of [
    ['explore', 'expedition'],
    ['escort', 'caravan'],
  ]) {
    if (state.adventure.history.some((entry) => entry.kind === kind))
      recordFirstWatch(state, id, at);
  }
  if (state.wolves.some((wolf) => wolf.equipment !== null)) recordFirstWatch(state, 'equip', at);
  return state;
}

/** Rewards remain pending when storage is full; a claim never silently drops resources. */
export function firstWatchProgress(state) {
  const chapter = state.firstWatch;
  const claimed = chapter.claims.length;
  const steps = FIRST_WATCH_STEPS.map((definition, index) => {
    const completedAt = chapter.milestones[definition.id];
    const claim = chapter.claims[index];
    const missingCapacity = Object.fromEntries(
      Object.entries(definition.reward)
        .map(([key, amount]) => [
          key,
          Math.max(0, Math.ceil(state.resources[key] + amount - state.capacity)),
        ])
        .filter(([, amount]) => amount > 0),
    );
    const storageBlocked = Object.keys(missingCapacity).length > 0;
    return {
      ...definition,
      index,
      completedAt,
      claimedAt: claim?.at ?? null,
      completed: completedAt !== null,
      claimed: index < claimed,
      locked: index > claimed,
      claimable: index === claimed && completedAt !== null && !storageBlocked,
      storageBlocked,
      missingCapacity,
    };
  });
  return {
    version: 1,
    cohort: chapter.cohort,
    startedAt: chapter.startedAt,
    total: steps.length,
    completed: steps.filter((step) => step.completed).length,
    claimed,
    finished: claimed === steps.length,
    current: steps[claimed] ?? null,
    steps,
  };
}

export function claimFirstWatch(state, id, at) {
  const index = IDS.indexOf(id);
  if (index === -1) fail('FIRST_WATCH_INVALID_STEP');
  const chapter = state.firstWatch;
  if (index < chapter.claims.length) fail('FIRST_WATCH_CLAIMED');
  if (index > chapter.claims.length) fail('FIRST_WATCH_LOCKED');
  if (chapter.milestones[id] === null) fail('FIRST_WATCH_INCOMPLETE');
  if (
    !time(
      at,
      Math.max(chapter.milestones[id], chapter.claims.at(-1)?.at ?? chapter.startedAt),
      state.updatedAt,
    )
  )
    fail('INVALID_CLOCK');
  if (firstWatchProgress(state).current.storageBlocked) fail('FIRST_WATCH_STORAGE_FULL');
  for (const [key, amount] of Object.entries(FIRST_WATCH_STEPS[index].reward))
    state.resources[key] += amount;
  chapter.claims.push({ id, at });
  return state;
}

export function validateFirstWatch(state) {
  const chapter = state.firstWatch;
  if (
    !exact(chapter, ['version', 'cohort', 'startedAt', 'firstWinAt', 'milestones', 'claims']) ||
    chapter.version !== 1 ||
    !['new', 'returning'].includes(chapter.cohort) ||
    !time(chapter.startedAt, 0, state.updatedAt) ||
    !exact(chapter.milestones, IDS) ||
    !Array.isArray(chapter.claims) ||
    chapter.claims.length > IDS.length
  )
    return false;
  if (
    !Object.values(chapter.milestones).every(
      (at) => at === null || time(at, chapter.startedAt, state.updatedAt),
    )
  )
    return false;
  for (const [id, stat] of [
    ['gather', 'gathers'],
    ['build', 'builds'],
    ['train', 'trained'],
  ]) {
    if (chapter.milestones[id] !== null && state.stats[stat] === 0) return false;
  }
  if (
    chapter.milestones.recover !== null &&
    (chapter.milestones.battle === null || chapter.milestones.recover < chapter.milestones.battle)
  )
    return false;
  if (
    chapter.firstWinAt !== null &&
    (!time(chapter.firstWinAt, chapter.startedAt, state.updatedAt) ||
      state.stats.wins < 1 ||
      chapter.milestones.battle === null ||
      chapter.firstWinAt < chapter.milestones.battle)
  )
    return false;
  let previous = chapter.startedAt;
  for (const [index, claim] of chapter.claims.entries()) {
    const milestone = chapter.milestones[IDS[index]];
    if (
      !exact(claim, ['id', 'at']) ||
      claim.id !== IDS[index] ||
      milestone === null ||
      !time(claim.at, Math.max(previous, milestone), state.updatedAt)
    )
      return false;
    previous = claim.at;
  }
  return true;
}
