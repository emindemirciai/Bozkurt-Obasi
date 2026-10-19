import '../web/style.css';
import '../web/v2.css';
import { firstWatchPanel } from '../web/first-watch-panel.mjs';
import { firstWatchJournalPanel } from '../web/first-watch-journal-panel.mjs';
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
    returning: 'Geri dönen oba · Önceki ilerleme',
    boundary: '15 dakika sınırı · Önce ve sonra',
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
    returning: 'Returning homeland · Earlier progress',
    boundary: '15-minute boundary · Before and after',
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
    returning: [5, 4],
    boundary: [3, 1],
  };
  const [done, claimed] = counts[scenario];
  const milestones =
    scenario === 'boundary'
      ? [899, 900, 901]
      : [45, 150, 250, 450, 520, 6 * 3600 + 600, 6 * 3600 + 720, 12 * 3600 + 900];
  const claims = [75, 170, 280, 475, 550, 6 * 3600 + 630, 6 * 3600 + 750, 12 * 3600 + 930];
  const elapsed = {
    beginning: 0,
    reward: 75,
    ambush: 300,
    recovery: 480,
    blocked: 75,
    complete: 12 * 3600 + 1000,
    returning: 3600,
    boundary: 901,
  }[scenario];
  state.updatedAt = now + elapsed * 1000;
  FIRST_WATCH_STEPS.forEach((step, index) => {
    if (index < done) state.firstWatch.milestones[step.id] = now + milestones[index] * 1000;
    if (index < claimed)
      state.firstWatch.claims.push({
        id: step.id,
        at: now + (scenario === 'boundary' ? 899 : claims[index]) * 1000,
      });
  });
  state.stats.gathers = done > 0 ? 1 : 0;
  state.stats.builds = done > 1 ? 1 : 0;
  state.stats.trained = done > 2 ? 1 : 0;
  state.stats.wins = done > 3 ? 1 : 0;
  if (done > 3) state.firstWatch.firstWinAt = now + 450_000;
  if (scenario === 'returning') {
    state.firstWatch.cohort = 'returning';
    // Earlier achievements were recognized on migration; their original times are unknown.
    for (const step of FIRST_WATCH_STEPS.slice(0, done)) state.firstWatch.milestones[step.id] = now;
    for (const claim of state.firstWatch.claims) claim.at = now;
    state.firstWatch.firstWinAt = now;
  }
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
    {
      beginning: 1,
      reward: 1,
      ambush: 1,
      recovery: 1,
      blocked: 1,
      complete: 1,
      returning: 1,
      boundary: 1,
    },
  )
    .map(
      (value) =>
        `<option value="${value}" ${value === scenario ? 'selected' : ''}>${copy[value]}</option>`,
    )
    .join(
      '',
    )}</select></label></section><div class="first-watch-preview-layout"><aside><h2>${copy.card}</h2><div id="compact-example">${firstWatchPanel(state, { t, language, compact: true, readOnly: true })}</div></aside><div id="chapter-example">${firstWatchPanel(state, { t, language, readOnly: true })}</div></div><div id="journal-example">${firstWatchJournalPanel(state, { t, language })}</div></main></div>`;
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
    [
      'beginning',
      'reward',
      'ambush',
      'recovery',
      'blocked',
      'complete',
      'returning',
      'boundary',
    ].includes(event.target.value)
  ) {
    scenario = event.target.value;
    render('preview-scenario');
  }
});
render();
