import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  advanceGame,
  migrateGame,
  resumeGame,
  validateGame,
} from '../shared/game.mjs';
import { ADVENTURE_PLANS, adventureQuote, REGIONS } from '../shared/adventures.mjs';
import { adventureReadiness } from '../web/adventure-planning.mjs';

const NOW = Date.UTC(2026, 9, 16, 12);
const choice = (extra = {}) => ({
  kind: 'expedition',
  region: 'spring',
  difficulty: 'easy',
  wolfIds: ['wolf-scout'],
  ...extra,
});
const act = (state, selection) =>
  applyAction(state, { type: selection.kind, ...selection }, state.updatedAt);
const totalXp = (wolf) => (45 * wolf.level * (wolf.level - 1)) / 2 + wolf.xp;
const finish = (state) => advanceGame(state, state.adventure.active.endsAt);
const expected = {
  standard: {
    water: 18,
    feed: 23,
    seconds: 21600,
    xp: 180,
    wood: 96,
    stone: 60,
    herbs: 18,
    fatigue: 5,
  },
  survey: {
    water: 23,
    feed: 29,
    seconds: 21600,
    xp: 270,
    wood: 72,
    stone: 45,
    herbs: 13,
    fatigue: 7,
  },
  supply: {
    water: 23,
    feed: 29,
    seconds: 21600,
    xp: 135,
    wood: 144,
    stone: 90,
    herbs: 27,
    fatigue: 8,
  },
};

test('mission plans quote explicit costs, duration, fatigue and reward tradeoffs', () => {
  assert.deepEqual(ADVENTURE_PLANS, ['standard', 'survey', 'supply']);
  const state = createGame(NOW);
  for (const plan of ADVENTURE_PLANS) {
    const e = expected[plan];
    assert.deepEqual(adventureQuote(state, choice({ plan })), {
      plan,
      cost: { water: e.water, feed: e.feed },
      seconds: e.seconds,
      minimumWolves: 1,
      xp: e.xp,
      reward: { wood: e.wood, stone: e.stone, herbs: e.herbs },
      fatigue: e.fatigue,
      item: 'leather_vest',
    });
  }
  assert.deepEqual(
    adventureQuote(state, choice()),
    adventureQuote(state, choice({ plan: 'standard' })),
  );
});

test('malformed explicit plans fail before supplies, sequence or departure mutate', () => {
  for (const plan of [null, undefined, '', 'unknown', 'STANDARD', 0, false, [], {}, ['survey']]) {
    const state = createGame(NOW);
    const before = structuredClone(state);
    assert.throws(() => adventureQuote(state, choice({ plan })), { code: 'INVALID_EXPEDITION' });
    assert.throws(() => act(state, choice({ plan })), { code: 'INVALID_EXPEDITION' });
    assert.deepEqual(state, before);
  }
});

for (const plan of ADVENTURE_PLANS) {
  test(`${plan} departure and receipt charge once and reward only its selected guardian`, () => {
    const state = createGame(NOW);
    // A level-ten guardian isolates fatigue from level-up healing at every plan payout.
    state.wolves[3].level = 10;
    for (const key of ['wood', 'stone', 'herbs']) state.resources[key] = 0;
    state.wolves[3].hp = 70;
    const before = structuredClone(state);
    const e = expected[plan];
    act(state, choice({ plan }));
    assert.equal(state.adventure.active.plan, plan);
    assert.equal(state.resources.water, before.resources.water - e.water);
    assert.equal(state.resources.feed, before.resources.feed - e.feed);
    assert.equal(state.adventure.active.endsAt, NOW + e.seconds * 1000);
    assert.equal(validateGame(state), true);
    advanceGame(state, state.adventure.active.endsAt - 1);
    assert.equal(state.adventure.history.length, 0);
    finish(state);
    assert.equal(state.wolves[3].hp, 70 - e.fatigue);
    assert.equal(totalXp(state.wolves[3]) - totalXp(before.wolves[3]), e.xp);
    assert.deepEqual(
      state.wolves.filter((w) => w.id !== 'wolf-scout'),
      before.wolves.filter((w) => w.id !== 'wolf-scout'),
    );
    assert.deepEqual(state.adventure.history[0].reward, {
      water: 0,
      feed: 0,
      wood: e.wood,
      stone: e.stone,
      herbs: e.herbs,
    });
    assert.equal(state.adventure.history[0].plan, plan);
    assert.equal(state.adventure.history[0].xp, e.xp);
    assert.equal(state.inventory.leather_vest, 1);
    assert.deepEqual(state.adventure.unlocked, ['homeland', 'spring']);
    assert.equal(state.location, 'homeland');
    const awarded = structuredClone(state);
    advanceGame(state, state.updatedAt + 60_000);
    assert.deepEqual(state.wolves, awarded.wolves);
    assert.deepEqual(state.inventory, awarded.inventory);
    assert.deepEqual(state.resources, awarded.resources);
    assert.deepEqual(state.adventure.history, awarded.adventure.history);
    assert.equal(validateGame(state), true);
  });
}

