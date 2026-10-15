// Analyze.Your.Site /api/track contract: cumulative updates reuse the pageview id.
// Only named game screens are sent; saves, session cookies and URL parameters are excluded.
const SCREENS = new Set(['home', 'village', 'battle', 'world', 'wolves', 'quests', 'updates']);

export function createAnalytics() {
  let config, active;
  let progressState,
    progressGeneration = 0;
  const progressPending = new Set();
  const progressRetryAfter = new Map();
  const progressRecords = new Map();
  const progressKey = 'bozkurt.analytics.first-watch';
  const steps = ['gather', 'build', 'train', 'battle', 'recover', 'explore', 'equip', 'escort'];
  // The UI chooses a screen after resolving authentication.
  let currentScreen;
  let visitorId, sessionId;
  let pending = Promise.resolve();
  const optedOut = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  const randomId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
  const storedId = (storage, key, prefix) => {
    try {
      const existing = storage.getItem(key);
      if (existing && /^[a-z]+-[a-f0-9-]{36}$/.test(existing)) return existing;
      const value = randomId(prefix);
      storage.setItem(key, value);
      return value;
    } catch {
      return randomId(prefix);
    }
  };
  const referrer = () => {
    try {
      return new URL(document.referrer).origin;
    } catch {
      return 'direct';
    }
  };
  function send(eventType) {
    if (!active || optedOut()) return;
    const visibleMs =
      active.visibleMs + (active.since === null ? 0 : performance.now() - active.since);
    const payload = {
      id: active.id,
      // Keep the merged row visible: this panel filters out rows typed "duration".
      eventType: 'pageview',
      site: config.site,
      createdAt: active.createdAt,
      visitorId,
      sessionId,
      path: `/${active.screen}`,
      url: `${location.origin}/${active.screen}`,
      referrer: referrer(),
      userAgent: navigator.userAgent,
      language: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      screen: `${window.screen.width}x${window.screen.height}`,
      duration: eventType === 'duration' ? Math.max(0, Math.floor(visibleMs / 1000)) : 0,
    };
    // Keep updates ordered because the panel upserts by id, rather than adding duration events.
    pending = pending
      .then(() =>
        fetch(config.endpoint, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
          signal: AbortSignal.timeout(4000),
        }),
      )
      .catch(() => {});
  }
  function view(screen) {
    if (!SCREENS.has(screen)) return;
    currentScreen = screen;
    if (!config || active?.screen === screen || optedOut()) return;
    send('duration');
    active = {
      id: randomId('pageview'),
      screen,
      createdAt: new Date().toISOString(),
      visibleMs: 0,
      since: document.hidden ? null : performance.now(),
    };
    send('pageview');
  }
  // Call only with a confirmed, authenticated server snapshot. State is never serialized.
  async function progress(state, accountKey = '') {
    progressState = { state, accountKey };
    if (!config || optedOut()) return;
    const chapter = state?.firstWatch;
    if (
      !chapter ||
      chapter.version !== 1 ||
      !['new', 'returning'].includes(chapter.cohort) ||
      !Number.isFinite(chapter.startedAt) ||
      chapter.startedAt < 0
    )
      return;
    const generation = progressGeneration;
    let key;
    try {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(String(accountKey) + ':' + chapter.startedAt),
      );
      key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      );
    } catch {
      return;
    }
    if (generation !== progressGeneration || optedOut()) return;
    let record = progressRecords.get(key);
    if (!record) {
      try {
        const saved = JSON.parse(localStorage.getItem(progressKey) || '{}');
        for (const [savedKey, value] of Object.entries(saved)) {
          if (
            value &&
            value.visitorId === visitorId &&
            /^progression-[a-f0-9-]{36}$/.test(value.id) &&
            Number.isFinite(Date.parse(value.createdAt))
          )
            progressRecords.set(savedKey, value);
        }
      } catch {
        /* Restricted or corrupt storage cannot block play. */
      }
      record = progressRecords.get(key);
      if (!record) {
        record = {
          id: randomId('progression'),
          visitorId,
          createdAt: new Date().toISOString(),
          signature: '',
        };
        progressRecords.set(key, record);
        persistProgressRecords();
      }
    }
    const completed = steps.filter((step) => Number.isFinite(chapter.milestones?.[step]));
    const claimed = steps.filter((step) => chapter.claims?.some((claim) => claim.id === step));
    const progression = {
      chapter: 'first-watch',
      cohort: chapter.cohort,
      completed,
      claimed,
      firstWin: Number.isFinite(chapter.firstWinAt),
    };
    const signature = JSON.stringify(progression);
    if (
      record.signature === signature ||
      progressPending.has(record.id) ||
      (progressRetryAfter.get(record.id) || 0) > Date.now()
    )
      return;
    const payload = {
      id: record.id,
      eventType: 'progression',
      site: config.site,
      visitorId,
      sessionId,
      createdAt: record.createdAt,
      progression,
    };
    progressPending.add(record.id);
    pending = pending
      .then(async () => {
        if (optedOut() || generation !== progressGeneration) return;
        const response = await fetch(config.endpoint, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
          signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) throw new Error('Optional progression collection unavailable');
        record.signature = signature;
        progressRetryAfter.delete(record.id);
        // Keep a bounded account-to-browser-event mapping locally; send no account identifier.
        persistProgressRecords();
      })
      .catch(() => {
        progressRetryAfter.set(record.id, Date.now() + 30_000);
      })
      .finally(() => {
        progressPending.delete(record.id);
        if (generation === progressGeneration && progressState)
          void progress(progressState.state, progressState.accountKey);
      });
  }
  function persistProgressRecords() {
    while (progressRecords.size > 16) progressRecords.delete(progressRecords.keys().next().value);
    try {
      localStorage.setItem(progressKey, JSON.stringify(Object.fromEntries(progressRecords)));
    } catch {
      /* In-memory dedup still works without persistent storage. */
    }
  }
  function reset() {
    progressState = undefined;
    progressGeneration += 1;
  }
  async function start() {
    if (location.protocol !== 'https:' || optedOut()) return;
    try {
      const response = await fetch('/api/config', {
        credentials: 'omit',
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return;
      const candidate = (await response.json()).analytics;
      if (!candidate?.enabled || !candidate.allowedOrigins?.includes(location.origin)) return;
      const endpoint = new URL(candidate.endpoint);
      if (
        endpoint.protocol !== 'https:' ||
        endpoint.username ||
        endpoint.password ||
        endpoint.pathname !== '/api/track' ||
        endpoint.search ||
        endpoint.hash ||
        !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(candidate.site)
      )
        return;
      // Accessing storage itself can throw in restricted browser contexts.
      try {
        visitorId = storedId(localStorage, 'bozkurt.analytics.visitor', 'visitor');
      } catch {
        visitorId = randomId('visitor');
      }
      try {
        sessionId = storedId(sessionStorage, 'bozkurt.analytics.session', 'session');
      } catch {
        sessionId = randomId('session');
      }
      config = candidate;
      view(currentScreen);
      if (progressState) void progress(progressState.state, progressState.accountKey);
      document.addEventListener('visibilitychange', () => {
        if (!active) return;
        if (document.hidden && active.since !== null) {
          active.visibleMs += performance.now() - active.since;
          active.since = null;
          send('duration');
        } else if (!document.hidden && active.since === null) active.since = performance.now();
      });
      window.addEventListener('pagehide', () => send('duration'));
    } catch {
      // Analytics is optional; unavailable configuration or collection never blocks gameplay.
    }
  }
  void start();
  return { view, progress, reset };
}
