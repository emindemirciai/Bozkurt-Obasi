import './first-watch-journal-panel.css';
import { firstWatchJournal } from './first-watch-journal.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

function duration(milliseconds, t, language) {
  if (milliseconds === null) return '—';
  const number = new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US');
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    minimumIntegerDigits: 2,
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format((milliseconds % 60_000) / 1000);
  const hourPrefix = hours ? `${number.format(hours)} ${t('journeyHours')} ` : '';
  return `${hourPrefix}${number.format(minutes)} ${t('fwJournalMinutes')} ${seconds} ${t('fwJournalSeconds')}`;
}
const field = (name, text) =>
  `<span id="fw-journal-${name}" data-journal-value="${name}">${escape(text)}</span>`;

export function firstWatchJournalPanel(state, { t, language = 'tr' } = {}) {
  const journal = firstWatchJournal(state);
  const number = (value) =>
    new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US').format(value);
  const windowState = !journal.timingAvailable
    ? 'fwJournalWindowUnknown'
    : journal.windowClosed
      ? 'fwJournalWindowClosed'
      : 'fwJournalWindowOpen';
  const timingNote = journal.inferred
    ? 'fwJournalInferred'
    : journal.timingAvailable
      ? 'fwJournalMeasured'
      : 'fwJournalUnavailable';
  const metrics = [
    ['elapsed', 'fwJournalElapsed', duration(journal.elapsedMs, t, language)],
    ['first-win', 'fwJournalFirstWin', duration(journal.firstWin.elapsedMs, t, language)],
    ['battle-recovery', 'fwJournalBattleRecovery', duration(journal.battleRecoveryMs, t, language)],
  ];
  const row = (step) => {
    const statusKey =
      step.status === 'claimed'
        ? 'fwJournalClaimed'
        : step.status === 'pendingClaim'
          ? 'fwJournalPendingClaim'
          : step.status === 'current'
            ? 'fwJournalCurrent'
            : step.completed
              ? 'fwJournalCompletedLocked'
              : 'fwJournalLocked';
    const windowText =
      step.withinWindow === null
        ? '—'
        : t(step.withinWindow ? 'fwJournalWithinWindow' : 'fwJournalAfterWindow');
    return `<li data-journal-step="${step.id}" data-journal-status="${step.status}" data-journal-window="${step.withinWindow === null ? 'unknown' : step.withinWindow ? 'within' : 'after'}"><div class="fw-journal-step-heading"><span class="fw-journal-step-number" aria-hidden="true">${String(step.index + 1).padStart(2, '0')}</span><div><h4>${escape(t(`fw_${step.id}`))}</h4><p class="fw-journal-status">${field(`status-${step.id}`, t(statusKey))}</p></div></div><dl class="fw-journal-step-times"><div><dt>${t('fwJournalCompletedAt')}</dt><dd>${field(`completed-${step.id}`, duration(step.completionMs, t, language))}</dd></div><div><dt>${t('fwJournalClaimedAt')}</dt><dd>${field(`claimed-${step.id}`, duration(step.claimMs, t, language))}</dd></div><div><dt>${t('fwJournalClaimDelay')}</dt><dd>${field(`claim-delay-${step.id}`, duration(step.claimDelayMs, t, language))}</dd></div><div class="fw-journal-window-cell"><dt>${t('fwJournalFirst15')}</dt><dd>${field(`window-${step.id}`, windowText)}</dd></div></dl></li>`;
  };
  return `<section id="first-watch-journal" class="first-watch-journal" data-journal-cohort="${journal.cohort ?? 'unknown'}" data-journal-timing="${journal.timingAvailable}" aria-labelledby="fw-journal-title" aria-describedby="fw-journal-clock-note fw-journal-timing-explanation"><header class="fw-journal-heading"><div><span class="eyebrow">${t('fwJournalEyebrow')}</span><h3 id="fw-journal-title" tabindex="-1">${t('fwJournalTitle')}</h3></div><div class="fw-journal-counts"><span>${field('completed-count', number(journal.completed))} / ${number(journal.total)} ${t('fwJournalCompletedCount')}</span><span>${field('claimed-count', number(journal.claimed))} / ${number(journal.total)} ${t('fwJournalClaimedCount')}</span></div></header><p class="fw-journal-intro">${t('fwJournalIntro')}</p><p id="fw-journal-clock-note" class="fw-journal-clock-note">${t('fwJournalClockNote')}</p><p id="fw-journal-timing-explanation" class="fw-journal-timing-note">${field('timing-note', t(timingNote))}</p><div class="fw-journal-metrics">${metrics.map(([id, label, value]) => `<dl><dt>${t(label)}</dt><dd>${field(id, value)}</dd></dl>`).join('')}</div><div class="fw-journal-window"><span class="fw-journal-window-marker" aria-hidden="true">15</span><div><h4>${t('fwJournalWindowTitle')}</h4><p>${field('window-state', t(windowState))}</p><p class="fw-journal-window-hint">${t('fwJournalWindowHint')}</p></div></div><ol class="fw-journal-steps" aria-label="${t('fwJournalSteps')}">${journal.steps.map(row).join('')}</ol><p class="fw-journal-footnote">${t('fwJournalMissingNote')}</p></section>`;
}

/** Polling refreshes recorded values without replacing headings or quest controls. */
export function updateFirstWatchJournalPanel(root, state, options) {
  const panel = root.querySelector('#first-watch-journal');
  if (!panel) return;
  const template = document.createElement('template');
  template.innerHTML = firstWatchJournalPanel(state, options);
  const fresh = template.content.firstElementChild;
  for (const key of ['data-journal-cohort', 'data-journal-timing'])
    panel.setAttribute(key, fresh.getAttribute(key));
  for (const node of panel.querySelectorAll('[data-journal-value]')) {
    const updated = fresh.querySelector(`[data-journal-value="${node.dataset.journalValue}"]`);
    if (updated && updated.textContent !== node.textContent) node.textContent = updated.textContent;
  }
  for (const row of panel.querySelectorAll('[data-journal-step]')) {
    const updated = fresh.querySelector(`[data-journal-step="${row.dataset.journalStep}"]`);
    for (const key of ['data-journal-status', 'data-journal-window'])
      row.setAttribute(key, updated.getAttribute(key));
  }
}
