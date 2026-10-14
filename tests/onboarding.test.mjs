import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, advanceGame, TACTICS, validateGame } from '../shared/game.mjs';
import { firstSteps } from '../web/onboarding.mjs';
import { establishedGame } from './established-game.mjs';

const START = 1_000_000;
const act = (state, action) => applyAction(state, action, state.updatedAt);
const step = (state, id) => firstSteps(state).steps.find((entry) => entry.id === id);
const train = (state) => act(state, { type: 'train', id: 'wolf-alpha', path: 'guardian' });

function preparedVillage() {
  const state = createGame(START);
  act(state, { type: 'collect' });
  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  act(state, { type: 'claimQuest', id: 'first_build' });
  train(state);
  train(state);
  return state;
}

function freeze(value) {
  for (const nested of Object.values(value))
    if (nested && typeof nested === 'object') freeze(nested);
  return Object.freeze(value);
}

test('guide follows accepted actions, requires claiming the reward and preserves partial training', () => {
  const state = createGame(START);
  assert.equal(firstSteps(state).completed, 0);
  assert.equal(firstSteps(state).next, 'gather');
  act(state, { type: 'collect' });
  const afterGather = firstSteps(state);
  assert.equal(afterGather.next, 'build');
  assert.throws(() => act(state, { type: 'collect' }), { code: 'COLLECT_COOLDOWN' });
  assert.deepEqual(firstSteps(state), afterGather);

  act(state, { type: 'build', building: 'quarry', plotId: 'p7' });
  assert.equal(firstSteps(state).completed, 2);
  assert.equal(firstSteps(state).next, 'reward');
  assert.equal(step(state, 'reward').complete, false);
  act(state, { type: 'claimQuest', id: 'first_build' });
  assert.equal(firstSteps(state).next, 'train');
  train(state);
  assert.equal(step(state, 'train').progress, 1);
  assert.equal(step(state, 'train').complete, false);
  assert.equal(firstSteps(state).completed, 3);
  train(state);
  assert.equal(firstSteps(state).completed, 4);
  assert.equal(firstSteps(state).next, 'win');
  assert.equal(validateGame(state), true);
});

test('migrated saves recognize out-of-order actions and any new structure', () => {
  const state = establishedGame(START);
  act(state, { type: 'upgrade', id: 'building-lumber' });
  assert.equal(step(state, 'build').complete, false);
  act(state, { type: 'build', building: 'healer', plotId: 'p35' });
  train(state);
  train(state);
  trainOtherWolf(state);
  act(state, { type: 'claimQuest', id: 'first_build' });
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(validateGame(restored), true);
  assert.equal(firstSteps(restored).completed, 3);
  assert.equal(firstSteps(restored).next, 'gather');
  assert.equal(step(restored, 'train').progress, 2);
  act(restored, { type: 'collect' });
  assert.equal(firstSteps(restored).next, 'win');
  assert.equal(firstSteps(restored).completed, 4);
});

function trainOtherWolf(state) {
  act(state, { type: 'train', id: 'wolf-guardian', path: 'guardian' });
}

test('every initial jackal tactic can finish the guide and reading it never changes the save', () => {
  for (const [index, tactic] of TACTICS.entries()) {
    const state = preparedVillage();
    applyAction(state, { type: 'startBattle' }, START, () => (index + 0.5) / TACTICS.length);
    assert.equal(firstSteps(state).next, 'win', tactic);
    advanceGame(state, START + 60_000);
    assert.equal(state.battle.status, 'won', tactic);
    assert.equal(validateGame(state), true);
    const snapshot = JSON.stringify(state);
    freeze(state);
    const guide = firstSteps(state);
    assert.equal(guide.completed, 5, tactic);
    assert.equal(guide.next, 'explore', tactic);
    assert.ok(guide.steps.every((entry) => entry.complete));
    guide.steps[0].progress = 0;
    assert.equal(firstSteps(state).steps[0].progress, 1);
    assert.equal(JSON.stringify(state), snapshot);
  }
});

test('defeat leaves the first victory unfinished and preserves earlier achievements', () => {
  const state = preparedVillage();
  state.herd.hp = 30;
  applyAction(state, { type: 'startBattle' }, START, () => 0);
  advanceGame(state, START + 60_000);
  assert.equal(state.battle.status, 'lost');
  assert.equal(validateGame(state), true);
  assert.equal(firstSteps(state).completed, 4);
  assert.equal(firstSteps(state).next, 'win');
  assert.equal(step(state, 'win').progress, 0);
  act(state, { type: 'newBattle' });
  assert.equal(firstSteps(state).next, 'win');
});
