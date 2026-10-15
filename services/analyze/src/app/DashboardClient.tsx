"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import WorldMap from "../components/WorldMap";
import FirstWatchProgress from "../components/FirstWatchProgress";
import type { AnalyzeSitePublicConfig } from "../lib/siteConfig";
import { useAnalyzeTheme } from "../lib/useAnalyzeTheme";

type RangeType = "24h" | "7d" | "30d";
type ThemeType = "dark" | "light";
type LanguageType = "tr" | "en";

type TableItem = {
  label: string;
  count?: number;
  visitors?: number;
};

type ChartPoint = {
  time: string;
  value: number;
};

type CityBreakdown = {
  city: string;
  visitors: number;
  percent: number;
};

type RawAnalyzeEvent = Record<string, unknown>;

type DashboardData = {
  visitors: number;
  visits: number;
  views: number;
  bounceRate: number;
  averageDurationTr: string;
  averageDurationEn: string;
  visitorChange: number;
  visitChange: number;
  viewChange: number;
  bounceChange: number;
  durationChange: number;
  locations: Array<{
    country: string;
    countryCode?: string;
    countryIso2?: string;
    visitors: number;
    cities: CityBreakdown[];
  }>;
  pages: TableItem[];
  referrers: TableItem[];
  browsers: TableItem[];
  chart: ChartPoint[];
};

const ANALYZE_EVENTS_ENDPOINT = "/api/events";

const dictionary = {
  tr: {
    title: "Siteni Analiz Et",
    panel: "Özel Takip Paneli",
    subtitle: "Gerçek zamanlı bağımsız sunucu trafik analitiği",
    last24: "Son 24 saat",
    last7: "7 Gün",
    last30: "Son 1 ay",
    visitors: "Ziyaretçi",
    visits: "Ziyaretler",
    views: "Görüntüleme",
    bounceRate: "Tek Sayfa Ziyaret Oranı",
    averageDuration: "Ortalama Ziyaret Süresi",
    visitChart: "Ziyaret Saatleri Grafiği",
    geoMap: "Coğrafi Dağılım Harita",
    live: "Canlı Etkileşim",
    visitorLocations: "Ziyaretçi Konumları",
    pagePath: "Sayfa Yolu",
    entryPage: "Giriş Sayfası",
    referrers: "Yönlendiren Kaynaklar",
    browser: "Yazılım / Tarayıcı",
    empty: "Henüz bir veri akışı bulunmuyor.",
    dark: "Koyu",
    light: "Açık",
    switchDark: "Koyu temaya geç",
    switchLight: "Açık temaya geç",
    loading: "Veriler güncelleniyor...",
    apiError: "API verisi alınamadı.",
  },
  en: {
    title: "Analyze Your Site",
    panel: "Private Tracking Panel",
    subtitle: "Real-time independent server traffic analysis",
    last24: "Last 24 hours",
    last7: "7 Days",
    last30: "Last 30 days",
    visitors: "Visitors",
    visits: "Visits",
    views: "Page Views",
    bounceRate: "Bounce Rate",
    averageDuration: "Average Visit Duration",
    visitChart: "Visit Hours Chart",
    geoMap: "Geographic Distribution Map",
    live: "Live Interaction",
    visitorLocations: "Visitor Locations",
    pagePath: "Page Path",
    entryPage: "Entry Page",
    referrers: "Referrers",
    browser: "Software / Browser",
    empty: "No data stream found yet.",
    dark: "Dark",
    light: "Light",
    switchDark: "Switch to dark theme",
    switchLight: "Switch to light theme",
    loading: "Updating data...",
    apiError: "Could not fetch API data.",
  },
};

const EMPTY_DASHBOARD_DATA: DashboardData = {
  visitors: 0,
  visits: 0,
  views: 0,
  bounceRate: 0,
  averageDurationTr: "0sn",
  averageDurationEn: "0s",
  visitorChange: 0,
  visitChange: 0,
  viewChange: 0,
  bounceChange: 0,
  durationChange: 0,
  locations: [],
  pages: [],
  referrers: [],
  browsers: [],
  chart: [],
};

