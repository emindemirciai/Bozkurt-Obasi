import { promises as fs } from "fs";
import path from "path";

export type StoredAnalyzeEvent = {
  id: string;
  site: string;
  eventType: "pageview" | "duration";
  createdAt: string;
  updatedAt: string;
  visitorId: string;
  sessionId: string;
  url: string;
  path: string;
  referrer: string;
  userAgent: string;
  browser: string;
  country: string;
  countryCode?: string;
  countryIso2?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  language?: string;
  timezone?: string;
  screen?: string;
  duration?: number;
};

const DATA_DIR = process.env.ANALYZE_DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "analyze-events.json");
const MAX_EVENTS = Number(process.env.ANALYZE_MAX_EVENTS || 20000);
let writeQueue: Promise<unknown> = Promise.resolve();

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

export async function readAnalyzeEvents() {
  await ensureDataFile();

  const fileContent = await fs.readFile(DATA_FILE, "utf-8");

  try {
    const parsed = JSON.parse(fileContent);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is StoredAnalyzeEvent => {
      return typeof item === "object" && item !== null;
    });
  } catch {
    return [];
  }
}

async function saveAnalyzeEventNow(event: StoredAnalyzeEvent) {
  const events = await readAnalyzeEvents();

  const existingIndex = events.findIndex((item) => item.id === event.id);

  if (existingIndex >= 0) {
    events[existingIndex] = {
      ...events[existingIndex],
      ...event,
      createdAt: events[existingIndex].createdAt,
      updatedAt: new Date().toISOString(),
    };
  } else {
    events.push(event);
  }

  const limitedEvents = events
    .sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .slice(-MAX_EVENTS);

  const temporaryFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(limitedEvents, null, 2), "utf-8");
  await fs.rename(temporaryFile, DATA_FILE);

  return event;
}

export function saveAnalyzeEvent(event: StoredAnalyzeEvent) {
  const operation = writeQueue.then(() => saveAnalyzeEventNow(event));
  writeQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}
