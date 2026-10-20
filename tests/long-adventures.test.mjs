import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  advanceGame,
  resumeGame,
  migrateGame,
  validateGame,
} from '../shared/game.mjs';
import {
  ADVENTURE_HOURS,
  ADVENTURE_PLANS,
  DIFFICULTIES,
  REGIONS,
  adventureQuote,
  outingQuote,
} from '../shared/adventures.mjs';

const START = Date.UTC(2026, 9, 19, 12);
const choice = (extra = {}) => ({
  kind: 'expedition',
  region: 'spring',
  difficulty: 'easy',
  plan: 'standard',
  wolfIds: ['wolf-scout'],
  ...extra,
});
const act = (state, action) => applyAction(state, action, state.updatedAt);
const depart = (state, selection = choice()) => act(state, { ...selection, type: selection.kind });
const totalXp = (wolf) => (45 * wolf.level * (wolf.level - 1)) / 2 + wolf.xp;
const emptyMaterials = (state) => {
  state.resources.wood = 0;
  state.resources.stone = 0;
  state.resources.herbs = 0;
};
function legacyDeparture(state, selection, marker) {
  const version = marker === undefined ? 1 : marker;
  const promised = adventureQuote(state, selection, { economyVersion: version });
  depart(state, selection);
  const active = state.adventure.active;
  active.endsAt = active.startedAt + promised.seconds * 1000;
  if (marker === undefined) delete active.economyVersion;
  else active.economyVersion = marker;
  if (!Object.hasOwn(selection, 'plan')) delete active.plan;
  return promised;
}

test('all new routes use their fixed six/eight/ten/twelve-hour duration for every plan and difficulty', () => {
  assert.deepEqual(ADVENTURE_HOURS, {
    homeland: 6,
    spring: 6,
    meadow: 8,
    highland: 10,
    ruins: 12,
  });
  assert.equal(Object.isFrozen(ADVENTURE_HOURS), true);
  const state = createGame(START);
  for (const wolf of state.wolves) wolf.equipment = 'scout_charm';
  const before = structuredClone(state);
  for (const route of REGIONS) {
    for (const difficulty of DIFFICULTIES) {
      for (const plan of ADVENTURE_PLANS) {
        for (const kind of ['expedition', 'caravan']) {
          const quoted = adventureQuote(
            state,
            choice({
              region: route.id,
              difficulty,
              plan,
              kind,
              wolfIds: state.wolves.map((w) => w.id),
            }),
          );
          assert.equal(quoted.seconds, ADVENTURE_HOURS[route.id] * 3600);
          assert.ok(quoted.seconds >= 6 * 3600 && quoted.seconds <= 12 * 3600);
        }
      }
    }
  }
  assert.deepEqual(state, before);
  assert.deepEqual(
    REGIONS.map((region) => region.duration),
    [45, 60, 90, 120, 150],
  );
});

test('long-journey XP and materials scale moderately with hours, difficulty and the chosen plan', () => {
  const state = createGame(START);
  const base = {
    spring: { xp: 180, wood: 96, stone: 60, herbs: 18 },
    meadow: { xp: 240, wood: 128, stone: 80, herbs: 24 },
    highland: { xp: 300, wood: 160, stone: 100, herbs: 30 },
    ruins: { xp: 360, wood: 192, stone: 120, herbs: 36 },
  };
  for (const [region, expected] of Object.entries(base)) {
    const standard = adventureQuote(state, choice({ region }));
    assert.equal(standard.xp, expected.xp);
    assert.deepEqual(standard.reward, {
      wood: expected.wood,
      stone: expected.stone,
      herbs: expected.herbs,
    });
    for (const [index, difficulty] of DIFFICULTIES.entries()) {
      const multiplier = [1, 1.5, 2][index];
      for (const plan of ADVENTURE_PLANS) {
        const quoted = adventureQuote(state, choice({ region, difficulty, plan }));
        const xpMultiplier = plan === 'survey' ? 1.5 : plan === 'supply' ? 0.75 : 1;
        const materialMultiplier = plan === 'survey' ? 0.75 : plan === 'supply' ? 1.5 : 1;
        assert.equal(quoted.xp, Math.floor(expected.xp * multiplier * xpMultiplier));
        for (const key of ['wood', 'stone', 'herbs'])
          assert.equal(
            quoted.reward[key],
            Math.floor(expected[key] * multiplier * materialMultiplier),
          );
        assert.equal(quoted.minimumWolves, index + 1);
        assert.equal(
          quoted.fatigue,
          (index + 1) * (plan === 'survey' ? 7 : plan === 'supply' ? 8 : 5),
        );
      }
    }
  }
  const old = adventureQuote(state, choice(), { economyVersion: 2 });
  const current = adventureQuote(state, choice());
  assert.ok(current.reward.wood < old.reward.wood * (current.seconds / old.seconds));
  assert.deepEqual(current.cost, old.cost);
  assert.equal(current.fatigue, old.fatigue);
});

