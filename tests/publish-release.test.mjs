import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publishRelease, runCommand, verifyReleaseAssets } from '../scripts/publish-release.mjs';

const sha = 'a'.repeat(40);
const object = 'b'.repeat(40);
const otherSha = 'c'.repeat(40);
const repository = 'example/Bozkurt-Obasi';
const tag = 'v1.2.3';
const releaseUrl = `https://github.com/${repository}/releases/tag/${tag}`;
const archiveName = `Bozkurt-Obasi-${tag}-20260928-120000.zip`;
const notes = '## v1.2.3 — 2026-09-28\n\n**TR**\n- Türkçe sürüm.\n\n**EN**\n- English release.\n';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'bozkurt-publish-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets', 'artifacts'), { recursive: true });
  await mkdir(path.join(root, 'assets', 'preview'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  await writeFile(path.join(root, 'notes.md'), notes);
  const archive = path.join(root, 'assets', 'artifacts', archiveName);
  const bytes = Buffer.from('PK\u0003\u0004test archive');
  await writeFile(archive, bytes);
  await writeFile(
    `${archive}.sha256`,
    `${createHash('sha256').update(bytes).digest('hex')}  ${archiveName}\n`,
  );
  await writeFile(
    path.join(root, 'assets', 'preview', 'index.html'),
    '<!doctype html><title>Bozkurt Obası</title>',
  );
  return {
    root,
    assets: 'assets',
    notes: 'notes.md',
    archive,
    env: { GH_TOKEN: 'test-only-token', GITHUB_REPOSITORY: repository, GITHUB_SHA: sha },
  };
}

function api(body, status = 200) {
  return {
    code: status === 200 ? 0 : 1,
    stdout: `HTTP/2.0 ${status} Response\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(body)}`,
    stderr: status === 200 ? '' : `gh: HTTP ${status}`,
  };
}

function fakeRunner(options = {}) {
  const calls = [];
  let remoteCommit = options.remoteCommit;
  let localExists = options.localExists ?? false;
  const initialNames = options.assetNames || [archiveName, `${archiveName}.sha256`, 'index.html'];
  const metadata = (draft, names) => ({
    tag_name: tag,
    draft,
    html_url: releaseUrl,
    assets: names.map((name) => ({ name })),
  });
  let release = ['draft', 'published'].includes(options.release)
    ? metadata(options.release === 'draft', initialNames)
    : null;
  const success = (stdout = '') => ({ code: 0, stdout, stderr: '' });
  async function run(program, args, executionOptions) {
    calls.push({ program, args, executionOptions });
    if (options.fail?.(program, args))
      return { code: 1, stdout: '', stderr: 'network unavailable' };
    if (program === 'git') {
      if (args[0] === 'rev-parse')
        return success(
          args.at(-1) === 'HEAD^{commit}' ? options.head || sha : options.localCommit || sha,
        );
      if (args[0] === 'ls-remote') {
        return success(
          remoteCommit
            ? `${object}\trefs/tags/${tag}\n${options.lightweight ? '' : `${remoteCommit}\trefs/tags/${tag}^{}\n`}`
            : '',
        );
      }
      if (args[0] === 'show-ref') return { code: localExists ? 0 : 1, stdout: '', stderr: '' };
      if (args[0] === 'cat-file') return success(options.localLightweight ? 'commit' : 'tag');
      if (args[0] === 'config') return success();
      if (args[0] === 'tag') {
        localExists = true;
        return success();
      }
      if (args[0] === 'push') {
        remoteCommit = sha;
        return success();
      }
    }
    if (program === 'gh') {
      if (args[0] === 'api' && args.includes('--paginate')) {
        return success(release ? JSON.stringify(release) : '');
      }
      if (args[0] === 'api' && !args.includes('--include')) return success(repository);
      if (args[0] === 'api')
        return (
          options.releaseLookupResponse ||
          (release && !release.draft ? api(release) : api({ message: 'Not Found' }, 404))
        );
      if (args[0] === 'release' && args[1] === 'create') {
        release = metadata(
          false,
          args.slice(3, args.indexOf('--verify-tag')).map((filename) => path.basename(filename)),
        );
        return success(releaseUrl);
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        assert.equal(release?.draft, true, 'clobber uploads are allowed only for drafts');
        const names = args
          .slice(3, args.indexOf('--clobber'))
          .map((filename) => path.basename(filename));
        release.assets = [
          ...release.assets.filter(({ name }) => !names.includes(name)),
          ...names.map((name) => ({ name })),
        ];
        return success();
      }
      if (args[0] === 'release' && args[1] === 'delete-asset') {
        assert.equal(release?.draft, true, 'obsolete archives are removed only from drafts');
        release.assets = release.assets.filter(({ name }) => name !== args[3]);
        return success();
      }
      if (args[0] === 'release' && args[1] === 'edit') {
        release.draft = false;
        return success();
      }
    }
    assert.fail(`Unexpected command: ${program} ${args.join(' ')}`);
  }
  return { run, calls };
}

function mutations(calls) {
  return calls.filter(
    ({ program, args }) =>
      (program === 'git' && ['tag', 'push', 'config'].includes(args[0])) ||
      (program === 'gh' && args[0] === 'release'),
  );
}

test('first publication creates an annotated exact-commit tag and bilingual release with verified assets', async (t) => {
  const input = await fixture(t);
  input.env.GITHUB_STEP_SUMMARY = path.join(input.root, 'summary.md');
  const runner = fakeRunner();
  const result = await publishRelease({ ...input, run: runner.run });
  assert.equal(result.status, 'created');
  assert.equal(result.url, releaseUrl);
  assert.equal(result.sha, sha);
  assert.deepEqual(result.assets, [archiveName, `${archiveName}.sha256`, 'index.html']);
  const tagCommand = runner.calls.find(
    ({ program, args }) => program === 'git' && args[0] === 'tag',
  );
  assert.deepEqual(tagCommand.args, ['tag', '-a', tag, sha, '-m', 'Bozkurt Obası v1.2.3']);
  const create = runner.calls.find(({ program, args }) => program === 'gh' && args[1] === 'create');
  assert.ok(create.args.includes('--verify-tag'));
  assert.equal(create.args[create.args.indexOf('--target') + 1], sha);
  assert.equal(
    create.args[create.args.indexOf('--notes-file') + 1],
    path.join(input.root, 'notes.md'),
  );
  assert.equal(create.args[create.args.indexOf('--repo') + 1], repository);
  assert.match(await readFile(input.env.GITHUB_STEP_SUMMARY, 'utf8'), /GitHub Release.*created/);
});

test('existing published release at the exact tag commit is an immutable-friendly no-op', async (t) => {
  const input = await fixture(t);
  const publishedArchive = `Bozkurt-Obasi-${tag}-20260928-110000.zip`;
  const assetNames = [publishedArchive, `${publishedArchive}.sha256`, 'index.html'];
  const runner = fakeRunner({ remoteCommit: sha, release: 'published', assetNames });
  const result = await publishRelease({ ...input, run: runner.run });
  assert.equal(result.status, 'unchanged');
  assert.deepEqual(
    result.assets,
    assetNames,
    'summary names use the published assets, not the rerun ZIP',
  );
  assert.deepEqual(mutations(runner.calls), []);
});

test('interrupted draft resumes assets and notes before publishing; tag remains unchanged', async (t) => {
  const input = await fixture(t);
  const runner = fakeRunner({ remoteCommit: sha, release: 'draft' });
  assert.equal((await publishRelease({ ...input, run: runner.run })).status, 'resumed');
  const actions = mutations(runner.calls);
  assert.deepEqual(
    actions.map(({ args }) => args[1]),
    ['upload', 'edit'],
  );
  assert.ok(actions[0].args.includes('--clobber'));
  assert.ok(actions[1].args.includes('--draft=false'));
  assert.ok(actions[1].args.includes('--notes-file'));
  assert.ok(
    runner.calls.some(({ args }) => args.includes('--paginate')),
    'drafts are found through the authenticated paginated list',
  );
});

test('draft retry removes stale timestamp ZIPs and SHA files before uploading exactly three current assets', async (t) => {
  const input = await fixture(t);
  const staleArchive = `Bozkurt-Obasi-${tag}-20260928-110000.zip`;
  const runner = fakeRunner({
    remoteCommit: sha,
    release: 'draft',
    assetNames: [staleArchive, `${staleArchive}.sha256`, 'index.html'],
  });
  const result = await publishRelease({ ...input, run: runner.run });
  assert.equal(result.status, 'resumed');
  assert.deepEqual(result.assets, [archiveName, `${archiveName}.sha256`, 'index.html']);
  assert.deepEqual(
    mutations(runner.calls).map(({ args }) => args[1]),
    ['delete-asset', 'delete-asset', 'upload', 'edit'],
  );
  assert.deepEqual(
    runner.calls.filter(({ args }) => args[1] === 'delete-asset').map(({ args }) => args[3]),
    [staleArchive, `${staleArchive}.sha256`],
  );
});

test('draft cleanup refuses unknown assets and archives belonging to another version', async (t) => {
  const input = await fixture(t);
  for (const unexpected of ['private-backup.zip', 'Bozkurt-Obasi-v1.2.2-20260928-110000.zip']) {
    const runner = fakeRunner({
      remoteCommit: sha,
      release: 'draft',
      assetNames: [archiveName, `${archiveName}.sha256`, 'index.html', unexpected],
    });
    await assert.rejects(publishRelease({ ...input, run: runner.run }), /unexpected assets/);
    assert.deepEqual(mutations(runner.calls), []);
  }
});

test('existing tag at another commit fails without moving a tag or editing a release', async (t) => {
  const input = await fixture(t);
  const runner = fakeRunner({ remoteCommit: otherSha, release: 'published' });
  await assert.rejects(
    publishRelease({ ...input, run: runner.run }),
    /another commit; tags are never moved/,
  );
  assert.deepEqual(mutations(runner.calls), []);
});

test('lightweight remote and mismatched local tags fail before publication', async (t) => {
  const input = await fixture(t);
  for (const options of [
    { remoteCommit: sha, lightweight: true },
    { localExists: true, localCommit: otherSha },
    { localExists: true, localLightweight: true },
  ]) {
    const runner = fakeRunner(options);
    await assert.rejects(
      publishRelease({ ...input, run: runner.run }),
      /annotated tag|another commit/,
    );
    assert.deepEqual(mutations(runner.calls), []);
  }
});

test('same-commit local annotated tag from an interrupted push is reused safely', async (t) => {
  const input = await fixture(t);
  const runner = fakeRunner({ localExists: true });
  assert.equal((await publishRelease({ ...input, run: runner.run })).status, 'created');
  assert.equal(
    runner.calls.some(({ program, args }) => program === 'git' && args[0] === 'tag'),
    false,
  );
  assert.equal(
    runner.calls.some(({ program, args }) => program === 'git' && args[0] === 'push'),
    true,
  );
});

test('GitHub authentication, network, and HTTP permission failures never count as a missing release', async (t) => {
  const input = await fixture(t);
  for (const options of [
    { fail: (program, args) => program === 'gh' && !args.includes('--include') },
    { fail: (program, args) => program === 'gh' && args.includes('--include') },
    { fail: (program, args) => program === 'gh' && args.includes('--paginate') },
    { releaseLookupResponse: api({ message: 'Resource not accessible by integration' }, 403) },
    { releaseLookupResponse: api({ message: 'Bad credentials' }, 401) },
  ]) {
    const runner = fakeRunner(options);
    await assert.rejects(
      publishRelease({ ...input, run: runner.run }),
      /failed|valid HTTP response/,
    );
    assert.deepEqual(mutations(runner.calls), []);
  }
});

test('workflow checkout and environment identity must be valid before any publication', async (t) => {
  const input = await fixture(t);
  const wrongHead = fakeRunner({ head: otherSha });
  await assert.rejects(publishRelease({ ...input, run: wrongHead.run }), /HEAD does not match/);
  assert.deepEqual(mutations(wrongHead.calls), []);
  for (const patch of [
    { GH_TOKEN: '' },
    { GITHUB_SHA: 'main' },
    { GITHUB_REPOSITORY: '--repo evil' },
  ]) {
    const runner = fakeRunner();
    await assert.rejects(
      publishRelease({ ...input, env: { ...input.env, ...patch }, run: runner.run }),
    );
    assert.deepEqual(runner.calls, []);
  }
});

test('corrupt ZIP and wrong sidecar filename fail checksum validation before network calls', async (t) => {
  const input = await fixture(t);
  const runner = fakeRunner();
  await writeFile(input.archive, 'corrupt bytes');
  await assert.rejects(publishRelease({ ...input, run: runner.run }), /SHA256 verification failed/);
  assert.deepEqual(runner.calls, []);
  await writeFile(`${input.archive}.sha256`, `${'0'.repeat(64)}  another.zip\n`);
  await assert.rejects(
    verifyReleaseAssets(path.join(input.root, 'assets'), '1.2.3'),
    /Invalid release SHA256 sidecar/,
  );
});

test('missing preview, duplicate archive, and extra assets cannot create a partial release', async (t) => {
  const input = await fixture(t);
  const assets = path.join(input.root, 'assets');
  const preview = path.join(assets, 'preview', 'index.html');
  await unlink(preview);
  await assert.rejects(verifyReleaseAssets(assets, '1.2.3'), /only the ZIP/);
  await writeFile(preview, '<html></html>');
  const duplicate = path.join(assets, 'artifacts', `Bozkurt-Obasi-${tag}-20260928-120001.zip`);
  await writeFile(duplicate, 'duplicate');
  await assert.rejects(verifyReleaseAssets(assets, '1.2.3'), /exactly one/);
  await unlink(duplicate);
  await writeFile(path.join(assets, '.env'), 'SECRET=unexpected');
  await assert.rejects(verifyReleaseAssets(assets, '1.2.3'), /only the ZIP/);
});

test('wrong-version or empty bilingual notes fail before external commands', async (t) => {
  const input = await fixture(t);
  for (const invalid of [
    notes.replace('v1.2.3', 'v1.2.4'),
    notes.replace('- English release.', ''),
  ]) {
    await writeFile(path.join(input.root, 'notes.md'), invalid);
    const runner = fakeRunner();
    await assert.rejects(publishRelease({ ...input, run: runner.run }), /Missing|empty EN/);
    assert.deepEqual(runner.calls, []);
  }
});

test('failed tag push stops the release instead of trusting an unpushed local tag', async (t) => {
  const input = await fixture(t);
  const runner = fakeRunner({ fail: (program, args) => program === 'git' && args[0] === 'push' });
  await assert.rejects(publishRelease({ ...input, run: runner.run }), /git push failed/);
  assert.equal(
    runner.calls.some(({ program, args }) => program === 'gh' && args[0] === 'release'),
    false,
  );
});

test('command runner passes shell metacharacters as literal arguments', async () => {
  const argument = '$(touch unwanted) `echo secret`; & | >';
  const result = await runCommand(process.execPath, [
    '-e',
    'process.stdout.write(process.argv[1])',
    argument,
  ]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, argument);
});
