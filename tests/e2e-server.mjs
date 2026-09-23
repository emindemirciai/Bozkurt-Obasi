import { createApp } from '../server/web/app.mjs';
import { analyticsConfig } from '../server/web/analytics.mjs';
const app = createApp({
  dbPath: ':memory:',
  rateLimit: 2000,
  analytics: analyticsConfig({ ANALYZE_ENABLED: 'true' }),
});
await app.listen(4173);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
