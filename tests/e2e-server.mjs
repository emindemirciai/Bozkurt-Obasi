import { createApp } from '../server/web/app.mjs';
import { analyticsConfig } from '../server/web/analytics.mjs';
import { generateKeyPairSync, sign } from 'node:crypto';

const clientId = '1234567890.apps.googleusercontent.com';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'e2e-key', alg: 'RS256' };
function jwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'e2e-key' })).toString(
    'base64url',
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const input = `${header}.${payload}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}
async function googleFetch(url, options) {
  if (url === 'https://www.googleapis.com/oauth2/v3/certs')
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  if (url !== 'https://oauth2.googleapis.com/token') throw new Error('Unexpected OAuth endpoint');
  const code = new URLSearchParams(options.body).get('code') || '';
  const [nonce, identity] = code.split('.');
  if (!nonce || !/^[a-f0-9-]{36}$/.test(identity))
    return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  return new Response(
    JSON.stringify({
      id_token: jwt({
        iss: 'https://accounts.google.com',
        aud: clientId,
        sub: `e2e-${identity}`,
        email: `player-${identity}@example.com`,
        email_verified: true,
        name: 'Player One',
        nonce,
        iat: now,
        exp: now + 3600,
      }),
    }),
    { status: 200 },
  );
}
const app = createApp({
  dbPath: ':memory:',
  rateLimit: 2000,
  analytics: analyticsConfig({ ANALYZE_ENABLED: 'true' }),
  googleClientId: clientId,
  googleClientSecret: 'e2e-only-secret',
  googleRedirectUris: 'http://127.0.0.1:4173/api/auth/google/callback',
  googleFetch,
});
await app.listen(4173);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
