import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectFiles, projectRoot } from './project-files.mjs';
import { readReleaseMetadata } from './release-version.mjs';

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
const webDockerfile = await readFile(path.join(projectRoot, 'services/web/Dockerfile'), 'utf8');
if (!dockerfile.includes('COPY public ./public') || !webDockerfile.includes('COPY public ./public'))
  fail('Both production images must include public privacy and terms pages.');
for (const file of ['public/privacy.html', 'public/terms.html', 'web/assets/hero-bozkurt.webp'])
  await access(path.join(projectRoot, file)).catch(() =>
    fail('Public homepage asset missing: ' + file),
  );
const license = await readFile(path.join(projectRoot, 'LICENSE'), 'utf8');
if (!license.startsWith('MIT License') || !license.includes('Permission is hereby granted'))
  fail('Root MIT license missing.');
const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(path.join(projectRoot, 'package-lock.json'), 'utf8'));
if (packageInfo.name !== lock.name || packageInfo.version !== lock.version)
  fail('Package and lockfile metadata differ.');
const releases = JSON.parse(await readFile(path.join(projectRoot, 'releases.json'), 'utf8'));
if (
  releases.version !== packageInfo.version ||
  releases.releases?.[0]?.version !== packageInfo.version
)
  fail('Current release, package, and lockfile versions differ.');
const seenVersions = new Set();
const changelog = await readFile(path.join(projectRoot, 'CHANGELOG.md'), 'utf8');
for (const release of releases.releases) {
  if (seenVersions.has(release.version) || !/^\d+\.\d+\.\d+$/.test(release.version))
    fail('Duplicate or invalid release version.');
  seenVersions.add(release.version);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release.date)) fail('Invalid release date: ' + release.version);
  if (!changelog.includes(`## v${release.version} — ${release.date}`))
    fail('Changelog entry missing: ' + release.version);
  for (const language of ['tr', 'en']) {
    if (!Array.isArray(release.changes?.[language]) || release.changes[language].length === 0)
      fail('Release translation missing: ' + release.version + ' ' + language);
    if (release.changes[language].some((item) => typeof item !== 'string' || !item.trim()))
      fail('Empty release change: ' + release.version + ' ' + language);
  }
}
const environment = await readFile(path.join(projectRoot, '.env.production.example'), 'utf8');
await readReleaseMetadata(projectRoot);
const composeInputs = [...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):-/g)].map((match) => match[1]);
const exampleInputs = [...environment.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
if (
  JSON.stringify([...new Set(composeInputs)].sort()) !==
  JSON.stringify([...new Set(exampleInputs)].sort())
)
  fail('Production environment example must list exactly the configurable Compose inputs.');
if (!/^GOOGLE_CLIENT_SECRET=$/m.test(environment))
  fail('Production environment example must not include a Google client secret.');
if (!/^ADMIN_PASSWORD=$/m.test(environment))
  fail('Production environment example must not include a password or inline placeholder.');
if (!/^SMTP_PASSWORD=$/m.test(environment))
  fail('Production environment example must not include an SMTP password or inline placeholder.');
console.log(
  `Checks passed: ${javascript.length} JavaScript files; ${turkish.length} TR/EN translation keys; Docker sources; persistent single-replica compose; lockfile metadata.`,
);
