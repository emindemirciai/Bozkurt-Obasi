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
