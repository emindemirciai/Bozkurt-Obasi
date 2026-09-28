import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractReleaseNotes, validateReleaseMetadata } from '../scripts/release-notes.mjs';

const current = `## v1.2.3 — 2026-09-28

**TR**
- Türkçe değişiklik.

**EN**
- English change.
`;
const older = `## v1.2.2 — 2026-09-27

**TR**
- Eski değişiklik.

**EN**
- Older change.
`;

function metadata(version = '1.2.3') {
  return {
    version,
    releases: [{ version, changes: { tr: ['Türkçe değişiklik.'], en: ['English change.'] } }],
  };
}

test('release notes contain only the exact version, including Markdown and TR/EN text', () => {
  const changelog =
    '# Changelog\n\n## v1.2.30 — 2026-09-29\n\n**TR**\n- Future.\n\n**EN**\n- Future.\n\n' +
    current +
    '\n' +
    older;
  assert.equal(extractReleaseNotes(changelog, '1.2.3'), current);
  assert.equal(extractReleaseNotes(changelog, '1.2.2'), older);
});

test('release notes normalize CRLF and allow a BOM', () => {
  assert.equal(extractReleaseNotes('\uFEFF' + current.replace(/\n/g, '\r\n'), '1.2.3'), current);
});

test('missing or duplicate versions cannot silently produce a release', () => {
  assert.throws(() => extractReleaseNotes(older, '1.2.3'), /Missing.*v1\.2\.3/);
  assert.throws(() => extractReleaseNotes(current + '\n' + current, '1.2.3'), /Duplicate/);
  assert.throws(() => extractReleaseNotes(current, '1.2'), /MAJOR.MINOR.PATCH/);
});

test('release versions reject prerelease and numeric prefix matches', () => {
  assert.throws(
    () => extractReleaseNotes(current.replace('v1.2.3', 'v1.2.3-beta.1'), '1.2.3'),
    /Missing/,
  );
  assert.throws(
    () => extractReleaseNotes(current.replace('v1.2.3', 'v1.2.30'), '1.2.3'),
    /Missing/,
  );
});

test('missing, duplicate, and empty language sections are rejected independently', () => {
  for (const language of ['TR', 'EN']) {
    assert.throws(
      () => extractReleaseNotes(current.replace(`**${language}**`, '**OTHER**'), '1.2.3'),
      new RegExp(language),
    );
    const pattern = language === 'TR' ? '- Türkçe değişiklik.' : '- English change.';
    assert.throws(
      () => extractReleaseNotes(current.replace(pattern, '  \n<!-- draft -->\n- ** **'), '1.2.3'),
      new RegExp(`empty ${language}`),
    );
    assert.throws(
      () => extractReleaseNotes(current + `\n**${language}**\n- Duplicate\n`, '1.2.3'),
      /exactly one/,
    );
  }
});

test('headings inside fenced code do not split releases or satisfy language requirements', () => {
  const withCode = current.replace(
    '- Türkçe değişiklik.',
    '- Türkçe değişiklik.\n\n```md\n## v1.2.3\n**EN**\n```',
  );
  assert.equal(extractReleaseNotes(withCode + '\n' + older, '1.2.3'), withCode);
  const codeOnly = '## v1.2.3\n\n```md\n**TR**\n- text\n**EN**\n- text\n```';
  assert.throws(() => extractReleaseNotes(codeOnly, '1.2.3'), /TR/);
});

test('release metadata must agree with the package and provide both languages', () => {
  assert.equal(validateReleaseMetadata({ version: '1.2.3' }, metadata()), '1.2.3');
  assert.throws(
    () => validateReleaseMetadata({ version: '1.2.3' }, metadata('1.2.2')),
    /same current version/,
  );
  const wrongFirst = metadata();
  wrongFirst.releases[0].version = '1.2.2';
  assert.throws(
    () => validateReleaseMetadata({ version: '1.2.3' }, wrongFirst),
    /same current version/,
  );
  for (const language of ['tr', 'en']) {
    for (const changes of [undefined, [], [''], [' '], ['<!-- draft -->'], ['valid', null]]) {
      const invalid = metadata();
      invalid.releases[0].changes[language] = changes;
      assert.throws(() => validateReleaseMetadata({ version: '1.2.3' }, invalid), /nonempty/);
    }
  }
});

test('CLI writes only the current bilingual section and leaves no file on invalid notes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'bozkurt-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  await writeFile(join(root, 'releases.json'), JSON.stringify(metadata()));
  await writeFile(join(root, 'CHANGELOG.md'), current + '\n' + older);
  const script = fileURLToPath(new URL('../scripts/release-notes.mjs', import.meta.url));
  const output = join(root, 'output', 'notes.md');
  const stdout = execFileSync(process.execPath, [script, '--root', root, '--output', output], {
    encoding: 'utf8',
  });
  assert.match(stdout, /v1\.2\.3 TR\/EN/);
  assert.equal(await readFile(output, 'utf8'), current);
  const invalidOutput = join(root, 'invalid.md');
  await writeFile(join(root, 'CHANGELOG.md'), older);
  assert.throws(
    () =>
      execFileSync(process.execPath, [script, '--root', root, '--output', invalidOutput], {
        stdio: 'pipe',
      }),
    /Command failed/,
  );
  await assert.rejects(readFile(invalidOutput), { code: 'ENOENT' });
});
