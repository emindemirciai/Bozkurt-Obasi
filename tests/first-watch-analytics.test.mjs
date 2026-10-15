import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FIRST_WATCH_STEPS as ENGINE_STEPS } from '../shared/first-watch.mjs';
import {
  FIRST_WATCH_STEPS,
  normalizeProgressionPayload,
  mergeAnalyzeEvent,
  buildProgressionFunnel,
  readTrackPayload,
  MAX_TRACK_BYTES,
} from '../services/analyze/src/lib/progression.mjs';

const now = '2026-10-15T12:00:00.000Z';
function payload(overrides = {}) {
  return {
    id: 'progression-' + randomUUID(),
    eventType: 'progression',
    site: 'bozkurtobasi.com',
    visitorId: 'visitor-' + randomUUID(),
    sessionId: 'session-' + randomUUID(),
    createdAt: now,
    progression: {
      chapter: 'first-watch',
      cohort: 'new',
      completed: [],
      claimed: [],
      firstWin: false,
    },
    ...overrides,
  };
}
const normalize = (input) => normalizeProgressionPayload(input, ['bozkurtobasi.com'], now);

test('progression accepts only closed anonymous identity and milestone fields', () => {
  assert.deepEqual(
    FIRST_WATCH_STEPS,
    ENGINE_STEPS.map((step) => step.id),
  );
  const valid = payload();
  assert.equal(normalize(valid).eventType, 'progression');
  for (const extra of [{ email: 'private@example.test' }, { resources: {} }, { path: '/profile' }])
    assert.throws(() => normalize({ ...valid, ...extra }));
  for (const patch of [
    { chapter: 'anything' },
    { cohort: 'invented' },
    { completed: ['custom'] },
    { completed: ['gather', 'gather'] },
    { claimed: ['build'], completed: ['build'] },
    { claimed: ['gather'] },
    { firstWin: 1 },
    { firstWin: true },
    { completed: ['recover'] },
    { accountId: 'private' },
  ])
    assert.throws(() => normalize({ ...valid, progression: { ...valid.progression, ...patch } }));
  for (const patch of [
    { site: 'another.example' },
    { visitorId: 'an-email@example.test' },
    { id: 'bad' },
    { createdAt: 'tomorrow' },
    { createdAt: '2099-01-01T00:00:00Z' },
  ])
    assert.throws(() => normalize({ ...valid, ...patch }));
});

test('collection body is bounded even without Content-Length and unknown event types are rejected', async () => {
  const request = (body) => new Request('https://example.test/api/track', { method: 'POST', body });
  assert.equal(
    (await readTrackPayload(request(JSON.stringify(payload())))).eventType,
    'progression',
  );
  for (const body of ['null', '[]', '{"eventType":"email"}', 'x'.repeat(MAX_TRACK_BYTES + 1)])
    await assert.rejects(() => readTrackPayload(request(body)));
  await assert.rejects(() =>
    readTrackPayload(
      new Request('https://example.test', {
        method: 'POST',
        body: '{}',
        headers: { 'content-length': String(MAX_TRACK_BYTES + 1) },
      }),
    ),
  );
});

test('retries cannot erase progress, move the cohort window, or overwrite another identity', () => {
  const input = payload();
  const original = normalize(input);
  const advanced = normalize({
    ...input,
    progression: {
      chapter: 'first-watch',
      cohort: 'new',
      completed: ['gather', 'build', 'train', 'battle'],
      claimed: ['gather', 'build'],
      firstWin: true,
    },
  });
  const merged = mergeAnalyzeEvent(original, advanced, now);
  const stale = mergeAnalyzeEvent(merged, original, now);
  assert.deepEqual(stale.progression, advanced.progression);
  assert.equal(stale.createdAt, original.createdAt);
  for (const patch of [
    { visitorId: 'visitor-' + randomUUID() },
    { site: 'another.example' },
    { eventType: 'pageview' },
    { progression: { ...advanced.progression, cohort: 'returning' } },
  ])
    assert.throws(
      () => mergeAnalyzeEvent(original, { ...advanced, ...patch }),
      /AnalyzeIdentityConflict/,
    );
});

test('funnel isolates sites, chapter-start windows, and returning cohorts without double counting', () => {
  const first = normalize(payload());
  const advanced = {
    ...first,
    progression: {
      ...first.progression,
      completed: ['gather', 'build', 'battle', 'explore'],
      claimed: ['gather', 'build'],
      firstWin: true,
    },
  };
  const finished = normalize(
    payload({
      progression: {
        chapter: 'first-watch',
        cohort: 'new',
        completed: FIRST_WATCH_STEPS,
        claimed: FIRST_WATCH_STEPS,
        firstWin: true,
      },
    }),
  );
  const returning = {
    ...finished,
    id: 'progression-' + randomUUID(),
    progression: { ...finished.progression, cohort: 'returning' },
  };
  const events = [
    first,
    advanced,
    advanced,
    finished,
    returning,
    { ...finished, id: 'progression-' + randomUUID(), site: 'another.example' },
    { ...finished, id: 'progression-' + randomUUID(), createdAt: '2026-10-01T12:00:00Z' },
    { ...finished, id: 'progression-' + randomUUID(), eventType: 'pageview' },
  ];
  const options = {
    sites: ['bozkurtobasi.com'],
    start: Date.parse(now) - 3600_000,
    end: Date.parse(now),
    cohort: 'new',
  };
  const result = buildProgressionFunnel(events, options);
  assert.equal(result.started, 2);
  assert.equal(result.finished, 1);
  assert.equal(result.firstBuild, 2);
  assert.equal(result.firstBattle, 2);
  assert.equal(result.firstVictory, 2);
  assert.equal(result.firstExpedition, 2);
  assert.deepEqual(
    result.steps.find((step) => step.id === 'train'),
    { id: 'train', completed: 1, claimed: 1, percent: 50, current: 1 },
  );
  assert.equal(buildProgressionFunnel(events, { ...options, cohort: 'returning' }).started, 1);
  assert.equal(buildProgressionFunnel(events, { ...options, sites: ['empty.example'] }).started, 0);
});

test('queued file-store upserts keep one monotonic snapshot and reject identity replacement', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bozkurt-progression-store-'));
  const previous = process.env.ANALYZE_DATA_DIR;
  process.env.ANALYZE_DATA_DIR = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.ANALYZE_DATA_DIR;
    else process.env.ANALYZE_DATA_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  });
  const store = await import('../services/analyze/src/lib/analyzeStore.ts?first-watch-test');
  const first = normalize(payload());
  const next = {
    ...first,
    progression: { ...first.progression, completed: ['gather', 'build'], claimed: ['gather'] },
  };
  await Promise.all([
    store.saveAnalyzeEvent(first),
    store.saveAnalyzeEvent(next),
    store.saveAnalyzeEvent(first),
  ]);
  const rows = await store.readAnalyzeEvents();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].progression, next.progression);
  await assert.rejects(
    () => store.saveAnalyzeEvent({ ...next, visitorId: 'visitor-' + randomUUID() }),
    /AnalyzeIdentityConflict/,
  );
  assert.deepEqual((await store.readAnalyzeEvents())[0].progression, next.progression);
});
