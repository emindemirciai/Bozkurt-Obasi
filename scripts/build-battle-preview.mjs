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
      entry: resolve('scripts/battle-preview.mjs'),
      name: 'BozkurtBattlePreview',
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
const html = `<!doctype html>${legal}<html lang="tr" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="Emin DEMİRCİ"><meta name="copyright" content="Copyright © 2026 Emin DEMİRCİ; MIT License"><link rel="icon" type="image/svg+xml" href="${favicon}"><title>Bozkurt Obası · Savaş meydanı</title><style>${css}
.battle-preview{max-width:1200px;margin:auto;padding:24px;min-width:0}
.preview-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.preview-heading h1{font-family:Georgia,serif;font-size:clamp(26px,4vw,36px);color:var(--forest);margin:5px 0 8px}
.preview-heading p{line-height:1.6;color:var(--muted);max-width:650px}.preview-brand{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--gold)}
.preview-controls,.preview-simulation-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.preview-controls .button,.preview-simulation-controls .button{min-height:42px}
.preview-simulation-controls{margin-bottom:18px;justify-content:space-between}.preview-simulation-controls label{display:grid;gap:8px;min-width:0;font-size:12px;color:var(--muted)}.preview-simulation-controls select{padding:12px;max-width:100%;min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}.preview-simulation-buttons{display:flex;gap:8px;flex-wrap:wrap}
.battle-preview .scene-wrap{min-height:0}.battle-preview .landscape{width:100%;height:auto;min-height:0;max-height:none;aspect-ratio:900/650;transform:none}.battle-preview .scene-building{cursor:default}
.preview-stats{display:flex;gap:16px;flex-wrap:wrap;padding:16px 0;font-size:12px;color:var(--muted)}.preview-stats strong{color:var(--forest)}
.preview-notice{font-size:12px;line-height:1.7;border-top:1px solid var(--line);padding-top:14px;color:var(--muted)}.preview-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:var(--muted)}
.preview-error{color:var(--danger,#b54a3e);font-size:13px}.preview-error:empty{display:none}
.battle-preview .battle-narrative{margin-bottom:18px}.battle-preview #battle-command-panel{margin:18px 0}
@media(max-width:600px){.battle-preview{padding:14px}.preview-heading{margin-bottom:14px}.preview-controls{width:100%}.preview-controls .button{flex:1;padding-inline:10px}.preview-simulation-controls label{width:100%}.preview-simulation-controls select{width:100%}.preview-simulation-buttons{width:100%}.preview-simulation-buttons .button{flex:1}.battle-preview .map-top{padding:0 12px}.battle-preview .map-coordinates{display:none}.battle-preview .map-toolbar{padding:12px;height:auto;min-height:58px;gap:12px;flex-wrap:wrap}.battle-preview .map-toolbar>span{font-size:10px;max-width:100%}.preview-stats{gap:12px}}
</style></head><body><div id="app"></div><script>${script}</script></body></html>`;
await mkdir('preview', { recursive: true });
await writePreview('preview/battle.html', html, 'utf8');
console.log(
  `Offline battle-command sandbox: preview/battle.html (${Buffer.byteLength(html)} bytes)`,
);
