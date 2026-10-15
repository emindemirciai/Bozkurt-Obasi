import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  migrateGame,
  validateGame,
  applyAction,
  advanceGame,
  resumeGame,
} from '../shared/game.mjs';
import { createGame as createLegacyGame } from '../shared/legacy-v1.mjs';
import { FIRST_WATCH_STEPS, firstWatchProgress } from '../shared/first-watch.mjs';

const START = 1_000_000;
const fresh = () => createGame(START);
const act = (state, action, at = state.updatedAt) => applyAction(state, action, at, () => 0);
const claim = (state, id) => act(state, { type: 'claimFirstWatch', id });
const unchangedFailure = (state, action, code) => {
  const before = structuredClone(state);
  assert.throws(() => act(state, action), { code });
  assert.deepEqual(state, before);
};
const outing = (state, kind = 'expedition') => {
  act(state, { type: kind, region: 'spring', difficulty: 'easy', wolfIds: ['wolf-scout'] });
  const arrival = state.adventure.active.endsAt;
  advanceGame(state, arrival);
  return arrival;
};
function completeBattle(state, { lose = false } = {}) {
  act(state, { type: 'startBattle' });
  if (lose) state.herd.hp = 1;
  advanceGame(state, state.updatedAt + 90_000);
  assert.ok(['won', 'lost'].includes(state.battle.status));
}

function completeChapter() {
  const state = fresh();
  act(state, { type: 'collect' });
  claim(state, 'gather');
  act(state, { type: 'build', building: 'pasture', plotId: 'p0' });
  claim(state, 'build');
  act(state, { type: 'train', id: 'wolf-alpha', path: 'guardian' });
  claim(state, 'train');
  completeBattle(state);
  claim(state, 'battle');
  if (state.firstWatch.milestones.recover === null) act(state, { type: 'rest' });
  claim(state, 'recover');
  outing(state);
  claim(state, 'explore');
  act(state, { type: 'equip', id: 'wolf-scout', item: 'leather_vest' });
  // Growing storage is a real available action, not a test-only resource reset.
  act(state, { type: 'build', building: 'storage', plotId: 'p1' });
  claim(state, 'equip');
  outing(state, 'caravan');
  claim(state, 'escort');
  return state;
}

test('First Watch starts empty, preserves the four legacy quests and isolates new games', () => {
  const state = fresh();
  assert.equal(validateGame(state), true);
  assert.equal(state.firstWatch.cohort, 'new');
  assert.equal(state.firstWatch.startedAt, START);
  assert.equal(state.quests.length, 4);
  const progress = firstWatchProgress(state);
  assert.equal(progress.total, 8);
  assert.equal(progress.completed, 0);
  assert.equal(progress.claimed, 0);
  assert.equal(progress.current.id, 'gather');
  assert.equal(progress.current.claimable, false);
  assert.equal(
    progress.steps.slice(1).every((step) => step.locked),
    true,
  );
  act(state, { type: 'collect' });
  assert.equal(fresh().firstWatch.milestones.gather, null);
});

test('a complete chapter works through real game actions and survives a saved reload', () => {
  const state = completeChapter();
  assert.equal(validateGame(state), true);
  const progress = firstWatchProgress(state);
  assert.equal(progress.completed, 8);
  assert.equal(progress.claimed, 8);
  assert.equal(progress.finished, true);
  assert.equal(progress.current, null);
  assert.equal(state.location, 'spring');
  assert.equal(state.wolves[3].equipment, 'leather_vest');
  assert.equal(state.adventure.history.length, 2);
  assert.equal(
    state.quests.every((quest) => !quest.claimed),
    true,
  );
  const saved = JSON.parse(JSON.stringify(state));
  assert.deepEqual(migrateGame(saved), state);
  const rewardsBefore = structuredClone(saved.resources);
  for (const step of FIRST_WATCH_STEPS)
    unchangedFailure(saved, { type: 'claimFirstWatch', id: step.id }, 'FIRST_WATCH_CLAIMED');
  assert.deepEqual(saved.resources, rewardsBefore);
});