test('scouting discounts only departure water and feed, rounds once and remains capped at thirty percent', () => {
  const state = createGame(START);
  const selection = choice({ plan: 'survey' });
  const base = adventureQuote(state, selection);
  state.wolves[3].equipment = 'scout_charm';
  const oneScout = adventureQuote(state, selection);
  assert.deepEqual(oneScout.cost, { water: 20, feed: 25 });
  assert.deepEqual(oneScout, { ...base, cost: oneScout.cost });
  for (const wolf of state.wolves) wolf.equipment = 'scout_charm';
  const three = adventureQuote(
    state,
    choice({
      plan: 'survey',
      difficulty: 'hard',
      wolfIds: state.wolves.slice(0, 3).map((w) => w.id),
    }),
  );
  const five = adventureQuote(
    state,
    choice({ plan: 'survey', difficulty: 'hard', wolfIds: state.wolves.map((w) => w.id) }),
  );
  assert.deepEqual(three, five);
  assert.deepEqual(three.cost, { water: 25, feed: 33 });
  assert.equal(three.seconds, 21_600);
  assert.equal(three.xp, 540);
  assert.deepEqual(three.reward, { wood: 144, stone: 90, herbs: 27 });
});

test('representative legacy tier, plan and scout promises retain their exact historic quote values', () => {
  const state = createGame(START);
  const wolfIds = state.wolves.slice(0, 3).map((wolf) => {
    wolf.equipment = 'scout_charm';
    return wolf.id;
  });
  const selection = choice({ region: 'highland', difficulty: 'hard', plan: 'supply', wolfIds });
  const old = {
    plan: 'supply',
    cost: { water: 43, feed: 57 },
    seconds: 315,
    minimumWolves: 3,
    xp: 112,
    reward: { wood: 252, stone: 175, herbs: 49 },
    fatigue: 24,
    item: 'iron_guard',
  };
  assert.deepEqual(adventureQuote(state, selection, { economyVersion: 1 }), old);
  assert.deepEqual(adventureQuote(state, selection, { economyVersion: 2 }), {
    ...old,
    reward: { wood: 126, stone: 87, herbs: 24 },
  });
});

test('new server departures always record version three and clients cannot choose a faster economy', () => {
  for (const marker of [undefined, 1, 2, 3, null, '2', false]) {
    const state = createGame(START);
    const before = structuredClone(state);
    const selection = choice({ economyVersion: marker, seconds: 1 });
    depart(state, selection);
    assert.equal(state.adventure.active.economyVersion, 3);
    assert.equal(state.adventure.active.endsAt - state.adventure.active.startedAt, 21_600_000);
    assert.equal(state.resources.water, before.resources.water - 18);
    assert.equal(state.resources.feed, before.resources.feed - 23);
    assert.equal(Object.hasOwn(state.adventure.active, 'seconds'), false);
    assert.equal(validateGame(state), true);
  }
});

test('a six-hour expedition awards nothing before arrival and credits its selected wolves exactly once', () => {
  const state = createGame(START);
  emptyMaterials(state);
  const before = structuredClone(state);
  depart(state);
  const end = state.adventure.active.endsAt;
  advanceGame(state, end - 1);
  assert.equal(state.adventure.active.endsAt, end);
  assert.deepEqual(state.adventure.history, []);
  assert.equal(state.inventory.leather_vest, 0);
  assert.equal(totalXp(state.wolves[3]), totalXp(before.wolves[3]));
  assert.equal(state.firstWatch.milestones.explore, null);
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  advanceGame(restored, end);
  assert.equal(restored.adventure.active, null);
  assert.equal(restored.adventure.history[0].economyVersion, 3);
  assert.equal(restored.adventure.history[0].completedAt, end);
  assert.deepEqual(restored.adventure.history[0].reward, {
    water: 0,
    feed: 0,
    wood: 96,
    stone: 60,
    herbs: 18,
  });
  assert.equal(restored.adventure.history[0].xp, 180);
  assert.equal(restored.inventory.leather_vest, 1);
  assert.equal(totalXp(restored.wolves[3]) - totalXp(before.wolves[3]), 180);
  for (const [index, wolf] of restored.wolves.entries())
    if (wolf.id !== 'wolf-scout') assert.deepEqual(wolf, before.wolves[index]);
  assert.equal(restored.firstWatch.milestones.explore, end);
  assert.equal(validateGame(restored), true);
  const paid = structuredClone(restored);
  resumeGame(restored, end + 86_400_000);
  assert.deepEqual(restored.resources, paid.resources);
  assert.deepEqual(restored.wolves, paid.wolves);
  assert.deepEqual(restored.inventory, paid.inventory);
  assert.deepEqual(restored.adventure.history, paid.adventure.history);
});

