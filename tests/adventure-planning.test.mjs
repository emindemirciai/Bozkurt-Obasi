import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction } from '../shared/game.mjs';
import { adventureReadiness } from '../web/adventure-planning.mjs';

const NOW = Date.UTC(2026, 9, 15, 12);
const selection = (overrides = {}) => ({
  kind: 'expedition',
  region: 'spring',
  difficulty: 'easy',
  wolfIds: ['wolf-alpha'],
  ...overrides,
});

test('adventure preparation agrees with authoritative departure decisions', () => {
  const cases = [
    ['fresh expedition', () => {}, selection(), true],
    ['missing guardians', () => {}, selection({ wolfIds: [] }), false],
    ['hard minimum party', () => {}, selection({ difficulty: 'hard' }), false],
    [
      'hard prepared party',
      () => {},
      selection({ difficulty: 'hard', wolfIds: ['wolf-alpha', 'wolf-scout', 'wolf-healer'] }),
      true,
    ],
    [
      'wounded wolf',
      (s) => {
        s.wolves[0].hp = 19;
      },
      selection(),
      false,
    ],
    [
      'health boundary',
      (s) => {
        s.wolves[0].hp = 20;
      },
      selection(),
      true,
    ],
    [
      'water shortage',
      (s) => {
        s.resources.water = 17.9;
      },
      selection(),
      false,
    ],
    [
      'exact supplies',
      (s) => {
        s.resources.water = 18;
        s.resources.feed = 23;
      },
      selection(),
      true,
    ],
    ['unknown route', () => {}, selection({ region: 'ruins' }), false],
    ['locked escort', () => {}, selection({ kind: 'caravan' }), false],
    ['already there', () => {}, selection({ kind: 'caravan', region: 'homeland' }), false],
    [
      'escort',
      (s) => {
        s.adventure.unlocked.push('spring');
      },
      selection({ kind: 'caravan' }),
      true,
    ],
    [
      'exhausted herd',
      (s) => {
        s.adventure.unlocked.push('spring');
        s.herd.hp = 59;
      },
      selection({ kind: 'caravan' }),
      false,
    ],
    [
      'herd health boundary',
      (s) => {
        s.adventure.unlocked.push('spring');
        s.herd.hp = 60;
      },
      selection({ kind: 'caravan' }),
      true,
    ],
    ['battle in progress', (s) => applyAction(s, { type: 'startBattle' }, NOW), selection(), false],
    [
      'journey in progress',
      (s) => applyAction(s, { type: 'expedition', ...selection() }, NOW),
      selection(),
      false,
    ],
    ['duplicated guardian', () => {}, selection({ wolfIds: ['wolf-alpha', 'wolf-alpha'] }), false],
    ['unknown guardian', () => {}, selection({ wolfIds: ['wolf-missing'] }), false],
  ];
  for (const [name, setup, choice, expected] of cases) {
    const state = createGame(NOW);
    setup(state);
    const before = structuredClone(state);
    const plan = adventureReadiness(state, choice);
    assert.equal(plan.ready, expected, name);
    assert.deepEqual(state, before, `${name}: planning must not mutate saved state`);
    const action = { type: choice.kind, ...choice };
    if (expected) assert.doesNotThrow(() => applyAction(state, action, NOW), name);
    else assert.throws(() => applyAction(state, action, NOW), undefined, name);
  }
});

test('readiness explains the actual route and multiple shortages without blocking capped rewards', () => {
  const state = createGame(NOW);
  state.resources.water = 16.5;
  state.resources.feed = 20;
  state.resources.wood = 499;
  state.resources.stone = 500;
  state.inventory.leather_vest = 10000;
  const plan = adventureReadiness(state, selection());
  assert.deepEqual(plan.shortages, [
    { resource: 'water', amount: 2 },
    { resource: 'feed', amount: 3 },
  ]);
  assert.deepEqual(plan.overflow, [
    { resource: 'wood', amount: 95 },
    { resource: 'stone', amount: 60 },
  ]);
  assert.equal(plan.itemFull, true);
  assert.equal(plan.fatigue, 5);
  state.resources.water = 180;
  state.resources.feed = 180;
  assert.equal(adventureReadiness(state, selection()).ready, true);
  const locked = adventureReadiness(state, selection({ region: 'ruins' })).checks.find(
    (c) => c.id === 'route',
  );
  assert.deepEqual(locked, {
    id: 'route',
    ok: false,
    key: 'routeLockedCheck',
    values: { region: 'highland' },
  });
  const current = adventureReadiness(
    state,
    selection({ kind: 'caravan', region: 'homeland' }),
  ).checks.find((c) => c.id === 'route');
  assert.equal(current.key, 'routeElsewhereCheck');
});

test('scout equipment and difficulty use the server quote, even with a legacy journey pending', () => {
  const state = createGame(NOW);
  state.inventory.scout_charm = 1;
  applyAction(state, { type: 'equip', id: 'wolf-alpha', item: 'scout_charm' }, NOW);
  const plan = adventureReadiness(
    state,
    selection({ difficulty: 'hard', wolfIds: ['wolf-alpha', 'wolf-scout', 'wolf-healer'] }),
  );
  assert.equal(plan.quote.seconds, 21600);
  assert.deepEqual(plan.quote.cost, { water: 24, feed: 32 });
  assert.equal(plan.fatigue, 15);
  assert.equal(plan.ready, true);
  state.journey = { destination: 'spring', startedAt: NOW, endsAt: NOW + 60000 };
  const legacy = adventureReadiness(state, selection());
  assert.equal(legacy.ready, false);
  assert.equal(legacy.checks.find((c) => c.id === 'journey').ok, false);
});
