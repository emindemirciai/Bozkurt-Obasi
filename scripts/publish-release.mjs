import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractReleaseNotes } from './release-notes.mjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const commitPattern = /^[a-f0-9]{40}$/i;

function generatedArchiveName(filename, version, allowChecksum = false) {
  const prefix = `Bozkurt-Obasi-v${version}-`;
  return (
    filename.startsWith(prefix) &&
    (allowChecksum ? /^\d{8}-\d{6}\.zip(?:\.sha256)?$/ : /^\d{8}-\d{6}\.zip$/).test(
      filename.slice(prefix.length),
    )
  );
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (value) => (stdout += value));
    child.stderr.on('data', (value) => (stderr += value));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Release assets cannot contain symlinks: ${entry.name}`);
    if (entry.isDirectory()) files.push(...(await filesUnder(filename)));
    else if (entry.isFile()) files.push(filename);
    else throw new Error(`Unsupported release asset: ${entry.name}`);
  }
  return files;
}

export async function verifyReleaseAssets(directory, version) {
  if (!stableVersion.test(version))
    throw new Error('Release version must use stable X.Y.Z semver.');
  const files = await filesUnder(directory);
  const archives = files.filter((filename) =>
    generatedArchiveName(path.basename(filename), version),
  );
  if (archives.length !== 1)
    throw new Error('Release assets must contain exactly one current-version ZIP.');
  const archive = archives[0];
  const checksum = `${archive}.sha256`;
  const preview = path.join(directory, 'preview', 'index.html');
  if (files.length !== 3 || !files.includes(checksum) || !files.includes(preview)) {
    throw new Error(
      'Release assets must contain only the ZIP, its SHA256 sidecar, and preview/index.html.',
    );
  }
  const sidecar = (await readFile(checksum, 'utf8')).trim();
  const expectedName = path.basename(archive);
  const match = /^([a-f0-9]{64}) {2}([^\r\n]+)$/i.exec(sidecar);
  if (!match || match[2] !== expectedName) throw new Error('Invalid release SHA256 sidecar.');
  const actualHash = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  if (actualHash !== match[1].toLowerCase())
    throw new Error('Release ZIP SHA256 verification failed.');
  if (!(await readFile(preview, 'utf8')).trim())
    throw new Error('Release preview must not be empty.');
  return [archive, checksum, preview];
}

function parseApiResponse(result) {
  const stdout = result.stdout.replace(/\r\n/g, '\n');
  const headerEnd = stdout.indexOf('\n\n');
  const status = /^HTTP\/\S+\s+(\d{3})\b/.exec(stdout);
  if (!status || headerEnd < 0) {
    throw new Error(
      `GitHub API did not return a valid HTTP response: ${result.stderr.trim() || 'missing response'}`,
    );
  }
  let body;
  try {
    body = JSON.parse(stdout.slice(headerEnd + 2));
  } catch {
    throw new Error('GitHub API returned invalid JSON.');
  }
  return { status: Number(status[1]), body };
}

export async function publishRelease({
  root = defaultRoot,
  assets,
  notes,
  env = process.env,
  run = runCommand,
}) {
  const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
  if (!stableVersion.test(version))
    throw new Error('Release version must use stable X.Y.Z semver.');
  const sha = env.GITHUB_SHA?.toLowerCase();
  const repository = env.GITHUB_REPOSITORY;
  if (!commitPattern.test(sha || ''))
    throw new Error('GITHUB_SHA must contain the exact 40-character workflow commit.');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) {
    throw new Error('GITHUB_REPOSITORY must use owner/repository format.');
  }
  if (!env.GH_TOKEN?.trim()) throw new Error('GH_TOKEN is required to publish a release.');
  if (!assets || !notes) throw new Error('Release asset directory and notes file are required.');
  const assetsDirectory = path.resolve(root, assets);
  const notesFile = path.resolve(root, notes);
  extractReleaseNotes(await readFile(notesFile, 'utf8'), version);
  const assetPaths = await verifyReleaseAssets(assetsDirectory, version);
  const tag = `v${version}`;
  const title = `Bozkurt Obası ${tag}`;
  const command = (program, args) => run(program, args, { cwd: root, env });
  async function checked(program, args) {
    const result = await command(program, args);
    if (result.code !== 0) {
      throw new Error(
        `${program} ${args[0]} failed: ${result.stderr.trim() || `exit ${result.code}`}`,
      );
    }
    return result.stdout.trim();
  }
  const head = await checked('git', ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (head.toLowerCase() !== sha) throw new Error('Checkout HEAD does not match GITHUB_SHA.');
  // GitHub can hide inaccessible repositories behind 404. Confirm access before interpreting a missing release.
  const accessibleRepository = await checked('gh', [
    'api',
    `repos/${repository}`,
    '--jq',
    '.full_name',
  ]);
  if (accessibleRepository.toLowerCase() !== repository.toLowerCase()) {
    throw new Error('GitHub repository access check returned an unexpected repository.');
  }
  async function findRelease() {
    const result = await command('gh', [
      'api',
      '--include',
      `repos/${repository}/releases/tags/${tag}`,
    ]);
    const { status, body: responseBody } = parseApiResponse(result);
    let body = responseBody;
    if (status === 404 && body.message === 'Not Found') {
      // The by-tag endpoint is documented for published releases. Writers can find drafts in the list.
      const listing = await checked('gh', [
        'api',
        '--paginate',
        `repos/${repository}/releases?per_page=100`,
        '--jq',
        `.[] | select(.tag_name == "${tag}")`,
      ]);
      if (!listing) return null;
      try {
        body = JSON.parse(listing);
      } catch {
        throw new Error('GitHub returned invalid or duplicate matching release metadata.');
      }
    } else if (result.code !== 0 || status !== 200) {
      throw new Error(
        `GitHub release lookup failed (HTTP ${status}): ${body.message || result.stderr.trim()}`,
      );
    }
    if (
      body.tag_name !== tag ||
      typeof body.draft !== 'boolean' ||
      !Array.isArray(body.assets) ||
      body.assets.some((asset) => typeof asset.name !== 'string' || !asset.name) ||
      new Set(body.assets.map((asset) => asset.name)).size !== body.assets.length
    ) {
      throw new Error('GitHub returned unexpected release metadata.');
    }
    return body;
  }
  const existingRelease = await findRelease();
  const remoteTags = await checked('git', [
    'ls-remote',
    '--tags',
    'origin',
    `refs/tags/${tag}`,
    `refs/tags/${tag}^{}`,
  ]);
  const remote = new Map();
  for (const line of remoteTags.split(/\r?\n/).filter(Boolean)) {
    const [object, ref, ...extra] = line.split(/\s+/);
    if (
      !commitPattern.test(object || '') ||
      ![`refs/tags/${tag}`, `refs/tags/${tag}^{}`].includes(ref) ||
      extra.length
    ) {
      throw new Error('Git returned unexpected remote tag metadata.');
    }
    if (remote.has(ref)) throw new Error('Git returned duplicate remote tag metadata.');
    remote.set(ref, object.toLowerCase());
  }
  const remoteTag = remote.get(`refs/tags/${tag}`);
  if (remoteTag) {
    const remoteCommit = remote.get(`refs/tags/${tag}^{}`);
    if (!remoteCommit) throw new Error(`Existing ${tag} must be an annotated tag.`);
    if (remoteCommit !== sha)
      throw new Error(`Existing ${tag} points to another commit; tags are never moved.`);
  } else {
    if (remote.size) throw new Error('Remote tag metadata has no tag object.');
    if (existingRelease)
      throw new Error(`Existing release ${tag} has no remote tag; refusing to recreate it.`);
    const localTag = await command('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`]);
    if (localTag.code === 0) {
      if ((await checked('git', ['cat-file', '-t', `refs/tags/${tag}`])) !== 'tag') {
        throw new Error(`Existing local ${tag} must be an annotated tag.`);
      }
      if (
        (
          await checked('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`])
        ).toLowerCase() !== sha
      ) {
        throw new Error(`Existing local ${tag} points to another commit; tags are never moved.`);
      }
    } else if (localTag.code === 1) {
      await checked('git', ['config', 'user.name', 'github-actions[bot]']);
      await checked('git', [
        'config',
        'user.email',
        '41898282+github-actions[bot]@users.noreply.github.com',
      ]);
      await checked('git', ['tag', '-a', tag, sha, '-m', title]);
    } else {
      throw new Error(
        `Local tag lookup failed: ${localTag.stderr.trim() || `exit ${localTag.code}`}`,
      );
    }
    await checked('git', ['push', 'origin', `refs/tags/${tag}`]);
  }

  let status = 'unchanged';
  const expectedNames = assetPaths.map((filename) => path.basename(filename));
  if (!existingRelease) {
    await checked('gh', [
      'release',
      'create',
      tag,
      ...assetPaths,
      '--verify-tag',
      '--target',
      sha,
      '--title',
      title,
      '--notes-file',
      notesFile,
      '--latest',
      '--repo',
      repository,
    ]);
    status = 'created';
  } else if (existingRelease.draft) {
    const obsolete = existingRelease.assets
      .map((asset) => asset.name)
      .filter((name) => !expectedNames.includes(name));
    if (obsolete.some((name) => !generatedArchiveName(name, version, true))) {
      throw new Error('Draft release contains unexpected assets; refusing to remove them.');
    }
    // A new CI run has a new ZIP timestamp. Remove only our stale current-version draft archives.
    for (const name of obsolete) {
      await checked('gh', ['release', 'delete-asset', tag, name, '--yes', '--repo', repository]);
    }
    await checked('gh', [
      'release',
      'upload',
      tag,
      ...assetPaths,
      '--clobber',
      '--repo',
      repository,
    ]);
    await checked('gh', [
      'release',
      'edit',
      tag,
      '--draft=false',
      '--latest',
      '--title',
      title,
      '--notes-file',
      notesFile,
      '--repo',
      repository,
    ]);
    status = 'resumed';
  }
  const published = status === 'unchanged' ? existingRelease : await findRelease();
  if (!published || published.draft) throw new Error(`Release ${tag} was not published.`);
  const expectedUrl = `https://github.com/${repository}/releases/tag/${tag}`;
  if (published.html_url?.toLowerCase() !== expectedUrl.toLowerCase()) {
    throw new Error('GitHub returned an unexpected release URL.');
  }
  const publishedNames = published.assets.map((asset) => asset.name);
  if (
    status !== 'unchanged' &&
    (publishedNames.length !== expectedNames.length ||
      publishedNames.some((name) => !expectedNames.includes(name)))
  ) {
    throw new Error('Published release assets do not match the verified ZIP, SHA256, and preview.');
  }
  const result = {
    version,
    tag,
    sha,
    status,
    url: published.html_url,
    assets: publishedNames,
  };
  if (env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      env.GITHUB_STEP_SUMMARY,
      `### Bozkurt Obası ${tag}\n\n[GitHub Release](${result.url}) · ${status}\n\nCommit: \`${sha}\`\n\nAssets: ${result.assets.map((filename) => `\`${filename}\``).join(', ')}\n`,
    );
  }
  return result;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (
      !['--assets', '--notes', '--root'].includes(option) ||
      !args[index + 1] ||
      args[index + 1].startsWith('--')
    ) {
      throw new Error(
        'Usage: node scripts/publish-release.mjs --assets <directory> --notes <file> [--root <repository>]',
      );
    }
    const key = option.slice(2);
    if (options[key]) throw new Error(`Duplicate option: ${option}`);
    options[key] = args[++index];
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await publishRelease(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
