import { execFile } from 'node:child_process';
import { access, lstat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

const excludedDirectories = new Set([
  '.git',
  '.next',
  '.codex',
  '.agents',
  '.idea',
  '.vs',
  '.vscode',
  'node_modules',
  'dist',
  'library',
  'temp',
  'logs',
  'obj',
  '.cache',
  '.npm-cache',
  'artifacts',
  'release-assets',
  'data',
  'playwright-report',
  'test-results',
  'builds',
  'usersettings',
  'memorycaptures',
]);
const excludedFiles =
  /\.(?:log|tmp|sqlite(?:-wal|-shm)?|db(?:-wal|-shm)?|zip|rar|7z|sha256|pem|key|p12|pfx|keystore|jks)$/i;

const runFile = promisify(execFile);

function included(relative) {
  const segments = relative.split('/');
  if (segments.some((segment) => excludedDirectories.has(segment.toLowerCase()))) return false;
  if (relative.startsWith('server/build/') || relative.startsWith('infrastructure/backups/'))
    return false;
  const name = segments.at(-1);
  if (name.startsWith('.env') && !['.env.example', '.env.production.example'].includes(name))
    return false;
  return !excludedFiles.test(name) && !['.DS_Store', 'Thumbs.db'].includes(name);
}

async function walkFiles(directory = projectRoot, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name.toLowerCase())) continue;
      if (relative === 'server/build' || relative === 'infrastructure/backups') continue;
      files.push(...(await walkFiles(path.join(directory, entry.name), `${relative}/`)));
    } else if (entry.isFile()) {
      if (included(relative)) files.push(relative);
    }
  }
  return files;
}

export async function projectFiles() {
  try {
    await access(path.join(projectRoot, '.git'));
  } catch {
    return walkFiles(); // A clean source ZIP can also be used without Git installed.
  }
  // A release archive represents the Git project, so personal untracked files never enter it.
  const { stdout } = await runFile('git', ['ls-files', '--cached', '--full-name', '-z'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const files = stdout.split('\0').filter(included);
  const present = await Promise.all(
    files.map(async (relative) => [relative, await lstat(path.join(projectRoot, relative))]),
  );
  return present
    .filter(([, info]) => info.isFile() && !info.isSymbolicLink())
    .map(([relative]) => relative)
    .sort((a, b) => a.localeCompare(b, 'en'));
}
