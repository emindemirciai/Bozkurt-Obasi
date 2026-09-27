// Analyze.Your.Site /api/track contract: cumulative updates reuse the pageview id.
// Only named game screens are sent; saves, session cookies and URL parameters are excluded.
const SCREENS = new Set(['village', 'battle', 'world', 'wolves', 'quests', 'updates']);

export function createAnalytics() {
  let config, active;
  let currentScreen = 'village';
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
  return { view };
}
