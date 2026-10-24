import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_WATCH_STEPS } from '../shared/first-watch.mjs';
import { createGame, applyAction, advanceGame } from '../shared/game.mjs';
import { firstWatchJournal } from '../web/first-watch-journal.mjs';

const START = 1_000_000;
const empty = ({ start = START, elapsed = 0, cohort = 'new' } = {}) => ({
  updatedAt: start + elapsed,
  firstWatch: {
    version: 1,
    cohort,
    startedAt: start,
    firstWinAt: null,
    milestones: Object.fromEntries(FIRST_WATCH_STEPS.map(({ id }) => [id, null])),
    claims: [],
  },
});
const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};
function noInvalidNumbers(value) {
  if (typeof value === 'number') assert.ok(Number.isSafeInteger(value) && value >= 0);
  if (value !== null && typeof value === 'object') Object.values(value).forEach(noInvalidNumbers);
}

test('an empty journal lists eight ordered steps without inventing achievements or claims', () => {
  const result = firstWatchJournal(empty());
  assert.equal(result.total, 8);
  assert.equal(result.completed, 0);
  assert.equal(result.claimed, 0);
  assert.equal(result.currentId, 'gather');
  assert.equal(result.steps[0].status, 'current');
  assert.equal(
    result.steps.slice(1).every((step) => step.status === 'locked'),
    true,
  );
  assert.equal(
    result.steps.every((step) => step.completionMs === null),
    true,
  );
  assert.equal(
    result.steps.every((step) => step.claimMs === null),
    true,
  );
  assert.deepEqual(result.firstWin, { recorded: false, elapsedMs: null, withinWindow: null });
  assert.equal(result.battleRecoveryMs, null);
  assert.equal(result.elapsedMs, 0);
  assert.equal(result.timingAvailable, true);
  assert.equal(result.windowClosed, false);
});

test('timestamp zero is a real completion and claim with a valid zero delay', () => {
  const state = empty({ start: 0 });
  state.firstWatch.milestones.gather = 0;
  state.firstWatch.claims.push({ id: 'gather', at: 0 });
  const result = firstWatchJournal(state);
  assert.equal(result.steps[0].status, 'claimed');
  assert.equal(result.steps[0].completionMs, 0);
  assert.equal(result.steps[0].claimMs, 0);
  assert.equal(result.steps[0].claimDelayMs, 0);
  assert.equal(result.steps[0].withinWindow, true);
  assert.equal(result.currentId, 'build');
});

test('the first fifteen-minute window includes its exact boundary and excludes one millisecond later', () => {
  for (const elapsed of [899_999, 900_000, 900_001]) {
    const state = empty({ elapsed });
    state.firstWatch.milestones.gather = START + elapsed;
    const result = firstWatchJournal(state);
    assert.equal(result.elapsedMs, elapsed);
    assert.equal(result.windowClosed, elapsed > 900_000);
    assert.equal(result.steps[0].withinWindow, elapsed <= 900_000);
    assert.equal(result.windowMs, 900_000);
  }
});

test('wall-clock duration uses saved updatedAt, includes offline gaps and never reads the device clock', () => {
  const state = empty({ elapsed: 3_600_000 });
  state.firstWatch.milestones.gather = START + 60_000;
  state.firstWatch.claims.push({ id: 'gather', at: START + 3_600_000 });
  const before = structuredClone(state);
  const originalNow = Date.now;
  Date.now = () => {
    throw new Error('The journal must not read the client clock');
  };
  try {
    const result = firstWatchJournal(deepFreeze(state));
    assert.equal(result.elapsedMs, 3_600_000);
    assert.equal(result.steps[0].completionMs, 60_000);
    assert.equal(result.steps[0].claimMs, 3_600_000);
    assert.equal(result.steps[0].claimDelayMs, 3_540_000);
    assert.equal(result.steps[0].withinWindow, true);
    assert.deepEqual(state, before);
  } finally {
    Date.now = originalNow;
  }
});

test('out-of-order achievements remain visible while reward claims follow their ordered prefix', () => {
  const state = empty({ elapsed: 100_000 });
  Object.assign(state.firstWatch.milestones, {
    gather: START + 60_000,
    build: START + 10_000,
    train: START + 20_000,
    equip: START,
  });
  state.firstWatch.claims.push({ id: 'gather', at: START + 70_000 });
  const result = firstWatchJournal(state);
  assert.equal(result.completed, 4);
  assert.equal(result.claimed, 1);
  assert.equal(result.currentId, 'build');
  assert.equal(result.steps[0].claimDelayMs, 10_000);
  assert.equal(result.steps[1].status, 'pendingClaim');
  assert.equal(result.steps[1].completionMs, 10_000);
  assert.equal(result.steps[1].claimMs, null);
  assert.equal(result.steps[1].locked, false);
  assert.equal(result.steps[2].status, 'locked');
  assert.equal(result.steps[2].locked, true);
  assert.equal(result.steps[2].completed, true);
  assert.equal(result.steps[6].completionMs, 0);
});

