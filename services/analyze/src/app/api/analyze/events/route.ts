import { readAnalyzeEvents } from "../../../../lib/analyzeStore";
import { getAnalyzeSiteConfig } from "../../../../lib/siteConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RangeType = "24h" | "7d" | "30d";

function getRangeStartDate(range: RangeType) {
  const now = new Date();
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

function normalizeRange(value: string | null): RangeType {
  if (value === "7d" || value === "30d") return value;
  return "24h";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const requestedSite = url.searchParams.get("site")?.trim().toLowerCase();
  const deploymentSite = getAnalyzeSiteConfig();
  const visibleSites = requestedSite && deploymentSite.eventSites.includes(requestedSite)
    ? [requestedSite]
    : deploymentSite.eventSites;

  const all = rangeParam === "all";
  const range = normalizeRange(rangeParam);
  const startDate = getRangeStartDate(range);
  const events = await readAnalyzeEvents();

  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.createdAt);

    if (Number.isNaN(eventDate.getTime())) return false;
    if (!all && eventDate < startDate) return false;
    if (!visibleSites.includes(event.site.trim().toLowerCase())) return false;

    return event.eventType !== "duration";
  });

  return Response.json(
    {
      ok: true,
      range: all ? "all" : range,
      events: filteredEvents,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
