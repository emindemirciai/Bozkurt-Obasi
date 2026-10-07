import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const [
  webImage = 'bozkurt-obasi-web',
  adminImage = 'bozkurt-obasi-admin',
  apiImage = 'bozkurt-obasi-api',
] = process.argv.slice(2);
const prefix = `bozkurt-proxy-${randomBytes(5).toString('hex')}`;
const network = `${prefix}-net`;
const containers = [];

function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 60_000 });
  if (result.status !== 0 && !allowFailure)
    throw new Error(`Docker proxy smoke failed: ${result.stderr || result.error}`);
  return result.stdout?.trim() || '';
}

function run(name, image, options = [], command = []) {
  containers.push(name);
  docker(['run', '-d', '--name', name, '--network', network, ...options, image, ...command]);
}

function inspect(name) {
  return JSON.parse(docker(['inspect', name]))[0];
}

async function until(check, label) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if (await check()) return;
    } catch {
      /* Wait for binding or Docker DNS refresh. */
    }
    await delay(250);
  }
  throw new Error(`Timed out: ${label}`);
}

function startApi(name, marker) {
  const server = `require('node:http').createServer(async (req,res)=>{
    let bytes=0; for await(const chunk of req) bytes+=chunk.length;
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({marker:${JSON.stringify(marker)},url:req.url,method:req.method,bytes,
      authorization:req.headers.authorization,proto:req.headers['x-forwarded-proto']}));
  }).listen(3000,'0.0.0.0');`;
  run(name, apiImage, ['--network-alias', 'api', '--entrypoint', 'node'], ['-e', server]);
}

try {
  docker(['network', 'create', network]);
  const proxies = [];
  for (const [service, image] of [
    ['web', webImage],
    ['admin', adminImage],
  ]) {
    const name = `${prefix}-${service}`;
    run(name, image, ['-p', '127.0.0.1::3000']);
    const details = inspect(name);
    const base = `http://127.0.0.1:${details.NetworkSettings.Ports['3000/tcp'][0].HostPort}`;
    await until(
      async () =>
        (await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(1500) })).status === 200,
      `${service} starts without API DNS`,
    );
    assert.equal(
      (await fetch(base)).status,
      200,
      `${service} static page stays available without API`,
    );
    assert.equal(
      (await fetch(`${base}/api/health`)).status,
      502,
      `${service} cannot authenticate without API`,
    );
    proxies.push({ name, base, startedAt: inspect(name).State.StartedAt });
  }

  const firstApi = `${prefix}-api-first`;
  startApi(firstApi, 'first');
  for (const { base } of proxies) {
    await until(
      async () =>
        (await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) })).json())
          .marker === 'first',
      'API appears after proxy startup',
    );
    const response = await fetch(`${base}/api/auth/login?return=%2Fvillage&lang=en`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer smoke-token',
        'X-Forwarded-Proto': 'https',
      },
      body: '{"test":true}',
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.url, '/api/auth/login?return=%2Fvillage&lang=en');
    assert.equal(payload.method, 'POST');
    assert.equal(payload.authorization, 'Bearer smoke-token');
    assert.equal(payload.proto, 'https');
    assert.equal(payload.bytes, 13);
  }

  const photoBody = 'x'.repeat(64 * 1024);
  const web = proxies[0];
  assert.equal(
    (await fetch(`${web.base}/api/auth/login`, { method: 'POST', body: photoBody })).status,
    413,
    'Generic API body limit stays small',
  );
  const photo = await fetch(`${web.base}/api/player/profile`, { method: 'PATCH', body: photoBody });
  assert.equal(photo.status, 200, 'Profile photo route keeps its larger body limit');
  assert.equal((await photo.json()).bytes, photoBody.length);

  const oldIp = inspect(firstApi).NetworkSettings.Networks[network].IPAddress;
  docker(['rm', '-f', firstApi]);
  run(
    `${prefix}-old-address`,
    apiImage,
    ['--ip', oldIp, '--entrypoint', 'node'],
    ['-e', 'setInterval(()=>{},1000)'],
  );
  const replacement = `${prefix}-api-replacement`;
  startApi(replacement, 'replacement');
  assert.notEqual(
    inspect(replacement).NetworkSettings.Networks[network].IPAddress,
    oldIp,
    'Replacement must use a different IP',
  );
  for (const { name, base, startedAt } of proxies) {
    await until(
      async () =>
        (await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) })).json())
          .marker === 'replacement',
      'Proxy resolves replacement API IP',
    );
    assert.equal(inspect(name).State.StartedAt, startedAt, 'Proxy must recover without restart');
  }
  console.log(
    'Web/admin proxy smoke passed: startup without API, forwarded path/query/auth, photo limits, API IP replacement without proxy restart.',
  );
} finally {
  for (const name of containers.reverse()) docker(['rm', '-f', name], true);
  docker(['network', 'rm', network], true);
}
