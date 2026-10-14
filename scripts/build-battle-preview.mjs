import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createGame } from '../shared/game.mjs';
import { translations } from '../web/i18n.mjs';
import { icon, scene } from '../web/art.mjs';

// Display-only, offline scene: no account, game action, storage or network access.
const state = createGame(0);
const text = {
  tr: {
    title: 'Savaş meydanı',
    subtitle: 'Gerçekçi kurtlar, çakallar ve ay-yıldız düzenindeki sürü.',
    notice: 'Yalnızca görsel önizleme. Oyuna giriş için doğrulanmış hesabın gerekir.',
    dark: 'Koyu tema',
    light: 'Açık tema',
    motion: 'Animasyonu aç',
    pause: 'Animasyonu durdur',
    zoom: 'Yakınlaştır',
    reset: 'Tam meydan',
    formation: 'Hilal: muhafız kurtlar · Yıldız: korunan sürü',
    wolf: 'Kurt',
    jackal: 'Çakal',
    sheep: 'Koyun',
    cow: 'Büyükbaş',
    offline: 'Çevrimdışı görsel test',
    language: 'Dili değiştir',
    animals: 'Hayvanlar',
  },
  en: {
    title: 'Battlefield',
    subtitle: 'Realistic wolves, jackals and a herd in crescent-star formation.',
    notice: 'Visual preview only. A verified account is required to enter the game.',
    dark: 'Dark theme',
    light: 'Light theme',
    motion: 'Play animation',
    pause: 'Pause animation',
    zoom: 'Zoom in',
    reset: 'Full battlefield',
    formation: 'Crescent: guardian wolves · Star: protected herd',
    wolf: 'Wolf',
    jackal: 'Jackal',
    sheep: 'Sheep',
    cow: 'Cattle',
    offline: 'Offline visual test',
    language: 'Switch language',
    animals: 'Animals',
  },
};
let artwork = scene(state, { battle: true, t: (key) => translations.tr[key] || key });
// Preview the completed formation without starting an account or a game simulation.
artwork = artwork.replace('data-phase="preparing"', 'data-phase="clash"');
const terrain = artwork.match(/<image class="battlefield-terrain"[^>]*href="([^"]+)"/);
if (!terrain) throw new Error('The battlefield terrain is missing.');
artwork = artwork.replace(
  terrain[1],
  `data:image/webp;base64,${(await readFile(fileURLToPath(terrain[1]))).toString('base64')}`,
);
const sources = new Map();
for (const match of artwork.matchAll(
  /<image[^>]*data-animal-kind="([^"]+)"[^>]*href="([^"]+)"[^>]*\/>/g,
)) {
  const [, species, url] = match;
  if (!sources.has(species)) {
    const bytes = await readFile(fileURLToPath(url));
    sources.set(
      species,
      `<image id="preview-${species}" width="512" height="341" href="data:image/webp;base64,${bytes.toString('base64')}"/>`,
    );
  }
  artwork = artwork.replace(
    match[0],
    match[0].replace('<image ', '<use ').replace(`href="${url}"`, `href="#preview-${species}"`),
  );
}
if (sources.size !== 4)
  throw new Error('The battlefield preview requires all four local animal assets.');
artwork = artwork.replace('<defs>', `<defs>${[...sources.values()].join('')}`);
artwork = artwork.replaceAll('role="button" tabindex="0"', '');
const legalNotice = (await readFile('index.html', 'utf8')).match(/<!--[\s\S]*?-->/)?.[0];
if (!legalNotice?.includes('MIT License')) throw new Error('MIT source notice is missing.');
const css =
  (await readFile('web/style.css', 'utf8')) + '\n' + (await readFile('web/v2.css', 'utf8'));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const favicon = `data:image/svg+xml;base64,${(await readFile('public/brand/logo-mark.svg')).toString('base64')}`;
