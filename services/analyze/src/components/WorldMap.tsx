"use client";

import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";

export type GeoLocation = {
  country?: string;
  name?: string;
  code?: string;
  countryCode?: string;
  visitors: number;
  cities?: Array<{
    city: string;
    visitors: number;
    percent?: number;
  }>;
};

type ThemeType = "dark" | "light";
type LanguageType = "tr" | "en";

type WorldMapProps = {
  data?: GeoLocation[];
  className?: string;
  theme?: ThemeType;
  language?: LanguageType;
};

type CityBreakdown = {
  city: string;
  visitors: number;
  percent: number;
};

type ActiveCountry = {
  id: string;
  name: string;
  visitors: number;
  cities: CityBreakdown[];
};

type TooltipState = {
  name: string;
  visitors: number;
  percent: number;
  cities: CityBreakdown[];
  x: number;
  y: number;
};

type MapPosition = {
  coordinates: [number, number];
  zoom: number;
};

type GeographyItem = {
  id: string | number;
  rsmKey: string;
  properties?: {
    name?: string;
    NAME?: string;
    ADMIN?: string;
  };
};

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const DEFAULT_LOCATIONS: GeoLocation[] = [
  { country: "Türkiye", visitors: 1, cities: [{ city: "İstanbul", visitors: 1 }] },
];

const COUNTRY_IDS: Record<string, string> = {
  tr: "792",
  turkiye: "792",
  türkiye: "792",
  turkey: "792",
  do: "214",
  "dominik cumhuriyeti": "214",
  "dominican republic": "214",
  us: "840",
  usa: "840",
  abd: "840",
  "amerika birleşik devletleri": "840",
  "amerika birlesik devletleri": "840",
  "united states": "840",
  "united states of america": "840",
  de: "276",
  almanya: "276",
  germany: "276",
  fr: "250",
  fransa: "250",
  france: "250",
  gb: "826",
  uk: "826",
  ingiltere: "826",
  "birleşik krallık": "826",
  "birlesik krallik": "826",
  "united kingdom": "826",
  nl: "528",
  hollanda: "528",
  netherlands: "528",
  es: "724",
  ispanya: "724",
  spain: "724",
  it: "380",
  italya: "380",
  italy: "380",
  ru: "643",
  rusya: "643",
  russia: "643",
  cn: "156",
  çin: "156",
  cin: "156",
  china: "156",
  jp: "392",
  japonya: "392",
  japan: "392",
  in: "356",
  hindistan: "356",
  india: "356",
  br: "076",
  brezilya: "076",
  brazil: "076",
  ca: "124",
  kanada: "124",
  canada: "124",
  au: "036",
  avustralya: "036",
  australia: "036",
  ae: "784",
  bae: "784",
  "birleşik arap emirlikleri": "784",
  "birlesik arap emirlikleri": "784",
  "united arab emirates": "784",
  sa: "682",
  "suudi arabistan": "682",
  "saudi arabia": "682",
};

