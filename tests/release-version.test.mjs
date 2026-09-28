import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  bumpRelease,
  checkRepositoryVersion,
  compareVersions,
  nextVersion,
  parseArguments,
  readReleaseMetadata,
} from '../scripts/release-version.mjs';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../scripts/release-version.mjs', import.meta.url));
const files = ['package.json', 'package-lock.json', 'releases.json', 'CHANGELOG.md', 'README.md'];
const notes = {
  tr: ['Giriş ekranı iyileştirildi.', 'Sürüm notları otomatik oluşturuldu.'],
  en: ['Improved the sign-in screen.', 'Generated release notes automatically.'],
};
const currentRelease = {
  version: '1.2.1',
  date: '2026-09-28',
  changes: { tr: ['Köy erişimi korundu.'], en: ['Protected village access.'] },
};

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-version-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('release-version-'));
    await rm(root, { recursive: true, force: true });
  });
  const initial = {
    'package.json':
      JSON.stringify(
        { name: 'release-fixture', version: '1.2.1', dependencies: { other: '4.0.0' } },
        null,
        2,
      ) + '\n',
    'package-lock.json':
      JSON.stringify(
        {
          name: 'release-fixture',
          version: '1.2.1',
          lockfileVersion: 3,
          packages: {
            '': { name: 'release-fixture', version: '1.2.1' },
            'node_modules/other': { version: '4.0.0' },
          },
        },
        null,
        2,
      ) + '\n',
    'releases.json':
      JSON.stringify({ version: '1.2.1', releases: [currentRelease] }, null, 2) + '\n',
    'CHANGELOG.md':
      '# Sürüm geçmişi / Changelog\n\nIntro text.\n\n## v1.2.1 — 2026-09-28\n\n**TR**\n\n- Köy erişimi korundu.\n\n**EN**\n\n- Protected village access.\n',
    'README.md':
      '# Fixture\n\n**Güncel sürüm / Current version: v1.2.1**\n\nCurrent UI v1.2.1; [release](https://example.com/releases/tag/v1.2.1). Other v1.2.10 stays.\n',
  };
  await Promise.all(
    Object.entries(initial).map(([file, content]) => writeFile(path.join(root, file), content)),
  );
  return root;
}

async function snapshot(root) {
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [file, await readFile(path.join(root, file), 'utf8')]),
    ),
  );
}

async function replaceJson(root, file, mutate) {
  const data = JSON.parse(await readFile(path.join(root, file), 'utf8'));
  mutate(data);
  await writeFile(path.join(root, file), JSON.stringify(data, null, 2) + '\n');
}

const bumpOptions = () => ({ kind: 'patch', ...structuredClone(notes), date: '2026-09-28' });

test('semantic versions compare numerically and reject unstable or ambiguous versions', () => {
  assert.equal(compareVersions('1.9.9', '1.10.0'), -1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('0.0.1', '0.0.1'), 0);
  for (const version of [
    'v1.2.3',
    '01.2.3',
    '1.2',
    '1.2.3-beta.1',
    '1.2.3+build',
    '1.2.9007199254740992',
  ]) {
    assert.throws(() => compareVersions(version, '1.2.3'));
  }
  assert.equal(nextVersion('1.2.9', 'patch'), '1.2.10');
  assert.equal(nextVersion('1.2.9', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.9', 'major'), '2.0.0');
  assert.throws(() => nextVersion('1.2.9', 'anything'));
});

test('bump updates package, lock roots, bilingual notes, and every current README reference', async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  const result = await bumpRelease(root, bumpOptions());
  assert.equal(result.version, '1.2.2');
  const after = await snapshot(root);
  const packageJson = JSON.parse(after['package.json']);
  const lock = JSON.parse(after['package-lock.json']);
  const history = JSON.parse(after['releases.json']);
  assert.equal(packageJson.version, '1.2.2');
  assert.equal(packageJson.dependencies.other, '4.0.0');
  assert.equal(lock.version, '1.2.2');
  assert.equal(lock.packages[''].version, '1.2.2');
  assert.equal(lock.packages['node_modules/other'].version, '4.0.0');
  assert.deepEqual(history.releases[0], { version: '1.2.2', date: '2026-09-28', changes: notes });
  assert.deepEqual(history.releases[1], currentRelease);
  assert.ok(
    after['CHANGELOG.md'].endsWith(
      before['CHANGELOG.md'].slice(before['CHANGELOG.md'].indexOf('## v1.2.1')),
    ),
  );
  assert.match(after['README.md'], /Current version: v1\.2\.2/);
  assert.match(after['README.md'], /releases\/tag\/v1\.2\.2/);
  assert.match(after['README.md'], /Other v1\.2\.10 stays/);
  assert.equal((await readReleaseMetadata(root)).version, '1.2.2');
});

test('dry-run validates a complete release without changing any file', async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  const result = await bumpRelease(root, { ...bumpOptions(), kind: 'minor', dryRun: true });
  assert.equal(result.version, '1.3.0');
  assert.equal(result.dryRun, true);
  assert.deepEqual(await snapshot(root), before);
});