const html = `<!doctype html>${legalNotice}
<html lang="tr" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="Emin DEMİRCİ"><meta name="copyright" content="Copyright © 2026 Emin DEMİRCİ; MIT License"><meta name="description" content="Bozkurt Obası gerçekçi savaş meydanı çevrimdışı görsel önizlemesi."><link rel="icon" href="${favicon}"><title>Bozkurt Obası · Savaş meydanı önizlemesi</title><style>${css}
.battle-preview {max-width:1200px;margin:auto;padding:24px;}
.preview-heading {display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.preview-heading h1 {font-family:Georgia,serif;font-size:clamp(26px,4vw,36px);color:var(--forest);margin:5px 0 8px;}
.preview-heading p {line-height:1.6;color:var(--muted);max-width:650px;}
.preview-brand {font-size:11px;font-weight:700;letter-spacing:2px;color:var(--gold);}
.preview-controls {display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.preview-controls .button {min-height:42px;}
.battle-preview .scene-wrap {min-height:0;}
.battle-preview .landscape {width:100%;height:auto;min-height:0;max-height:none;aspect-ratio:900/650;transform:none;}
.battle-preview .scene-building {cursor:default;}
.preview-legend {display:flex;gap:18px;flex-wrap:wrap;padding:18px 0 10px;font-size:12px;color:var(--muted);}
.preview-legend strong {color:var(--forest);margin-right:4px;}
.preview-notice {font-size:12px;line-height:1.6;border-top:1px solid var(--line);padding-top:14px;color:var(--muted);}
.preview-footer {display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:var(--muted);}
@media(max-width:600px){.battle-preview{padding:14px;}.preview-heading{margin-bottom:14px;}.preview-controls{width:100%;}.preview-controls .button{flex:1;}.battle-preview .map-top{padding:0 12px;}.preview-legend{gap:12px;}.battle-preview .map-toolbar{padding:12px;height:auto;min-height:58px;}.battle-preview .map-toolbar>span{font-size:10px;}}
</style></head><body><main class="battle-preview">
<header class="preview-heading"><div><span class="preview-brand">BOZKURT OBASI · AY-YILDIZ NÖBETİ</span><h1 data-text="title">${text.tr.title}</h1><p data-text="subtitle">${text.tr.subtitle}</p></div><div class="preview-controls"><button class="button outline" id="language" type="button" data-label="language" aria-label="Dili değiştir">EN</button><button class="button outline" id="theme" type="button" data-text="dark">${text.tr.dark}</button><button class="button primary" id="motion" type="button" aria-pressed="false" data-text="motion">${text.tr.motion}</button></div></header>
<section class="map-card" data-label="title" aria-label="Savaş meydanı"><div class="map-top"><span class="map-title">${icon('battle', 16)}<span data-text="title">${text.tr.title}</span><span class="map-chip" data-text="offline">${text.tr.offline}</span></span><span class="map-coordinates">04 · 12</span></div><div class="scene-wrap">${artwork}</div><div class="map-toolbar"><span data-text="formation">${text.tr.formation}</span><button class="button outline" id="zoom" type="button" aria-pressed="false" data-text="zoom">${text.tr.zoom}</button></div></section>
<div class="preview-legend" data-label="animals" aria-label="Hayvanlar"><span><strong data-text="wolf">${text.tr.wolf}</strong> × ${state.wolves.length}</span><span><strong data-text="jackal">${text.tr.jackal}</strong> × ${state.battle.enemies.length}</span><span><strong data-text="sheep">${text.tr.sheep}</strong></span><span><strong data-text="cow">${text.tr.cow}</strong></span></div>
<p class="preview-notice" data-text="notice">${text.tr.notice}</p><footer class="preview-footer"><span>© 2026 Bozkurt Obası</span><span>v${version}</span></footer></main>
<script>
const copy = ${JSON.stringify(text)};
let language = 'tr';
const motion = document.querySelector('#motion');
const theme = document.querySelector('#theme');
const zoom = document.querySelector('#zoom');
const battlefield = document.querySelector('.battle-scene');
function translate() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-label]').forEach((element) => {element.setAttribute('aria-label', copy[language][element.dataset.label]);});
  document.querySelectorAll('[data-text]').forEach((element) => {element.textContent = copy[language][element.dataset.text];});
  document.querySelector('#language').textContent = language === 'tr' ? 'EN' : 'TR';
  battlefield.setAttribute('aria-label', copy[language].title);
  document.title = 'Bozkurt Obası · ' + copy[language].title;
}
document.querySelector('#language').addEventListener('click', () => {language = language === 'tr' ? 'en' : 'tr';translate();});
theme.addEventListener('click', () => {const dark = document.documentElement.dataset.theme !== 'dark';document.documentElement.dataset.theme = dark ? 'dark' : 'light';theme.dataset.text = dark ? 'light' : 'dark';translate();});
motion.addEventListener('click', () => {const active = battlefield.classList.toggle('is-active');motion.setAttribute('aria-pressed', String(active));motion.dataset.text = active ? 'pause' : 'motion';translate();});
zoom.addEventListener('click', () => {const close = zoom.getAttribute('aria-pressed') !== 'true';zoom.setAttribute('aria-pressed', String(close));zoom.dataset.text = close ? 'reset' : 'zoom';battlefield.setAttribute('viewBox', close ? '140 95 570 455' : '0 0 900 650');translate();});
translate();
</script></body></html>`;
await mkdir('preview', { recursive: true });
await writeFile('preview/battle.html', html, 'utf8');
console.log(`Offline battlefield preview: preview/battle.html (${Buffer.byteLength(html)} bytes)`);