function getStringValue(event: RawAnalyzeEvent, keys: string[]) {
  for (const key of keys) {
    const value = event[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function getNumberValue(event: RawAnalyzeEvent, keys: string[]) {
  for (const key of keys) {
    const value = event[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function getEventDate(event: RawAnalyzeEvent) {
  const rawValue = getStringValue(event, [
    "createdAt",
    "created_at",
    "timestamp",
    "time",
    "date",
    "datetime",
    "visitedAt",
    "visited_at",
    "eventTime",
    "event_time",
  ]);

  if (!rawValue) return null;

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function getRangeStartDate(range: RangeType, now: Date) {
  const start = new Date(now);

  if (range === "24h") {
    start.setHours(start.getHours() - 24);
    return start;
  }

  if (range === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return start;
}

function filterEventsByRange(
  events: RawAnalyzeEvent[],
  range: RangeType,
  now: Date
) {
  const startDate = getRangeStartDate(range, now);

  return events.filter((event) => {
    const eventDate = getEventDate(event);
    if (!eventDate) return false;

    return eventDate >= startDate && eventDate <= now;
  });
}

function getIdentityValue(
  event: RawAnalyzeEvent,
  keys: string[],
  fallbackPrefix: string,
  fallbackIndex: number
) {
  const value = getStringValue(event, keys);
  return value || `${fallbackPrefix}-${fallbackIndex}`;
}

function getPathFromEvent(event: RawAnalyzeEvent) {
  const directPath = getStringValue(event, [
    "path",
    "pathname",
    "urlPath",
    "page",
    "route",
  ]);

  if (directPath) return directPath;

  const url = getStringValue(event, ["url", "pageUrl", "page_url", "href"]);

  if (!url) return "/";

  try {
    return new URL(url).pathname || "/";
  } catch {
    return url.startsWith("/") ? url : "/";
  }
}

function getReferrerFromEvent(event: RawAnalyzeEvent) {
  const referrer = getStringValue(event, [
    "referrer",
    "referer",
    "referrerUrl",
    "referrer_url",
    "referrerDomain",
    "referrer_domain",
  ]);

  if (!referrer) return "direct";
  if (referrer === "$direct") return "direct";

  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer.replace(/^www\./, "");
  }
}

function getBrowserFromUserAgent(userAgent: string) {
  const value = userAgent.toLowerCase();

  if (value.includes("edg/")) return "Edge";
  if (value.includes("opr/") || value.includes("opera")) return "Opera";
  if (value.includes("firefox")) return "Firefox";
  if (value.includes("safari") && !value.includes("chrome")) return "Safari";
  if (value.includes("chrome") || value.includes("chromium")) return "Chrome";

  return "";
}

function getBrowserFromEvent(event: RawAnalyzeEvent) {
  const browser = getStringValue(event, [
    "browser",
    "browserName",
    "browser_name",
    "clientBrowser",
    "client_browser",
  ]);

  if (browser) return browser;

  const userAgent = getStringValue(event, [
    "userAgent",
    "user_agent",
    "ua",
    "agent",
  ]);

  return getBrowserFromUserAgent(userAgent) || "Unknown";
}

// Türkiye İngilizce panelde de "Türkiye" olarak kalsın (eski ICU/topojson "Turkey" diyebilir;
// tarayıcı sürümünden bağımsız garanti için override). Diğer ülkeler Intl ile çevrilir.
const EN_COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  TR: "Türkiye",
};

function localizeCountryName(
  iso2: string | undefined,
  fallback: string,
  language: LanguageType
) {
  const code = (iso2 ?? "").trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(code)) {
    if (language === "en" && EN_COUNTRY_NAME_OVERRIDES[code]) {
      return EN_COUNTRY_NAME_OVERRIDES[code];
    }

    try {
      const name = new Intl.DisplayNames([language], { type: "region" }).of(code);
      if (name && name !== code) return name;
    } catch {
      // Intl desteklenmiyorsa fallback kullanılır
    }
  }

  return fallback;
}

function getCountryFromEvent(event: RawAnalyzeEvent) {
  const countryCode = getStringValue(event, [
    "countryCode",
    "country_code",
    "countryNumericCode",
    "country_numeric_code",
    "countryIso",
    "country_iso",
    "countryIsoCode",
    "country_iso_code",
  ]);

  const countryIso2 = getStringValue(event, [
    "countryIso2",
    "country_iso2",
    "countryIso",
    "country_iso",
  ]);

  const country = getStringValue(event, [
    "country",
    "countryName",
    "country_name",
    "locationCountry",
    "location_country",
  ]);

  return {
    country: country || countryCode || "Unknown",
    countryCode: countryCode || undefined,
    countryIso2: countryIso2 || undefined,
  };
}

function getCityFromEvent(event: RawAnalyzeEvent, language: LanguageType) {
  const city = getStringValue(event, [
    "city",
    "cityName",
    "city_name",
    "locationCity",
    "location_city",
  ]);

  const region = getStringValue(event, [
    "region",
    "regionName",
    "region_name",
    "state",
    "province",
  ]);

  return city || region || (language === "tr" ? "Bilinmeyen Şehir" : "Unknown City");
}

function countBy<T>(
  events: RawAnalyzeEvent[],
  getter: (event: RawAnalyzeEvent) => T
) {
  const result = new Map<T, number>();

  events.forEach((event) => {
    const key = getter(event);
    result.set(key, (result.get(key) ?? 0) + 1);
  });

  return result;
}

function mapToTableItems(map: Map<string, number>, limit = 8): TableItem[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
    }));
}

function formatDuration(seconds: number, language: LanguageType) {
  if (!seconds || seconds < 1) {
    return language === "tr" ? "0sn" : "0s";
  }

  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (minutes <= 0) {
    return language === "tr" ? `${remainingSeconds}sn` : `${remainingSeconds}s`;
  }

  return language === "tr"
    ? `${minutes}dk ${remainingSeconds}sn`
    : `${minutes}m ${remainingSeconds}s`;
}

function floorToHour(date: Date) {
  const nextDate = new Date(date);
  nextDate.setMinutes(0, 0, 0);
  return nextDate;
}

function getDayLabel(date: Date, language: LanguageType) {
  const trDays = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const enDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return language === "tr" ? trDays[date.getDay()] : enDays[date.getDay()];
}

function createEmptyChart(range: RangeType, language: LanguageType, now: Date) {
  if (range === "24h") {
    const start = floorToHour(now);
    start.setHours(start.getHours() - 23);

    return Array.from({ length: 24 }, (_, index) => {
      const bucketDate = new Date(start);
      bucketDate.setHours(start.getHours() + index);

      return {
        time: `${String(bucketDate.getHours()).padStart(2, "0")}:00`,
        value: 0,
      };
    });
  }

  if (range === "7d") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(today.getDate() - 6);

    return Array.from({ length: 7 }, (_, index) => {
      const bucketDate = new Date(start);
      bucketDate.setDate(start.getDate() + index);

      return {
        time: getDayLabel(bucketDate, language),
        value: 0,
      };
    });
  }

  return Array.from({ length: 5 }, (_, index) => {
    const startDay = index * 6 + 1;
    const endDay = Math.min((index + 1) * 6, 30);

    return {
      time: language === "tr" ? `${startDay}-${endDay}. Gün` : `D${startDay}-${endDay}`,
      value: 0,
    };
  });
}

function groupEventsIntoChart(
  events: RawAnalyzeEvent[],
  range: RangeType,
  language: LanguageType,
  now: Date
) {
  const chart = createEmptyChart(range, language, now);

  if (range === "24h") {
    const start = floorToHour(now);
    start.setHours(start.getHours() - 23);

    const bucketMs = 60 * 60 * 1000;

    events.forEach((event) => {
      const eventDate = getEventDate(event);
      if (!eventDate) return;

      const bucketIndex = Math.floor(
        (eventDate.getTime() - start.getTime()) / bucketMs
      );

      if (bucketIndex >= 0 && bucketIndex < chart.length) {
        chart[bucketIndex].value += 1;
      }
    });

    return chart;
  }

  if (range === "7d") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(today.getDate() - 6);

    events.forEach((event) => {
      const eventDate = getEventDate(event);
      if (!eventDate) return;

      const eventDay = new Date(eventDate);
      eventDay.setHours(0, 0, 0, 0);

      const diffMs = eventDay.getTime() - start.getTime();
      const bucketIndex = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      if (bucketIndex >= 0 && bucketIndex < chart.length) {
        chart[bucketIndex].value += 1;
      }
    });

    return chart;
  }

  const start = getRangeStartDate("30d", now);
  const bucketMs = 6 * 24 * 60 * 60 * 1000;

  events.forEach((event) => {
    const eventDate = getEventDate(event);
    if (!eventDate) return;

    const bucketIndex = Math.floor(
      (eventDate.getTime() - start.getTime()) / bucketMs
    );

    if (bucketIndex >= 0 && bucketIndex < chart.length) {
      chart[bucketIndex].value += 1;
    }
  });

  return chart;
}