test('every plan retains party, route, health and concurrent mission restrictions', () => {
  for (const plan of ADVENTURE_PLANS) {
    for (const [overrides, code] of [
      [{ difficulty: 'hard' }, 'PARTY_TOO_SMALL'],
      [{ wolfIds: [] }, 'INVALID_PARTY'],
      [{ wolfIds: ['wolf-scout', 'wolf-scout'] }, 'INVALID_PARTY'],
      [{ wolfIds: ['missing'] }, 'INVALID_PARTY'],
      [{ region: 'ruins' }, 'REGION_LOCKED'],
      [{ kind: 'caravan' }, 'REGION_LOCKED'],
    ]) {
      const state = createGame(NOW);
      const before = structuredClone(state);
      assert.throws(() => act(state, choice({ plan, ...overrides })), { code });
      assert.deepEqual(state, before);
    }
    const state = createGame(NOW);
    state.wolves[3].hp = 19;
    assert.throws(() => act(state, choice({ plan })), { code: 'INVALID_PARTY' });
    state.wolves[3].hp = 20;
    act(state, choice({ plan }));
    const before = structuredClone(state);
    assert.throws(() => act(state, choice({ plan })), { code: 'JOURNEY_ACTIVE' });
    assert.deepEqual(state, before);
  }
});

test('scout equipment discounts departure supplies with one final rounding and cannot change underway', () => {
  const state = createGame(NOW);
  state.inventory.scout_charm = 3;
  for (const id of ['wolf-scout', 'wolf-alpha', 'wolf-guardian'])
    applyAction(state, { type: 'equip', id, item: 'scout_charm' }, NOW);
  assert.equal(adventureQuote(state, choice()).seconds, 21600);
  assert.deepEqual(adventureQuote(state, choice()).cost, { water: 16, feed: 20 });
  assert.equal(adventureQuote(state, choice({ plan: 'survey' })).seconds, 21600);
  assert.deepEqual(adventureQuote(state, choice({ plan: 'survey' })).cost, { water: 20, feed: 25 });
  assert.equal(adventureQuote(state, choice({ plan: 'supply' })).seconds, 21600);
  // The combined 45% scouting discount remains capped at 30%, with one final rounding.
  const squad = choice({
    plan: 'survey',
    difficulty: 'hard',
    wolfIds: ['wolf-scout', 'wolf-alpha', 'wolf-guardian'],
  });
  assert.equal(adventureQuote(state, squad).seconds, 21600);
  assert.deepEqual(adventureQuote(state, squad).cost, { water: 25, feed: 33 });
  act(state, squad);
  const before = structuredClone(state);
  assert.throws(() => applyAction(state, { type: 'unequip', id: 'wolf-scout' }, NOW), {
    code: 'WOLF_BUSY',
  });
  assert.deepEqual(state, before);
  finish(state);
  applyAction(state, { type: 'unequip', id: 'wolf-scout' }, state.updatedAt);
  assert.equal(
    validateGame(state),
    true,
    'historical time is independent of equipment changed after arrival',
  );
});

