import { createGame, applyAction, validateGame } from '../shared/game.mjs';

// Explicit test grants stay within actual storage. They are never installed in production.
export function fillResources(state) {
  for (const key of Object.keys(state.resources)) state.resources[key] = state.capacity;
  return state;
}

// Buy every storage tier at its real price before funding a late-game scenario.
// Callers deliberately reserve a plot and account for the warehouse in their assertions.
export function fundStorage(state, level = 5, plotId = 'p35') {
  let storage = state.buildings.find((building) => building.type === 'storage');
  if (!storage) {
    fillResources(state);
    applyAction(state, { type: 'build', building: 'storage', plotId }, state.updatedAt);
    storage = state.buildings.at(-1);
  }
  while (storage.level < level) {
    fillResources(state);
    applyAction(state, { type: 'upgrade', id: storage.id }, state.updatedAt);
  }
  fillResources(state);
  if (!validateGame(state)) throw new Error('Invalid funded storage fixture');
  return state;
}

export function fundedGame(now, level = 5) {
  return fundStorage(createGame(now), level);
}

// Freeze the exact pre-v2.16 schema when testing migrations. This is a legacy fixture,
// not a production downgrade: no new economic history may appear in old saves.
export function previousSave(state) {
  const previous = structuredClone(state);
  previous.version = 2;
  delete previous.refundReserve;
  for (const building of previous.buildings) delete building.costBasis;
  return previous;
}
