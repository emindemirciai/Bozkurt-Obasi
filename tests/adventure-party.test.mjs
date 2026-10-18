import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, advanceGame, validateGame } from '../shared/game.mjs';
import { ADVENTURE_PLANS, DIFFICULTIES, REGIONS } from '../shared/adventures.mjs';
import { adventurePartySuggestions, adventurePartyForecast } from '../web/adventure-party.mjs';

const NOW = Date.UTC(2026, 9, 19, 12);
const choice = (extra = {}) => ({
  kind: 'expedition',
  region: 'spring',
  difficulty: 'easy',
  plan: 'standard',
  wolfIds: ['wolf-alpha'],
  ...extra,
});
const byStrategy = (suggestions, id) => suggestions.find((entry) => entry.id === id);
const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

test('suggestions and forecasts are repeatable and do not mutate frozen game or selection', () => {
  const state = deepFreeze(createGame(NOW));
  const selection = deepFreeze(choice());
  const before = JSON.stringify({ state, selection });
  assert.deepEqual(
    adventurePartySuggestions(state, selection),
    adventurePartySuggestions(state, selection),
  );
  assert.deepEqual(
    adventurePartyForecast(state, selection),
    adventurePartyForecast(state, selection),
  );
  assert.equal(JSON.stringify({ state, selection }), before);
  assert.deepEqual(
    adventurePartySuggestions(state, selection).map((entry) => entry.id),
    ['scouting', 'resilience', 'training'],
  );
});

test('scouting chooses equipped guardians and quotes the actual recommended party duration', () => {
  const state = createGame(NOW);
  state.wolves[3].equipment = 'scout_charm';
  state.wolves[3].hp = 20;
  const best = byStrategy(adventurePartySuggestions(state, choice()), 'scouting');
  assert.deepEqual(best.wolfIds, ['wolf-scout']);
  assert.equal(best.scouting, 15);
  assert.equal(best.quote.seconds, 51);
  assert.equal(best.ready, true);
  state.wolves[0].equipment = 'scout_charm';
  state.wolves[1].equipment = 'scout_charm';
  const hard = byStrategy(
    adventurePartySuggestions(state, choice({ difficulty: 'hard' })),
    'scouting',
  );
  assert.equal(hard.scouting, 45);
  assert.equal(hard.quote.seconds, 126, 'equipment reduction retains the authoritative 30% cap');
});

test('resilience ranks post-fatigue reserve and scouting ties use health fraction then state order', () => {
  const state = createGame(NOW);
  state.wolves[0].hp = 100;
  state.wolves[1].hp = 110;
  state.wolves[2].hp = 110;
  state.wolves[3].hp = 99;
  state.wolves[4].hp = 99;
  const suggestions = adventurePartySuggestions(
    state,
    choice({ wolfIds: ['wolf-alpha', 'wolf-guardian'] }),
  );
  assert.deepEqual(byStrategy(suggestions, 'resilience').wolfIds, ['wolf-hunter', 'wolf-guardian']);
  assert.deepEqual(byStrategy(suggestions, 'scouting').wolfIds, ['wolf-healer', 'wolf-hunter']);
  state.wolves.forEach((wolf) => {
    wolf.hp = wolf.maxHp;
  });
  assert.deepEqual(byStrategy(adventurePartySuggestions(state, choice()), 'scouting').wolfIds, [
    'wolf-alpha',
  ]);
});

test('training favors the nearest next level and leaves capped wolves as party fallback', () => {
  const state = createGame(NOW);
  state.wolves[0].level = 20;
  state.wolves[0].xp = 898;
  state.wolves[1].xp = 40;
  state.wolves[2].xp = 43;
  state.wolves[3].level = 2;
  state.wolves[3].xp = 89;
  state.wolves[4].xp = 0;
  const train = byStrategy(
    adventurePartySuggestions(state, choice({ difficulty: 'hard' })),
    'training',
  );
  assert.deepEqual(train.wolfIds, ['wolf-scout', 'wolf-hunter', 'wolf-guardian']);
  const all = byStrategy(
    adventurePartySuggestions(state, choice({ wolfIds: state.wolves.map((wolf) => wolf.id) })),
    'training',
  );
  assert.equal(all.wolfIds.at(-1), 'wolf-alpha');
  assert.equal(all.ready, true);
  for (const wolf of state.wolves) {
    wolf.level = 20;
    wolf.xp = 899;
  }
  assert.deepEqual(byStrategy(adventurePartySuggestions(state, choice()), 'training').wolfIds, [
    'wolf-alpha',
  ]);
});

