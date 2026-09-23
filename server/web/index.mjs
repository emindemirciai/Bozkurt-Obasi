import { resolve } from 'node:path';
import { createApp } from './app.mjs';
import { analyticsConfig } from './analytics.mjs';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be between 1 and 65535');

const app = createApp({
  ...(process.env.DATABASE_PATH
    ? { dbPath: resolve(process.env.DATABASE_PATH) }
    : process.env.DATA_DIR
      ? { dbPath: resolve(process.env.DATA_DIR, 'game.sqlite') }
      : {}),
  ...(process.env.STATIC_DIR ? { staticDir: resolve(process.env.STATIC_DIR) } : {}),
  trustProxy: process.env.TRUST_PROXY === 'true',
  analytics: analyticsConfig(process.env),
});
await app.listen(port, host);
console.log(`Bozkurt Obası: Ay-Yıldız Nöbeti available at http://${host}:${port}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => {
    app.server.closeAllConnections();
  }, 10_000);
  timeout.unref();
  try {
    await app.close();
  } finally {
    clearTimeout(timeout);
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
