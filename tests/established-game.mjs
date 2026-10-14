import {
  createGame as createLegacyGame,
  applyAction as applyLegacyAction,
} from '../shared/legacy-v1.mjs';
import { migrateGame } from '../shared/game.mjs';

// An existing player's village, used for regression tests of the original economy.
// Fresh v2 accounts deliberately begin with an empty, player-designed settlement.
export function establishedGame(now) {
  return migrateGame(createLegacyGame(now));
}

export function establishedJourney(now, destination) {
  const state = createLegacyGame(now);
  applyLegacyAction(state, { type: 'travel', destination }, now);
  return migrateGame(state);
}
