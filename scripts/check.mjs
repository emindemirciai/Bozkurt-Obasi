import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectFiles, projectRoot } from './project-files.mjs';

const fail = (message) => {
  throw new Error(message);
};
const files = await projectFiles();
const javascript = files.filter(
  (file) =>
    /\.(?:mjs|js|cjs)$/.test(file) &&
    (/^(?:web|shared|server\/web|services\/admin|scripts|tests)\//.test(file) ||
      !file.includes('/')),
);
for (const file of javascript) {
  const result = spawnSync(process.execPath, ['--check', path.join(projectRoot, file)], {
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(`${file}\n${result.stderr || result.error}`);
}
const { translations } = await import(pathToFileURL(path.join(projectRoot, 'web/i18n.mjs')));
const turkish = Object.keys(translations.tr).sort();
const english = Object.keys(translations.en).sort();
if (JSON.stringify(turkish) !== JSON.stringify(english)) fail('TR/EN translation keys differ.');
for (const key of turkish) {
  for (const locale of ['tr', 'en']) {
    if (typeof translations[locale][key] !== 'string' || translations[locale][key].trim() === '')
      fail(`Empty translation: ${locale}.${key}`);
  }
  const placeholders = (value) => (value.match(/\{[\w]+\}/g) || []).sort().join(',');
  if (placeholders(translations.tr[key]) !== placeholders(translations.en[key]))
    fail(`Translation placeholders differ: ${key}`);
}
const dockerfile = await readFile(path.join(projectRoot, 'Dockerfile'), 'utf8');
for (const line of dockerfile
  .split('\n')
  .filter((line) => /^COPY\s/.test(line) && !line.includes('--from='))) {
  const sources = line
    .replace(/^COPY\s+/, '')
    .split(/\s+/)
    .filter((token) => !token.startsWith('--'))
    .slice(0, -1);
  for (const source of sources)
    await access(path.join(projectRoot, source)).catch(() =>
      fail(`Docker COPY source missing: ${source}`),
    );
}
if (!/USER node/.test(dockerfile)) fail('Production container must run as node user.');
if (!dockerfile.includes('/api/health')) fail('Container health route missing.');
const compose = await readFile(path.join(projectRoot, 'compose.yml'), 'utf8');
const dokployCompose = await readFile(path.join(projectRoot, 'docker-compose.yml'), 'utf8');
if (compose !== dokployCompose) fail('Dokploy docker-compose.yml must match compose.yml.');
for (const expected of [
  'game-data:/data',
  'DATABASE_PATH: /data/game.sqlite',
  'replicas: 1',
  '"3000"',
]) {
  if (!compose.includes(expected)) fail(`Compose requirement missing: ${expected}`);
}
for (const service of ['web', 'api', 'admin', 'analyze']) {
  if (!new RegExp('^  ' + service + ':', 'm').test(compose))
    fail('Compose service missing: ' + service);
}
for (const file of [
  'services/web/Dockerfile',
  'services/admin/Dockerfile',
  'services/analyze/Dockerfile',
  'services/analyze/LICENSE',
]) {
  await access(path.join(projectRoot, file)).catch(() => fail('Service source missing: ' + file));
}
const license = await readFile(path.join(projectRoot, 'LICENSE'), 'utf8');
if (!license.startsWith('MIT License') || !license.includes('Permission is hereby granted'))
  fail('Root MIT license missing.');
const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(projectRoot, 'package-lock.json'), 'utf8'));
if (packageInfo.name !== lock.name || packageInfo.version !== lock.version)
  fail('Package and lockfile metadata differ.');
console.log(
  `Checks passed: ${javascript.length} JavaScript files; ${turkish.length} TR/EN translation keys; Docker sources; persistent single-replica compose; lockfile metadata.`,
);