function calculateBounceRate(events: RawAnalyzeEvent[]) {
  const sessions = new Map<string, number>();

  events.forEach((event, index) => {
    const sessionId = getIdentityValue(
      event,
      ["sessionId", "session_id", "visitId", "visit_id"],
      "session",
      index
    );

    sessions.set(sessionId, (sessions.get(sessionId) ?? 0) + 1);
  });

  if (!sessions.size) return 0;

  const bouncedSessions = Array.from(sessions.values()).filter(
    (pageViewCount) => pageViewCount <= 1
  ).length;

  return Math.round((bouncedSessions / sessions.size) * 100);
}

type PeriodStats = {
  visitors: number;
  visits: number;
  views: number;
  bounce: number;
  durationSeconds: number;
};

function periodStats(events: RawAnalyzeEvent[]): PeriodStats {
  const visitorIds = new Set<string>();
  const sessionIds = new Set<string>();

  events.forEach((event, index) => {
    visitorIds.add(
      getIdentityValue(
        event,
        [
          "visitorId",
          "visitor_id",
          "clientId",
          "client_id",
          "userId",
          "user_id",
          "anonymousId",
          "anonymous_id",
          "ip",
        ],
        "visitor",
        index
      )
    );
    sessionIds.add(
      getIdentityValue(
        event,
        ["sessionId", "session_id", "visitId", "visit_id"],
        "session",
        index
      )
    );
  });

  const durationValues = events
    .map((event) =>
      getNumberValue(event, [
        "duration",
        "durationSeconds",
        "duration_seconds",
        "timeOnPage",
        "time_on_page",
        "visitDuration",
        "visit_duration",
      ])
    )
    .filter((duration) => duration > 0);

  const durationSeconds = durationValues.length
    ? durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length
    : 0;

  return {
    visitors: visitorIds.size,
    visits: sessionIds.size,
    views: events.length,
    bounce: calculateBounceRate(events),
    durationSeconds,
  };
}

