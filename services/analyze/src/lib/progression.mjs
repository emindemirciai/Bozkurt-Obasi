// A small, closed contract: no account fields, save snapshots or arbitrary event names.
export const FIRST_WATCH_STEPS = ['gather', 'build', 'train', 'battle', 'recover', 'explore', 'equip', 'escort'];
export const MAX_TRACK_BYTES = 8192;
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const identifier = (value, prefix) => typeof value === 'string' && new RegExp('^' + prefix + '-' + UUID + '$').test(value);
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const keysOnly = (value, keys) => plain(value) && Object.keys(value).every((key) => keys.includes(key));
const validSteps = (value) => Array.isArray(value) && value.length <= 8 &&
  new Set(value).size === value.length && value.every((step) => FIRST_WATCH_STEPS.includes(step));

export async function readTrackPayload(request) {
  if (Number(request.headers.get('content-length')) > MAX_TRACK_BYTES) throw new Error('Payload too large');
  if (!request.body) throw new Error('Missing payload');
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_TRACK_BYTES) { await reader.cancel(); throw new Error('Payload too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!plain(payload)) throw new Error('Invalid payload');
  if (payload.eventType !== undefined && !['pageview', 'duration', 'progression'].includes(payload.eventType))
    throw new Error('Unknown event type');
  return payload;
}

export function normalizeProgressionPayload(payload, allowedSites, now = new Date().toISOString()) {
  if (!keysOnly(payload, ['id', 'eventType', 'site', 'visitorId', 'sessionId', 'createdAt', 'progression']) ||
      payload.eventType !== 'progression' || !identifier(payload.id, 'progression') ||
      !identifier(payload.visitorId, 'visitor') || !identifier(payload.sessionId, 'session') ||
      !allowedSites.includes(payload.site) || typeof payload.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(payload.createdAt)) || Date.parse(payload.createdAt) < Date.UTC(2000, 0) ||
      Date.parse(payload.createdAt) > Date.parse(now) + 60_000) throw new Error('Invalid progression identity');
  const p = payload.progression;
  if (!keysOnly(p, ['chapter', 'cohort', 'completed', 'claimed', 'firstWin']) || p.chapter !== 'first-watch' ||
      !['new', 'returning'].includes(p.cohort) || !validSteps(p.completed) || !validSteps(p.claimed) ||
      typeof p.firstWin !== 'boolean' || (p.firstWin && !p.completed.includes('battle')) ||
      (p.completed.includes('recover') && !p.completed.includes('battle')) || p.claimed.some((step, index) => step !== FIRST_WATCH_STEPS[index] || !p.completed.includes(step)))
    throw new Error('Invalid progression snapshot');
  return {
    id: payload.id, eventType: /** @type {'progression'} */ ('progression'), site: payload.site, visitorId: payload.visitorId,
    sessionId: payload.sessionId, createdAt: new Date(payload.createdAt).toISOString(), updatedAt: now,
    progression: { chapter: p.chapter, cohort: p.cohort,
      completed: FIRST_WATCH_STEPS.filter((step) => p.completed.includes(step)), claimed: [...p.claimed], firstWin: p.firstWin },
    url: '', path: '', referrer: '', userAgent: '', browser: '', country: '',
  };
}

export function mergeAnalyzeEvent(existing, incoming, now = new Date().toISOString()) {
  if (!existing) return incoming;
  if (existing.site !== incoming.site || existing.visitorId !== incoming.visitorId || (existing.eventType === 'progression') !== (incoming.eventType === 'progression') ||
      (incoming.eventType === 'progression' && (existing.progression?.chapter !== incoming.progression.chapter ||
       existing.progression?.cohort !== incoming.progression.cohort))) throw new Error('AnalyzeIdentityConflict');
  const merged = { ...existing, ...incoming, createdAt: existing.createdAt, updatedAt: now };
  if (incoming.eventType === 'progression') {
    merged.progression = { ...existing.progression,
      completed: FIRST_WATCH_STEPS.filter((step) => existing.progression.completed.includes(step) || incoming.progression.completed.includes(step)),
      claimed: existing.progression.claimed.length > incoming.progression.claimed.length ? existing.progression.claimed : incoming.progression.claimed,
      firstWin: existing.progression.firstWin || incoming.progression.firstWin };
  } else merged.duration = Math.max(Number(existing.duration) || 0, Number(incoming.duration) || 0);
  return merged;
}

export function buildProgressionFunnel(events, { sites, start, end, cohort }) {
  const rows = new Map();
  for (const event of events) {
    if (event.eventType !== 'progression' || !sites.includes(event.site) || event.progression?.cohort !== cohort) continue;
    const date = Date.parse(event.createdAt);
    if (!Number.isFinite(date) || date < start || date > end) continue;
    try {
      const clean = normalizeProgressionPayload({ id: event.id, site: event.site, eventType: event.eventType,
        visitorId: event.visitorId, sessionId: event.sessionId, createdAt: event.createdAt,
        progression: event.progression }, sites, new Date(end).toISOString());
      rows.set(clean.id, mergeAnalyzeEvent(rows.get(clean.id), clean));
    } catch { /* Ignore corrupt historical rows, never invent a denominator. */ }
  }
  const snapshots = [...rows.values()].map((event) => event.progression);
  const started = snapshots.length;
  return { started, finished: snapshots.filter((p) => p.claimed.length === 8).length,
    firstBuild: snapshots.filter((p) => p.completed.includes('build')).length,
    firstBattle: snapshots.filter((p) => p.completed.includes('battle')).length,
    firstVictory: snapshots.filter((p) => p.firstWin).length,
    firstExpedition: snapshots.filter((p) => p.completed.includes('explore')).length,
    steps: FIRST_WATCH_STEPS.map((id, index) => {
      const completed = snapshots.filter((p) => p.completed.includes(id)).length;
      return { id, completed, claimed: snapshots.filter((p) => p.claimed.includes(id)).length,
        percent: started ? Math.round(completed / started * 100) : 0,
        current: snapshots.filter((p) => p.claimed.length === index).length };
    }) };
}
