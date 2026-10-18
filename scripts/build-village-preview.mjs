import { build } from 'vite';
import { mkdir, readFile } from 'node:fs/promises';
import { writePreview } from './write-preview.mjs';
import { resolve } from 'node:path';

const result = await build({
  configFile: false,
  logLevel: 'warn',
  define: { 'import.meta.url': 'document.baseURI' },
  build: {
    write: false,
    target: 'es2022',
    minify: true,
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024,
    lib: {
      entry: resolve('scripts/village-preview.mjs'),
      name: 'BozkurtVillagePreview',
      formats: ['iife'],
    },
  },
});
const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
const script = output
  .filter((item) => item.type === 'chunk')
  .map((item) => item.code)
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');
const css = output
  .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
  .map((item) => item.source)
  .join('\n');
const legal = (await readFile('index.html', 'utf8')).match(/<!--[\s\S]*?-->/)?.[0];
if (!legal?.includes('MIT License')) throw new Error('MIT source notice is missing.');
const html = `<!doctype html>${legal}<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bozkurt Obası · Oba planlaması</title><style>${css}
.village-preview{max-width:1240px;padding:0 24px 40px;margin:auto}
.village-preview-notice{padding:16px;text-align:center;overflow-wrap:anywhere;border-bottom:1px solid var(--line)}
.village-preview-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 0}
.village-preview-header>.wordmark{display:flex;align-items:center;gap:12px;min-width:0}
.village-preview-header>.wordmark svg{width:44px;height:44px;flex-shrink:0}
.village-preview-header>div:last-child{display:flex;gap:8px}
.village-preview main{padding:0}.village-preview .map-card{margin-bottom:28px}
.village-preview .scene-wrap{height:620px;min-height:240px}.preview-tier{display:flex;gap:12px;align-items:center;margin:20px 0}.preview-tier select{padding:8px;background:var(--surface);border:1px solid var(--line)}.preview-guardians{margin:28px 0}.preview-guardians>div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.preview-guardians article{text-align:center;min-width:0}.preview-guardians svg{height:180px}.preview-guardians h3{font-size:14px}@media(max-width:600px){.preview-guardians>div{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.village-preview{padding:0 14px 24px}.village-preview-header{flex-wrap:wrap}.village-preview-header>div:last-child{margin-left:auto}.village-preview .scene-wrap{height:260px}}
</style></head><body><div id="app"></div><script>${script}</script></body></html>`;
await mkdir('preview', { recursive: true });
await writePreview('preview/village.html', html, 'utf8');
console.log(
  `Offline village planning preview: preview/village.html (${Buffer.byteLength(html)} bytes)`,
);