test('suggestions satisfy difficulty minimum and preserve a larger manually chosen party size', () => {
  const state = createGame(NOW);
  for (const [difficulty, count] of [
    ['easy', 1],
    ['normal', 2],
    ['hard', 3],
  ]) {
    for (const suggestion of adventurePartySuggestions(
      state,
      choice({ difficulty, wolfIds: [] }),
    )) {
      assert.equal(suggestion.proposedCount, count);
      assert.equal(suggestion.wolfIds.length, count);
      assert.equal(suggestion.ready, true);
    }
  }
  for (const suggestion of adventurePartySuggestions(
    state,
    choice({ wolfIds: state.wolves.map((wolf) => wolf.id) }),
  )) {
    assert.equal(suggestion.proposedCount, 5);
    assert.equal(suggestion.wolfIds.length, 5);
    assert.equal(suggestion.sameAsSelection, true, 'party order is not a roster change');
  }
  assert.equal(
    adventurePartySuggestions(state, choice({ wolfIds: ['wolf-alpha', 'wolf-alpha'] }))[0]
      .proposedCount,
    1,
  );
});

test('wounded guardians are excluded at the health boundary and a shortage cannot apply a partial party', () => {
  const state = createGame(NOW);
  state.wolves[0].hp = 20;
  for (const wolf of state.wolves.slice(1)) wolf.hp = 19;
  for (const suggestion of adventurePartySuggestions(state, choice({ difficulty: 'hard' }))) {
    assert.deepEqual(suggestion.wolfIds, ['wolf-alpha']);
    assert.equal(suggestion.proposedCount, 3);
    assert.equal(suggestion.eligibleCount, 1);
    assert.equal(suggestion.missingCount, 2);
    assert.equal(suggestion.ready, false);
    assert.equal(suggestion.reason, 'party');
  }
  state.wolves[0].hp = 19;
  for (const suggestion of adventurePartySuggestions(state, choice())) {
    assert.deepEqual(suggestion.wolfIds, []);
    assert.equal(suggestion.ready, false);
    assert.equal(suggestion.missingCount, 1);
  }
});

test('battle and both journey formats lock roster application while busy guardians stay excluded', () => {
  for (const activity of ['battle', 'adventure', 'legacy']) {
    const state = createGame(NOW);
    if (activity === 'battle') applyAction(state, { type: 'startBattle' }, NOW);
    if (activity === 'adventure') applyAction(state, { type: 'expedition', ...choice() }, NOW);
    if (activity === 'legacy') state.journey = { destination: 'spring', endsAt: NOW + 60000 };
    for (const suggestion of adventurePartySuggestions(state, choice())) {
      assert.equal(suggestion.locked, true);
      assert.equal(suggestion.ready, false);
      assert.equal(suggestion.reason, activity === 'battle' ? 'battle' : 'journey');
      if (activity === 'adventure') assert.equal(suggestion.wolfIds.includes('wolf-alpha'), false);
    }
    assert.equal(adventurePartyForecast(state, choice()).locked, true);
  }
});

test('recommendation readiness describes party availability independently from departure route and supplies', () => {
  const state = createGame(NOW);
  state.resources.water = 0;
  state.resources.feed = 0;
  for (const suggestion of adventurePartySuggestions(state, choice({ region: 'ruins' }))) {
    assert.equal(suggestion.ready, true);
    assert.equal(suggestion.reason, null);
  }
});

