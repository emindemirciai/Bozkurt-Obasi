import '../web/style.css';
import { createGame } from '../shared/game.mjs';
import { translations } from '../web/i18n.mjs';
import { economyPanel, updateEconomyPanel } from '../web/economy-panel.mjs';
import { scene } from '../web/art.mjs';
import { brandMark, brandName } from '../web/logo.mjs';
import { version as releaseVersion } from '../releases.json';

// Fictional read-only village. No account, save, network request or game command.
const state = createGame(Date.UTC(2026, 9, 9, 0));
state.resources.wood = 42;
state.resources.stone = 12;
let language = 'tr',
  theme = 'light',
  plannedBuilding = 'quarry';
const root = document.querySelector('#app');
const labels = {
  tr: {
    title: 'Oba planlaması',
    notice:
      'Çevrimdışı görsel önizleme · Örnek köy · Salt okunur. Oyuna giriş için doğrulanmış hesabın gerekir.',
    theme: 'Koyu tema',
    light: 'Açık tema',
    language: 'Switch to English',
  },
  en: {
    title: 'Village planning',
    notice:
      'Offline visual preview · Fictional village · Read-only. A verified account is required to play.',
    theme: 'Dark theme',
    light: 'Light theme',
    language: 'Türkçeye geç',
  },
};
const t = (key) => translations[language][key] || key;
const number = (value) => Math.floor(value).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US');
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const context = () => ({ t, number, escape, language });
function lock() {
  const button = document.querySelector('#execute-construction-plan');
  if (button) button.disabled = true;
}
function render() {
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  document.title = 'Bozkurt Obası · ' + labels[language].title;
  root.innerHTML = `<div class="village-preview">
    <p id="offline-banner" class="village-preview-notice">${labels[language].notice} · v${releaseVersion}</p>
    <header class="village-preview-header"><div class="wordmark">${brandMark}${brandName}</div>
      <div><button id="language" class="button outline" aria-label="${labels[language].language}">${language === 'tr' ? 'EN' : 'TR'}</button>
      <button id="theme" class="button outline">${labels[language][theme === 'light' ? 'theme' : 'light']}</button></div></header>
    <main><section class="page-heading"><div><div class="eyebrow">${t('subtitle')}</div><h1>${labels[language].title}</h1></div></section>
      <section class="map-card"><div class="map-top"><span class="map-title">${t('homeland')}</span><span class="map-chip">4 ${t('buildingCount')}</span></div>
        <div class="scene-wrap">${scene(state, { battle: false, zoom: 1, selected: 'building-hall', t })}</div></section>
      ${economyPanel(state, plannedBuilding, context())}</main></div>`;
  lock();
}
root.addEventListener('click', (event) => {
  if (event.target.closest('#language')) {
    language = language === 'tr' ? 'en' : 'tr';
    render();
  } else if (event.target.closest('#theme')) {
    theme = theme === 'light' ? 'dark' : 'light';
    render();
  }
});
root.addEventListener('change', (event) => {
  if (event.target.id !== 'construction-plan') return;
  plannedBuilding = event.target.value;
  updateEconomyPanel(root, state, plannedBuilding, context());
  lock();
});
render();
