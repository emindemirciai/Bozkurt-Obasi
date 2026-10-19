import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, advanceGame, validateGame } from '../shared/game.mjs';
import { arrivalReport, createArrivalTracker } from '../web/arrival-notices.mjs';

const NOW = Date.UTC(2026, 9, 19, 12);
const ACCOUNT = 'guardian#1234';
const OTHER = 'scout#5678';

function storage() {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
}

function report(number = 1, extra = {}) {
  return {
    id: 'outing-' + number,
    kind: 'expedition',
    region: 'spring',
    difficulty: 'easy',
    plan: 'standard',
    economyVersion: 2,
    wolfIds: ['wolf-scout'],
    startedAt: NOW + number * 100_000,
    endsAt: NOW + number * 100_000 + 60_000,
    completedAt: NOW + number * 100_000 + 60_000,
    reward: { water: 0, feed: 0, wood: 16, stone: 10, herbs: 3 },
    item: 'leather_vest',
    itemCount: 1,
    xp: 30,
    ...extra,
  };
}
function state(reports = [], extra = {}) {
  return {
    adventure: {
      sequence: reports.length ? Number(reports[0].id.slice(7)) : 0,
      active: null,
      history: reports,
      ...extra,
    },
  };
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test('arrival projection retains credited fractions, zero items and participant XP without changing saves', () => {
  const game = createGame(NOW);
  game.resources.wood = 499.5;
  game.resources.stone = 500;
  game.resources.herbs = 498;
  game.inventory.leather_vest = 10000;
  const tracker = createArrivalTracker();
  assert.deepEqual(tracker.update(ACCOUNT, game), { notice: null, unreadCount: 0 });
  applyAction(
    game,
    {
      type: 'expedition',
      region: 'spring',
      difficulty: 'easy',
      plan: 'supply',
      wolfIds: ['wolf-scout'],
    },
    NOW,
  );
  tracker.update(ACCOUNT, game);
  advanceGame(game, game.adventure.active.endsAt);
  assert.equal(validateGame(game), true);
  const before = structuredClone(game);
  freeze(game);
  const { notice, unreadCount } = tracker.update(ACCOUNT, game);
  assert.equal(unreadCount, 1);
  assert.equal(notice.source, 'returned');
  assert.deepEqual(notice.reward, { water: 0, feed: 0, wood: 0.5, stone: 0, herbs: 2 });
  assert.equal(notice.itemCount, 0);
  assert.equal(notice.xp, 135);
  assert.deepEqual(notice.wolfIds, ['wolf-scout']);
  assert.deepEqual(game, before);
  notice.reward.wood = 999;
  notice.wolfIds.push('wolf-alpha');
  assert.equal(tracker.update(ACCOUNT, game).notice.reward.wood, 0.5);
  assert.deepEqual(tracker.update(ACCOUNT, game).notice.wolfIds, ['wolf-scout']);
  assert.deepEqual(game, before);
});

test('legacy reports keep old credited rewards and never invent a plan or economy version', () => {
  const legacy = report(1);
  delete legacy.plan;
  delete legacy.economyVersion;
  legacy.reward.wood = 32;
  legacy.reward.stone = 21;
  legacy.reward.herbs = 7;
  const projected = arrivalReport(freeze(legacy));
  assert.equal(Object.hasOwn(projected, 'plan'), false);
  assert.equal(Object.hasOwn(projected, 'economyVersion'), false);
  assert.deepEqual(projected.reward, legacy.reward);
  assert.equal(projected.key, 'outing-1@' + legacy.startedAt);
});

test('first login and reload expose only the latest historical report with neutral wording', () => {
  const memory = storage();
  const reports = Array.from({ length: 20 }, (_, index) => report(20 - index));
  const tracker = createArrivalTracker({ storage: memory });
  const snapshot = tracker.update(ACCOUNT, state(reports));
  assert.equal(snapshot.unreadCount, 1);
  assert.equal(snapshot.notice.id, 'outing-20');
  assert.equal(snapshot.notice.source, 'existing');
  assert.equal(memory.entries.size, 0);
  assert.equal(tracker.update(ACCOUNT, state(reports)).notice.source, 'existing');
  assert.deepEqual(tracker.dismiss(ACCOUNT, snapshot.notice.key), { notice: null, unreadCount: 0 });
  assert.deepEqual(tracker.update(ACCOUNT, state(reports)), { notice: null, unreadCount: 0 });
  const reloaded = createArrivalTracker({ storage: memory });
  assert.deepEqual(reloaded.update(ACCOUNT, state(reports)), { notice: null, unreadCount: 0 });
  assert.equal(memory.entries.size, 1);
  const saved = [...memory.entries.values()][0];
  assert.deepEqual(JSON.parse(saved), { version: 1, read: [snapshot.notice.key] });
  assert.equal(saved.includes('wood'), false);
  assert.equal(saved.includes(ACCOUNT), false);
});

test('new live completions stay unread once across polls and become neutral after reload', () => {
  const memory = storage();
  const tracker = createArrivalTracker({ storage: memory });
  tracker.update(ACCOUNT, state([report(1)]));
  tracker.dismiss(ACCOUNT);
  const next = tracker.update(ACCOUNT, state([report(3), report(2), report(1)]));
  assert.equal(next.notice.id, 'outing-3');
  assert.equal(next.notice.source, 'returned');
  assert.equal(next.unreadCount, 1);
  assert.deepEqual(tracker.update(ACCOUNT, state([report(3), report(2), report(1)])), next);
  const reloaded = createArrivalTracker({ storage: memory });
  assert.equal(
    reloaded.update(ACCOUNT, state([report(3), report(2), report(1)])).notice.source,
    'existing',
  );
  tracker.dismiss(ACCOUNT);
  assert.deepEqual(tracker.update(ACCOUNT, state([report(3), report(2), report(1)])), {
    notice: null,
    unreadCount: 0,
  });
});

test('account switching, stale dismisses and logout never expose or acknowledge another account notice', () => {
  const memory = storage();
  const tracker = createArrivalTracker({ storage: memory });
  const a = tracker.update(ACCOUNT, state([report(1)]));
  tracker.dismiss(ACCOUNT);
  const b = tracker.update(OTHER, state([report(1)]));
  assert.equal(b.unreadCount, 1);
  assert.deepEqual(tracker.dismiss(ACCOUNT, a.notice.key), { notice: null, unreadCount: 0 });
  assert.equal(tracker.update(OTHER, state([report(1)])).unreadCount, 1);
  assert.deepEqual(tracker.dismiss(OTHER, 'wrong-key'), b);
  assert.deepEqual(tracker.clear(), { notice: null, unreadCount: 0 });
  assert.deepEqual(tracker.update(null, state([report(1)])), { notice: null, unreadCount: 0 });
  assert.equal(tracker.update(OTHER, state([report(1)])).notice.source, 'existing');
  assert.deepEqual(tracker.update(ACCOUNT, state([report(1)])), { notice: null, unreadCount: 0 });
  assert.ok([...memory.entries.keys()].every((key) => !key.includes('#')));
});

test('save resets clear obsolete notices and reused outing numbers retain independent identities', () => {
  const tracker = createArrivalTracker({ storage: storage() });
  const old = report(7);
  tracker.update(ACCOUNT, state([old]));
  tracker.dismiss(ACCOUNT);
  tracker.update(ACCOUNT, state([report(8), old]));
  assert.deepEqual(tracker.update(ACCOUNT, state()), { notice: null, unreadCount: 0 });
  const fresh = report(1, { startedAt: NOW + 9_000_000, completedAt: NOW + 9_060_000 });
  const arrived = tracker.update(ACCOUNT, state([fresh]));
  assert.equal(arrived.notice.source, 'returned');
  assert.equal(arrived.notice.key, 'outing-1@' + fresh.startedAt);
  tracker.dismiss(ACCOUNT);
  const replacement = {
    ...fresh,
    startedAt: fresh.startedAt + 1,
    completedAt: fresh.completedAt + 1,
  };
  const reset = tracker.update(ACCOUNT, state([replacement]));
  assert.equal(reset.unreadCount, 1);
  assert.equal(reset.notice.source, 'existing');
});

test('switching directly to an older or lower-sequence save is a neutral latest report', () => {
  const tracker = createArrivalTracker();
  tracker.update(ACCOUNT, state([report(8)]));
  tracker.dismiss(ACCOUNT);
  const lower = report(1, { startedAt: NOW + 9_000_000, completedAt: NOW + 9_060_000 });
  assert.equal(tracker.update(ACCOUNT, state([lower])).notice.source, 'existing');
  const older = report(3, { startedAt: NOW, completedAt: NOW + 60_000 });
  assert.equal(tracker.update(ACCOUNT, state([older])).notice.source, 'existing');
});

test('denied storage, quota errors and malformed receipts preserve usable session deduplication', () => {
  for (const raw of [
    '{broken',
    '[]',
    '{"version":9,"read":[]}',
    '{"version":1,"read":null}',
    'x'.repeat(17000),
  ]) {
    const tracker = createArrivalTracker({
      storage: {
        getItem: () => raw,
        setItem: () => {
          throw new Error('quota');
        },
      },
    });
    assert.equal(tracker.update(ACCOUNT, state([report(1)])).unreadCount, 1);
    assert.equal(tracker.dismiss(ACCOUNT).unreadCount, 0);
    assert.equal(tracker.update(ACCOUNT, state([report(1)])).unreadCount, 0);
  }
  const tracker = createArrivalTracker({
    storage: {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    },
  });
  tracker.update(ACCOUNT, state([report(1)]));
  tracker.dismiss(ACCOUNT);
  assert.equal(tracker.update(ACCOUNT, state([report(1)])).unreadCount, 0);
  assert.equal(tracker.update(ACCOUNT, state([report(2)])).notice.source, 'returned');
});

test('receipt storage is bounded and contains only validated report identities', () => {
  const memory = storage();
  const tracker = createArrivalTracker({ storage: memory });
  for (let number = 1; number <= 70; number++) {
    tracker.update(ACCOUNT, state([report(number)]));
    tracker.dismiss(ACCOUNT);
  }
  const saved = JSON.parse([...memory.entries.values()][0]);
  assert.equal(saved.read.length, 40);
  assert.equal(saved.read[0], 'outing-31@' + report(31).startedAt);
  const key = [...memory.entries.keys()][0];
  memory.entries.set(
    key,
    JSON.stringify({
      version: 1,
      read: [null, {}, 'outing-1@NaN', report(70).id + '@' + report(70).startedAt],
      reward: { wood: 1000 },
    }),
  );
  const reloaded = createArrivalTracker({ storage: memory });
  assert.equal(reloaded.update(ACCOUNT, state([report(70)])).unreadCount, 0);
  reloaded.update(ACCOUNT, state([report(71)]));
  reloaded.dismiss(ACCOUNT);
  assert.deepEqual(Object.keys(JSON.parse(memory.entries.get(key))), ['version', 'read']);
});

test('empty and malformed game histories never invent rewards or retain a removed report', () => {
  const tracker = createArrivalTracker();
  for (const value of [null, {}, { adventure: null }, state(), { adventure: { history: {} } }])
    assert.deepEqual(tracker.update(ACCOUNT, value), { notice: null, unreadCount: 0 });
  for (const invalid of [
    null,
    {},
    report(1, { reward: { water: 0, feed: 0, wood: -1, stone: 1, herbs: 1 } }),
    report(1, { itemCount: 2 }),
    report(1, { xp: NaN }),
    report(1, { completedAt: NOW }),
    report(1, { wolfIds: [] }),
  ])
    assert.equal(arrivalReport(invalid), null);
  assert.equal(tracker.update(ACCOUNT, state([report(1)])).unreadCount, 1);
  assert.deepEqual(tracker.update(ACCOUNT, state()), { notice: null, unreadCount: 0 });
  assert.deepEqual(tracker.update('', state([report(1)])), { notice: null, unreadCount: 0 });
});

test('an already observed active departure can complete without incrementing its sequence again', () => {
  const tracker = createArrivalTracker();
  const previous = report(1);
  const returning = report(2);
  tracker.update(ACCOUNT, state([previous]));
  tracker.dismiss(ACCOUNT);
  tracker.update(ACCOUNT, state([previous], { sequence: 2, active: returning }));
  const snapshot = tracker.update(ACCOUNT, state([returning, previous], { sequence: 2 }));
  assert.equal(snapshot.notice.source, 'returned');
  assert.equal(snapshot.unreadCount, 1);
});
