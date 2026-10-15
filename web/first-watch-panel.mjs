import './first-watch.css';
import { firstWatchProgress } from '../shared/first-watch.mjs';
import { icon } from './art.mjs';
import heroImage from './assets/hero-bozkurt.webp';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const stepIcons = {
  gather: 'feed',
  build: 'village',
  train: 'wolves',
  battle: 'battle',
  recover: 'heart',
  explore: 'flag',
  equip: 'wolves',
  escort: 'flag',
};
function rewards(step, t, language) {
  const number = (value) =>
    new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(value);
  return Object.entries(step.reward)
    .map(
      ([key, value]) =>
        `<span>${icon(key, 15)}<span>${number(value)} ${escape(t(key))}</span></span>`,
    )
    .join('');
}
function controls(step, { t, busy, readOnly, language }) {
  if (step.claimed)
    return `<p class="first-watch-claimed">${icon('check', 16)}${t('fwClaimed')}</p>`;
  const explanation = step.locked
    ? t('fwLocked')
    : step.storageBlocked && step.completed
      ? t('fwStorageFull') +
        ' ' +
        Object.entries(step.missingCapacity)
          .map(([key, value]) => `${Math.ceil(value)} ${t(key)}`)
          .join(' · ')
      : step.completed
        ? t('fwRewardReady')
        : t(`fw_${step.id}Goal`);
  const storageControl =
    step.completed && !step.locked
      ? `<button id="fw-storage-${step.id}" class="button outline first-watch-storage" data-action="firstWatchStorage" ${step.storageBlocked ? '' : 'hidden'} ${busy || readOnly ? 'disabled' : ''}>${t('fwManageStorage')}${icon('arrow', 16)}</button>`
      : '';
  const action = step.completed ? 'claimFirstWatch' : 'firstWatchGo';
  const label = step.completed ? t('claim') : t(`fw_${step.id}Action`);
  return `<p id="fw-reason-${step.id}" class="first-watch-reason">${escape(explanation)}</p><button id="fw-action-${step.id}" class="button ${step.completed ? 'primary' : 'outline'}" data-action="${action}" data-id="${step.id}" aria-describedby="fw-reason-${step.id}" ${busy || readOnly || step.locked || (step.completed && !step.claimable) ? 'disabled' : ''}>${label}${icon(step.completed ? 'flag' : 'arrow', 16)}</button>${storageControl}`;
}
export function firstWatchPanel(state, options = {}) {
  const { t, language = 'tr', compact = false, readOnly = false, busy = false } = options;
  const chapter = firstWatchProgress(state);
  const context = { t, language, busy, readOnly };
  const counter = `${chapter.claimed} / ${chapter.total} ${t('fwProgressLabel')}`;
  const progress = `<div class="first-watch-progress" role="progressbar" aria-label="${t('fwTitle')}" aria-valuemin="0" aria-valuemax="${chapter.total}" aria-valuenow="${chapter.claimed}" aria-valuetext="${counter}"><span style="width:${(chapter.claimed / chapter.total) * 100}%"></span></div>`;
  const next = chapter.current;
  if (compact)
    return `<section id="first-watch-panel" class="first-watch first-watch-compact" data-compact="true" aria-labelledby="fw-title"><div class="first-watch-heading"><span class="eyebrow">${t('fwChapter')}</span><span class="first-watch-count">${counter}</span></div><h3 id="fw-title">${t('fwTitle')}</h3>${progress}${next ? `<div class="first-watch-current" aria-current="step" data-step="${next.id}"><span class="first-watch-step-number">${String(next.index + 1).padStart(2, '0')} · ${t(next.completed ? 'fwRewardReady' : 'fwNext')}</span><h4>${t(`fw_${next.id}`)}</h4><p>${t(`fw_${next.id}Story`)}</p><div class="first-watch-rewards" aria-label="${t('reward')}">${rewards(next, t, language)}</div>${controls(next, context)}</div>` : `<p class="first-watch-finale">${t('fwFinale')}</p>`}<button class="first-watch-all" data-view="quests" ${readOnly ? 'disabled' : ''}>${t('fwAll')}${icon('arrow', 15)}</button></section>`;
  return `<section id="first-watch-panel" class="first-watch first-watch-chapter" data-compact="false" aria-labelledby="fw-title"><header class="first-watch-hero" style="--chapter-image:url('${heroImage}')"><div><span class="eyebrow">${t('fwChapter')}</span><h2 id="fw-title">${t('fwTitle')}</h2><p>${t(chapter.finished ? 'fwFinale' : 'fwIntro')}</p><span class="first-watch-count">${counter}</span>${progress}</div></header><p class="first-watch-order">${t('fwOrder')}</p><ol class="first-watch-steps">${chapter.steps.map((step) => `<li class="first-watch-step ${step.claimed ? 'is-claimed' : ''} ${step.locked ? 'is-locked' : ''}" data-step="${step.id}" ${next?.id === step.id ? 'aria-current="step"' : ''}><div class="first-watch-step-header"><span class="first-watch-seal" aria-hidden="true">${step.claimed ? icon('check', 22) : icon(stepIcons[step.id], 22)}</span><div><span class="first-watch-step-number">${String(step.index + 1).padStart(2, '0')} · ${t(step.claimed ? 'fwClaimed' : step.locked ? 'fwLater' : step.completed ? 'fwRewardReady' : 'fwNext')}</span><h3>${t(`fw_${step.id}`)}</h3></div></div><p class="first-watch-story">${t(`fw_${step.id}Story`)}</p><p class="first-watch-objective">${icon(step.completed ? 'check' : 'target', 15)}${t(`fw_${step.id}Goal`)}${step.completed && !step.claimed ? ` <span>· ${t('fwObjectiveDone')}</span>` : ''}</p><div class="first-watch-rewards" aria-label="${t('reward')}">${rewards(step, t, language)}</div>${controls(step, context)}</li>`).join('')}</ol></section>`;
}

export function updateFirstWatchPanel(root, state, options) {
  const panel = root.querySelector('#first-watch-panel');
  if (!panel) return;
  const template = document.createElement('template');
  template.innerHTML = firstWatchPanel(state, {
    ...options,
    compact: panel.dataset.compact === 'true',
  });
  // Resource production may affect reward capacity without changing chapter milestones.
  const fresh = template.content.firstElementChild;
  for (const button of panel.querySelectorAll('[data-action]')) {
    const updated = fresh.querySelector(`#${button.id}`);
    if (updated) {
      button.disabled = updated.disabled;
      button.hidden = updated.hidden;
    }
  }
  for (const reason of panel.querySelectorAll('.first-watch-reason')) {
    const updated = fresh.querySelector(`#${reason.id}`);
    if (updated && updated.textContent !== reason.textContent)
      reason.textContent = updated.textContent;
  }
}