test('forecast handles invalid and duplicated selections explicitly without forecasting a wolf twice', () => {
  const state = createGame(NOW);
  state.wolves[1].hp = 19;
  const forecast = adventurePartyForecast(
    state,
    choice({
      wolfIds: ['missing', 'wolf-guardian', 'wolf-alpha', 'missing', 'wolf-alpha'],
    }),
  );
  assert.deepEqual(forecast.invalidIds, ['missing']);
  assert.deepEqual(forecast.duplicateIds, ['missing', 'wolf-alpha']);
  assert.deepEqual(
    forecast.wolves.map((wolf) => wolf.id),
    ['wolf-guardian', 'wolf-alpha'],
  );
  assert.equal(forecast.wolves[0].eligible, false);
  assert.equal(forecast.wolves[1].eligible, true);
  assert.deepEqual(adventurePartyForecast(state, choice({ wolfIds: [] })).wolves, []);
});

test('arrival forecast matches actual authoritative missions for every plan, difficulty and mission kind', () => {
  for (const plan of ADVENTURE_PLANS)
    for (const difficulty of DIFFICULTIES)
      for (const kind of ['expedition', 'caravan']) {
        const state = createGame(NOW);
        state.adventure.unlocked = REGIONS.map((region) => region.id);
        state.wolves[0].xp = 44;
        state.wolves[0].hp = 20;
        state.wolves[1].level = 19;
        state.wolves[1].xp = 850;
        state.wolves[1].hp = 32;
        state.wolves[2].level = 20;
        state.wolves[2].xp = 895;
        state.wolves[2].hp = 20;
        const selection = choice({
          plan,
          difficulty,
          kind,
          region: 'ruins',
          wolfIds: ['wolf-alpha', 'wolf-guardian', 'wolf-hunter'],
        });
        const before = structuredClone(state);
        const forecast = adventurePartyForecast(state, selection);
        assert.deepEqual(state, before);
        applyAction(state, { type: kind, ...selection }, NOW);
        advanceGame(state, state.adventure.active.endsAt);
        assert.equal(validateGame(state), true, JSON.stringify({ plan, difficulty, kind }));
        for (const prediction of forecast.wolves) {
          const actual = state.wolves.find((wolf) => wolf.id === prediction.id);
          for (const key of ['hp', 'maxHp', 'level', 'xp', 'points'])
            assert.equal(
              prediction[key],
              actual[key],
              `${plan}/${difficulty}/${kind}/${prediction.id}/${key}`,
            );
        }
        assert.deepEqual(
          state.wolves.slice(3),
          before.wolves.slice(3),
          'unselected guardians receive no fatigue, XP or healing',
        );
      }
});

test('forecast applies fatigue first, then multi-level healing and training points', () => {
  const state = createGame(NOW);
  state.wolves[0].hp = 20;
  state.wolves[0].xp = 44;
  const prediction = adventurePartyForecast(
    state,
    choice({
      plan: 'survey',
      difficulty: 'hard',
      region: 'ruins',
    }),
  ).wolves[0];
  assert.equal(prediction.postFatigueHp, 1);
  assert.equal(prediction.levelsGained, 3);
  assert.equal(prediction.level, 4);
  assert.equal(prediction.hp, 55);
  assert.equal(prediction.maxHp, 158);
  assert.equal(prediction.points, 5);
  assert.equal(prediction.xpGained, 270);
  assert.equal(prediction.nominalXp, 270);
});

test('forecast distinguishes nominal XP from accepted XP at the level 20 cap', () => {
  const state = createGame(NOW);
  state.wolves[0].level = 20;
  state.wolves[0].xp = 898;
  let prediction = adventurePartyForecast(state, choice()).wolves[0];
  assert.equal(prediction.levelsGained, 0);
  assert.equal(prediction.xpGained, 1);
  assert.equal(prediction.nominalXp, 30);
  assert.equal(prediction.xp, 899);
  state.wolves[0].xp = 899;
  prediction = adventurePartyForecast(state, choice()).wolves[0];
  assert.equal(prediction.xpGained, 0);
  assert.equal(prediction.nominalXp, 30);
});