test('missing bilingual notes and placeholders fail before touching files', async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  for (const changes of [
    { tr: [], en: notes.en },
    { tr: notes.tr, en: [] },
    { tr: ['TODO'], en: notes.en },
    { tr: notes.tr, en: ['placeholder'] },
    { tr: ['Giriş güncellendi.\n## new section'], en: notes.en },
  ]) {
    await assert.rejects(bumpRelease(root, { ...bumpOptions(), ...changes }));
    assert.deepEqual(await snapshot(root), before);
  }
});

test('invalid dates or backwards release dates fail without mutation', async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  for (const date of ['2026-02-30', '28/09/2026', '2026-09-27']) {
    await assert.rejects(bumpRelease(root, { ...bumpOptions(), date }));
    assert.deepEqual(await snapshot(root), before);
  }
});

test('manifest drift, duplicate releases, README drift, and missing EN notes block bump', async (t) => {
  for (const problem of ['lock', 'history', 'duplicate', 'readme', 'changelog']) {
    const root = await fixture(t);
    if (problem === 'lock')
      await replaceJson(root, 'package-lock.json', (data) => {
        data.packages[''].version = '1.1.0';
      });
    if (problem === 'history')
      await replaceJson(root, 'releases.json', (data) => {
        data.version = '1.1.0';
      });
    if (problem === 'duplicate')
      await replaceJson(root, 'releases.json', (data) => {
        data.releases.push(structuredClone(data.releases[0]));
      });
    if (problem === 'readme')
      await writeFile(path.join(root, 'README.md'), '**Current version: v1.1.0**');
    if (problem === 'changelog') {
      const text = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
      await writeFile(path.join(root, 'CHANGELOG.md'), text.replace('**EN**', '**English**'));
    }
    const before = await snapshot(root);
    await assert.rejects(bumpRelease(root, bumpOptions()), undefined, problem);
    assert.deepEqual(await snapshot(root), before, problem);
  }
});

test('CLI supports repeated language notes and safe fixture root, and rejects misspelled flags', async (t) => {
  const root = await fixture(t);
  const args = [
    'patch',
    '--root',
    root,
    '--tr',
    notes.tr[0],
    '--tr',
    notes.tr[1],
    '--en',
    notes.en[0],
    '--en',
    notes.en[1],
    '--date',
    '2026-09-28',
  ];
  assert.deepEqual(parseArguments(args).options.tr, notes.tr);
  const { stdout } = await run(process.execPath, [cli, ...args]);
  assert.equal(JSON.parse(stdout).version, '1.2.2');
  assert.deepEqual(JSON.parse((await snapshot(root))['releases.json']).releases[0].changes, notes);
  for (const args of [
    ['patch', '--eng', 'note'],
    ['patch', '--base', 'a'.repeat(40)],
    ['check', '--tr', 'note'],
    ['patch', '--root'],
  ]) {
    assert.throws(() => parseArguments(args));
  }
});

test('base commit check requires a strictly newer version and valid full SHA', async (t) => {
  const root = await fixture(t);
  await run('git', ['-c', 'init.defaultBranch=main', 'init', '--quiet'], { cwd: root });
  await run('git', ['add', '--', ...files], { cwd: root });
  await run(
    'git',
    [
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=release@example.com',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '-m',
      'fixture baseline',
    ],
    { cwd: root },
  );
  const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
  const base = stdout.trim();
  await assert.rejects(checkRepositoryVersion(root, { base }), /must be greater/);
  await assert.rejects(checkRepositoryVersion(root, { base: 'HEAD;echo unsafe' }), /40-character/);
  await assert.rejects(checkRepositoryVersion(root, { base: '0'.repeat(40) }), /40-character/);
  await bumpRelease(root, bumpOptions());
  assert.deepEqual(await checkRepositoryVersion(root, { base }), {
    version: '1.2.2',
    baseVersion: '1.2.1',
  });
  const cliResult = await run(process.execPath, [cli, 'check', '--root', root, '--base', base]);
  assert.deepEqual(JSON.parse(cliResult.stdout), { version: '1.2.2', baseVersion: '1.2.1' });
});

test('importing the CLI module causes no console output or writes', async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  const moduleUrl = new URL('../scripts/release-version.mjs', import.meta.url).href;
  const { stdout, stderr } = await run(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(moduleUrl)})`],
    { cwd: root },
  );
  assert.equal(stdout, '');
  assert.equal(stderr, '');
  assert.deepEqual(await snapshot(root), before);
});
