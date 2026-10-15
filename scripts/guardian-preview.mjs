import '../web/style.css';
import '../web/v2.css';
import { guardianPanel } from '../web/guardian-panel.mjs';
import { createGame } from '../shared/game.mjs';
import { ITEM_DEFINITIONS } from '../shared/adventures.mjs';
import { translations } from '../web/i18n.mjs';
import { brandMark, brandName } from '../web/logo.mjs';
import { version as releaseVersion } from '../releases.json';

// Fixed fictional examples. No account, storage, network request or game command.
const root = document.querySelector('#app');
const now = Date.UTC(2026, 9, 15, 12);
let language = 'tr',
  theme = 'light',
  scenario = 'ready',
  selectedId = 'wolf-alpha',
  state;
const labels = {
  tr: {
    title: 'Muhafız gelişimi',
    notice:
      'Çevrimdışı görsel önizleme · Örnek muhafızlar · Salt okunur. Eğitim ve ekipman işlemleri kapalıdır; kaynak harcanmaz, oyuncu kaydına erişilmez.',
    scenario: 'Örnek durum',
    ready: 'Eğitime hazır muhafızlar',
    supplies: 'Eksik eğitim kaynakları',
    away: 'Seferdeki izci',
    maximum: 'En yüksek seviyedeki alfa',
    dark: 'Koyu tema',
    light: 'Açık tema',
    language: 'Switch to English',
    hint: 'Kurtları seçerek can, deneyim, eğitim yolları ve ekipman etkilerini incele. Oynamak için doğrulanmış hesabınla giriş yap.',
  },
  en: {
    title: 'Guardian progression',
    notice:
      'Offline visual preview · Fictional guardians · Read-only. Training and equipment actions are disabled; no resources are spent and no player save is accessed.',
    scenario: 'Example scenario',
    ready: 'Guardians ready to train',
    supplies: 'Insufficient training supplies',
    away: 'Scout on an expedition',
    maximum: 'Alpha at the level cap',
    dark: 'Dark theme',
    light: 'Light theme',
    language: 'Türkçeye geç',
    hint: 'Select a wolf to inspect health, experience, training paths and equipment effects. Sign in with a verified account to play.',
  },
};
const t = (key) => translations[language][key] || key;
function setScenario(value) {
  scenario = value;
  state = createGame(now);
  state.inventory = Object.fromEntries(ITEM_DEFINITIONS.map((item, index) => [item.id, index + 1]));
  state.wolves.forEach((wolf, index) => {
    wolf.level = [4, 3, 3, 2, 2][index];
    wolf.xp = [95, 85, 45, 32, 60][index];
    wolf.points = [2, 1, 0, 1, 2][index];
    wolf.maxHp += (wolf.level - 1) * 6;
    wolf.hp = wolf.maxHp - [24, 48, 15, 0, 10][index];
    wolf.equipment = [null, 'iron_guard', 'leather_vest', 'scout_charm', 'healer_satchel'][index];
  });
  state.wolves[0].ranks.leader = 3;
  state.wolves[1].ranks.guardian = 3;
  state.wolves[2].ranks.hunter = 2;
  state.wolves[4].ranks.healer = 2;
  if (scenario === 'supplies') {
    state.resources.herbs = 3;
    state.resources.feed = 7;
  } else if (scenario === 'away') {
    selectedId = 'wolf-scout';
    state.adventure.sequence = 1;
    state.adventure.active = {
      id: 'outing-1',
      kind: 'expedition',
      region: 'spring',
      difficulty: 'easy',
      wolfIds: ['wolf-scout'],
      startedAt: now - 15000,
      endsAt: now + 36000,
    };
  } else if (scenario === 'maximum') {
    selectedId = 'wolf-alpha';
    const wolf = state.wolves[0];
    wolf.level = 20;
    wolf.xp = 899;
    wolf.maxHp = 280;
    wolf.hp = 250;
    wolf.points = 2;
    wolf.ranks.leader = 5;
  }
}
function render(focusWolf = false) {
  const copy = labels[language];
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  document.title = 'Bozkurt Obası · ' + copy.title;
  root.innerHTML = `<div class="guardian-preview">
    <p id="offline-banner" class="guardian-preview-notice">${copy.notice} · v${releaseVersion}</p>
    <header class="guardian-preview-header"><div class="wordmark">${brandMark}${brandName}</div><div>
      <button id="language" class="button outline" aria-label="${copy.language}">${language === 'tr' ? 'EN' : 'TR'}</button>
      <button id="theme" class="button outline">${copy[theme === 'light' ? 'dark' : 'light']}</button></div></header>
    <main><section class="guardian-preview-toolbar"><h1>${copy.title}</h1><label>${copy.scenario}<select id="preview-scenario">${['ready', 'supplies', 'away', 'maximum'].map((value) => `<option value="${value}" ${scenario === value ? 'selected' : ''}>${copy[value]}</option>`).join('')}</select></label></section>
      <p id="preview-guardian-note" class="guardian-preview-hint">${copy.hint}</p>
      ${guardianPanel(state, selectedId, { t, language, busy: false, readOnly: true })}</main></div>`;
  // This preview never registers gameplay action handlers, and all action buttons stay locked.
  root.querySelectorAll('[data-action]').forEach((button) => {
    button.disabled = true;
    button.setAttribute(
      'aria-describedby',
      [button.getAttribute('aria-describedby'), 'preview-guardian-note'].filter(Boolean).join(' '),
    );
  });
  if (focusWolf)
    root.querySelector(`button[data-wolf="${selectedId}"]`)?.focus({ preventScroll: true });
}
root.addEventListener('submit', (event) => event.preventDefault());
root.addEventListener('click', (event) => {
  if (event.target.closest('#language')) {
    language = language === 'tr' ? 'en' : 'tr';
    render();
  } else if (event.target.closest('#theme')) {
    theme = theme === 'light' ? 'dark' : 'light';
    render();
  } else {
    const button = event.target.closest('button[data-wolf]');
    if (!button || button.disabled || !state.wolves.some((wolf) => wolf.id === button.dataset.wolf))
      return;
    selectedId = button.dataset.wolf;
    render(true);
  }
});
root.addEventListener('change', (event) => {
  if (event.target.id !== 'preview-scenario' || !Object.hasOwn(labels.tr, event.target.value))
    return;
  if (!['ready', 'supplies', 'away', 'maximum'].includes(event.target.value)) return;
  setScenario(event.target.value);
  render();
  root.querySelector('#preview-scenario')?.focus({ preventScroll: true });
});
setScenario(scenario);
render();
