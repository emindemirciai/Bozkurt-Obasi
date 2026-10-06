import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const image = process.argv[2] || 'bozkurt-obasi:local';
const name = `bozkurt-smoke-${randomBytes(5).toString('hex')}`;
const volume = `${name}-data`;
function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 60_000 });
  if (result.status !== 0 && !allowFailure)
    throw new Error(`docker ${args.join(' ')} failed\n${result.stderr || result.error}`);
  return result.stdout?.trim() || '';
}
async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {
      /* Wait for the process to bind and open SQLite. */
    }
    await delay(250);
  }
  throw new Error('Container did not become healthy.');
}
let created = false;
function containerUrl() {
  const binding = JSON.parse(
    docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]),
  );
  return `http://127.0.0.1:${binding['3000/tcp'][0].HostPort}`;
}
try {
  docker(['volume', 'create', volume]);
  docker([
    'run',
    '-d',
    '--name',
    name,
    '--read-only',
    '--tmpfs',
    '/tmp:size=32m,mode=1777',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges:true',
    '-p',
    '127.0.0.1::3000',
    '-v',
    `${volume}:/data`,
    image,
  ]);
  created = true;
  let baseUrl = containerUrl();
  await waitForHealth(baseUrl);
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200, 'Production HTML must load.');
  assert.match(await page.text(), /<html/i);
  const authResponse = await fetch(`${baseUrl}/api/auth/google/status`);
  assert.equal(authResponse.status, 200, 'Google sign-in status must load.');
  assert.deepEqual(await authResponse.json(), {
    enabled: false,
    authenticated: false,
    reason: 'not_configured',
  });
  const playerStatus = await fetch(`${baseUrl}/api/auth/player/status`);
  const playerConfig = await playerStatus.json();
  assert.equal(playerStatus.status, 200);
  assert.equal(playerConfig.emailEnabled, true, 'Email accounts work without Google keys.');
  assert.equal(
    playerConfig.mailEnabled,
    false,
    'Without SMTP, email verification remains unavailable.',
  );
  assert.equal(playerConfig.authenticated, false);
  const recovery = await fetch(`${baseUrl}/api/auth/player/password/reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'recovery@example.com' }),
  });
  assert.equal(recovery.status, 503, 'Recovery must require SMTP in the production image.');
  assert.equal((await recovery.json()).error, 'mail_unavailable');
  const sessionResponse = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(sessionResponse.status, 401, 'A guest must not reach the village.');
  assert.equal(
    sessionResponse.headers.get('set-cookie'),
    null,
    'A guest cookie must not be created.',
  );
  const mutationResponse = await fetch(`${baseUrl}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: { type: 'build', building: 'quarry' },
      revision: 0,
    }),
  });
  assert.equal(mutationResponse.status, 401, 'A guest must not mutate a village.');
  const credentials = {
    email: `${name}@example.com`,
    password: randomBytes(24).toString('base64url'),
    name: 'Container Player',
  };
  const registration = await fetch(`${baseUrl}/api/auth/player/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  assert.equal(registration.status, 201, 'Email registration must work in the production image.');
  const registered = await registration.json();
  assert.equal(registered.authenticated, false);
  assert.equal(registered.verificationRequired, true);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await fetch(`${baseUrl}/api/state`, { headers: { Cookie: cookie } })).status,
    403,
    'An unverified account must not play.',
  );
  // This isolated smoke volume has no SMTP. Seed a verified test fixture directly;
  // production has no HTTP route or environment setting to bypass verification.
  docker([
    'exec',
    name,
    'node',
    '--input-type=module',
    '-e',
    "import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync('/data/game.sqlite');db.prepare('UPDATE email_accounts SET email_verified=1 WHERE email=?').run(process.argv[1]);db.close();",
    credentials.email,
  ]);
  const current = await fetch(`${baseUrl}/api/state`, { headers: { Cookie: cookie } });
  const village = await current.json();
  const construction = await fetch(`${baseUrl}/api/action`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: { type: 'build', building: 'quarry' },
      revision: village.revision,
    }),
  });
  assert.equal(construction.status, 200);
  const saved = await construction.json();
  docker(['restart', name]);
  // Docker may allocate a different ephemeral host port after a restart.
  baseUrl = containerUrl();
  await waitForHealth(baseUrl);
  const restoredResponse = await fetch(`${baseUrl}/api/state`);
  assert.equal(restoredResponse.status, 401, 'The village gate must survive container restart.');
  const signedIn = await fetch(`${baseUrl}/api/auth/player/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  assert.equal(signedIn.status, 200, 'Email account must survive container restart.');
  const renewedCookie = signedIn.headers.get('set-cookie').split(';')[0];
  assert.notEqual(renewedCookie, cookie);
  const resumedResponse = await fetch(`${baseUrl}/api/state`, {
    headers: { Cookie: renewedCookie },
  });
  assert.equal(resumedResponse.status, 200);
  const resumed = await resumedResponse.json();
  assert.deepEqual(resumed.state.buildings, saved.state.buildings, 'Account village must persist.');
  assert.ok(resumed.revision >= saved.revision);
  const logout = await fetch(`${baseUrl}/api/auth/player/logout`, {
    method: 'POST',
    headers: { Cookie: renewedCookie, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(logout.status, 200);
  assert.equal(
    (await fetch(`${baseUrl}/api/state`, { headers: { Cookie: renewedCookie } })).status,
    401,
    'Logged-out player cookies must not reopen the village.',
  );
  console.log(
    'Container smoke passed: non-root read-only runtime, health, guest denial, email registration/login, saved village across restart, cookie rotation and logout.',
  );
} catch (error) {
  if (created) console.error(docker(['logs', name], true));
  throw error;
} finally {
  if (created) docker(['rm', '-f', name], true);
  docker(['volume', 'rm', volume], true);
}
