import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

function requireVersion(version) {
  if (typeof version !== 'string' || !versionPattern.test(version)) {
    throw new Error('Release version must use MAJOR.MINOR.PATCH (for example 1.2.3).');
  }
  return version;
}

function hasContent(value) {
  return Boolean(value.replace(/<!--[\s\S]*?-->/g, '').replace(/[\s*#>`~_\-[\]]/g, ''));
}

/** Extract one exact release section; headings inside fenced code are ignored. */
export function extractReleaseNotes(changelog, version) {
  requireVersion(version);
  if (typeof changelog !== 'string') throw new Error('CHANGELOG.md must be Markdown text.');
  const lines = changelog
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const headings = [];
  const languageMarkers = [];
  let fence;
  for (const [index, line] of lines.entries()) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^ {0,3}##\s+(.+?)\s*#*\s*$/);
    if (heading) headings.push({ index, text: heading[1] });
    const language = line.match(/^\s*(?:\*\*(TR|EN)\*\*|###\s+(TR|EN))\s*$/);
    if (language) languageMarkers.push({ index, language: language[1] || language[2] });
  }
  const matches = headings.filter(({ text }) => {
    const found = text.match(/^\[?v?(\d+\.\d+\.\d+)\]?(?=\s|$)/);
    return found?.[1] === version;
  });
  if (matches.length !== 1) {
    throw new Error(
      matches.length
        ? `Duplicate CHANGELOG.md section for v${version}.`
        : `Missing CHANGELOG.md section for v${version}.`,
    );
  }
  const start = matches[0].index;
  const end = headings.find(({ index }) => index > start)?.index ?? lines.length;
  const markers = languageMarkers.filter(({ index }) => index > start && index < end);
  for (const language of ['TR', 'EN']) {
    const found = markers.filter((marker) => marker.language === language);
    if (found.length !== 1) {
      throw new Error(`v${version} requires exactly one ${language} release-note section.`);
    }
    const bodyStart = found[0].index + 1;
    const bodyEnd = markers.find(({ index }) => index >= bodyStart)?.index ?? end;
    if (!hasContent(lines.slice(bodyStart, bodyEnd).join('\n'))) {
      throw new Error(`v${version} has empty ${language} release notes.`);
    }
  }
  return lines.slice(start, end).join('\n').trim() + '\n';
}

export function validateReleaseMetadata(packageJson, releases) {
  const version = requireVersion(packageJson?.version);
  if (releases?.version !== version || releases?.releases?.[0]?.version !== version) {
    throw new Error('package.json and releases.json must identify the same current version.');
  }
  const current = releases.releases[0];
  for (const language of ['tr', 'en']) {
    const changes = current.changes?.[language];
    if (
      !Array.isArray(changes) ||
      !changes.length ||
      changes.some((entry) => typeof entry !== 'string' || !hasContent(entry))
    ) {
      throw new Error(
        `releases.json v${version} requires nonempty ${language.toUpperCase()} changes.`,
      );
    }
  }
  return version;
}

export async function readReleaseNotes(root = projectRoot) {
  const [packageText, releasesText, changelog] = await Promise.all([
    readFile(resolve(root, 'package.json'), 'utf8'),
    readFile(resolve(root, 'releases.json'), 'utf8'),
    readFile(resolve(root, 'CHANGELOG.md'), 'utf8'),
  ]);
  const version = validateReleaseMetadata(JSON.parse(packageText), JSON.parse(releasesText));
  return { version, tag: `v${version}`, notes: extractReleaseNotes(changelog, version) };
}

async function main(args) {
  let output;
  let root = projectRoot;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (
      !['--output', '--root'].includes(option) ||
      !args[index + 1] ||
      args[index + 1].startsWith('--')
    ) {
      throw new Error(
        'Usage: node scripts/release-notes.mjs --output <file> [--root <repository>]',
      );
    }
    const value = args[++index];
    if (option === '--output') output = resolve(value);
    else root = resolve(value);
  }
  if (!output) throw new Error('--output is required.');
  const release = await readReleaseNotes(root);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, release.notes, 'utf8');
  console.log(`Wrote ${release.tag} TR/EN release notes to ${output}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
