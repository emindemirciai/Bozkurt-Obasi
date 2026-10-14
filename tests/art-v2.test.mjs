import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction } from '../shared/game.mjs';
import { scene, miniBuilding, wolfArt } from '../web/art.mjs';

const t = (key) => key;

test('village rendering follows saved plot coordinates for duplicate producers and relocation', () => {
  const state = createGame(1_000);
  assert.equal((scene(state, { t }).match(/data-plot=/g) || []).length, 36);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p0' }, 1_000);
  applyAction(state, { type: 'build', building: 'quarry', plotId: 'p5' }, 1_000);
  let artwork = scene(state, { t });
  assert.equal((artwork.match(/data-plot=/g) || []).length, 34);
  assert.match(artwork, /data-building="building-quarry"[^>]*transform="translate\(720 240\)"/);
  assert.match(artwork, /data-building="building-quarry-2"[^>]*transform="translate\(1210 525\)"/);
  applyAction(state, { type: 'moveBuilding', id: 'building-quarry', plotId: 'p35' }, 1_000);
  artwork = scene(state, { t });
  assert.match(artwork, /data-plot="p0"/);
  assert.doesNotMatch(artwork, /data-plot="p35"/);
  assert.match(artwork, /data-building="building-quarry"[^>]*transform="translate\(720 810\)"/);
  assert.match(artwork, /village-terrain\.webp/);
  assert.doesNotMatch(artwork, /battlefield\.webp/);
});

test('building visuals change at levels three and five while intermediate levels keep their tier', () => {
  for (const type of ['hall', 'quarry', 'well', 'watchtower']) {
    assert.equal(miniBuilding(type, 1), miniBuilding(type, 2));
    assert.equal(miniBuilding(type, 3), miniBuilding(type, 4));
    assert.notEqual(miniBuilding(type, 1), miniBuilding(type, 3));
    assert.notEqual(miniBuilding(type, 3), miniBuilding(type, 5));
    assert.match(miniBuilding(type, 5), /building-tiers\.webp/);
  }
  // The mail-art generator imports this module in Node, without browser globals.
  assert.match(wolfArt(), /<g transform=/);
});

test('battle scene exposes story phases and preserves animal identities, facing and health bars', () => {
  const state = createGame(1_000);
  const preparing = scene(state, { battle: true, t });
  assert.match(preparing, /data-phase="preparing"/);
  assert.match(preparing, /data-tactic=""/);
  state.battle.status = 'active';
  state.battle.startedAt = 1_000;
  state.battle.tactic = 'double';
  for (const [tick, phase] of [
    [0, 'march'],
    [2, 'march'],
    [3, 'ambush'],
    [4, 'ambush'],
    [5, 'forming'],
    [6, 'forming'],
    [7, 'clash'],
  ]) {
    state.battle.tick = tick;
    const artwork = scene(state, { battle: true, t });
    assert.match(artwork, new RegExp(`data-phase="${phase}"`));
    assert.match(artwork, /data-tactic="double"/);
    assert.match(artwork, /data-started-at="1000"/);
    assert.equal(
      (artwork.match(/class="battle-deployment"/g) || []).length,
      state.wolves.length + state.herd.count,
    );
    assert.equal((artwork.match(/data-wolf=/g) || []).length, 5);
    assert.equal((artwork.match(/data-enemy-id=/g) || []).length, state.battle.enemies.length);
    assert.equal((artwork.match(/data-hp-bar/g) || []).length, 5 + state.battle.enemies.length);
    assert.equal(
      (artwork.match(/data-facing="-1"/g) || []).length,
      state.wolves.length + state.herd.count,
    );
    assert.equal((artwork.match(/data-facing="1"/g) || []).length, state.battle.enemies.length);
    assert.match(artwork, /class="formation-guide"/);
    assert.match(artwork, /class="battlefield-terrain"[^>]*battlefield\.webp/);
    assert.doesNotMatch(artwork, /village-terrain\.webp|data-building=|data-plot=/);
  }
});