// Önceki dönem (aynı uzunlukta, mevcut dönemin hemen öncesi) — değişim yüzdesi için.
function filterEventsByPreviousRange(
  events: RawAnalyzeEvent[],
  range: RangeType,
  now: Date
) {
  const currentStart = getRangeStartDate(range, now);
  const previousStart = new Date(currentStart);

  if (range === "24h") previousStart.setHours(previousStart.getHours() - 24);
  else if (range === "7d") previousStart.setDate(previousStart.getDate() - 7);
  else previousStart.setDate(previousStart.getDate() - 30);

  return events.filter((event) => {
    const eventDate = getEventDate(event);
    if (!eventDate) return false;
    return eventDate >= previousStart && eventDate < currentStart;
  });
}

function buildDashboardData(
  rawEvents: RawAnalyzeEvent[],
  range: RangeType,
  language: LanguageType,
  now: Date
): DashboardData {
  const traffic = rawEvents.filter((event) => event.eventType === "pageview");
  const events = filterEventsByRange(traffic, range, now);
  const previousEvents = filterEventsByPreviousRange(traffic, range, now);

  const current = periodStats(events);
  const previous = periodStats(previousEvents);

  const pctChange = (cur: number, prev: number) =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;

  const countryGroups = new Map<
    string,
    {
      country: string;
      countryCode?: string;
      countryIso2?: string;
      visitors: number;
      cityMap: Map<string, number>;
    }
  >();

  events.forEach((event) => {
    const { country, countryCode, countryIso2 } = getCountryFromEvent(event);
    const city = getCityFromEvent(event, language);
    const key = countryCode || country;

    const current = countryGroups.get(key);

    if (current) {
      current.visitors += 1;
      current.cityMap.set(city, (current.cityMap.get(city) ?? 0) + 1);
    } else {
      const cityMap = new Map<string, number>();
      cityMap.set(city, 1);

      countryGroups.set(key, {
        country,
        countryCode,
        countryIso2,
        visitors: 1,
        cityMap,
      });
    }
  });

  const pages = mapToTableItems(countBy(events, getPathFromEvent), 8);
  const referrers = mapToTableItems(countBy(events, getReferrerFromEvent), 8);
  const browsers = mapToTableItems(countBy(events, getBrowserFromEvent), 8);

  return {
    visitors: current.visitors,
    visits: current.visits,
    views: current.views,
    bounceRate: current.bounce,
    averageDurationTr: formatDuration(current.durationSeconds, "tr"),
    averageDurationEn: formatDuration(current.durationSeconds, "en"),
    visitorChange: pctChange(current.visitors, previous.visitors),
    visitChange: pctChange(current.visits, previous.visits),
    viewChange: pctChange(current.views, previous.views),
    bounceChange: current.bounce - previous.bounce,
    durationChange: pctChange(current.durationSeconds, previous.durationSeconds),
    locations: Array.from(countryGroups.values())
      .map((item) => ({
        country: item.country,
        countryCode: item.countryCode,
        countryIso2: item.countryIso2,
        visitors: item.visitors,
        cities: Array.from(item.cityMap.entries())
          .map(([city, visitors]) => ({
            city,
            visitors,
            percent: item.visitors ? Math.round((visitors / item.visitors) * 100) : 0,
          }))
          .sort((a, b) => b.visitors - a.visitors)
          .slice(0, 8),
      }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 10),
    pages,
    referrers: referrers.filter((item) => item.label !== "direct"),
    browsers,
    chart: groupEventsIntoChart(events, range, language, now),
  };
}

function extractEventsFromPayload(payload: unknown): RawAnalyzeEvent[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is RawAnalyzeEvent => {
      return typeof item === "object" && item !== null;
    });
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const objectPayload = payload as Record<string, unknown>;

  const possibleArrays = [
    objectPayload.events,
    objectPayload.data,
    objectPayload.records,
    objectPayload.results,
    objectPayload.pageviews,
    objectPayload.visits,
  ];

  for (const value of possibleArrays) {
    if (Array.isArray(value)) {
      return value.filter((item): item is RawAnalyzeEvent => {
        return typeof item === "object" && item !== null;
      });
    }
  }

  return [];
}