test('a twelve-hour offline return completes on schedule while passive production retains its eight-hour ceiling', () => {
  const state = createGame(START);
  act(state, { type: 'build', building: 'healer', plotId: 'p0' });
  act(state, { type: 'build', building: 'storage', plotId: 'p1' });
  // Mature storage keeps the production ceiling observable instead of filling first.
  state.buildings.find((building) => building.type === 'storage').level = 5;
  state.capacity = 5000000;
  state.resources.herbs = 0;
  state.adventure.unlocked = REGIONS.map((region) => region.id);
  assert.equal(validateGame(state), true);
  const initialXp = totalXp(state.wolves[3]);
  depart(state, choice({ region: 'ruins' }));
  const arrival = START + 12 * 3_600_000;
  assert.equal(state.adventure.active.endsAt, arrival);
  const restored = migrateGame(JSON.parse(JSON.stringify(state)));
  resumeGame(restored, arrival);
  assert.equal(restored.adventure.active, null);
  assert.equal(restored.updatedAt, arrival);
  assert.equal(restored.adventure.history[0].completedAt, arrival);
  assert.equal(restored.firstWatch.milestones.explore, arrival);
  assert.equal(restored.adventure.history[0].reward.herbs, 36);
  assert.equal(restored.resources.herbs, 144 + 36);
  assert.equal(totalXp(restored.wolves[3]) - initialXp, 360);
  assert.equal(validateGame(restored), true);
  const paid = structuredClone(restored);
  const reloaded = migrateGame(JSON.parse(JSON.stringify(restored)));
  resumeGame(reloaded, arrival);
  assert.deepEqual(reloaded.resources, paid.resources);
  assert.deepEqual(reloaded.wolves, paid.wolves);
  assert.deepEqual(reloaded.adventure.history, paid.adventure.history);
  resumeGame(reloaded, arrival + 60_000);
  assert.deepEqual(reloaded.resources, { ...paid.resources, herbs: paid.resources.herbs + 0.3 });
  assert.deepEqual(reloaded.wolves, paid.wolves);
  assert.deepEqual(reloaded.adventure.history, paid.adventure.history);
  assert.equal(validateGame(reloaded), true);
});

test('late polling and exact arrival produce the same long-journey rewards and completion timestamps', () => {
  const exact = createGame(START);
  emptyMaterials(exact);
  depart(exact);
  const late = structuredClone(exact);
  const end = exact.adventure.active.endsAt;
  advanceGame(exact, end);
  advanceGame(exact, end + 60_000);
  advanceGame(late, end + 60_000);
  assert.deepEqual(exact, late);
});

test('escorts to every discovered region, including the six-hour return home, use the route clock', () => {
  for (const region of REGIONS) {
    const state = createGame(START);
    state.adventure.unlocked = REGIONS.map((entry) => entry.id);
    state.location = region.id === 'homeland' ? 'spring' : 'homeland';
    emptyMaterials(state);
    depart(state, choice({ kind: 'caravan', region: region.id }));
    const end = START + ADVENTURE_HOURS[region.id] * 3_600_000;
    assert.equal(state.adventure.active.endsAt, end);
    assert.equal(validateGame(state), true);
    advanceGame(state, end);
    assert.equal(state.location, region.id);
    assert.equal(state.firstWatch.milestones.escort, end);
    assert.equal(state.adventure.history[0].xp, ADVENTURE_HOURS[region.id] * 30);
    assert.equal(validateGame(state), true);
  }
});