test('reloading before and after arrival preserves every plan and awards exactly once', () => {
  for (const plan of ADVENTURE_PLANS) {
    for (const kind of ['expedition', 'caravan']) {
      const state = createGame(NOW);
      if (kind === 'caravan') state.adventure.unlocked.push('spring');
      act(state, choice({ plan, kind }));
      const end = state.adventure.active.endsAt;
      const restored = migrateGame(JSON.parse(JSON.stringify(state)));
      resumeGame(restored, end - 1);
      assert.equal(restored.adventure.active.plan, plan);
      assert.equal(restored.adventure.history.length, 0);
      resumeGame(restored, end + 1000);
      assert.equal(restored.adventure.active, null);
      assert.equal(restored.adventure.history[0].plan, plan);
      assert.equal(restored.adventure.history[0].xp, expected[plan].xp);
      assert.equal(restored.adventure.history[0].completedAt, end);
      assert.equal(restored.location, kind === 'caravan' ? 'spring' : 'homeland');
      const once = structuredClone(restored);
      resumeGame(restored, end + 60_000);
      assert.deepEqual(restored.adventure, once.adventure);
      assert.deepEqual(restored.wolves, once.wolves);
      assert.deepEqual(restored.inventory, once.inventory);
      assert.equal(validateGame(restored), true);
    }
  }
});

test('legacy active and history records retain their original timing, payouts and absent plan', () => {
  const state = createGame(NOW);
  act(state, choice());
  assert.equal(state.adventure.active.plan, 'standard');
  delete state.adventure.active.plan;
  delete state.adventure.active.economyVersion;
  state.adventure.active.endsAt = NOW + 60_000;
  const before = structuredClone(state);
  assert.equal(validateGame(state), true);
  assert.deepEqual(migrateGame(state), before);
  const legacy = JSON.parse(JSON.stringify(state));
  resumeGame(legacy, NOW + 60_000);
  assert.equal(legacy.adventure.history[0].completedAt, NOW + 60_000);
  assert.equal(Object.hasOwn(legacy.adventure.history[0], 'plan'), false);
  assert.equal(legacy.adventure.history[0].xp, 30);
  assert.deepEqual(legacy.adventure.history[0].reward, {
    water: 0,
    feed: 0,
    herbs: 7,
    wood: 32,
    stone: 21,
  });
  assert.equal(legacy.wolves[3].hp, 105);
  assert.equal(validateGame(legacy), true);
  const oldReceipt = structuredClone(legacy.adventure.history[0]);
  act(legacy, choice({ plan: 'survey' }));
  finish(legacy);
  assert.deepEqual(legacy.adventure.history[1], oldReceipt);
  assert.equal(validateGame(legacy), true);
});

test('legacy save validation rejects invalid plan fields, changed active timing and forged receipt amounts', () => {
  const state = createGame(NOW);
  act(state, choice({ plan: 'survey' }));
  state.adventure.active.economyVersion = 2;
  state.adventure.active.endsAt = NOW + 75_000;
  for (const plan of [null, undefined, '', 'anything', false, [], {}, 1]) {
    const changed = structuredClone(state);
    changed.adventure.active.plan = plan;
    assert.equal(validateGame(changed), false);
  }
  for (const mutate of [
    (a) => {
      delete a.plan;
    },
    (a) => {
      a.plan = 'standard';
    },
    (a) => {
      a.planExtra = 'supply';
    },
    (a) => {
      a.endsAt += 1000;
    },
  ]) {
    const changed = structuredClone(state);
    mutate(changed.adventure.active);
    assert.equal(validateGame(changed), false);
  }
  finish(state);
  for (const mutate of [
    (r) => {
      r.plan = null;
    },
    (r) => {
      r.plan = 'invalid';
    },
    (r) => {
      delete r.plan;
    },
    (r) => {
      r.plan = 'standard';
    },
    (r) => {
      r.xp++;
    },
    (r) => {
      r.reward.wood = 25;
    },
    (r) => {
      r.reward.feed = 1;
    },
    (r) => {
      r.item = 'iron_guard';
    },
    (r) => {
      r.itemCount = 2;
    },
    (r) => {
      r.endsAt = r.startedAt + 564000;
      r.completedAt = r.endsAt;
    },
  ]) {
    const changed = structuredClone(state);
    mutate(changed.adventure.history[0]);
    assert.equal(validateGame(changed), false);
  }
});

