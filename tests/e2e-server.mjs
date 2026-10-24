import { createServer } from 'node:http';
import { createApp } from '../server/web/app.mjs';
import { createAdminGateway } from './admin-gateway.mjs';
import { analyticsConfig } from '../server/web/analytics.mjs';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { validateGame } from '../shared/game.mjs';

const fixtureDirectory = await mkdtemp(join(tmpdir(), 'bozkurt-browser-fixture-'));
const dbPath = join(fixtureDirectory, 'game.sqlite');
let fixtureDatabase;

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
  const [nonce, identity, encodedEmail] = code.split('.');
  if (!nonce || !/^[a-f0-9-]{36}$/.test(identity))
    return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  // Explicit email fixtures exist only in this signed test provider, never in production.
  const email = encodedEmail
    ? Buffer.from(encodedEmail, 'base64url').toString('utf8')
    : `player-${identity}@example.com`;
  if (email.length > 254 || !/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))
    return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  return new Response(
    JSON.stringify({
      id_token: jwt({
        iss: 'https://accounts.google.com',
        aud: clientId,
        sub: `e2e-${identity}`,
        email,
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
const messages = new Map();
const inbox = createServer(async (request, response) => {
  // This loopback-only fixture API is compiled only by the test runner. The live app
  // has no save upload endpoint; each real-account test explicitly requests a grant.
  if (request.url === '/fixture/state') {
    const reply = (status, payload) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(payload));
    };
    if (
      request.method !== 'POST' ||
      request.headers['x-bozkurt-test-fixture'] !== 'explicit-e2e-fixture' ||
      request.headers.origin ||
      request.socket.remoteAddress !== '127.0.0.1'
    )
      return reply(403, { error: 'fixture_forbidden' });
    try {
      const token = /(?:^|;\s*)bozkurt_session=([^;]+)/.exec(request.headers.cookie || '')?.[1];
      const session =
        token &&
        fixtureDatabase
          .prepare('SELECT account_sub, account_provider FROM sessions WHERE token_hash=?')
          .get(createHash('sha256').update(token).digest('hex'));
      if (!session || session.account_provider !== 'google')
        return reply(401, { error: 'fixture_session_required' });
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 1_000_000) return reply(413, { error: 'fixture_too_large' });
      }
      const { state } = JSON.parse(body);
      if (!validateGame(state)) return reply(400, { error: 'invalid_fixture' });
      fixtureDatabase
        .prepare(
          'UPDATE google_accounts SET state_json=?, revision=revision+1, updated_at=? WHERE sub=?',
        )
        .run(JSON.stringify(state), state.updatedAt, session.account_sub);
      const account = fixtureDatabase
        .prepare('SELECT revision FROM google_accounts WHERE sub=?')
        .get(session.account_sub);
      return reply(200, { state, revision: account.revision });
    } catch {
      return reply(400, { error: 'invalid_fixture' });
    }
  }
  const email = new URL(request.url, 'http://localhost').searchParams.get('email');
  const message = messages.get(email);
  response.writeHead(message ? 200 : 404, { 'Content-Type': 'application/json' });
  response.end(
    JSON.stringify(
      message ? { code: /code: ([0-9]{6})/.exec(message.text)[1] } : { error: 'not_found' },
    ),
  );
});
await new Promise((resolve) => inbox.listen(4174, '127.0.0.1', resolve));
const app = createApp({
  dbPath,
  adminEmail: 'admin@example.com',
  adminPassword: 'e2e-admin-password-2026',
  mailProvider: 'smtp',
  smtpHost: 'smtp.hostinger.com',
  smtpPort: '465',
  smtpSecure: 'true',
  smtpUser: 'info@bozkurtobasi.com',
  smtpPassword: 'test-only-secret',
  publicUrl: 'http://127.0.0.1:4173',
  mailSender: async (message) => {
    messages.set(message.to, message);
  },
  rateLimit: 2000,
  // Simulate the trusted gateway; browser scenarios can use distinct documentation IPs.
  trustProxy: true,
  analytics: analyticsConfig({ ANALYZE_ENABLED: 'true' }),
  googleClientId: clientId,
  googleClientSecret: 'e2e-only-secret',
  googleRedirectUris: 'http://127.0.0.1:4173/api/auth/google/callback',
  googleFetch,
});
fixtureDatabase = new DatabaseSync(dbPath);
await app.listen(4173);
const adminGateway = await createAdminGateway(4173, 4175);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    inbox.close();
    await adminGateway.close();
    await app.close();
    fixtureDatabase.close();
    const cleanupTarget = resolve(fixtureDirectory);
    const tempRoot = resolve(tmpdir()) + sep;
    if (
      cleanupTarget.startsWith(tempRoot) &&
      cleanupTarget.slice(tempRoot.length).startsWith('bozkurt-browser-fixture-')
    )
      await rm(cleanupTarget, { recursive: true, force: true });
    process.exit(0);
  });