test('old v2 villages migrate without changing accounts, economy, old rewards or equipment', () => {
  const old = completeChapter();
  act(old, { type: 'claimQuest', id: 'first_build' });
  delete old.firstWatch;
  const before = structuredClone(old);
  assert.equal(validateGame(old), false);
  const migrated = migrateGame(old);
  assert.deepEqual(old, before);
  const { firstWatch, ...unchanged } = migrated;
  assert.deepEqual(unchanged, before);
  assert.equal(firstWatch.cohort, 'returning');
  assert.equal(firstWatch.startedAt, old.updatedAt);
  assert.equal(firstWatch.claims.length, 0);
  assert.equal(
    Object.values(firstWatch.milestones).every((at) => at === old.updatedAt),
    true,
  );
  assert.equal(validateGame(migrated), true);
  assert.equal(migrateGame(migrated), migrated);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated)), migrated);
});

test('old empty v2 and historical v1 saves gain a pending chapter without invented achievements', () => {
  const old = fresh();
  delete old.firstWatch;
  assert.equal(firstWatchProgress(migrateGame(old)).completed, 0);
  const legacy = createLegacyGame(START);
  const migrated = migrateGame(legacy);
  assert.equal(migrated.firstWatch.cohort, 'returning');
  assert.equal(firstWatchProgress(migrated).completed, 0);
  assert.deepEqual(migrated.resources, legacy.resources);
  assert.deepEqual(migrated.quests, legacy.quests);
  assert.equal(validateGame(migrated), true);
});

test('claims enforce a completed ordered prefix, atomic rewards and exactly-once payout', () => {
  const state = fresh();
  unchangedFailure(state, { type: 'claimFirstWatch', id: 'unknown' }, 'FIRST_WATCH_INVALID_STEP');
  unchangedFailure(state, { type: 'claimFirstWatch', id: '__proto__' }, 'FIRST_WATCH_INVALID_STEP');
  unchangedFailure(state, { type: 'claimFirstWatch', id: 'gather' }, 'FIRST_WATCH_INCOMPLETE');
  act(state, { type: 'build', building: 'well', plotId: 'p0' });
  unchangedFailure(state, { type: 'claimFirstWatch', id: 'build' }, 'FIRST_WATCH_LOCKED');
  act(state, { type: 'collect' });
  const before = structuredClone(state.resources);
  claim(state, 'gather');
  for (const key of Object.keys(before))
    assert.equal(state.resources[key], before[key] + (FIRST_WATCH_STEPS[0].reward[key] || 0));
  unchangedFailure(state, { type: 'claimFirstWatch', id: 'gather' }, 'FIRST_WATCH_CLAIMED');
  claim(state, 'build');
  assert.equal(firstWatchProgress(state).current.id, 'train');
  assert.equal(validateGame(state), true);
});

test('full storage keeps the entire claim pending and reveals exact required free capacity', () => {
  const state = fresh();
  act(state, { type: 'collect' });
  state.resources.wood = 495.25;
  state.resources.stone = 500;
  const progress = firstWatchProgress(state).current;
  assert.equal(progress.completed, true);
  assert.equal(progress.claimable, false);
  assert.deepEqual(progress.missingCapacity, { wood: 16, stone: 10 });
  unchangedFailure(state, { type: 'claimFirstWatch', id: 'gather' }, 'FIRST_WATCH_STORAGE_FULL');
  act(state, { type: 'build', building: 'well', plotId: 'p0' });
  assert.equal(firstWatchProgress(state).current.claimable, true);
  claim(state, 'gather');
  assert.equal(state.resources.wood, 470.25);
  assert.equal(state.resources.stone, 490);
  assert.equal(validateGame(state), true);
});

