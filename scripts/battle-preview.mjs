import '../web/style.css';
import '../web/v2.css';
import '../web/battle-feedback.css';
import { createGame, applyAction, advanceGame } from '../shared/game.mjs';
import { battleCommandStatus } from '../shared/battle-commands.mjs';
import { scene, icon } from '../web/art.mjs';
import { battlePhase, narrativePanel } from '../web/v2-view.mjs';
import {
  battleCommandPanel,
  updateBattleCommandPanel,
  battleCommandBadge,
  updateBattleCommandBadge,
  battleCommandQuickbar,
  updateBattleCommandQuickbar,
} from '../web/battle-command-panel.mjs';
import { translations } from '../web/i18n.mjs';
import { version } from '../releases.json';

// An isolated, in-memory demonstration. No requests, browser storage or account APIs.
const root = document.querySelector('#app');
const START = Date.UTC(2026, 9, 16, 12);
let language = 'tr',
  theme = 'light',
  scenario = 'ready',
  motion = false,
  close = false;
let state, clock;
const copy = {
  tr: {
    title: 'Savaş meydanı',
    subtitle:
      'Hilali güçlendir, saldırıyı yoğunlaştır veya sürünü ulumayla toparla. Komutları burada deneyebilirsin.',
    notice:
      'Çevrimdışı deneme alanı · Örnek savaş yalnızca bu sayfada ilerler. Hesabına bağlanılmaz; kayıt tutulmaz, gerçek kaynak veya ödül aktarılmaz. Süreyi adım adım ilerlet, savaş senaryosunu değiştir veya baştan başla.',
    dark: 'Koyu tema',
    light: 'Açık tema',
    motion: 'Animasyonu aç',
    pause: 'Animasyonu durdur',
    zoom: 'Yakınlaştır',
    resetZoom: 'Tam meydan',
    language: 'Switch to English',
    scenario: 'Savaş senaryosu',
    preparing: 'Yola çıkmadan önce',
    intro: 'Yürüyüş ve pusu',
    ready: 'Komut vermeye hazır',
    brace: 'Hilali sıklaştır · Etki aktif',
    focus: 'Odak saldırısı · Etki aktif',
    rally: 'Uluma · Sürü toparlandı',
    completed: 'Savaş tamamlandı',
    step: '1 saniye ilerlet',
    depart: 'Yola çık',
    restart: 'Senaryoyu sıfırla',
    formation: 'Hilal: muhafız kurtlar · Yıldız: korunan sürü',
    offline: 'Çevrimdışı deneme',
    time: 'Savaş süresi',
    wolves: 'Muhafız canı',
    enemies: 'Çakal canı',
    herd: 'Sürü canı',
    panic: 'Panik',
    error: 'Komut bu aşamada kullanılamıyor. Güncel durumu kontrol et.',
  },
  en: {
    title: 'Battlefield',
    subtitle:
      'Brace the crescent, strengthen the assault or rally the herd with a howl. Try each command here.',
    notice:
      'Offline sandbox · The sample battle advances only on this page. No account access, saved progress, real resources or rewards. Advance time one second at a time, switch the battle scenario or start over.',
    dark: 'Dark theme',
    light: 'Light theme',
    motion: 'Play animation',
    pause: 'Pause animation',
    zoom: 'Zoom in',
    resetZoom: 'Full battlefield',
    language: 'Türkçeye geç',
    scenario: 'Battle scenario',
    preparing: 'Before departure',
    intro: 'March and ambush',
    ready: 'Ready for commands',
    brace: 'Brace the crescent · Active',
    focus: 'Focused assault · Active',
    rally: 'Rally howl · Herd recovered',
    completed: 'Battle completed',
    step: 'Advance 1 second',
    depart: 'Depart',
    restart: 'Reset scenario',
    formation: 'Crescent: guardian wolves · Star: protected herd',
    offline: 'Offline sandbox',
    time: 'Battle time',
    wolves: 'Guardian health',
    enemies: 'Jackal health',
    herd: 'Herd health',
    panic: 'Panic',
    error: 'This command is unavailable at this stage. Check the current battle state.',
  },
};
const t = (key) => translations[language][key] || key;
function reset() {
  state = createGame(START);
  clock = START;
  if (scenario !== 'preparing') {
    applyAction(state, { type: 'startBattle' }, clock, () => 0.99);
    clock += scenario === 'intro' ? 2000 : 7000;
    advanceGame(state, clock);
    if (['brace', 'focus', 'rally'].includes(scenario))
      applyAction(state, { type: 'battleCommand', id: scenario }, clock);
    if (scenario === 'completed') {
      clock = START + 90000;
      advanceGame(state, clock);
    }
  }
}
function artwork() {
  const container = document.createElement('div');
  container.innerHTML = scene(state, { battle: true, t });
  const svg = container.querySelector('.battle-scene');
  const sources = new Map();
  // Preserve one embedded bitmap per species, rather than repeating data URLs for every animal.
  for (const image of svg.querySelectorAll('image[data-animal-kind]')) {
    const species = image.dataset.animalKind;
    if (!sources.has(species)) {
      const source = image.cloneNode(true);
      source.id = `preview-${species}`;
      source.removeAttribute('class');
      source.removeAttribute('data-animal-kind');
      svg.querySelector('defs').append(source);
      sources.set(species, source);
    }
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    for (const attr of image.attributes) use.setAttribute(attr.name, attr.value);
    use.setAttribute('href', `#preview-${species}`);
    image.replaceWith(use);
  }
  for (const actor of svg.querySelectorAll('[role="button"]')) {
    actor.removeAttribute('role');
    actor.removeAttribute('tabindex');
  }
  return container.innerHTML;
}
function render(focusId) {
  const c = copy[language];
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  document.title = 'Bozkurt Obası · ' + c.title;
  root.innerHTML = `<main class="battle-preview"><header class="preview-heading"><div><span class="preview-brand">BOZKURT OBASI · AY-YILDIZ NÖBETİ</span><h1>${c.title}</h1><p>${c.subtitle}</p></div><div class="preview-controls"><button class="button outline" id="language" aria-label="${c.language}">${language === 'tr' ? 'EN' : 'TR'}</button><button class="button outline" id="theme">${c[theme === 'light' ? 'dark' : 'light']}</button><button class="button outline" id="motion" aria-pressed="${motion}">${c[motion ? 'pause' : 'motion']}</button></div></header><p class="preview-notice" id="offline-banner">${c.notice}</p><div class="preview-simulation-controls"><label>${c.scenario}<select id="preview-scenario">${['preparing', 'intro', 'ready', 'brace', 'focus', 'rally', 'completed'].map((id) => `<option value="${id}" ${id === scenario ? 'selected' : ''}>${c[id]}</option>`).join('')}</select></label><div class="preview-simulation-buttons"><button id="preview-step" class="button primary">${c.step}</button><button id="preview-reset" class="button outline">${c.restart}</button></div></div><div id="preview-story">${narrativePanel(state, { t })}</div><section class="map-card" aria-label="${c.title}"><div class="map-top"><span class="map-title">${icon('battle', 16)}${c.title}<span class="map-chip">${c.offline}</span></span><span class="map-coordinates">04 · 12</span></div><div class="scene-wrap">${artwork()}${battleCommandBadge(state, { t })}</div><div class="map-toolbar"><span>${c.formation}</span><button class="button outline" id="zoom" aria-pressed="${close}">${c[close ? 'resetZoom' : 'zoom']}</button></div>${battleCommandQuickbar(state, { t })}</section><div class="preview-stats" aria-live="off" id="preview-stats"></div>${battleCommandPanel(state, { t })}<p class="preview-error" role="alert" id="preview-error"></p><footer class="preview-footer"><span>© 2026 Bozkurt Obası</span><span>v${version}</span></footer></main>`;
  refresh();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}
