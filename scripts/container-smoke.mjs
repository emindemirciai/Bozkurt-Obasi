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
  docker(['restart', name]);
  // Docker may allocate a different ephemeral host port after a restart.
  baseUrl = containerUrl();
  await waitForHealth(baseUrl);
  const restoredResponse = await fetch(`${baseUrl}/api/state`);
  assert.equal(restoredResponse.status, 401, 'The village gate must survive container restart.');
  console.log(
    'Container smoke passed: non-root read-only runtime, HTTP health, production HTML, Google status, guest access denied before and after restart.',
  );
} catch (error) {
  if (created) console.error(docker(['logs', name], true));
  throw error;
} finally {
  if (created) docker(['rm', '-f', name], true);
  docker(['volume', 'rm', volume], true);
}