test('a completed full journal has no current step and reports each separate claim delay', () => {
  const state = empty({ elapsed: 100_000 });
  FIRST_WATCH_STEPS.forEach(({ id }, index) => {
    state.firstWatch.milestones[id] = START + index * 1000;
    state.firstWatch.claims.push({ id, at: START + 20_000 + index * 1000 });
  });
  state.firstWatch.firstWinAt = START + 3000;
  const result = firstWatchJournal(state);
  assert.equal(result.completed, 8);
  assert.equal(result.claimed, 8);
  assert.equal(result.currentId, null);
  assert.equal(
    result.steps.every((step) => step.status === 'claimed'),
    true,
  );
  assert.equal(
    result.steps.every((step) => step.claimDelayMs === 20_000),
    true,
  );
  assert.equal(result.battleRecoveryMs, 1000);
});

test('first battle-to-recovery duration remains separate from a later first victory after a defeat', () => {
  const state = createGame(0);
  const act = (action) => applyAction(state, action, state.updatedAt, () => 0);
  act({ type: 'startBattle' });
  state.herd.hp = 1;
  advanceGame(state, 90_000);
  assert.equal(state.battle.status, 'lost');
  const firstBattleAt = state.firstWatch.milestones.battle;
  advanceGame(state, state.updatedAt + 12_000);
  state.resources.water = 500;
  state.resources.feed = 500;
  act({ type: 'rest' });
  const recoveryAt = state.firstWatch.milestones.recover;
  assert.equal(firstWatchJournal(state).firstWin.recorded, false);
  act({ type: 'healHerd' });
  act({ type: 'healHerd' });
  act({ type: 'newBattle' });
  act({ type: 'startBattle' });
  for (const enemy of state.battle.enemies) enemy.hp = 1;
  advanceGame(state, state.updatedAt + 7000);
  assert.equal(state.battle.status, 'won');
  const result = firstWatchJournal(state);
  assert.equal(result.battleRecoveryMs, recoveryAt - firstBattleAt);
  assert.equal(result.firstWin.elapsedMs, state.firstWatch.firstWinAt);
  assert.ok(result.firstWin.elapsedMs > recoveryAt);
  assert.equal(result.steps[3].completionMs, firstBattleAt);
  assert.equal(result.steps[4].completionMs, recoveryAt);
});

test('healthy battle completion permits an immediate zero-duration recovery and exact-window victory', () => {
  const state = empty({ start: 0, elapsed: 900_000 });
  state.firstWatch.milestones.battle = 900_000;
  state.firstWatch.milestones.recover = 900_000;
  state.firstWatch.firstWinAt = 900_000;
  const result = firstWatchJournal(state);
  assert.equal(result.battleRecoveryMs, 0);
  assert.deepEqual(result.firstWin, {
    recorded: true,
    elapsedMs: 900_000,
    withinWindow: true,
  });
  state.updatedAt += 1;
  state.firstWatch.firstWinAt += 1;
  assert.equal(firstWatchJournal(state).firstWin.withinWindow, false);
});

test('all returning-village timings remain inferred, including later real achievements and claims', () => {
  const state = empty({ elapsed: 120_000, cohort: 'returning' });
  Object.assign(state.firstWatch.milestones, {
    gather: START,
    build: START,
    battle: START + 60_000,
    recover: START + 70_000,
  });
  state.firstWatch.firstWinAt = START + 90_000;
  state.firstWatch.claims.push({ id: 'gather', at: START + 10_000 });
  const result = firstWatchJournal(deepFreeze(state));
  assert.equal(result.cohort, 'returning');
  assert.equal(result.inferred, true);
  assert.equal(result.timingAvailable, false);
  assert.equal(result.elapsedMs, null);
  assert.equal(result.windowClosed, null);
  assert.equal(result.completed, 4);
  assert.equal(result.claimed, 1);
  assert.equal(result.steps[0].status, 'claimed');
  assert.equal(result.steps[1].status, 'pendingClaim');
  assert.equal(result.steps[3].completed, true);
  assert.equal(
    result.steps.every(
      (step) =>
        step.completionMs === null &&
        step.claimMs === null &&
        step.claimDelayMs === null &&
        step.withinWindow === null,
    ),
    true,
  );
  assert.deepEqual(result.firstWin, { recorded: true, elapsedMs: null, withinWindow: null });
  assert.equal(result.battleRecoveryMs, null);
});