test('legacy planned missions validate up to 563 seconds without widening their original duration cap', () => {
  for (const plan of ADVENTURE_PLANS) {
    const state = createGame(NOW);
    state.adventure.unlocked = REGIONS.slice(0, -1).map((r) => r.id);
    const squad = choice({
      plan,
      region: 'ruins',
      difficulty: 'hard',
      wolfIds: ['wolf-alpha', 'wolf-guardian', 'wolf-hunter'],
    });
    act(state, squad);
    state.adventure.active.economyVersion = 2;
    state.adventure.active.endsAt =
      NOW + adventureQuote(state, squad, { economyVersion: 2 }).seconds * 1000;
    assert.equal(state.adventure.active.endsAt - NOW, plan === 'standard' ? 450000 : 563000);
    assert.equal(validateGame(state), true);
    finish(state);
    assert.equal(validateGame(state), true);
    if (plan === 'standard') {
      delete state.adventure.history[0].plan;
      state.updatedAt = NOW + 451000;
      state.adventure.history[0].endsAt = state.updatedAt;
      state.adventure.history[0].completedAt = state.updatedAt;
      assert.equal(validateGame(state), false);
    }
  }
});

test('resource and item storage caps apply to enhanced supply receipts without duplicate awards', () => {
  const state = createGame(NOW);
  state.resources.wood = 499.5;
  state.resources.stone = 500;
  state.resources.herbs = 498;
  state.inventory.leather_vest = 10000;
  act(state, choice({ plan: 'supply' }));
  finish(state);
  assert.deepEqual(state.adventure.history[0].reward, {
    water: 0,
    feed: 0,
    herbs: 2,
    wood: 0.5,
    stone: 0,
  });
  assert.equal(state.adventure.history[0].itemCount, 0);
  assert.equal(state.inventory.leather_vest, 10000);
  assert.equal(totalXp(state.wolves[3]), 135);
  assert.equal(state.wolves[3].level, 3);
  assert.equal(state.wolves[3].xp, 0);
  assert.equal(state.wolves[3].hp, state.wolves[3].maxHp);
  assert.equal(validateGame(state), true);
});

test('readiness shows authoritative plan fatigue, costs and extra storage pressure without mutation', () => {
  const state = createGame(NOW);
  state.resources.water = 18;
  state.resources.feed = 23;
  state.resources.wood = 480;
  const before = structuredClone(state);
  assert.equal(adventureReadiness(state, choice()).ready, true);
  for (const plan of ['survey', 'supply']) {
    const readiness = adventureReadiness(state, choice({ plan }));
    assert.equal(readiness.ready, false);
    assert.equal(readiness.fatigue, expected[plan].fatigue);
    assert.deepEqual(readiness.shortages, [
      { resource: 'water', amount: 5 },
      { resource: 'feed', amount: 6 },
    ]);
    assert.deepEqual(readiness.overflow, [
      { resource: 'wood', amount: plan === 'supply' ? 124 : 52 },
    ]);
  }
  assert.deepEqual(state, before);
});

test('planned escort arrivals and production are independent of browser polling frequency', () => {
  for (const plan of ['survey', 'supply']) {
    const state = createGame(NOW);
    applyAction(state, { type: 'build', building: 'well', plotId: 'p0' }, NOW);
    state.adventure.unlocked.push('spring');
    act(state, choice({ kind: 'caravan', plan }));
    const end = state.adventure.active.endsAt;
    const frequent = structuredClone(state);
    advanceGame(state, end + 30_000);
    for (let at = NOW + 60_137; at < end + 30_000; at += 60_137) advanceGame(frequent, at);
    advanceGame(frequent, end + 30_000);
    for (const key of Object.keys(state.resources))
      assert.ok(Math.abs(state.resources[key] - frequent.resources[key]) < 1e-8, key);
    assert.deepEqual(state.adventure, frequent.adventure);
    assert.deepEqual(state.wolves, frequent.wolves);
    assert.deepEqual(state.inventory, frequent.inventory);
    assert.equal(state.location, 'spring');
    assert.equal(validateGame(state), true);
    assert.equal(validateGame(frequent), true);
  }
});
