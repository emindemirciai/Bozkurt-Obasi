import { execFile } from 'node:child_process';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { extractReleaseNotes } from './release-notes.mjs';

const runFile = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const releaseFiles = [
  'package.json',
  'package-lock.json',
  'releases.json',
  'CHANGELOG.md',
  'README.md',
];

export function parseVersion(version) {
  if (
    typeof version !== 'string' ||
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version)
  ) {
    throw new Error(`Expected a stable semantic version, received: ${version}`);
  }
  const parts = version.split('.').map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part)))
    throw new Error('Version component exceeds the safe integer range');
  return parts;
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

export function nextVersion(version, kind) {
  const parts = parseVersion(version);
  const index = { major: 0, minor: 1, patch: 2 }[kind];
  if (index === undefined) throw new Error('Bump must be patch, minor, or major');
  parts[index] += 1;
  for (let i = index + 1; i < 3; i += 1) parts[i] = 0;
  const result = parts.join('.');
  parseVersion(result);
  return result;
}

function validDate(date) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid release date: ${date}`);
  }
  return date;
}

function validateNotes(notes, language) {
  if (!Array.isArray(notes) || notes.length === 0)
    throw new Error(`At least one ${language} release note is required`);
  return notes.map((note) => {
    if (typeof note !== 'string' || !note.trim() || /[\r\n]/.test(note))
      throw new Error(`Invalid ${language} release note`);
    const text = note.trim();
    if (
      /(?:^|\b)(?:TODO|TBD|FIXME|placeholder|lorem ipsum|change me|to be added|yer tutucu)(?:\b|$)/iu.test(
        text,
      )
    ) {
      throw new Error(`Placeholder ${language} release notes are not allowed`);
    }
    return text;
  });
}

export function changelogRelease(changelog, version) {
  parseVersion(version);
  const section = extractReleaseNotes(changelog, version);
  const heading = section
    .split('\n')[0]
    .match(/^##\s+v?(\d+\.\d+\.\d+)\s+[—-]\s+(\d{4}-\d{2}-\d{2})\s*$/);
  if (!heading) throw new Error('Release heading must use ## vMAJOR.MINOR.PATCH — YYYY-MM-DD');
  const latest = changelog.match(/^##\s+v?(\d+\.\d+\.\d+)\s+[—-]/m)?.[1];
  if (latest !== version)
    throw new Error('The latest changelog section must match the package version');
  const body = section.slice(section.indexOf('\n') + 1).trim();
  const tr = body.match(/^\*\*TR\*\*\s*\n([\s\S]*?)(?=^\*\*EN\*\*)/m);
  const en = body.match(/^\*\*EN\*\*\s*\n([\s\S]*)$/m);
  if (!tr || !en) throw new Error(`v${version} changelog needs both **TR** and **EN** sections`);
  const notes = (text, language) =>
    validateNotes(
      [...text.matchAll(/^[-*]\s+(.+)$/gm)].map((item) => item[1]),
      language,
    );
  return {
    version,
    date: validDate(heading[2]),
    body,
    changes: { tr: notes(tr[1], 'TR'), en: notes(en[1], 'EN') },
  };
}

async function sourceSnapshot(root) {
  const entries = await Promise.all(
    releaseFiles.map(async (file) => [file, await readFile(path.join(root, file), 'utf8')]),
  );
  return Object.fromEntries(entries);
}

function metadataFromSources(sources) {
  const manifest = JSON.parse(sources['package.json']);
  const lock = JSON.parse(sources['package-lock.json']);
  const history = JSON.parse(sources['releases.json']);
  const version = manifest.version;
  parseVersion(version);
  if (lock.version !== version || lock.packages?.['']?.version !== version)
    throw new Error('package-lock.json root versions must match package.json');
  if (history.version !== version || history.releases?.[0]?.version !== version)
    throw new Error('releases.json latest version must match package.json');
  const versions = new Set();
  for (const release of history.releases) {
    parseVersion(release.version);
    if (versions.has(release.version))
      throw new Error(`Duplicate release version: ${release.version}`);
    versions.add(release.version);
    validDate(release.date);
    validateNotes(release.changes?.tr, 'TR');
    validateNotes(release.changes?.en, 'EN');
  }
  const changelog = changelogRelease(sources['CHANGELOG.md'], version);
  if (changelog.date !== history.releases[0].date)
    throw new Error('Current changelog and releases.json dates must match');
  const readmeVersion = sources['README.md'].match(/Current version:\s*v?(\d+\.\d+\.\d+)/i)?.[1];
  if (readmeVersion !== version) throw new Error('README current version must match package.json');
  return { version, manifest, lock, history, changelog };
}

export async function readReleaseMetadata(root = projectRoot) {
  return metadataFromSources(await sourceSnapshot(root));
}

export async function checkRepositoryVersion(root = projectRoot, { base } = {}) {
  const metadata = await readReleaseMetadata(root);
  if (base !== undefined) {
    if (!/^[a-f0-9]{40}$/i.test(base) || /^0+$/.test(base))
      throw new Error('--base must be a real 40-character commit SHA');
    const { stdout } = await runFile('git', ['show', `${base}:package.json`], {
      cwd: root,
      maxBuffer: 2 * 1024 * 1024,
    });
    const oldVersion = JSON.parse(stdout).version;
    if (compareVersions(metadata.version, oldVersion) <= 0) {
      throw new Error(
        `Current version ${metadata.version} must be greater than base version ${oldVersion}`,
      );
    }
    return { version: metadata.version, baseVersion: oldVersion };
  }
  return { version: metadata.version };
}

// Stage all files before replacing any; validation never writes and replacement failures restore originals.
async function writeSnapshot(root, before, after) {
  const suffix = `.release-${process.pid}-${Date.now()}.tmp`;
  const staged = [];
  const replaced = [];
  try {
    for (const file of releaseFiles) {
      const temporary = path.join(root, file + suffix);
      staged.push(temporary);
      await writeFile(temporary, after[file], { flag: 'wx' });
    }
    for (const file of releaseFiles) {
      replaced.push(file);
      await rename(path.join(root, file + suffix), path.join(root, file));
    }
  } catch (error) {
    const failures = [];
    for (const file of replaced) {
      try {
        await writeFile(path.join(root, file), before[file]);
      } catch (restoreError) {
        failures.push(restoreError);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        'Release write failed; some files could not be restored',
      );
    throw error;
  } finally {
    await Promise.all(staged.map((temporary) => rm(temporary, { force: true })));
  }
}

export async function bumpRelease(
  root = projectRoot,
  { kind, tr, en, date = new Date().toISOString().slice(0, 10), dryRun = false } = {},
) {
  const notes = { tr: validateNotes(tr, 'TR'), en: validateNotes(en, 'EN') };
  validDate(date);
  const before = await sourceSnapshot(root);
  const metadata = metadataFromSources(before);
  const version = nextVersion(metadata.version, kind);
  if (date < metadata.history.releases[0].date)
    throw new Error('The new release date cannot precede the latest release');
  metadata.manifest.version = version;
  metadata.lock.version = version;
  metadata.lock.packages[''].version = version;
  metadata.history.version = version;
  metadata.history.releases.unshift({ version, date, changes: notes });
  const section = [
    `## v${version} — ${date}`,
    '',
    '**TR**',
    '',
    ...notes.tr.map((note) => `- ${note}`),
    '',
    '**EN**',
    '',
    ...notes.en.map((note) => `- ${note}`),
    '',
  ].join('\n');
  const start = before['CHANGELOG.md'].search(/^##\s+v?\d+\.\d+\.\d+\s+[—-]/m);
  const oldVersionPattern = new RegExp(
    `v${metadata.version.replaceAll('.', '\\.')}((?![\\d.]))`,
    'g',
  );
  const after = {
    'package.json': JSON.stringify(metadata.manifest, null, 2) + '\n',
    'package-lock.json': JSON.stringify(metadata.lock, null, 2) + '\n',
    'releases.json': JSON.stringify(metadata.history, null, 2) + '\n',
    'CHANGELOG.md':
      before['CHANGELOG.md'].slice(0, start) + section + '\n' + before['CHANGELOG.md'].slice(start),
    'README.md': before['README.md'].replace(oldVersionPattern, `v${version}`),
  };
  metadataFromSources(after);
  if (!dryRun) await writeSnapshot(root, before, after);
  return { version, previousVersion: metadata.version, dryRun, files: releaseFiles };
}

