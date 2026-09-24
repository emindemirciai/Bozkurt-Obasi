import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  'data',
  'playwright-report',
  'test-results',
  'builds',
  'usersettings',
  'memorycaptures',
]);
const excludedFiles =
  /\.(?:log|tmp|sqlite(?:-wal|-shm)?|db(?:-wal|-shm)?|zip|rar|7z|sha256|pem|key|p12|pfx|keystore|jks)$/i;

export async function projectFiles(directory = projectRoot, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name.toLowerCase())) continue;
      if (relative === 'server/build' || relative === 'infrastructure/backups') continue;
      files.push(...(await projectFiles(path.join(directory, entry.name), `${relative}/`)));
    } else if (entry.isFile()) {
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
      if (excludedFiles.test(entry.name) || ['.DS_Store', 'Thumbs.db'].includes(entry.name))
        continue;
      files.push(relative);
    }
  }
  return files;
}