const COUNTRY_NAMES_TR: Record<string, string> = {
  "004": "Afganistan",
  "008": "Arnavutluk",
  "010": "Antarktika",
  "012": "Cezayir",
  "016": "Amerikan Samoası",
  "020": "Andorra",
  "024": "Angola",
  "028": "Antigua ve Barbuda",
  "031": "Azerbaycan",
  "032": "Arjantin",
  "036": "Avustralya",
  "040": "Avusturya",
  "044": "Bahamalar",
  "048": "Bahreyn",
  "050": "Bangladeş",
  "051": "Ermenistan",
  "052": "Barbados",
  "056": "Belçika",
  "064": "Butan",
  "068": "Bolivya",
  "070": "Bosna-Hersek",
  "072": "Botsvana",
  "076": "Brezilya",
  "084": "Belize",
  "090": "Solomon Adaları",
  "096": "Brunei",
  "100": "Bulgaristan",
  "104": "Myanmar",
  "108": "Burundi",
  "112": "Belarus",
  "116": "Kamboçya",
  "120": "Kamerun",
  "124": "Kanada",
  "132": "Yeşil Burun Adaları",
  "140": "Orta Afrika Cumhuriyeti",
  "144": "Sri Lanka",
  "148": "Çad",
  "152": "Şili",
  "156": "Çin",
  "170": "Kolombiya",
  "174": "Komorlar",
  "178": "Kongo",
  "180": "Kongo Demokratik Cumhuriyeti",
  "188": "Kosta Rika",
  "191": "Hırvatistan",
  "192": "Küba",
  "196": "Kıbrıs",
  "203": "Çekya",
  "204": "Benin",
  "208": "Danimarka",
  "214": "Dominik Cumhuriyeti",
  "218": "Ekvador",
  "222": "El Salvador",
  "226": "Ekvator Ginesi",
  "231": "Etiyopya",
  "232": "Eritre",
  "233": "Estonya",
  "242": "Fiji",
  "246": "Finlandiya",
  "250": "Fransa",
  "262": "Cibuti",
  "266": "Gabon",
  "268": "Gürcistan",
  "270": "Gambiya",
  "275": "Filistin",
  "276": "Almanya",
  "288": "Gana",
  "300": "Yunanistan",
  "304": "Grönland",
  "320": "Guatemala",
  "324": "Gine",
  "328": "Guyana",
  "332": "Haiti",
  "340": "Honduras",
  "348": "Macaristan",
  "352": "İzlanda",
  "356": "Hindistan",
  "360": "Endonezya",
  "364": "İran",
  "368": "Irak",
  "372": "İrlanda",
  "376": "İsrail",
  "380": "İtalya",
  "384": "Fildişi Sahili",
  "388": "Jamaika",
  "392": "Japonya",
  "398": "Kazakistan",
  "400": "Ürdün",
  "404": "Kenya",
  "408": "Kuzey Kore",
  "410": "Güney Kore",
  "414": "Kuveyt",
  "417": "Kırgızistan",
  "418": "Laos",
  "422": "Lübnan",
  "426": "Lesotho",
  "428": "Letonya",
  "430": "Liberya",
  "434": "Libya",
  "440": "Litvanya",
  "442": "Lüksemburg",
  "450": "Madagaskar",
  "454": "Malavi",
  "458": "Malezya",
  "466": "Mali",
  "478": "Moritanya",
  "484": "Meksika",
  "496": "Moğolistan",
  "498": "Moldova",
  "499": "Karadağ",
  "504": "Fas",
  "508": "Mozambik",
  "512": "Umman",
  "516": "Namibya",
  "524": "Nepal",
  "528": "Hollanda",
  "554": "Yeni Zelanda",
  "558": "Nikaragua",
  "562": "Nijer",
  "566": "Nijerya",
  "578": "Norveç",
  "586": "Pakistan",
  "591": "Panama",
  "598": "Papua Yeni Gine",
  "600": "Paraguay",
  "604": "Peru",
  "608": "Filipinler",
  "616": "Polonya",
  "620": "Portekiz",
  "630": "Porto Riko",
  "634": "Katar",
  "642": "Romanya",
  "643": "Rusya",
  "646": "Ruanda",
  "682": "Suudi Arabistan",
  "686": "Senegal",
  "688": "Sırbistan",
  "694": "Sierra Leone",
  "702": "Singapur",
  "703": "Slovakya",
  "704": "Vietnam",
  "705": "Slovenya",
  "706": "Somali",
  "710": "Güney Afrika",
  "716": "Zimbabve",
  "724": "İspanya",
  "728": "Güney Sudan",
  "729": "Sudan",
  "740": "Surinam",
  "748": "Esvatini",
  "752": "İsveç",
  "756": "İsviçre",
  "760": "Suriye",
  "762": "Tacikistan",
  "764": "Tayland",
  "768": "Togo",
  "780": "Trinidad ve Tobago",
  "784": "Birleşik Arap Emirlikleri",
  "788": "Tunus",
  "792": "Türkiye",
  "795": "Türkmenistan",
  "800": "Uganda",
  "804": "Ukrayna",
  "807": "Kuzey Makedonya",
  "818": "Mısır",
  "826": "Birleşik Krallık",
  "834": "Tanzanya",
  "840": "Amerika Birleşik Devletleri",
  "854": "Burkina Faso",
  "858": "Uruguay",
  "860": "Özbekistan",
  "862": "Venezuela",
  "887": "Yemen",
  "894": "Zambiya",
};

