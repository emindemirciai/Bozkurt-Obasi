import crypto from "crypto";
import {
  saveAnalyzeEvent,
  type StoredAnalyzeEvent,
} from "../../../lib/analyzeStore";
import { getAnalyzeSiteConfig } from "../../../lib/siteConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingTrackPayload = Record<string, unknown>;

type NormalizedGeo = {
  countryIso2: string;
  countryName: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

function requestOrigin(request: Request) {
  return request.headers.get("origin")?.replace(/\/$/, "") || "";
}

function isAllowed(request: Request, allowedOrigins: string[]) {
  const origin = requestOrigin(request);
  return !origin || allowedOrigins.includes(origin);
}

function corsHeaders(request: Request, allowedOrigins: string[]) {
  const origin = requestOrigin(request);
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

const COUNTRY_NAMES_TR: Record<string, string> = {
  TR: "Türkiye",
  US: "Amerika Birleşik Devletleri",
  DE: "Almanya",
  FR: "Fransa",
  GB: "Birleşik Krallık",
  UK: "Birleşik Krallık",
  NL: "Hollanda",
  ES: "İspanya",
  IT: "İtalya",
  RU: "Rusya",
  CN: "Çin",
  JP: "Japonya",
  IN: "Hindistan",
  BR: "Brezilya",
  CA: "Kanada",
  AU: "Avustralya",
  AE: "Birleşik Arap Emirlikleri",
  SA: "Suudi Arabistan",
  DO: "Dominik Cumhuriyeti",
  MX: "Meksika",
  AR: "Arjantin",
  CL: "Şili",
  CO: "Kolombiya",
  PE: "Peru",
  PT: "Portekiz",
  PL: "Polonya",
  RO: "Romanya",
  GR: "Yunanistan",
  BG: "Bulgaristan",
  EG: "Mısır",
  MA: "Fas",
  ZA: "Güney Afrika",
  KR: "Güney Kore",
  ID: "Endonezya",
  TH: "Tayland",
  MY: "Malezya",
  SG: "Singapur",
  VN: "Vietnam",
};

const ISO2_TO_NUMERIC: Record<string, string> = {
  AD: "020", AE: "784", AF: "004", AG: "028", AI: "660", AL: "008",
  AM: "051", AO: "024", AQ: "010", AR: "032", AS: "016", AT: "040",
  AU: "036", AW: "533", AX: "248", AZ: "031", BA: "070", BB: "052",
  BD: "050", BE: "056", BF: "854", BG: "100", BH: "048", BI: "108",
  BJ: "204", BL: "652", BM: "060", BN: "096", BO: "068", BQ: "535",
  BR: "076", BS: "044", BT: "064", BV: "074", BW: "072", BY: "112",
  BZ: "084", CA: "124", CC: "166", CD: "180", CF: "140", CG: "178",
  CH: "756", CI: "384", CK: "184", CL: "152", CM: "120", CN: "156",
  CO: "170", CR: "188", CU: "192", CV: "132", CW: "531", CX: "162",
  CY: "196", CZ: "203", DE: "276", DJ: "262", DK: "208", DM: "212",
  DO: "214", DZ: "012", EC: "218", EE: "233", EG: "818", EH: "732",
  ER: "232", ES: "724", ET: "231", FI: "246", FJ: "242", FK: "238",
  FM: "583", FO: "234", FR: "250", GA: "266", GB: "826", GD: "308",
  GE: "268", GF: "254", GG: "831", GH: "288", GI: "292", GL: "304",
  GM: "270", GN: "324", GP: "312", GQ: "226", GR: "300", GS: "239",
  GT: "320", GU: "316", GW: "624", GY: "328", HK: "344", HM: "334",
  HN: "340", HR: "191", HT: "332", HU: "348", ID: "360", IE: "372",
  IL: "376", IM: "833", IN: "356", IO: "086", IQ: "368", IR: "364",
  IS: "352", IT: "380", JE: "832", JM: "388", JO: "400", JP: "392",
  KE: "404", KG: "417", KH: "116", KI: "296", KM: "174", KN: "659",
  KP: "408", KR: "410", KW: "414", KY: "136", KZ: "398", LA: "418",
  LB: "422", LC: "662", LI: "438", LK: "144", LR: "430", LS: "426",
  LT: "440", LU: "442", LV: "428", LY: "434", MA: "504", MC: "492",
  MD: "498", ME: "499", MF: "663", MG: "450", MH: "584", MK: "807",
  ML: "466", MM: "104", MN: "496", MO: "446", MP: "580", MQ: "474",
  MR: "478", MS: "500", MT: "470", MU: "480", MV: "462", MW: "454",
  MX: "484", MY: "458", MZ: "508", NA: "516", NC: "540", NE: "562",
  NF: "574", NG: "566", NI: "558", NL: "528", NO: "578", NP: "524",
  NR: "520", NU: "570", NZ: "554", OM: "512", PA: "591", PE: "604",
  PF: "258", PG: "598", PH: "608", PK: "586", PL: "616", PM: "666",
  PN: "612", PR: "630", PS: "275", PT: "620", PW: "585", PY: "600",
  QA: "634", RE: "638", RO: "642", RS: "688", RU: "643", RW: "646",
  SA: "682", SB: "090", SC: "690", SD: "729", SE: "752", SG: "702",
  SH: "654", SI: "705", SJ: "744", SK: "703", SL: "694", SM: "674",
  SN: "686", SO: "706", SR: "740", SS: "728", ST: "678", SV: "222",
  SX: "534", SY: "760", SZ: "748", TC: "796", TD: "148", TF: "260",
  TG: "768", TH: "764", TJ: "762", TK: "772", TL: "626", TM: "795",
  TN: "788", TO: "776", TR: "792", TT: "780", TV: "798", TW: "158",
  TZ: "834", UA: "804", UG: "800", UM: "581", US: "840", UY: "858",
  UZ: "860", VA: "336", VC: "670", VE: "862", VG: "092", VI: "850",
  VN: "704", VU: "548", WF: "876", WS: "882", YE: "887", YT: "175",
  ZA: "710", ZM: "894", ZW: "716",
};

function getString(payload: IncomingTrackPayload, key: string, fallback = "") {
  const value = payload[key];
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function getNumber(payload: IncomingTrackPayload, key: string, fallback = 0) {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getBrowserFromUserAgent(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (value.includes("edg/")) return "Edge";
  if (value.includes("opr/") || value.includes("opera")) return "Opera";
  if (value.includes("firefox")) return "Firefox";
  if (value.includes("safari") && !value.includes("chrome")) return "Safari";
  if (value.includes("chrome") || value.includes("chromium")) return "Chrome";
  return "Unknown";
}

function cleanIp(value: string) {
  const first = value.split(",")[0]?.trim() || "";
  if (!first) return "unknown";
  if (first.startsWith("::ffff:")) return first.slice(7);
  if (first.startsWith("[")) return first.slice(1).split("]")[0] || "unknown";
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(first)) return first.split(":")[0];
  return first;
}

function getRequestIp(request: Request) {
  return cleanIp(
    request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-client-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown"
  );
}

function getHashedIp(request: Request) {
  return crypto.createHash("sha256").update(getRequestIp(request)).digest("hex");
}

function isPrivateOrUnknownIp(ip: string) {
  if (!ip || ip === "unknown" || ip === "localhost") return true;
  if (ip === "::1" || ip === "127.0.0.1") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  const lowerIp = ip.toLowerCase();
  if (lowerIp.startsWith("fc") || lowerIp.startsWith("fd") || lowerIp.startsWith("fe80")) return true;
  return false;
}

function getCountryCodeFromHeaders(request: Request) {
  return (
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code") ||
    ""
  ).toUpperCase();
}

function getCountryNameFromCode(countryCodeIso2: string) {
  return COUNTRY_NAMES_TR[countryCodeIso2] || countryCodeIso2 || "Unknown";
}

// Birincil sağlayıcı: ipwho.is (HTTPS, anahtarsız)
async function geoFromIpWhoIs(ip: string): Promise<NormalizedGeo | null> {
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      cache: "no-store",
      headers: { "User-Agent": "AnalyzeYourSite/1.0" },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    if (data.success === false) return null;

    const iso2 = String(data.country_code || "").toUpperCase();
    if (!iso2) return null;

    const tz = data.timezone;
    const timezone =
      tz && typeof tz === "object"
        ? String((tz as Record<string, unknown>).id || "")
        : typeof tz === "string"
          ? tz
          : "";

    return {
      countryIso2: iso2,
      countryName: typeof data.country === "string" ? data.country : "",
      city: typeof data.city === "string" ? data.city : undefined,
      region: typeof data.region === "string" ? data.region : undefined,
      latitude: toNumber(data.latitude),
      longitude: toNumber(data.longitude),
      timezone: timezone || undefined,
    };
  } catch {
    return null;
  }
}

// Yedek sağlayıcı: ip-api.com (anahtarsız, yüksek isabet)
async function geoFromIpApi(ip: string): Promise<NormalizedGeo | null> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone`,
      { cache: "no-store" }
    );
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    if (data.status !== "success") return null;

    const iso2 = String(data.countryCode || "").toUpperCase();
    if (!iso2) return null;

    return {
      countryIso2: iso2,
      countryName: typeof data.country === "string" ? data.country : "",
      city: typeof data.city === "string" ? data.city : undefined,
      region:
        typeof data.regionName === "string"
          ? data.regionName
          : typeof data.region === "string"
            ? data.region
            : undefined,
      latitude: toNumber(data.lat),
      longitude: toNumber(data.lon),
      timezone: typeof data.timezone === "string" ? data.timezone : undefined,
    };
  } catch {
    return null;
  }
}

async function lookupGeoByIp(ip: string): Promise<{
  countryIso2: string;
  countryNumericCode: string;
  country: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}> {
  if (process.env.ANALYZE_GEO_LOOKUP === "false" || isPrivateOrUnknownIp(ip)) {
    return { countryIso2: "", countryNumericCode: "", country: "Unknown" };
  }

  const geo = (await geoFromIpWhoIs(ip)) || (await geoFromIpApi(ip));

  if (!geo || !geo.countryIso2) {
    return { countryIso2: "", countryNumericCode: "", country: "Unknown" };
  }

  const countryIso2 = geo.countryIso2;
  const countryNumericCode = ISO2_TO_NUMERIC[countryIso2] || "";
  const country =
    COUNTRY_NAMES_TR[countryIso2] || geo.countryName || countryIso2 || "Unknown";

  return {
    countryIso2,
    countryNumericCode,
    country,
    city: geo.city,
    region: geo.region,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone,
  };
}

function normalizePath(payload: IncomingTrackPayload) {
  const pathValue = getString(payload, "path");
  if (pathValue) return pathValue;

  const url = getString(payload, "url");
  if (!url) return "/";

  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

export async function OPTIONS(request: Request) {
  const site = getAnalyzeSiteConfig();

  if (!isAllowed(request, site.allowedOrigins)) {
    return Response.json({ ok: false, error: "Origin is not allowed" }, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, site.allowedOrigins),
  });
}

export async function POST(request: Request) {
  const deploymentSite = getAnalyzeSiteConfig();

  if (!isAllowed(request, deploymentSite.allowedOrigins)) {
    return Response.json({ ok: false, error: "Origin is not allowed" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as IncomingTrackPayload;
    const now = new Date().toISOString();
    const userAgent = getString(payload, "userAgent") || request.headers.get("user-agent") || "";

    const payloadCountryIso2 = getString(payload, "countryCode").toUpperCase();
    const payloadCountry = getString(payload, "country");
    const headerCountryIso2 = getCountryCodeFromHeaders(request);

    const requestIp = getRequestIp(request);
    const geo =
      payloadCountryIso2 || payloadCountry || headerCountryIso2
        ? {
            countryIso2: payloadCountryIso2 || headerCountryIso2,
            countryNumericCode: ISO2_TO_NUMERIC[payloadCountryIso2 || headerCountryIso2] || "",
            country: payloadCountry || getCountryNameFromCode(payloadCountryIso2 || headerCountryIso2),
          }
        : await lookupGeoByIp(requestIp);

    const countryIso2 = geo.countryIso2 || payloadCountryIso2 || headerCountryIso2;
    const countryNumericCode = geo.countryNumericCode || ISO2_TO_NUMERIC[countryIso2] || "";
    const country = payloadCountry || geo.country || getCountryNameFromCode(countryIso2);

    const eventType: StoredAnalyzeEvent["eventType"] =
      getString(payload, "eventType") === "duration" ? "duration" : "pageview";
    const requestedSite = getString(payload, "site").trim().toLowerCase();
    const eventSite = deploymentSite.eventSites.includes(requestedSite)
      ? requestedSite
      : deploymentSite.eventSites[0];

    const event: StoredAnalyzeEvent = {
      id: getString(payload, "id", crypto.randomUUID()),
      site: eventSite,
      eventType,
      createdAt: getString(payload, "createdAt", now),
      updatedAt: now,
      visitorId: getString(payload, "visitorId", getHashedIp(request)),
      sessionId: getString(payload, "sessionId", crypto.randomUUID()),
      url: getString(payload, "url", ""),
      path: normalizePath(payload),
      referrer: getString(payload, "referrer", "direct") || "direct",
      userAgent,
      browser: getString(payload, "browser", getBrowserFromUserAgent(userAgent)),
      country,
      countryCode: countryNumericCode || countryIso2 || undefined,
      countryIso2: countryIso2 || undefined,
      city: geo.city,
      region: geo.region,
      latitude: geo.latitude,
      longitude: geo.longitude,
      language: getString(payload, "language"),
      timezone: getString(payload, "timezone") || geo.timezone,
      screen: getString(payload, "screen"),
      duration: getNumber(payload, "duration", 0),
    };

    await saveAnalyzeEvent(event);

    return Response.json(
      {
        ok: true,
      },
      {
        headers: corsHeaders(request, deploymentSite.allowedOrigins),
      }
    );
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Invalid analyze payload",
      },
      {
        status: 400,
        headers: corsHeaders(request, deploymentSite.allowedOrigins),
      }
    );
  }
}
