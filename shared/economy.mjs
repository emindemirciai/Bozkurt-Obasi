/** Active work shares one server-timed cooldown; recipes are never client-controlled. */
export const COLLECT_COOLDOWN_MS = 90_000;
export const COLLECTION_TASKS = Object.freeze(
  [
    { id: 'mixed', reward: { wood: 3, stone: 2, water: 2, feed: 2 } },
    { id: 'wood', reward: { wood: 10 } },
    { id: 'stone', reward: { stone: 7 } },
    { id: 'water', reward: { water: 8 } },
    { id: 'feed', reward: { feed: 8 } },
    { id: 'herbs', reward: { herbs: 2 } },
  ].map((task) => Object.freeze({ ...task, reward: Object.freeze(task.reward) })),
);

/** All spending forecasts and authoritative commands share these current recipes. */
export const REFUND_RESERVE_LIMIT = 100_000_000;
const TRAINING_HERBS = Object.freeze([40, 140, 450, 1400, 4200]);
const TRAINING_FEED = Object.freeze([80, 280, 900, 2800, 8400]);
export function getTrainingCost(wolf, path) {
  const rank = wolf?.ranks?.[path];
  if (!Number.isSafeInteger(rank) || rank < 0 || rank > 5) return {};
  const index = Math.min(4, rank);
  return { herbs: TRAINING_HERBS[index], feed: TRAINING_FEED[index] };
}
export function getBattleCost(state) {
  const wave = state.battle.wave;
  return { water: 60 + 12 * (wave - 1), feed: 80 + 16 * (wave - 1) };
}