const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  "792": [35.2433, 38.9637],
  "214": [-70.1627, 18.7357],
  "840": [-98.5795, 39.8283],
  "276": [10.4515, 51.1657],
  "250": [2.2137, 46.2276],
  "826": [-3.436, 55.3781],
  "528": [5.2913, 52.1326],
  "724": [-3.7492, 40.4637],
  "380": [12.5674, 41.8719],
  "643": [105.3188, 61.524],
  "156": [104.1954, 35.8617],
  "392": [138.2529, 36.2048],
  "356": [78.9629, 20.5937],
  "076": [-51.9253, -14.235],
  "124": [-106.3468, 56.1304],
  "036": [133.7751, -25.2744],
  "784": [53.8478, 23.4241],
  "682": [45.0792, 23.8859],
};

function normalizeText(value?: string) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function getCountryId(item: GeoLocation) {
  const value = item.countryCode ?? item.code ?? item.country ?? item.name ?? "";
  const normalized = normalizeText(value);

  if (/^\d{3}$/.test(normalized)) return normalized;

  return COUNTRY_IDS[normalized] ?? "";
}

function getCountryName(item: GeoLocation) {
  return item.country ?? item.name ?? item.code ?? item.countryCode ?? "Bilinmeyen";
}

function getGeoCountryName(
  geo: GeographyItem,
  countryId: string,
  language: LanguageType
) {
  // Türkiye her dilde "Türkiye" olarak gösterilsin (İngilizce'de "Turkey" olmasın).
  if (countryId === "792") return "Türkiye";

  if (language === "tr" && COUNTRY_NAMES_TR[countryId]) {
    return COUNTRY_NAMES_TR[countryId];
  }

  return (
    geo.properties?.name ??
    geo.properties?.NAME ??
    geo.properties?.ADMIN ??
    (language === "tr" ? "Bilinmeyen ülke" : "Unknown country")
  );
}

function getPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function normalizeCityBreakdowns(
  cities: Array<{ city: string; visitors: number; percent?: number }> = [],
  countryVisitors: number
): CityBreakdown[] {
  const cityMap = new Map<string, number>();

  cities.forEach((item) => {
    const city = item.city || "Bilinmeyen Şehir";
    const visitors = Number(item.visitors || 0);

    if (!visitors) return;

    cityMap.set(city, (cityMap.get(city) ?? 0) + visitors);
  });

  return Array.from(cityMap.entries())
    .map(([city, visitors]) => ({
      city,
      visitors,
      percent: getPercent(visitors, countryVisitors),
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);
}

function mergeCityBreakdowns(
  currentCities: CityBreakdown[],
  incomingCities: CityBreakdown[],
  countryVisitors: number
): CityBreakdown[] {
  const cityMap = new Map<string, number>();

  currentCities.forEach((item) => {
    cityMap.set(item.city, (cityMap.get(item.city) ?? 0) + Number(item.visitors || 0));
  });

  incomingCities.forEach((item) => {
    cityMap.set(item.city, (cityMap.get(item.city) ?? 0) + Number(item.visitors || 0));
  });

  return Array.from(cityMap.entries())
    .map(([city, visitors]) => ({
      city,
      visitors,
      percent: getPercent(visitors, countryVisitors),
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);
}

export default function WorldMap({
  data = DEFAULT_LOCATIONS,
  className = "",
  theme = "dark",
  language = "tr",
}: WorldMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState<MapPosition>({
    coordinates: [0, 8],
    zoom: 1,
  });

  const isDark = theme === "dark";

  const totalVisitors = useMemo(() => {
    return data.reduce((sum, item) => sum + Number(item.visitors || 0), 0);
  }, [data]);

  const activeCountries = useMemo(() => {
    const countryMap = new Map<string, ActiveCountry>();

    data.forEach((item) => {
      const id = getCountryId(item);
      if (!id) return;

      const visitors = Number(item.visitors || 0);
      const incomingCities = normalizeCityBreakdowns(item.cities ?? [], visitors);
      const current = countryMap.get(id);

      if (current) {
        current.visitors += visitors;
        current.cities = mergeCityBreakdowns(
          current.cities,
          incomingCities,
          current.visitors
        );
      } else {
        countryMap.set(id, {
          id,
          name: getCountryName(item),
          visitors,
          cities: incomingCities,
        });
      }
    });

    return countryMap;
  }, [data]);

  const maxVisitors = useMemo(() => {
    return Math.max(
      1,
      ...Array.from(activeCountries.values()).map((item) => item.visitors)
    );
  }, [activeCountries]);

  function handleMouseMove(
    event: MouseEvent<SVGElement>,
    name: string,
    visitors: number,
    cities: CityBreakdown[]
  ) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();

    setTooltip({
      name,
      visitors,
      percent: getPercent(visitors, totalVisitors),
      cities,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  function zoomIn() {
    setPosition((current) => ({
      ...current,
      zoom: Math.min(current.zoom * 1.35, 6),
    }));
  }

  function zoomOut() {
    setPosition((current) => ({
      ...current,
      zoom: Math.max(current.zoom / 1.35, 1),
    }));
  }

  function resetZoom() {
    setTooltip(null);
    setPosition({
      coordinates: [0, 8],
      zoom: 1,
    });
  }

  const visitorText =
    language === "tr"
      ? "ziyaretçi"
      : tooltip?.visitors === 1
        ? "visitor"
        : "visitors";

  const footerText =
    language === "tr"
      ? "Ülkelerin üzerine gelerek ülke, şehir ve ziyaretçi dağılımını görebilirsiniz."
      : "Hover over countries to see country, city and visitor distribution.";

  return (
    <div className={`relative ${className}`}>
      <div className="absolute right-5 top-5 z-10 flex overflow-hidden rounded-lg border border-blue-950/70 bg-blue-950/60 shadow">
        <button
          type="button"
          onClick={zoomOut}
          disabled={position.zoom <= 1}
          className="h-8 w-9 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={language === "tr" ? "Haritayı uzaklaştır" : "Zoom out"}
          title={language === "tr" ? "Uzaklaştır" : "Zoom out"}
        >
          −
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="h-8 min-w-14 border-x border-blue-900 px-3 text-sm font-bold text-white transition hover:bg-blue-900"
          aria-label={language === "tr" ? "Yakınlaştırmayı sıfırla" : "Reset zoom"}
          title={language === "tr" ? "Sıfırla" : "Reset"}
        >
          {Math.round(position.zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={position.zoom >= 6}
          className="h-8 w-9 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={language === "tr" ? "Haritayı yakınlaştır" : "Zoom in"}
          title={language === "tr" ? "Yakınlaştır" : "Zoom in"}
        >
          +
        </button>
      </div>

      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 170 }}
        className="h-full w-full"
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={(nextPosition: MapPosition) => {
            setPosition(nextPosition);
          }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: GeographyItem[] }) =>
              geographies.map((geo) => {
                const countryId = String(geo.id).padStart(3, "0");
                const active = activeCountries.get(countryId);
                const visitors = active?.visitors ?? 0;
                const countryName = getGeoCountryName(geo, countryId, language);
                const intensity = active ? 0.55 + (visitors / maxVisitors) * 0.45 : 0;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseMove={(event: MouseEvent<SVGPathElement>) => {
                      handleMouseMove(event, countryName, visitors, active?.cities ?? []);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill: active
                          ? `rgba(37, 99, 235, ${intensity})`
                          : isDark
                            ? "rgba(39, 39, 42, 0.96)"
                            : "rgba(226, 232, 240, 0.98)",
                        stroke: isDark
                          ? "rgba(24, 24, 27, 1)"
                          : "rgba(203, 213, 225, 1)",
                        strokeWidth: 0.55,
                        outline: "none",
                      },
                      hover: {
                        fill: active
                          ? "rgba(59, 130, 246, 1)"
                          : isDark
                            ? "rgba(63, 63, 70, 1)"
                            : "rgba(203, 213, 225, 1)",
                        stroke: active
                          ? "rgba(147, 197, 253, 0.95)"
                          : isDark
                            ? "rgba(113, 113, 122, 1)"
                            : "rgba(148, 163, 184, 1)",
                        strokeWidth: active ? 0.9 : 0.75,
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: {
                        fill: active
                          ? "rgba(37, 99, 235, 1)"
                          : isDark
                            ? "rgba(63, 63, 70, 1)"
                            : "rgba(203, 213, 225, 1)",
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {Array.from(activeCountries.values()).map((country) => {
            const coordinates = COUNTRY_COORDINATES[country.id];

            if (!coordinates) return null;

            return (
              <Marker key={`marker-${country.id}`} coordinates={coordinates}>
                {/* hale + buyuk nokta: kucuk ada ulkeler de gorunur ve hoverlanabilir olsun */}
                <circle r={11} fill="rgba(59, 130, 246, 0.22)" stroke="none" />
                <circle
                  r={6.5}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                  onMouseMove={(event) =>
                    handleMouseMove(
                      event,
                      country.name,
                      country.visitors,
                      country.cities
                    )
                  }
                  onMouseLeave={() => setTooltip(null)}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <div
          className={`pointer-events-none absolute z-20 min-w-[220px] rounded-xl border px-3 py-2 text-xs shadow-lg ${
            isDark
              ? "border-slate-700 bg-slate-950/95 text-white"
              : "border-slate-200 bg-white/95 text-slate-950"
          }`}
          style={{
            left: Math.min(tooltip.x + 14, 620),
            top: Math.max(tooltip.y - 18, 10),
          }}
        >
          <div className="mb-1 flex items-center gap-2 font-bold">
            <span
              className={`h-2 w-2 rounded-full ${
                tooltip.visitors > 0 ? "bg-blue-400" : "bg-zinc-500"
              }`}
            />
            {tooltip.name}
          </div>

          <div className={isDark ? "text-slate-300" : "text-slate-600"}>
            {tooltip.visitors} {visitorText} ·{" "}
            {language === "tr" ? `%${tooltip.percent}` : `${tooltip.percent}%`}
          </div>

          {tooltip.cities.length > 0 && (
            <div
              className={`mt-2 space-y-1 border-t pt-2 ${
                isDark ? "border-slate-700" : "border-slate-200"
              }`}
            >
              {tooltip.cities.map((city) => (
                <div
                  key={city.city}
                  className={`whitespace-nowrap text-[11px] ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  {language === "tr"
                    ? `${city.visitors} Ziyaretçi - ${city.city} - %${city.percent}`
                    : `${city.visitors} Visitor${city.visitors === 1 ? "" : "s"} - ${city.city} - ${city.percent}%`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p
        className={`mt-2 border-t pt-3 text-center text-xs italic ${
          isDark ? "border-zinc-800 text-zinc-500" : "border-slate-200 text-slate-400"
        }`}
      >
        {footerText}
      </p>
    </div>
  );
}
