import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
      entry: resolve('scripts/first-watch-preview.mjs'),
      name: 'BozkurtFirstWatchPreview',
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
const favicon =
  'data:image/svg+xml;base64,' + (await readFile('public/brand/logo-mark.svg')).toString('base64');
const html = `<!doctype html>${legal}<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="Emin DEMİRCİ"><meta name="copyright" content="Copyright © 2026 Emin DEMİRCİ; MIT License"><link rel="icon" type="image/svg+xml" href="${favicon}"><title>Bozkurt Obası · İlk Nöbet</title><style>${css}
.first-watch-preview{max-width:1240px;padding:0 24px 40px;margin:auto}
.first-watch-preview-notice{padding:16px;text-align:center;overflow-wrap:anywhere;border-bottom:1px solid var(--line);line-height:1.7;font-size:12px}
.first-watch-preview-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 0}
.first-watch-preview-header>.wordmark{display:flex;align-items:center;gap:12px;min-width:0}
.first-watch-preview-header>.wordmark svg{width:44px;height:44px;flex-shrink:0}
.first-watch-preview-header>div:last-child{display:flex;gap:8px}
.first-watch-preview main{padding:0;min-width:0}.first-watch-preview h1{font:clamp(24px,4vw,36px) Georgia,serif;line-height:1.25;overflow-wrap:anywhere}
.first-watch-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:20px 0;flex-wrap:wrap}
.first-watch-preview-toolbar label{display:grid;gap:8px;font-size:12px;max-width:100%;min-width:0}
.first-watch-preview-toolbar select{max-width:100%;min-width:0;padding:12px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px}
.first-watch-preview-hint{padding:14px 18px;border:1px solid var(--line);border-radius:10px;background:var(--surface);line-height:1.7;font-size:12px;margin:0 0 18px}

.first-watch-preview-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px}.first-watch-preview-layout aside>h2{font:18px Georgia,serif;margin:0 0 16px}.first-watch-preview-layout>aside,.first-watch-preview-layout>div{min-width:0}.first-watch-preview .first-watch-steps{grid-template-columns:1fr}@media(max-width:1000px){.first-watch-preview-layout{grid-template-columns:1fr}.first-watch-preview-layout>aside{max-width:460px;width:100%;margin:auto}}
@media(max-width:620px){.first-watch-preview{padding:0 14px 24px}.first-watch-preview-header{flex-wrap:wrap}.first-watch-preview-header>div:last-child{margin-left:auto}.first-watch-preview-toolbar{gap:14px}.first-watch-preview-toolbar label{width:100%}}
</style></head><body><div id="app"></div><script>${script}</script></body></html>`;
await mkdir('preview', { recursive: true });
await writeFile('preview/first-watch.html', html, 'utf8');
console.log(
  `Offline First Watch story preview: preview/first-watch.html (${Buffer.byteLength(html)} bytes)`,
);