test('legacy missing, version-one and version-two promises survive reload alongside new hour-long records', () => {
  for (const marker of [undefined, 1, 2]) {
    for (const kind of ['expedition', 'caravan']) {
      for (const plan of [undefined, ...ADVENTURE_PLANS]) {
        const state = createGame(START);
        if (kind === 'caravan') state.adventure.unlocked.push('spring');
        const selection = choice({ kind });
        if (plan === undefined) delete selection.plan;
        else selection.plan = plan;
        const promised = legacyDeparture(state, selection, marker);
        emptyMaterials(state);
        const snapshot = structuredClone(state);
        assert.equal(validateGame(state), true);
        assert.deepEqual(outingQuote(state, state.adventure.active), promised);
        const restored = migrateGame(JSON.parse(JSON.stringify(state)));
        assert.deepEqual(restored, snapshot);
        const end = restored.adventure.active.endsAt;
        resumeGame(restored, end);
        const receipt = structuredClone(restored.adventure.history[0]);
        assert.equal(receipt.endsAt - receipt.startedAt, promised.seconds * 1000);
        assert.deepEqual(receipt.reward, { water: 0, feed: 0, ...promised.reward });
        assert.equal(receipt.xp, promised.xp);
        assert.equal(receipt.economyVersion, marker);
        assert.equal(Object.hasOwn(receipt, 'economyVersion'), marker !== undefined);
        assert.equal(validateGame(restored), true);
        depart(restored);
        advanceGame(restored, restored.adventure.active.endsAt);
        assert.equal(restored.adventure.history[0].economyVersion, 3);
        assert.deepEqual(restored.adventure.history[1], receipt);
        assert.equal(validateGame(restored), true);
      }
    }
  }
});

test('legacy scouting still shortens old promises and changing equipment after a new return keeps history valid', () => {
  const state = createGame(START);
  state.inventory.scout_charm = 1;
  act(state, { type: 'equip', id: 'wolf-scout', item: 'scout_charm' });
  const selection = choice();
  assert.equal(adventureQuote(state, selection, { economyVersion: 1 }).seconds, 51);
  assert.equal(adventureQuote(state, selection, { economyVersion: 2 }).seconds, 51);
  const quoted = adventureQuote(state, selection);
  depart(state);
  assert.deepEqual(state.resources.water, 180 - quoted.cost.water);
  assert.throws(() => act(state, { type: 'unequip', id: 'wolf-scout' }), { code: 'WOLF_BUSY' });
  advanceGame(state, state.adventure.active.endsAt);
  const receipt = structuredClone(state.adventure.history[0]);
  act(state, { type: 'unequip', id: 'wolf-scout' });
  assert.deepEqual(state.adventure.history[0], receipt);
  assert.equal(validateGame(state), true);
  act(state, { type: 'equip', id: 'wolf-scout', item: 'leather_vest' });
  assert.equal(validateGame(state), true);
  assert.deepEqual(state.adventure.history[0], receipt);
});

test('new receipts record actual fractional/capped materials and respect the existing level-twenty limit', () => {
  const state = createGame(START);
  state.adventure.unlocked = REGIONS.map((region) => region.id);
  state.inventory.healer_satchel = 10_000;
  state.resources.wood = state.capacity - 0.25;
  state.resources.stone = state.capacity;
  state.resources.herbs = state.capacity;
  const selected = state.wolves.slice(0, 3);
  for (const wolf of selected) {
    wolf.level = 20;
    wolf.xp = 890;
  }
  depart(
    state,
    choice({
      region: 'ruins',
      difficulty: 'hard',
      plan: 'supply',
      wolfIds: selected.map((w) => w.id),
    }),
  );
  const end = state.adventure.active.endsAt;
  advanceGame(state, end);
  const receipt = state.adventure.history[0];
  assert.equal(receipt.xp, 540);
  assert.deepEqual(receipt.reward, { water: 0, feed: 0, wood: 0.25, stone: 0, herbs: 0 });
  assert.equal(receipt.itemCount, 0);
  assert.equal(state.inventory.healer_satchel, 10_000);
  for (const wolf of selected) {
    assert.equal(wolf.level, 20);
    assert.equal(wolf.xp, 899);
  }
  assert.equal(validateGame(state), true);
});

test('strict validation rejects forged short/long version-three clocks and unknown economy markers', () => {
  const state = createGame(START);
  depart(state);
  for (const seconds of [60, 21_599, 21_601, 43_200]) {
    const forged = structuredClone(state);
    forged.adventure.active.endsAt = START + seconds * 1000;
    assert.equal(validateGame(forged), false);
    assert.throws(() => migrateGame(forged), { code: 'INVALID_SAVE' });
  }
  for (const marker of [0, 4, null, undefined, '3', false, {}]) {
    const forged = structuredClone(state);
    forged.adventure.active.economyVersion = marker;
    assert.equal(validateGame(forged), false);
  }
  advanceGame(state, state.adventure.active.endsAt);
  const forged = structuredClone(state);
  forged.adventure.history[0].endsAt -= 1000;
  forged.adventure.history[0].completedAt -= 1000;
  assert.equal(validateGame(forged), false);
  const overpaid = structuredClone(state);
  overpaid.adventure.history[0].xp += 1;
  assert.equal(validateGame(overpaid), false);
});
