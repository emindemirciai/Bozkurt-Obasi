import '../web/style.css';
import '../web/v2.css';
import { adventureView, updateAdventurePlanning } from '../web/v2-view.mjs';
import { arrivalPanel } from '../web/arrival-panel.mjs';
import { adventurePartySuggestions } from '../web/adventure-party.mjs';
import { createGame, applyAction, advanceGame } from '../shared/game.mjs';
import { adventureQuote, REGIONS, ADVENTURE_PLANS } from '../shared/adventures.mjs';
import { translations } from '../web/i18n.mjs';
import { brandMark, brandName } from '../web/logo.mjs';
import { version as releaseVersion } from '../releases.json';

// Fictional fixed-time fixtures only. No account, storage, network or player-state mutation.
const now = Date.UTC(2026, 9, 15, 9);
const root = document.querySelector('#app');
let language = 'tr',
  theme = 'light',
  scenario = 'ready',
  state,
  selection;
const labels = {
  tr: {
    title: 'Keşif ve sevkiyat planlaması',
    notice:
      'Çevrimdışı görsel önizleme · Örnek oba · Salt okunur. Seçimler yalnızca planı gösterir; yolculuk başlatmaz, kayıt veya ödül oluşturmaz.',
    scenario: 'Örnek durum',
    ready: 'Yola hazır oba',
    lowresources: 'Eksik erzak ve yaralı sürü',
    activejourney: 'Yolculuk devam ediyor',
    completedjourney: 'Tamamlanan ikmal seferi',
    dark: 'Koyu tema',
    light: 'Açık tema',
    language: 'Switch to English',
    locked: 'Bu önizlemede yola çıkış kapalıdır. Oynamak için doğrulanmış hesabınla giriş yap.',
    fixed: 'Sabit örnek zaman · İlerleme sayacı bu önizlemede çalışmaz.',
  },
  en: {
    title: 'Exploration and escort planning',
    notice:
      'Offline visual preview · Fictional village · Read-only. Choices only show the plan; they do not start journeys, save progress or award rewards.',
    scenario: 'Example scenario',
    ready: 'Village ready to depart',
    lowresources: 'Low supplies and wounded herd',
    activejourney: 'Journey in progress',
    completedjourney: 'Completed supply run',
    dark: 'Dark theme',
    light: 'Light theme',
    language: 'Türkçeye geç',
    locked: 'Departure is disabled in this preview. Sign in with a verified account to play.',
    fixed: 'Fixed example time · The progress clock does not run in this preview.',
  },
};
const t = (key) => translations[language][key] || key;
function setScenario(value) {
  scenario = value;
  state = createGame(now - 48 * 60 * 60 * 1000);
  state.adventure.unlocked = ['homeland', 'spring', 'meadow'];
  state.inventory.leather_vest = 2;
  state.inventory.scout_charm = 1;
  state.wolves.find((wolf) => wolf.name === 'scout').equipment = 'scout_charm';
  state.wolves.find((wolf) => wolf.name === 'hunter').xp = 44;
  state.wolves.find((wolf) => wolf.name === 'healer').xp = 43;
  selection = {
    kind: 'expedition',
    plan: 'standard',
    region: 'highland',
    difficulty: 'normal',
    wolfIds: ['wolf-alpha', 'wolf-scout'],
  };
  if (scenario === 'lowresources') {
    state.resources.water = 4;
    state.resources.feed = 3;
    state.herd.hp = 48;
    state.wolves.find((wolf) => wolf.name === 'hunter').hp = 12;
  }
  if (scenario === 'activejourney' || scenario === 'completedjourney') {
    selection = {
      ...selection,
      kind: 'caravan',
      region: 'meadow',
      plan: scenario === 'activejourney' ? 'survey' : 'supply',
    };
    const quote = adventureQuote(state, selection);
    const startedAt = now - quote.seconds * (scenario === 'activejourney' ? 500 : 1000);
    applyAction(state, { type: selection.kind, ...selection }, startedAt);
    advanceGame(state, now);
  }
}
function render() {
  const focus = document.activeElement;
  const focusId = focus?.id;
  const focusRegion = focus?.dataset?.region;
  const copy = labels[language];
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  document.title = 'Bozkurt Obası · ' + copy.title;
  root.innerHTML = `<div class="adventure-preview">
    <p id="offline-banner" class="adventure-preview-notice">${copy.notice} · v${releaseVersion}</p>
    <header class="adventure-preview-header"><div class="wordmark">${brandMark}${brandName}</div><div>
      <button id="language" class="button outline" aria-label="${copy.language}">${language === 'tr' ? 'EN' : 'TR'}</button>
      <button id="theme" class="button outline">${copy[theme === 'light' ? 'dark' : 'light']}</button></div></header>
    <main><section class="adventure-preview-toolbar"><h1>${copy.title}</h1><label>${copy.scenario}<select id="preview-scenario">${['ready', 'lowresources', 'activejourney', 'completedjourney'].map((value) => `<option value="${value}" ${scenario === value ? 'selected' : ''}>${copy[value]}</option>`).join('')}</select></label></section>
      <p id="preview-departure-note" class="adventure-preview-lock">${copy.locked}</p>
      ${scenario === 'activejourney' ? `<p class="adventure-preview-clock">${copy.fixed}</p>` : ''}
      ${state.adventure.history[0] ? arrivalPanel({ ...state.adventure.history[0], source: 'returned' }, state, { t, language, readOnly: true }) : ''}
      ${adventureView(state, { t, busy: false, selection, language, now })}</main></div>`;
  // Keep the real readiness report while preventing every gameplay action.
  root
    .querySelectorAll(
      '[data-action]:not([data-action="selectRegion"]):not([data-action="openArrivalReport"])',
    )
    .forEach((button) => {
      button.disabled = true;
      button.setAttribute('aria-describedby', 'preview-departure-note');
    });
  const target = focusId
    ? document.getElementById(focusId)
    : focusRegion
      ? root.querySelector('[data-region="' + focusRegion + '"]')
      : null;
  if (target && !target.disabled) target.focus({ preventScroll: true });
}
root.addEventListener('submit', (event) => event.preventDefault());
root.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="openArrivalReport"]')) {
    const id = state.adventure.history[0]?.id;
    const report = [...root.querySelectorAll('[data-mission-report]')].find(
      (entry) => entry.dataset.missionReport === id,
    );
    if (report) {
      report.tabIndex = -1;
      report.focus({ preventScroll: true });
      report.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    return;
  }
  if (event.target.closest('#language')) {
    language = language === 'tr' ? 'en' : 'tr';
  } else if (event.target.closest('#theme')) {
    theme = theme === 'light' ? 'dark' : 'light';
  } else {
    const suggestionButton = event.target.closest('[data-party-suggestion]');
    if (suggestionButton) {
      const suggestion = adventurePartySuggestions(state, selection).find(
        (entry) => entry.id === suggestionButton.dataset.partySuggestion,
      );
      if (suggestionButton.disabled || !suggestion?.ready) return;
      selection.wolfIds = [...suggestion.wolfIds];
      for (const input of root.querySelectorAll('[name="adventure-wolf"]'))
        input.checked = selection.wolfIds.includes(input.value);
      updateAdventurePlanning(root, state, { t, busy: false, selection, language });
      root.querySelector('[data-action="startAdventure"]').disabled = true;
      return;
    }
    const choice = event.target.closest('[data-action="selectRegion"]');
    if (!choice || choice.disabled || state.adventure.active) return;
    const region = choice.dataset.region;
    if (!REGIONS.some((entry) => entry.id === region)) return;
    if (selection.kind === 'expedition' && region === 'homeland') return;
    selection.region = region;
  }
  render();
});
root.addEventListener('change', (event) => {
  const { target } = event;
  if (target.id === 'preview-scenario') {
    if (!['ready', 'lowresources', 'activejourney', 'completedjourney'].includes(target.value))
      return;
    setScenario(target.value);
  } else {
    if (state.adventure.active || target.disabled) return;
    if (target.name === 'adventure-plan') {
      if (!ADVENTURE_PLANS.includes(target.value)) return;
      selection.plan = target.value;
    } else if (target.id === 'adventure-kind') {
      selection.kind = target.value;
      if (selection.kind === 'expedition' && selection.region === 'homeland')
        selection.region = 'spring';
    } else if (target.id === 'adventure-region') {
      selection.region = target.value;
    } else if (target.id === 'adventure-difficulty') {
      selection.difficulty = target.value;
    } else if (target.name === 'adventure-wolf') {
      selection.wolfIds = [...root.querySelectorAll('[name="adventure-wolf"]:checked')].map(
        (input) => input.value,
      );
    } else return;
  }
  render();
});
setScenario(scenario);
render();
