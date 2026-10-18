import { writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const RETRY_DELAYS = Object.freeze([50, 100, 200, 400]);
const TRANSIENT_CODES = new Set(['UNKNOWN', 'EBUSY', 'EPERM']);

/** Windows file scanners can briefly lock generated previews. All failures remain fatal. */
export async function writePreview(
  path,
  content,
  encoding = 'utf8',
  { writer = writeFile, wait = setTimeout } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await writer(path, content, encoding);
    } catch (error) {
      if (!TRANSIENT_CODES.has(error?.code) || attempt >= RETRY_DELAYS.length) throw error;
      await wait(RETRY_DELAYS[attempt]);
    }
  }
}