async function fetchAnalyzeEvents() {
  const response = await fetch(`${ANALYZE_EVENTS_ENDPOINT}?range=all`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Analyze Your Site API error: ${response.status}`);
  }

  const payload = await response.json();
  return extractEventsFromPayload(payload);
}

function ChangeText({ value, theme }: { value: number; theme: ThemeType }) {
  const isPositive = value >= 0;

  return (
    <div className={isPositive ? theme === "dark" ? "analyze-dark-positive" : "text-emerald-400" : theme === "dark" ? "analyze-dark-error" : "text-red-400"}>
      {isPositive ? "↑" : "↓"} %{Math.abs(value)}
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  theme,
}: {
  title: string;
  value: string | number;
  change: number;
  theme: ThemeType;
}) {
  const isDark = theme === "dark";

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        isDark
          ? "analyze-dark-panel"
          : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      <div
        className={`mb-4 text-xs font-bold uppercase tracking-wide ${
          isDark ? "analyze-dark-muted" : "text-slate-500"
        }`}
      >
        {title}
      </div>
      <div className="mb-3 text-3xl font-black">{value}</div>
      <ChangeText value={change} theme={theme} />
    </div>
  );
}

function SectionCard({
  title,
  rightText,
  children,
  className = "",
  theme,
}: {
  title: string;
  rightText?: string;
  children: ReactNode;
  className?: string;
  theme: ThemeType;
}) {
  const isDark = theme === "dark";

  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${
        isDark
          ? "analyze-dark-panel"
          : "border-slate-200 bg-white text-slate-950"
      } ${className}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className={`border-b-2 pb-3 text-lg font-bold ${isDark ? "analyze-dark-accent" : "border-blue-500 text-blue-500"}`}>
          {title}
        </h2>
        {rightText ? (
          <span className={isDark ? "text-sm analyze-dark-muted" : "text-sm text-slate-500"}>
            {rightText}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TrafficChart({
  data,
  theme,
}: {
  data: ChartPoint[];
  theme: ThemeType;
}) {
  const isDark = theme === "dark";
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  const renderBar = (item: ChartPoint, narrow: boolean) => {
    const height = Math.max(
      narrow ? 8 : 18,
      (item.value / maxValue) * (narrow ? 78 : 170)
    );

    return (
      <div key={item.time} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
        {/* o saatteki ziyaretçi sayısı — barın üstünde (0 ise boş) */}
        <span
          className={`${narrow ? "text-[10px]" : "text-xs"} font-bold leading-none ${
            item.value > 0
              ? isDark
                ? "analyze-dark-positive"
                : "text-blue-600"
              : "text-transparent"
          }`}
        >
          {item.value > 0 ? item.value : "0"}
        </span>
        <div
          className={`w-full ${narrow ? "max-w-[34px]" : "max-w-[54px]"} rounded-t border-t-2 ${
            isDark ? "analyze-dark-chart-bar" : "border-blue-400 bg-blue-100"
          }`}
          style={{ height }}
          title={`${item.time} · ${item.value} ziyaretçi`}
        />
        <span
          className={`w-full break-words text-center ${narrow ? "text-[10px]" : "text-xs sm:text-sm"} ${
            isDark ? "analyze-dark-muted" : "text-slate-400"
          }`}
        >
          {item.time}
        </span>
      </div>
    );
  };

  // Hour labels use six columns on small screens and twelve when there is room.
  if (data.length > 12) {
    const half = Math.ceil(data.length / 2);
    const rows = [data.slice(0, half), data.slice(half)];

    return (
      <div className="flex flex-col gap-5 border-t border-current/10 pt-6">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-6 items-end gap-x-1.5 gap-y-5 px-1 sm:h-[120px] sm:grid-cols-12">
            {row.map((item) => renderBar(item, true))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-[230px] items-end gap-2 border-t border-current/10 px-2 pb-8 pt-8 sm:gap-4">
      {data.map((item) => renderBar(item, false))}
    </div>
  );
}

function SimpleTable({
  items,
  emptyText,
  theme,
}: {
  items: TableItem[];
  emptyText: string;
  theme: ThemeType;
}) {
  const isDark = theme === "dark";
  const total = items.reduce((sum, item) => {
    return sum + Number(item.count ?? item.visitors ?? 0);
  }, 0);

  if (!items.length) {
    return (
      <div className={isDark ? "py-10 text-center analyze-dark-muted" : "py-10 text-center text-slate-400"}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const value = Number(item.count ?? item.visitors ?? 0);
        const percent = total ? Math.round((value / total) * 100) : 0;
        const hasVisitorValue = typeof item.visitors === "number";

        return (
          <div
            key={item.label}
            className={`rounded-lg px-3 py-3 ${
              isDark ? "analyze-dark-soft" : "bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{item.label}</span>
              <span>
                {value}
                {hasVisitorValue ? (
                  <span className={isDark ? "analyze-dark-muted" : "text-slate-400"}>
                    {" "}
                    (%{percent})
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LocationBreakdown({
  locations,
  language,
  theme,
  emptyText,
}: {
  locations: DashboardData["locations"];
  language: LanguageType;
  theme: ThemeType;
  emptyText: string;
}) {
  const isDark = theme === "dark";
  const total = locations.reduce((sum, item) => sum + item.visitors, 0);

  if (!locations.length) {
    return (
      <div className={isDark ? "py-10 text-center analyze-dark-muted" : "py-10 text-center text-slate-400"}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {locations.map((location) => {
        const name = localizeCountryName(location.countryIso2, location.country, language);
        const countryPercent = total ? Math.round((location.visitors / total) * 100) : 0;
        const visitorWord =
          language === "tr" ? "ziyaretçi" : location.visitors === 1 ? "visitor" : "visitors";

        return (
          <div
            key={location.countryCode ?? location.countryIso2 ?? location.country}
            className={`rounded-lg px-3 py-3 ${isDark ? "analyze-dark-soft" : "bg-slate-50"}`}
          >
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{name}</span>
              <span>
                {location.visitors} {visitorWord}
                <span className={isDark ? "analyze-dark-muted" : "text-slate-400"}>
                  {" · "}
                  {language === "tr" ? `%${countryPercent}` : `${countryPercent}%`}
                </span>
              </span>
            </div>

            {location.cities.length > 0 && (
              <div
                className={`mt-2 space-y-1 border-t pt-2 ${
                  isDark ? "analyze-dark-rule" : "border-slate-200"
                }`}
              >
                {location.cities.map((city) => {
                  const cityWord =
                    language === "tr"
                      ? "Ziyaretçi"
                      : city.visitors === 1
                        ? "Visitor"
                        : "Visitors";

                  return (
                    <div
                      key={city.city}
                      className={`text-[11px] ${isDark ? "analyze-dark-ink" : "text-slate-600"}`}
                    >
                      {language === "tr"
                        ? `${city.visitors} ${cityWord} - ${city.city} - %${city.percent}`
                        : `${city.visitors} ${cityWord} - ${city.city} - ${city.percent}%`}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardClient({ site }: { site: AnalyzeSitePublicConfig }) {
  const [range, setRange] = useState<RangeType>("24h");
  const { theme, ready: mounted, chooseTheme } = useAnalyzeTheme();
  const [language, setLanguage] = useState<LanguageType>("tr");
  const [rawEvents, setRawEvents] = useState<RawAnalyzeEvent[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const t = {
    ...dictionary[language],
    title: site.dashboardTitle[language],
  };
  const isDark = theme === "dark";

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login';
  }

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalyzeEvents() {
      try {
        setApiError("");
        setIsLoading(true);

        const events = await fetchAnalyzeEvents();

        if (!isCancelled) {
          setRawEvents(events);
          setNow(new Date());
        }
      } catch {
        if (!isCancelled) {
          setRawEvents([]);
          setApiError(t.apiError);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAnalyzeEvents();

    const timer = window.setInterval(() => {
      loadAnalyzeEvents();
    }, 10000);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [t.apiError]);

  const dashboardData = useMemo(() => {
    if (!rawEvents.length) {
      return {
        ...EMPTY_DASHBOARD_DATA,
        chart: createEmptyChart(range, language, now),
      };
    }

    return buildDashboardData(rawEvents, range, language, now);
  }, [rawEvents, range, language, now]);

  const visitorLocations = useMemo(() => {
    return dashboardData.locations.map((location) => ({
      country: location.country,
      countryCode: location.countryCode,
      visitors: location.visitors,
      cities: location.cities,
    }));
  }, [dashboardData.locations]);

  const averageDuration =
    language === "tr" ? dashboardData.averageDurationTr : dashboardData.averageDurationEn;

  if (!mounted) return <main className="analyze-dashboard-pending min-h-screen px-5 py-10"><h1 className="mx-auto max-w-7xl text-3xl font-black">{site.dashboardTitle.tr}</h1></main>;

  return (
    <main
      className={`min-h-screen px-5 py-10 transition ${
        isDark ? "analyze-login" : "bg-slate-50 text-slate-950"
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 border-b border-current/10 pb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${isDark ? "analyze-dark-dot" : "bg-blue-600"}`} />
                <h1 className="text-3xl font-black">{t.title}</h1>
                <span className={isDark ? "analyze-dark-muted" : "text-slate-500"}>{t.panel}</span>
              </div>
              <p className={isDark ? "analyze-dark-muted" : "text-slate-500"}>{t.subtitle}</p>
              {(isLoading || apiError) && (
                <p className={`mt-3 text-sm ${isDark ? apiError ? "analyze-dark-error" : "analyze-dark-accent" : apiError ? "text-red-500" : "text-blue-500"}`}>
                  {apiError || t.loading}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {site.authMode !== "none" && (
              <button
                type="button"
                onClick={() => void logout()}
                className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                  isDark ? "analyze-dark-control" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <LogOut size={16} /> {language === 'tr' ? 'Çıkış' : 'Sign out'}
              </button>
              )}
              <button
                type="button"
                onClick={() => chooseTheme(isDark ? "light" : "dark")}
                aria-label={isDark ? t.switchLight : t.switchDark}
                title={isDark ? t.switchLight : t.switchDark}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  isDark
                    ? "analyze-dark-control"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {isDark ? "☀️" : "🌙"} {isDark ? t.light : t.dark}
              </button>

              <div
                className={`rounded-xl border p-1 ${
                  isDark ? "analyze-dark-panel" : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setLanguage("tr")}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                    language === "tr"
                      ? isDark
                        ? "analyze-dark-selected"
                        : "bg-slate-100 text-slate-950"
                      : isDark
                        ? "analyze-dark-inactive"
                        : "text-slate-400 hover:text-slate-900"
                  }`}
                >
                  TR
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                    language === "en"
                      ? isDark
                        ? "analyze-dark-selected"
                        : "bg-slate-100 text-slate-950"
                      : isDark
                        ? "analyze-dark-inactive"
                        : "text-slate-400 hover:text-slate-900"
                  }`}
                >
                  EN
                </button>
              </div>

              <div
                className={`rounded-xl border p-1 ${
                  isDark ? "analyze-dark-panel" : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setRange("24h")}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    range === "24h"
                      ? isDark
                        ? "analyze-dark-selected"
                        : "bg-slate-100 text-slate-950"
                      : isDark
                        ? "analyze-dark-inactive"
                        : "text-slate-400 hover:text-slate-900"
                  }`}
                >
                  {t.last24}
                </button>
                <button
                  type="button"
                  onClick={() => setRange("7d")}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    range === "7d"
                      ? isDark
                        ? "analyze-dark-selected"
                        : "bg-slate-100 text-slate-950"
                      : isDark
                        ? "analyze-dark-inactive"
                        : "text-slate-400 hover:text-slate-900"
                  }`}
                >
                  {t.last7}
                </button>
                <button
                  type="button"
                  onClick={() => setRange("30d")}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    range === "30d"
                      ? isDark
                        ? "analyze-dark-selected"
                        : "bg-slate-100 text-slate-950"
                      : isDark
                        ? "analyze-dark-inactive"
                        : "text-slate-400 hover:text-slate-900"
                  }`}
                >
                  {t.last30}
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title={t.visitors} value={dashboardData.visitors} change={dashboardData.visitorChange} theme={theme} />
          <MetricCard title={t.visits} value={dashboardData.visits} change={dashboardData.visitChange} theme={theme} />
          <MetricCard title={t.views} value={dashboardData.views} change={dashboardData.viewChange} theme={theme} />
          <MetricCard title={t.bounceRate} value={`%${dashboardData.bounceRate}`} change={dashboardData.bounceChange} theme={theme} />
          <MetricCard title={t.averageDuration} value={averageDuration} change={dashboardData.durationChange} theme={theme} />
        </section>

        <FirstWatchProgress events={rawEvents} sites={site.eventSites} start={getRangeStartDate(range, now).getTime()} end={now.getTime()} language={language} theme={theme} />

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard title={t.visitChart} theme={theme}>
            <TrafficChart data={dashboardData.chart} theme={theme} />
          </SectionCard>

          <SectionCard title={t.geoMap} rightText={t.live} theme={theme}>
            <WorldMap
              data={visitorLocations}
              theme={theme}
              language={language}
              className="h-[340px]"
            />
          </SectionCard>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SectionCard title={t.visitorLocations} theme={theme}>
            <LocationBreakdown
              locations={dashboardData.locations}
              language={language}
              theme={theme}
              emptyText={t.empty}
            />
          </SectionCard>

          <SectionCard title={t.pagePath} rightText={t.entryPage} theme={theme}>
            <SimpleTable items={dashboardData.pages} emptyText={t.empty} theme={theme} />
          </SectionCard>

          <SectionCard title={t.referrers} theme={theme}>
            <SimpleTable items={dashboardData.referrers} emptyText={t.empty} theme={theme} />
          </SectionCard>
        </section>
      </div>
    </main>
  );
}
