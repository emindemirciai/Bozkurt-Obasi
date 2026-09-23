const DEFAULT_URL = 'https://analiz.bozkurtobasi.com';
const DEFAULT_SITE = 'bozkurtobasi.com';
const DEFAULT_ALLOWED_ORIGINS = ['https://bozkurtobasi.com', 'https://www.bozkurtobasi.com'];
const SITE_PATTERN =
  /^(?=.{1,128}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

function httpsOrigin(value, name) {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or hash.`);
  }
  const candidate = value.trim();
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or hash.`);
  }
  if (
    !/^https:\/\/[^/?#]+\/?$/i.test(candidate) ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !url.hostname
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or hash.`);
  }
  return url.origin;
}

function setting(env, name, fallback) {
  const value = env[name] ?? fallback;
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`);
  return value.trim();
}

export function analyticsConfig(env = {}) {
  if (env.ANALYZE_ENABLED !== 'true') return { enabled: false };

  const origin = httpsOrigin(setting(env, 'ANALYZE_URL', DEFAULT_URL), 'ANALYZE_URL');
  const site = setting(env, 'ANALYZE_SITE_ID', DEFAULT_SITE);
  if (!SITE_PATTERN.test(site)) {
    throw new Error(
      'ANALYZE_SITE_ID must be a lowercase hostname-like token with at most 128 characters.',
    );
  }

  const rawAllowedOrigins = setting(
    env,
    'ANALYZE_ALLOWED_ORIGINS',
    DEFAULT_ALLOWED_ORIGINS.join(','),
  ).split(',');
  if (rawAllowedOrigins.length === 0 || rawAllowedOrigins.length > 10) {
    throw new Error('ANALYZE_ALLOWED_ORIGINS must contain between 1 and 10 HTTPS origins.');
  }
  const allowedOrigins = rawAllowedOrigins.map((value, index) =>
    httpsOrigin(value, `ANALYZE_ALLOWED_ORIGINS entry ${index + 1}`),
  );

  return {
    enabled: true,
    endpoint: `${origin}/api/track`,
    site,
    allowedOrigins,
  };
}
