import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { wolfArt } from '../web/art.mjs';
const points = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5,
    r = i % 2 ? 58 : 145;
  return [620 + Math.cos(a) * r, 310 + Math.sin(a) * r];
});
const star = points.map((p) => p.join(',')).join(' ');
const sheep = points
  .flatMap((p, i) =>
    Array.from({ length: 3 }, (_, j) => {
      const next = points[(i + 1) % 10],
        x = p[0] + ((next[0] - p[0]) * j) / 3,
        y = p[1] + ((next[1] - p[1]) * j) / 3;
      return `<g transform="translate(${x} ${y})"><ellipse cy="8" rx="13" ry="4" fill="#233e31" opacity=".2"/><path d="M-6 5v9M6 5v9" stroke="#5b5141" stroke-width="3"/><ellipse rx="12" ry="8" fill="#f1ecd9"/><circle cx="-13" cy="-2" r="5" fill="#d3c7ae"/><circle cx="-15" cy="-3" r="1" fill="#243b32"/></g>`;
    }),
  )
  .join('');
const wolves = Array.from({ length: 5 }, (_, i) => {
  const a = -1.1 + i * 0.55,
    x = 420 - Math.cos(a) * 110,
    y = 315 + Math.sin(a) * 178;
  return `<g transform="translate(${x} ${y})"><ellipse cy="21" rx="35" ry="10" fill="#1d3027" opacity=".22"/>${wolfArt(i === 2 ? '#82938b' : '#667a6d', 1.2, -1)}</g>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#304c3d"/><stop offset="1" stop-color="#bea770"/></linearGradient><linearGradient id="ground" x2="0" y2="1"><stop stop-color="#8c9a69"/><stop offset="1" stop-color="#536d4a"/></linearGradient></defs><rect width="960" height="540" fill="url(#sky)"/><circle cx="830" cy="86" r="30" fill="#ecd29c"/><path d="M0 210 160 60 265 174 420 95 580 205 710 85 960 190V320H0" fill="#73836b"/><path d="M0 246Q230 190 500 227T960 213V540H0" fill="url(#ground)"/><path d="M470 194v-74l74-60 74 60v74Z" fill="#eee1bb"/><path d="m460 122 84-65 84 65Z" fill="#937350"/><path d="M528 194v-46h32v46" fill="#514234"/><path d="M430 210H815M430 220H815" stroke="#6d5738" stroke-width="4"/><path d="M440 199v34m40-34v34m40-34v34m40-34v34m40-34v34m40-34v34m40-34v34m40-34v34m40-34v34m40-34v34" stroke="#6d5738" stroke-width="4"/><path d="M455 125C215 122 215 495 455 500C304 401 304 218 455 125Z" fill="#dac891" opacity=".2" stroke="#edd99d" stroke-width="3"/><polygon points="${star}" fill="#d6bc76" fill-opacity=".22" stroke="#ead6a0" stroke-width="3" stroke-dasharray="7 8"/>${sheep}${wolves}<g opacity=".9" transform="translate(155 290)">${wolfArt('#bc8251', 0.8, 1)}</g><g opacity=".85" transform="translate(110 363)">${wolfArt('#a77549', 0.65, 1)}</g><path d="M20 492q200-38 370 3t550-7" fill="none" stroke="#b3b681" stroke-width="3" opacity=".4"/></svg>`;
const directory = new URL('../server/web/assets/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('formation.svg', directory), svg);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<style>body{margin:0}</style>${svg}`);
  await page
    .locator('svg')
    .screenshot({ path: fileURLToPath(new URL('formation.png', directory)) });
} finally {
  await browser.close();
}
