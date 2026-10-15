import '../web/style.css';
import '../web/v2.css';
import { firstWatchPanel } from '../web/first-watch-panel.mjs';
import { FIRST_WATCH_STEPS } from '../shared/first-watch.mjs';
import { createGame } from '../shared/game.mjs';
import { translations } from '../web/i18n.mjs';
import { brandMark, brandName } from '../web/logo.mjs';
import { version } from '../releases.json';

const root = document.querySelector('#app');
const now = Date.UTC(2026, 9, 15, 12);
let language = 'tr',
  theme = 'light',
  scenario = 'beginning';
const labels = {
  tr: {
    title: 'İlk Nöbet · Hikâye görevleri',
    notice:
      'Çevrimdışı görsel önizleme · Örnek hikâye durumları · Salt okunur. Ödül alınmaz, kaynak harcanmaz ve oyuncu hesabına erişilmez.',
    scenario: 'Hikâyedeki aşama',
    beginning: 'Yeni oba · İlk hedef',
    reward: 'İlk ödül hazır',
    ambush: 'Geçitteki pusu',
    recovery: 'Savaş sonrası toparlanma',
    blocked: 'Ödül için depo dolu',
    complete: 'İlk Nöbet tamamlandı',
    card: 'Köydeki sıradaki hedef kartı',
    dark: 'Koyu tema',
    light: 'Açık tema',
    language: 'Switch to English',
  },
  en: {
    title: 'First Watch · Story quests',
    notice:
      'Offline visual preview · Fictional story states · Read-only. No rewards are claimed, resources spent or player accounts accessed.',
    scenario: 'Story stage',
    beginning: 'New homeland · First objective',
    reward: 'First reward ready',
    ambush: 'Ambush in the pass',
    recovery: 'Recovery after battle',
    blocked: 'Storage is full for the reward',
    complete: 'First Watch completed',
    card: 'Next objective card in the village',
    dark: 'Dark theme',
    light: 'Light theme',
    language: 'Türkçeye geç',
  },
};
function example() {
  const state = createGame(now);
  const counts = {
    beginning: [0, 0],
    reward: [1, 0],
    ambush: [3, 3],
    recovery: [4, 4],
    blocked: [1, 0],
    complete: [8, 8],
  };
  const [done, claimed] = counts[scenario];
  FIRST_WATCH_STEPS.forEach((step, index) => {
    if (index < done) state.firstWatch.milestones[step.id] = now;
    if (index < claimed) state.firstWatch.claims.push({ id: step.id, at: now });
  });
  if (scenario === 'blocked') state.resources.wood = state.capacity;
  return state;
}
function render(focusId) {
  const copy = labels[language],
    t = (key) => translations[language][key] || key;
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  document.title = 'Bozkurt Obası · ' + copy.title;
  const state = example();
  root.innerHTML = `<div class="first-watch-preview"><p id="offline-banner" class="first-watch-preview-notice">${copy.notice} · v${version}</p><header class="first-watch-preview-header"><div class="wordmark">${brandMark}${brandName}</div><div><button id="language" class="button outline" aria-label="${copy.language}">${language === 'tr' ? 'EN' : 'TR'}</button><button id="theme" class="button outline">${copy[theme === 'light' ? 'dark' : 'light']}</button></div></header><main><section class="first-watch-preview-toolbar"><h1>${copy.title}</h1><label>${copy.scenario}<select id="preview-scenario">${Object.keys(
    { beginning: 1, reward: 1, ambush: 1, recovery: 1, blocked: 1, complete: 1 },
  )
    .map(
      (value) =>
        `<option value="${value}" ${value === scenario ? 'selected' : ''}>${copy[value]}</option>`,
    )
    .join(
      '',
    )}</select></label></section><div class="first-watch-preview-layout"><aside><h2>${copy.card}</h2><div id="compact-example">${firstWatchPanel(state, { t, language, compact: true, readOnly: true })}</div></aside><div id="chapter-example">${firstWatchPanel(state, { t, language, readOnly: true })}</div></div></main></div>`;
  // Both examples share the production component; prefix IDs so the document remains accessible.
  for (const [index, panel] of [...root.querySelectorAll('#first-watch-panel')].entries()) {
    for (const node of [panel, ...panel.querySelectorAll('[id]')])
      node.id = `example-${index}-${node.id}`;
    for (const node of [
      panel,
      ...panel.querySelectorAll('[aria-labelledby], [aria-describedby]'),
    ]) {
      for (const key of ['aria-labelledby', 'aria-describedby'])
        if (node.hasAttribute(key))
          node.setAttribute(
            key,
            node
              .getAttribute(key)
              .split(' ')
              .map((value) => `example-${index}-${value}`)
              .join(' '),
          );
    }
  }
  if (focusId) root.querySelector('#' + focusId)?.focus({ preventScroll: true });
}
root.addEventListener('click', (event) => {
  if (event.target.closest('#language')) {
    language = language === 'tr' ? 'en' : 'tr';
    render('language');
  } else if (event.target.closest('#theme')) {
    theme = theme === 'light' ? 'dark' : 'light';
    render('theme');
  }
});
root.addEventListener('change', (event) => {
  if (
    event.target.id === 'preview-scenario' &&
    ['beginning', 'reward', 'ambush', 'recovery', 'blocked', 'complete'].includes(
      event.target.value,
    )
  ) {
    scenario = event.target.value;
    render('preview-scenario');
  }
});
render();
