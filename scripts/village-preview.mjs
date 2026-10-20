import '../web/style.css';
import '../web/v2.css';
import '../web/village-camera.css';
import { mountVillageCamera, villageCameraControls } from '../web/village-camera.mjs';
import { wolfPortrait, settlementControls } from '../web/v2-view.mjs';
import { BUILDINGS, TOWER_PLOTS, demolitionQuote } from '../shared/settlement.mjs';
import { demolitionDialog } from '../web/demolition-panel.mjs';
import { createGame } from '../shared/game.mjs';
import { translations } from '../web/i18n.mjs';
import { economyPanel, updateEconomyPanel } from '../web/economy-panel.mjs';
import { herdPanel, updateHerdPanel } from '../web/herd-panel.mjs';
import { scene } from '../web/art.mjs';
import { brandMark, brandName } from '../web/logo.mjs';
import { version as releaseVersion } from '../releases.json';

// Fictional read-only village. No account, save, network request or game command.
const state = createGame(Date.UTC(2026, 9, 9, 0));
const villageBuildings = BUILDINGS.filter((building) => building.id !== 'watchtower').map(
  (building, index) => ({
    id: 'building-' + building.id,
    type: building.id,
    level: [1, 3, 5][BUILDINGS.findIndex((entry) => entry.id === building.id) % 3],
    x: 1 + (index % 4),
    y: 1 + Math.floor(index / 4) * 2,
  }),
);
const cornerTowers = (level) =>
  TOWER_PLOTS.map((plot, index) => {
    return {
      id: 'building-watchtower' + (index ? '-' + (index + 1) : ''),
      type: 'watchtower',
      level,
      x: plot.x,
      y: plot.y,
    };
  });
state.buildings = [...villageBuildings];
state.stats.builds = state.buildings.length;
function updateCapacity() {
  state.capacity =
    500 +
    state.buildings.reduce(
      (total, building) =>
        total +
        (building.type === 'storage'
          ? 250 * building.level
          : building.type === 'hall'
            ? 100 * (building.level - 1)
            : 0),
      0,
    );
}
updateCapacity();
state.walls.level = 3;
state.herd = { count: 20, maxHp: 200, hp: 150, panic: 30 };
state.resources.wood = 42;
state.resources.stone = 12;
let language = 'tr',
  theme = 'light',
  plannedBuilding = 'quarry',
  towerLevel = 1,
  replenishAmount = 1,
  demolitionOpen = false;
const root = document.querySelector('#app');
let camera = null,
  cameraState = {};
