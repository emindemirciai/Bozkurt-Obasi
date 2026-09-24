export type AnalyzeAuthMode = "none" | "platform-admin";

export type AnalyzeSiteConfig = {
  id: string;
  name: string;
  dashboardTitle: { tr: string; en: string };
  metadataTitle: string;
  description: string;
  healthName: string;
  authMode: AnalyzeAuthMode;
  authApiUrl: string;
  allowedOrigins: string[];
  eventSites: string[];
};

export type AnalyzeSitePublicConfig = Pick<
  AnalyzeSiteConfig,
  "id" | "dashboardTitle" | "authMode"
>;

type AnalyzeEnvironment = Record<string, string | undefined>;

let cachedEnvironmentKey = "";
let cachedSite: AnalyzeSiteConfig | undefined;

function readCsv(value: string | undefined, normalize: (item: string) => string) {
  return [...new Set(
    (value || "")
      .split(",")
      .map((item) => normalize(item.trim()))
      .filter(Boolean),
  )];
}

function normalizeOrigin(value: string) {
  return value.replace(/\/$/, "");
}

function readRequired(environment: AnalyzeEnvironment, key: string) {
  const value = environment[key]?.trim() || "";

  if (!value) {
    throw new Error(`${key} tanımlanmadı.`);
  }

  return value;
}

export function getAnalyzeSiteConfig(environment: AnalyzeEnvironment = process.env) {
  const environmentKey = [
    environment.ANALYZE_SITE_ID,
    environment.ANALYZE_SITE_NAME,
    environment.ANALYZE_TITLE_TR,
    environment.ANALYZE_TITLE_EN,
    environment.ANALYZE_METADATA_TITLE,
    environment.ANALYZE_DESCRIPTION,
    environment.ANALYZE_HEALTH_NAME,
    environment.ANALYZE_AUTH_MODE,
    environment.ANALYZE_AUTH_API_URL,
    environment.ANALYZE_ALLOWED_ORIGINS,
    environment.ANALYZE_EVENT_SITES,
  ].join("\u0000");

  if (cachedSite && environmentKey === cachedEnvironmentKey) {
    return cachedSite;
  }

  const id = readRequired(environment, "ANALYZE_SITE_ID").toLowerCase();
  const name = readRequired(environment, "ANALYZE_SITE_NAME");
  const allowedOrigins = readCsv(environment.ANALYZE_ALLOWED_ORIGINS, normalizeOrigin);
  const eventSites = readCsv(environment.ANALYZE_EVENT_SITES, (site) => site.toLowerCase());
  const authMode: AnalyzeAuthMode = environment.ANALYZE_AUTH_MODE === "platform-admin"
    ? "platform-admin"
    : "none";
  const authApiUrl = normalizeOrigin(environment.ANALYZE_AUTH_API_URL?.trim() || "");

  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(id)) {
    throw new Error("ANALYZE_SITE_ID küçük harf, rakam, nokta, tire veya alt çizgi içermeli.");
  }

  if (!allowedOrigins.length) {
    throw new Error("ANALYZE_ALLOWED_ORIGINS en az bir origin içermeli.");
  }

  if (!eventSites.length) {
    throw new Error("ANALYZE_EVENT_SITES en az bir site değeri içermeli.");
  }

  if (authMode === "platform-admin" && !authApiUrl) {
    throw new Error("ANALYZE_AUTH_API_URL yönetici girişi için zorunludur.");
  }

  cachedEnvironmentKey = environmentKey;
  cachedSite = {
    id,
    name,
    dashboardTitle: {
      tr: environment.ANALYZE_TITLE_TR?.trim() || `${name} Siteni Analiz Et`,
      en: environment.ANALYZE_TITLE_EN?.trim() || `${name} Analyze Your Site`,
    },
    metadataTitle: environment.ANALYZE_METADATA_TITLE?.trim() || `${name} Siteni Analiz Et | Trafik Paneli`,
    description: environment.ANALYZE_DESCRIPTION?.trim() || `${name} için gerçek zamanlı trafik analiz paneli`,
    healthName: environment.ANALYZE_HEALTH_NAME?.trim() || `${name} Siteni Analiz Et`,
    authMode,
    authApiUrl,
    allowedOrigins,
    eventSites,
  };

  return cachedSite;
}

export function getAnalyzeSessionCookieName(site: AnalyzeSiteConfig) {
  return `analyze_session_${site.id}`;
}

export function toAnalyzeSitePublicConfig(site: AnalyzeSiteConfig): AnalyzeSitePublicConfig {
  return {
    id: site.id,
    dashboardTitle: site.dashboardTitle,
    authMode: site.authMode,
  };
}