test('legitimate out-of-order actions remain completed after unequip, reload and repeated actions', () => {
  const state = fresh();
  state.inventory.leather_vest = 1; // An item received from an existing friend.
  act(state, { type: 'equip', id: 'wolf-scout', item: 'leather_vest' });
  act(state, { type: 'unequip', id: 'wolf-scout' });
  act(state, { type: 'train', id: 'wolf-alpha', path: 'guardian' });
  const arrival = outing(state);
  const snapshot = structuredClone(state.firstWatch.milestones);
  assert.equal(snapshot.equip, START);
  assert.equal(snapshot.train, START);
  assert.equal(snapshot.explore, arrival);
  assert.equal(firstWatchProgress(state).steps.find((step) => step.id === 'explore').locked, true);
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  outing(restored);
  assert.deepEqual(restored.firstWatch.milestones, snapshot);
  assert.equal(validateGame(restored), true);
  assert.equal(restored.firstWatch.claims.length, 0);
});

test('a lost battle advances the story and successful recovery only counts after combat', () => {
  const state = fresh();
  state.wolves[0].hp -= 10;
  act(state, { type: 'rest' });
  assert.equal(state.firstWatch.milestones.recover, null);
  completeBattle(state, { lose: true });
  assert.equal(state.battle.status, 'lost');
  assert.notEqual(state.firstWatch.milestones.battle, null);
  assert.equal(state.firstWatch.firstWinAt, null);
  assert.equal(state.firstWatch.milestones.recover, null);
  act(state, { type: 'healHerd' });
  assert.equal(state.firstWatch.milestones.recover, state.updatedAt);
  assert.equal(validateGame(state), true);
});

test('a healthy combat return needs no wasteful recovery action and victory is recorded once', () => {
  const state = fresh();
  act(state, { type: 'startBattle' });
  for (const enemy of state.battle.enemies) enemy.hp = 1;
  advanceGame(state, START + 7000);
  assert.equal(state.battle.status, 'won');
  assert.equal(state.firstWatch.milestones.recover, START + 7000);
  assert.equal(state.firstWatch.firstWinAt, START + 7000);
  const before = structuredClone(state.firstWatch);
  act(state, { type: 'newBattle' });
  act(state, { type: 'startBattle' });
  for (const enemy of state.battle.enemies) enemy.hp = 1;
  advanceGame(state, state.updatedAt + 7000);
  assert.deepEqual(state.firstWatch, before);
  assert.equal(validateGame(state), true);
});

test('resuming an interrupted battle never counts as a battle completion or a victory', () => {
  const state = fresh();
  act(state, { type: 'startBattle' });
  advanceGame(state, START + 9000);
  resumeGame(state, START + 100000);
  assert.equal(state.battle.status, 'preparing');
  assert.equal(state.firstWatch.milestones.battle, null);
  assert.equal(state.firstWatch.firstWinAt, null);
  assert.equal(validateGame(state), true);
});

