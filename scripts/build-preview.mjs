import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// A real playable bundle, inlined so file:// works without a web server or network.
const result = await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    write: false,
    target: 'es2022',
    minify: true,
    cssCodeSplit: false,
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
const html = `<!doctype html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#203e35"><meta name="description" content="Bozkurt Obası: Ay-Yıldız Nöbeti — obanı kur, sürünü koru."><title>Bozkurt Obası: Ay-Yıldız Nöbeti · Önizleme</title><style>${css}</style></head><body><div id="app"></div><script>${script}</script></body></html>`;
await mkdir('preview', { recursive: true });
await writeFile('preview/index.html', html, 'utf8');
console.log(`Playable offline preview: preview/index.html (${Buffer.byteLength(html)} bytes)`);