const labels = {
  tr: {
    title: 'Oba planlaması',
    tier: 'Mimari aşama',
    corners: 'Ayrılmış kule yerleri',
    towersBuilt: 'Dört köşe kulesi inşa edilmiş',
    towersEmpty: 'Dört boş kule yeri',
    towerTier: 'Kulelerin kendi seviyesi',
    towerNotice:
      'Dört köşe yalnızca gözcü kulesine ayrılır. Kuleleri oyuncu inşa eder; taşınamaz, yükseltilebilir veya kaldırılabilir. Sur seviyesi kule seviyesini değiştirmez.',
    guardians: 'Gerçekçi muhafızlar',
    notice:
      'Çevrimdışı görsel önizleme · Örnek köy · Salt okunur. Kaynak harcanmaz. Oyuna giriş için doğrulanmış hesabın gerekir.',
    theme: 'Koyu tema',
    light: 'Açık tema',
    language: 'Switch to English',
  },
  en: {
    title: 'Village planning',
    tier: 'Architecture tier',
    corners: 'Reserved tower sites',
    towersBuilt: 'Four corner towers built',
    towersEmpty: 'Four empty tower sites',
    towerTier: 'Towers’ own level',
    towerNotice:
      'The four corners accept watchtowers only. Players build them; towers cannot move but can be upgraded or demolished. Wall level does not change tower level.',
    guardians: 'Realistic guardians',
    notice:
      'Offline visual preview · Fictional village · Read-only. No resources are spent. A verified account is required to play.',
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
const recoveryContext = () => ({ ...context(), busy: false, readOnly: true });
function lock() {
  const button = document.querySelector('#execute-construction-plan');
  if (button) button.disabled = true;
  root
    .querySelectorAll('[data-action=upgradeWall], [data-action=replenishHerd]')
    .forEach((b) => (b.disabled = true));
  root.querySelectorAll('.scene-building').forEach((e) => {
    e.removeAttribute('role');
    e.removeAttribute('tabindex');
  });
}
function exampleRemoval() {
  const quote = demolitionQuote(state, 'building-well');
  return demolitionDialog(
    state,
    { id: quote.building.id, expected: quote.expected, quote },
    { t, language, busy: false, readOnly: true },
  );
}
function closeExample() {
  demolitionOpen = false;
  render();
  root.querySelector('#preview-demolition-open')?.focus({ preventScroll: true });
}
function render() {
  if (camera) {
    cameraState = camera.getState();
    camera.destroy();
    camera = null;
  }
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  document.title = 'Bozkurt Obası · ' + labels[language].title;
  root.innerHTML = `<div class="village-preview">
    <p id="offline-banner" class="village-preview-notice">${labels[language].notice} · v${releaseVersion}</p>
    <header class="village-preview-header"><div class="wordmark">${brandMark}${brandName}</div>
      <div><button id="language" class="button outline" aria-label="${labels[language].language}">${language === 'tr' ? 'EN' : 'TR'}</button>
      <button id="theme" class="button outline">${labels[language][theme === 'light' ? 'theme' : 'light']}</button></div></header>
    <main><section class="page-heading"><div><div class="eyebrow">${t('subtitle')}</div><h1>${labels[language].title}</h1></div></section>
      <section class="map-card"><div class="map-top"><span class="map-title">${t('homeland')}</span><span class="map-chip">${state.buildings.length} ${t('buildingCount')}</span></div>
        <div class="scene-wrap">${scene(state, { battle: false, selected: 'building-hall', t })}${villageCameraControls({ t })}</div></section>
      ${settlementControls(state, { t, busy: true })}<label class="preview-tier">${labels[language].tier} <select id="preview-tier"><option value="1" ${state.walls.level === 1 ? 'selected' : ''}>1</option><option value="3" ${state.walls.level === 3 ? 'selected' : ''}>3</option><option value="5" ${state.walls.level === 5 ? 'selected' : ''}>5</option></select></label><label class="preview-tier">${labels[language].corners} <select id="preview-corners"><option value="built" ${state.buildings.some((building) => building.type === 'watchtower') ? 'selected' : ''}>${labels[language].towersBuilt}</option><option value="empty" ${state.buildings.some((building) => building.type === 'watchtower') ? '' : 'selected'}>${labels[language].towersEmpty}</option></select></label><label class="preview-tier">${labels[language].towerTier} <select id="preview-tower-tier"><option value="1" ${towerLevel === 1 ? 'selected' : ''}>1</option><option value="3" ${towerLevel === 3 ? 'selected' : ''}>3</option><option value="5" ${towerLevel === 5 ? 'selected' : ''}>5</option></select></label><p class="village-preview-notice">${labels[language].towerNotice}</p><section class="preview-guardians"><h2>${labels[language].guardians}</h2><div>${state.wolves.map((w) => `<article>${wolfPortrait(w)}<h3>${t(w.name === 'healer' ? 'healerPath' : w.name)}</h3></article>`).join('')}</div></section>${economyPanel(state, plannedBuilding, context())}${herdPanel(state, replenishAmount, recoveryContext())}<section class="detail-card demolition-preview"><h2>${t('demolitionPreviewTitle')}</h2><p>${t('demolitionIntro')}</p><button id="preview-demolition-open" class="button outline">${t('demolitionPreviewOpen')}</button></section></main></div>${demolitionOpen ? exampleRemoval() : ''}`;
  camera = mountVillageCamera(root.querySelector('.scene-wrap'), {
    saved: cameraState,
    t,
    onChange: (next) => {
      cameraState = next;
    },
    canInteract: () => !demolitionOpen,
  });
  lock();
  if (demolitionOpen) root.querySelector('#demolition-cancel')?.focus({ preventScroll: true });
}
root.addEventListener('click', async (event) => {
  if (event.target.closest('[data-action=fullscreen]')) {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await root.querySelector('.map-card').requestFullscreen();
    return;
  }
  if (event.target.closest('#preview-demolition-open')) {
    demolitionOpen = true;
    render();
    return;
  }
  if (
    demolitionOpen &&
    (event.target.closest('[data-action="close"]') || event.target.matches('.modal-backdrop'))
  ) {
    closeExample();
    return;
  }
  if (event.target.closest('#language')) {
    language = language === 'tr' ? 'en' : 'tr';
    render();
  } else if (event.target.closest('#theme')) {
    theme = theme === 'light' ? 'dark' : 'light';
    render();
  }
});
root.addEventListener('change', (event) => {
  if (event.target.id === 'preview-corners') {
    state.buildings = state.buildings.filter((building) => building.type !== 'watchtower');
    if (event.target.value === 'built') state.buildings.push(...cornerTowers(towerLevel));
    state.stats.builds = state.buildings.length;
    updateCapacity();
    render();
    root.querySelector('#preview-corners')?.focus({ preventScroll: true });
    return;
  }
  if (event.target.id === 'preview-tower-tier') {
    towerLevel = Number(event.target.value);
    state.buildings
      .filter((building) => building.type === 'watchtower')
      .forEach((building) => (building.level = towerLevel));
    render();
    root.querySelector('#preview-tower-tier')?.focus({ preventScroll: true });
    return;
  }
  if (event.target.id === 'preview-tier') {
    const level = Number(event.target.value);
    state.buildings
      .filter((building) => building.type !== 'watchtower')
      .forEach((building) => (building.level = level));
    state.walls.level = level;
    updateCapacity();
    render();
    root.querySelector('#preview-tier').value = String(level);
    return;
  }
  if (event.target.id === 'herd-replenish-amount') {
    replenishAmount = Number(event.target.value);
    updateHerdPanel(root, state, replenishAmount, recoveryContext());
    lock();
    return;
  }
  if (event.target.id !== 'construction-plan') return;
  plannedBuilding = event.target.value;
  updateEconomyPanel(root, state, plannedBuilding, context());
  lock();
});
root.addEventListener('keydown', (event) => {
  if (!demolitionOpen) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeExample();
  } else if (event.key === 'Tab') {
    const controls = [...root.querySelectorAll('#demolition-dialog button:not(:disabled)')];
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
render();