test('unknown chapter versions retain readable progress while withholding unsupported timing conclusions', () => {
  const state = empty({ elapsed: 120_000 });
  state.firstWatch.version = 2;
  state.firstWatch.milestones.gather = START + 10_000;
  state.firstWatch.claims.push({ id: 'gather', at: START + 20_000 });
  const result = firstWatchJournal(state);
  assert.equal(result.completed, 1);
  assert.equal(result.claimed, 1);
  assert.equal(result.steps[0].status, 'claimed');
  assert.equal(result.timingAvailable, false);
  assert.equal(result.elapsedMs, null);
  assert.equal(result.windowClosed, null);
  assert.equal(result.steps[0].completionMs, null);
  assert.equal(result.steps[0].claimMs, null);
  assert.equal(result.steps[0].claimDelayMs, null);
  assert.equal(result.steps[0].withinWindow, null);
});

test('missing or malformed chapter clocks safely withhold timing rather than inventing zero', () => {
  const examples = [null, undefined, {}, { firstWatch: null }];
  for (const value of [null, NaN, Infinity, -1, 1.5, '1000000', Number.MAX_SAFE_INTEGER]) {
    const start = empty();
    start.firstWatch.startedAt = value;
    examples.push(start);
    const updated = empty();
    updated.updatedAt = value;
    examples.push(updated);
  }
  const reversed = empty();
  reversed.updatedAt -= 1;
  examples.push(reversed);
  const unknown = empty();
  unknown.firstWatch.cohort = 'unknown';
  examples.push(unknown);
  for (const state of examples) {
    const result = firstWatchJournal(state);
    assert.equal(result.timingAvailable, false);
    assert.equal(result.elapsedMs, null);
    assert.equal(result.windowClosed, null);
    assert.equal(result.battleRecoveryMs, null);
    noInvalidNumbers(result);
  }
});

test('future, reversed and malformed event timestamps have unavailable metrics', () => {
  for (const at of [START - 1, START + 1001, null, NaN, Infinity, '1000000', -1, 1.5]) {
    const state = empty({ elapsed: 1000 });
    state.firstWatch.milestones.gather = at;
    const result = firstWatchJournal(state);
    assert.equal(result.steps[0].completionMs, null);
    assert.equal(result.steps[0].withinWindow, null);
    noInvalidNumbers(result);
  }
  const state = empty({ elapsed: 1000 });
  state.firstWatch.milestones.battle = START + 500;
  state.firstWatch.milestones.recover = START + 400;
  state.firstWatch.firstWinAt = START + 499;
  assert.equal(firstWatchJournal(state).battleRecoveryMs, null);
  assert.equal(firstWatchJournal(state).steps[4].completionMs, null);
  assert.equal(firstWatchJournal(state).firstWin.elapsedMs, null);
  state.firstWatch.milestones.battle = null;
  assert.equal(firstWatchJournal(state).firstWin.recorded, false);
  assert.equal(firstWatchJournal(state).battleRecoveryMs, null);
});

test('malformed claim times preserve the recorded prefix but never produce negative or fabricated delays', () => {
  for (const at of [START - 1, START + 1001, null, NaN, Infinity, START + 9]) {
    const state = empty({ elapsed: 1000 });
    state.firstWatch.milestones.gather = START + 10;
    state.firstWatch.milestones.build = START;
    state.firstWatch.claims.push({ id: 'gather', at }, { id: 'build', at: START + 100 });
    const result = firstWatchJournal(state);
    assert.equal(result.claimed, 2);
    assert.equal(result.steps[0].claimMs, null);
    assert.equal(result.steps[0].claimDelayMs, null);
    assert.equal(result.steps[1].claimMs, null);
    noInvalidNumbers(result);
  }
  const reversed = empty({ elapsed: 1000 });
  reversed.firstWatch.milestones.gather = START;
  reversed.firstWatch.milestones.build = START;
  reversed.firstWatch.claims.push(
    { id: 'gather', at: START + 100 },
    { id: 'build', at: START + 99 },
  );
  assert.equal(firstWatchJournal(reversed).steps[0].claimMs, 100);
  assert.equal(firstWatchJournal(reversed).steps[1].claimMs, null);
  reversed.firstWatch.claims[0].id = 'build';
  assert.equal(firstWatchJournal(reversed).claimed, 0);
});

test('a frozen saved chapter is read-only and journal output never retains references into the save', () => {
  const state = empty({ elapsed: 1000 });
  state.firstWatch.milestones.gather = START;
  state.firstWatch.claims.push({ id: 'gather', at: START + 100 });
  const before = structuredClone(state);
  const output = firstWatchJournal(deepFreeze(state));
  output.steps[0].completionMs = 999;
  output.firstWin.recorded = true;
  output.steps.push({ id: 'forged' });
  assert.deepEqual(state, before);
  const next = firstWatchJournal(state);
  assert.equal(next.steps[0].completionMs, 0);
  assert.equal(next.firstWin.recorded, false);
  assert.equal(next.steps.length, 8);
});
