import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Inlined visual landing preview for file://; village entry still requires a server-side account session.
const result = await build({
  configFile: false,
  logLevel: 'warn',
  // The classic-script preview needs a valid browser base after Vite inlines asset URLs.
  define: { 'import.meta.url': 'document.baseURI' },
  build: {
    write: false,
    target: 'es2022',
    minify: true,
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024,
    lib: { entry: resolve('web/main.mjs'), name: 'Bozkurt', formats: ['iife'] },
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
const legalNotice = (await readFile('index.html', 'utf8')).match(/<!--[\s\S]*?-->/)?.[0];
if (!legalNotice?.includes('MIT License')) throw new Error('MIT source notice is missing.');
const favicon =
  'data:image/svg+xml;base64,' + (await readFile('public/brand/logo-mark.svg')).toString('base64');
const html = `<!doctype html>${legalNotice}<html lang="tr"><head><meta charset="UTF-8"><meta name="author" content="Emin DEMİRCİ"><meta name="copyright" content="Copyright © 2026 Emin DEMİRCİ; MIT License"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#203e35"><meta name="description" content="Bozkurt Obası: Ay-Yıldız Nöbeti — obanı kur, sürünü koru."><link rel="icon" type="image/svg+xml" href="${favicon}"><title>Bozkurt Obası: Ay-Yıldız Nöbeti · Önizleme</title><style>${css}</style></head><body><div id="app"></div><script>${script}</script></body></html>`;
await mkdir('preview', { recursive: true });
await writeFile('preview/index.html', html, 'utf8');
console.log(`Offline visual preview: preview/index.html (${Buffer.byteLength(html)} bytes)`);
await import('./build-battle-preview.mjs');
await import('./build-admin-preview.mjs');
