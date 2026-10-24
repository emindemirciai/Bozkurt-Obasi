import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, advanceGame, MAX_OFFLINE_MS } from '../shared/game.mjs';
import { productionForecast } from '../web/planning.mjs';
import { fillResources } from './economy-fixtures.mjs';

const NOW = Date.UTC(2026, 9, 24, 12);
function producers() {
  const state = createGame(NOW);
  applyAction(state, { type: 'build', building: 'lumber', plotId: 'p0' }, NOW);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p1' }, NOW);
  return state;
}
const resource = (forecast, key) => forecast.resources.find((entry) => entry.key === key);

test('a 24-hour absence estimates only the same eight production hours as the authoritative engine', () => {
  const state = producers();
  const before = structuredClone(state);
  const eight = productionForecast(state, 8);
  const day = productionForecast(state, 24);
  assert.equal(MAX_OFFLINE_MS, 28_800_000);
  assert.equal(day.requestedSeconds, 86_400);
  assert.equal(day.creditedSeconds, 28_800);
  assert.equal(day.capped, true);
  assert.equal(eight.capped, false);
  assert.deepEqual(day.resources, eight.resources);
  assert.equal(resource(day, 'wood').credited, 288);
  assert.equal(resource(day, 'stone').credited, 216);
  const actual = structuredClone(state);
  advanceGame(actual, NOW + 86_400_000);
  for (const row of day.resources) assert.equal(row.projected, actual.resources[row.key]);
  assert.deepEqual(state, before);
});

test('a smaller horizon scales income and distinguishes produced, storable and overflow materials', () => {
  const state = producers();
  state.resources.wood = 999.875;
  const forecast = productionForecast(state, 1);
  assert.deepEqual(resource(forecast, 'wood'), {
    key: 'wood',
    rate: 0.6,
    amount: 999.875,
    capacity: 1000,
    produced: 36,
    credited: 0.125,
    overflow: 35.875,
    projected: 1000,
  });
  assert.equal(resource(forecast, 'stone').credited, 27);
  assert.equal(forecast.creditedSeconds, 3600);
});

test('full stores and absent producers never promise materials or mutate pending refunds', () => {
  const state = fillResources(producers());
  state.refundReserve.wood = 700;
  const before = structuredClone(state);
  const forecast = productionForecast(state, 12);
  for (const row of forecast.resources) {
    assert.equal(row.credited, 0);
    assert.equal(row.projected, 1000);
  }
  assert.equal(resource(forecast, 'herbs').produced, 0);
  assert.equal(resource(forecast, 'wood').overflow, 288);
  assert.deepEqual(state, before);
});

test('regional production bonuses use current rates without completing or rewarding a journey', () => {
  const state = producers();
  state.location = 'highland';
  const forecast = productionForecast(state, 4);
  assert.equal(resource(forecast, 'stone').rate, 0.675);
  assert.equal(resource(forecast, 'stone').credited, 162);
  const before = structuredClone(state);
  state.adventure.active = { endsAt: NOW + 1000 };
  const estimate = productionForecast(state, 4);
  assert.deepEqual(estimate, forecast);
  assert.deepEqual(state.resources, before.resources);
  assert.deepEqual(state.adventure.active, { endsAt: NOW + 1000 });
});

test('invalid horizons cannot create unbounded, negative or non-finite income', () => {
  const state = producers();
  const expected = productionForecast(state, 8);
  for (const invalid of [0, -1, Infinity, NaN, '24', null, {}, 1000000])
    assert.deepEqual(productionForecast(state, invalid), expected);
});