test('outing achievements use authoritative arrival time and do not depend on polling frequency', () => {
  const state = fresh();
  act(state, { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-scout'] });
  const arrival = state.adventure.active.endsAt;
  const slow = structuredClone(state);
  advanceGame(state, arrival - 1);
  assert.equal(state.firstWatch.milestones.explore, null);
  advanceGame(state, arrival);
  advanceGame(state, arrival + 60000);
  advanceGame(slow, arrival + 60000);
  assert.equal(state.firstWatch.milestones.explore, arrival);
  assert.deepEqual(state, slow);
});

test('strict validation rejects unknown fields, impossible timestamps and forged claim sequences', () => {
  const state = completeChapter();
  const changes = [
    (s) => {
      s.firstWatch = null;
    },
    (s) => {
      s.firstWatch.cohort = 'admin';
    },
    (s) => {
      s.firstWatch.version = 2;
    },
    (s) => {
      s.firstWatch.startedAt = -1;
    },
    (s) => {
      s.firstWatch.startedAt = s.updatedAt + 1;
    },
    (s) => {
      s.firstWatch.milestones.gather = Infinity;
    },
    (s) => {
      s.firstWatch.milestones.gather = START - 1;
    },
    (s) => {
      s.firstWatch.milestones.escort = s.updatedAt + 1;
    },
    (s) => {
      s.firstWatch.milestones.battle = null;
    },
    (s) => {
      s.firstWatch.milestones.recover = START;
    },
    (s) => {
      s.firstWatch.milestones.gather = null;
    },
    (s) => {
      s.firstWatch.milestones.unknown = START;
    },
    (s) => {
      s.firstWatch.claims[0].id = 'build';
    },
    (s) => {
      s.firstWatch.claims[1].id = 'gather';
    },
    (s) => {
      s.firstWatch.claims[0].at = START - 1;
    },
    (s) => {
      s.firstWatch.claims[0].at = s.updatedAt + 1;
    },
    (s) => {
      s.firstWatch.claims[0].reward = { wood: 1000000 };
    },
    (s) => {
      s.firstWatch.claims[7].at = START;
    },
    (s) => {
      s.firstWatch.claims.push({ id: 'escort', at: s.updatedAt });
    },
    (s) => {
      s.firstWatch.firstWinAt = s.updatedAt + 1;
    },
    (s) => {
      s.firstWatch.firstWinAt = START - 1;
    },
    (s) => {
      s.firstWatch.extra = true;
    },
  ];
  for (const change of changes) {
    const corrupted = structuredClone(state);
    change(corrupted);
    assert.equal(validateGame(corrupted), false, change.toString());
    assert.throws(() => migrateGame(corrupted), { code: 'INVALID_SAVE' });
  }
  const freshState = fresh();
  freshState.firstWatch.milestones.gather = START;
  assert.equal(validateGame(freshState), false);
  const legacy = fresh();
  delete legacy.firstWatch;
  legacy.resources.wood = -1;
  assert.throws(() => migrateGame(legacy), { code: 'INVALID_SAVE' });
});

test('migration preserves an in-flight expedition and records its actual arrival after reload', () => {
  const old = fresh();
  act(old, { type: 'expedition', region: 'spring', difficulty: 'easy', wolfIds: ['wolf-scout'] });
  advanceGame(old, START + 15000);
  delete old.firstWatch;
  const active = structuredClone(old.adventure.active);
  const resources = structuredClone(old.resources);
  const migrated = migrateGame(old);
  assert.deepEqual(migrated.adventure.active, active);
  assert.deepEqual(migrated.resources, resources);
  assert.equal(migrated.firstWatch.milestones.explore, null);
  advanceGame(migrated, active.endsAt);
  assert.equal(migrated.firstWatch.milestones.explore, active.endsAt);
  assert.equal(migrated.adventure.history.length, 1);
  assert.equal(migrated.firstWatch.claims.length, 0);
  assert.equal(validateGame(migrated), true);
});

test('the first victory is recorded even when an earlier defeat already completed the battle step', () => {
  const state = fresh();
  completeBattle(state, { lose: true });
  const completedAt = state.firstWatch.milestones.battle;
  act(state, { type: 'rest' });
  act(state, { type: 'healHerd' });
  act(state, { type: 'healHerd' });
  act(state, { type: 'newBattle' });
  act(state, { type: 'startBattle' });
  for (const enemy of state.battle.enemies) enemy.hp = 1;
  advanceGame(state, state.updatedAt + 7000);
  assert.equal(state.battle.status, 'won');
  assert.equal(state.firstWatch.milestones.battle, completedAt);
  assert.equal(state.firstWatch.firstWinAt, state.updatedAt);
  assert.equal(validateGame(state), true);
});

test('timestamp zero is a valid completed and claimed event rather than an absent value', () => {
  const state = createGame(0);
  act(state, { type: 'collect' });
  claim(state, 'gather');
  const progress = firstWatchProgress(state);
  assert.equal(progress.steps[0].completedAt, 0);
  assert.equal(progress.steps[0].claimedAt, 0);
  assert.equal(progress.steps[0].completed, true);
  assert.equal(progress.steps[0].claimed, true);
  assert.equal(validateGame(state), true);
});