export function parseArguments(args) {
  const [command, ...remaining] = args;
  if (!['patch', 'minor', 'major', 'check'].includes(command))
    throw new Error(
      'Usage: release-version.mjs patch|minor|major --tr "note" --en "note" [--dry-run] [--root path], or check [--base SHA]',
    );
  const options = { kind: command, tr: [], en: [], root: projectRoot, dryRun: false };
  const singleton = new Set();
  for (let index = 0; index < remaining.length; index += 1) {
    const argument = remaining[index];
    if (argument === '--dry-run') {
      if (command === 'check') throw new Error('--dry-run applies only to a version bump');
      options.dryRun = true;
      continue;
    }
    const key = {
      '--tr': 'tr',
      '--en': 'en',
      '--root': 'root',
      '--base': 'base',
      '--date': 'date',
    }[argument];
    const value = remaining[++index];
    if (!key || !value || value.startsWith('--'))
      throw new Error(`Unknown argument or missing value: ${argument}`);
    if (command === 'check' && ['tr', 'en', 'date'].includes(key))
      throw new Error(`${argument} does not apply to check`);
    if (command !== 'check' && key === 'base') throw new Error('--base applies only to check');
    if (['tr', 'en'].includes(key)) options[key].push(value);
    else {
      if (singleton.has(key)) throw new Error(`Repeated option: ${argument}`);
      singleton.add(key);
      options[key] = key === 'root' ? path.resolve(value) : value;
    }
  }
  return { command, options };
}

export async function main(args = process.argv.slice(2)) {
  const { command, options } = parseArguments(args);
  const result =
    command === 'check'
      ? await checkRepositoryVersion(options.root, options)
      : await bumpRelease(options.root, options);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Release version error: ${error.message}`);
    process.exitCode = 1;
  });
}
