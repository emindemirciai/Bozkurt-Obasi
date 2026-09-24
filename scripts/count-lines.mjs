import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectFiles, projectRoot } from './project-files.mjs';

// Physical source lines, including comments and blank lines; generated previews and lockfiles are excluded.
const codeExtensions = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.html',
  '.cs',
  '.sh',
  '.ps1',
]);
const categories = {
  web: { label: 'Web istemci / Web client', files: 0, lines: 0 },
  server: { label: 'Web sunucu / Web server', files: 0, lines: 0 },
  services: { label: 'Dağıtım servisleri / Deployment services', files: 0, lines: 0 },
  shared: { label: 'Paylaşılan oyun / Shared game', files: 0, lines: 0 },
  delivery: { label: 'Web test ve araçlar / Web tests and tools', files: 0, lines: 0 },
  legacy: { label: 'Korunan Unity kaynakları / Preserved Unity sources', files: 0, lines: 0 },
};
for (const file of await projectFiles()) {
  if (file.startsWith('preview/') || !codeExtensions.has(path.extname(file))) continue;
  const content = await readFile(path.join(projectRoot, file), 'utf8');
  const lines = content === '' ? 0 : content.split('\n').length - Number(content.endsWith('\n'));
  const group =
    file.startsWith('web/') || file === 'index.html'
      ? 'web'
      : file.startsWith('services/')
        ? 'services'
        : file.startsWith('server/web/')
          ? 'server'
          : file.startsWith('shared/')
            ? 'shared'
            : /^(?:scripts|tests)\//.test(file) || (!file.includes('/') && /\.[cm]?js$/.test(file))
              ? 'delivery'
              : 'legacy';
  categories[group].files += 1;
  categories[group].lines += lines;
}
const totals = Object.values(categories).reduce(
  (sum, item) => ({ files: sum.files + item.files, lines: sum.lines + item.lines }),
  { files: 0, lines: 0 },
);
const webLines = totals.lines - categories.legacy.lines;
const table = [
  '| Kapsam / Scope | Dosya / Files | Satır / Lines |',
  '| --- | ---: | ---: |',
  ...Object.values(categories).map((item) => `| ${item.label} | ${item.files} | ${item.lines} |`),
  `| **Toplam / Total** | **${totals.files}** | **${totals.lines}** |`,
  '',
  `Aktif web kaynakları / Active web source: **${webLines}** satır / lines.`,
  'Fiziksel kaynak satırları; boş satırlar ve yorumlar dahil, üretilen önizleme, bağımlılıklar ve kilit dosyaları hariç. / Physical source lines include comments and blank lines; generated preview, dependencies, and lockfiles are excluded.',
].join('\n');
if (!process.argv.includes('--no-write')) {
  const readmePath = path.join(projectRoot, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const pattern = /<!-- metrics:start -->[\s\S]*?<!-- metrics:end -->/;
  if (pattern.test(readme)) {
    const updated = readme.replace(
      pattern,
      `<!-- metrics:start -->\n${table}\n<!-- metrics:end -->`,
    );
    if (updated !== readme) await writeFile(readmePath, updated);
  }
}
console.log(
  process.argv.includes('--json')
    ? JSON.stringify({ categories, totals, webLines }, null, 2)
    : table,
);