function refresh() {
  const c = copy[language],
    svg = root.querySelector('.battle-scene');
  const status = battleCommandStatus(state);
  svg.dataset.phase = battlePhase(state);
  svg.dataset.command = status.activeCommand || '';
  svg.dataset.rally = String(
    status.lastCommand?.id === 'rally' &&
      state.battle.tick - status.lastCommand.tick < 2 &&
      state.battle.status === 'active',
  );
  svg.classList.toggle('is-active', motion && state.battle.status === 'active');
  svg
    .querySelector('.battle-actors')
    .setAttribute('viewBox', close ? '140 95 570 455' : '0 0 900 650');
  for (const actor of svg.querySelectorAll('[data-wolf]')) {
    const wolf = state.wolves.find((w) => w.id === actor.dataset.wolf);
    actor.querySelector('[data-hp-bar]').setAttribute('width', String((42 * wolf.hp) / wolf.maxHp));
    actor.classList.toggle('is-wounded', wolf.hp < wolf.maxHp * 0.35);
  }
  for (const actor of svg.querySelectorAll('[data-enemy-id]')) {
    const enemy = state.battle.enemies.find((e) => e.id === actor.dataset.enemyId);
    actor.style.display = enemy.hp > 0 ? '' : 'none';
    actor
      .querySelector('[data-hp-bar]')
      .setAttribute('width', String((32 * enemy.hp) / enemy.maxHp));
  }
  root.querySelector('#preview-story').innerHTML = narrativePanel(state, { t });
  root.querySelector('#preview-stats').innerHTML =
    `<span>${c.time}: <strong data-preview-tick>${state.battle.tick}</strong> s</span><span>${c.wolves}: <strong>${Math.ceil(state.wolves.reduce((sum, wolf) => sum + wolf.hp, 0))}</strong></span><span>${c.enemies}: <strong>${Math.ceil(state.battle.enemies.reduce((sum, enemy) => sum + enemy.hp, 0))}</strong></span><span>${c.herd}: <strong>${Math.ceil(state.herd.hp)}/${state.herd.maxHp}</strong></span><span>${c.panic}: <strong data-preview-panic>${Math.round(state.herd.panic)}%</strong></span>`;
  const step = root.querySelector('#preview-step');
  step.textContent = c[state.battle.status === 'preparing' ? 'depart' : 'step'];
  step.disabled = ['won', 'lost'].includes(state.battle.status);
  updateBattleCommandPanel(root, state, { t });
  updateBattleCommandBadge(root, state, { t });
  updateBattleCommandQuickbar(root, state, { t });
}
root.addEventListener('change', (event) => {
  if (event.target.id !== 'preview-scenario') return;
  scenario = event.target.value;
  reset();
  render('preview-scenario');
});
root.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.id === 'language') {
    language = language === 'tr' ? 'en' : 'tr';
    render('language');
  } else if (button.id === 'theme') {
    theme = theme === 'light' ? 'dark' : 'light';
    render('theme');
  } else if (button.id === 'motion') {
    motion = !motion;
    button.textContent = copy[language][motion ? 'pause' : 'motion'];
    button.setAttribute('aria-pressed', String(motion));
    refresh();
  } else if (button.id === 'zoom') {
    close = !close;
    button.textContent = copy[language][close ? 'resetZoom' : 'zoom'];
    button.setAttribute('aria-pressed', String(close));
    refresh();
  } else if (button.id === 'preview-reset') {
    reset();
    render('preview-reset');
  } else if (button.id === 'preview-step' || button.dataset.action === 'battleCommand') {
    try {
      if (button.dataset.action === 'battleCommand')
        applyAction(state, { type: 'battleCommand', id: button.dataset.command }, clock);
      else if (state.battle.status === 'preparing')
        applyAction(state, { type: 'startBattle' }, clock, () => 0.99);
      else {
        clock += 1000;
        advanceGame(state, clock);
      }
      root.querySelector('#preview-error').textContent = '';
      refresh();
      if (button.dataset.action === 'battleCommand')
        root
          .querySelector(
            button.id.startsWith('battle-command-quick-')
              ? '#battle-command-quick-title'
              : '#battle-command-title',
          )
          ?.focus({ preventScroll: true });
    } catch {
      root.querySelector('#preview-error').textContent = copy[language].error;
    }
  }
});
reset();
render();
