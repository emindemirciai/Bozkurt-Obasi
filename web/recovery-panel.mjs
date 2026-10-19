import './recovery-panel.css';
import { recoveryPlan } from '../shared/recovery.mjs';
import { icon } from './art.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const number = (value, language) =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 6,
  }).format(value);
const name = (wolf, t) => t(wolf.name === 'healer' ? 'healerPath' : wolf.name);

/** A suggestion only. Navigation to care never spends resources or sends an action. */
export function recommendedRecovery(state) {
  const rest = recoveryPlan(state, 'rest');
  const heal = recoveryPlan(state, 'healHerd');
  if (rest.wolves.some((wolf) => wolf.gain > 0) && rest.ready) return 'rest';
  if (heal.needed && heal.ready) return 'healHerd';
  return rest.ready ? 'rest' : null;
}

function reason(plan, { t, language, busy, readOnly }) {
  if (busy) return t('careSending');
  if (plan.reason === 'INSUFFICIENT_RESOURCES')
    return (
      t('careShortage') +
      ': ' +
      plan.shortages
        .map(({ resource, amount }) => `${number(amount, language)} ${t(resource)}`)
        .join(' · ')
    );
  return t(
    {
      BATTLE_ACTIVE: 'careBattleBlocked',
      JOURNEY_ACTIVE: 'careJourneyBlocked',
      ALREADY_HEALTHY: plan.kind === 'rest' ? 'carePackHealthy' : 'careHerdHealthy',
    }[plan.reason] || (readOnly ? 'careReadOnly' : 'careReady'),
  );
}

function value(key, content, attributes = '') {
  return `<span data-care-value="${key}" ${attributes}>${escape(content)}</span>`;
}

function health(before, after, maxHp, language) {
  return `${number(before, language)} → ${number(after, language)} / ${number(maxHp, language)}`;
}

function option(plan, state, suggested, context) {
  const { t, language, busy, readOnly } = context;
  const key = plan.kind;
  const herd = plan.herd;
  const herdGain = `+${number(herd.gain, language)} ${t('careHp')}`;
  const panicGain = `−${number(herd.panicReduction, language)} ${t('carePanicPoints')}`;
  return `<article class="care-option ${plan.ready ? 'is-ready' : 'is-blocked'}" data-recovery-kind="${key}">
    <header><h3>${icon(key === 'rest' ? 'heart' : 'herbs', 19)}${escape(t(key))}</h3><span id="care-suggest-${key}" class="care-suggestion" ${suggested === key ? '' : 'hidden'}>${escape(t('careSuggested'))}</span></header>
    <p class="care-description">${escape(t(key === 'rest' ? 'careRestEffect' : 'careHealEffect'))}</p>
    <p class="care-forecast-label">${escape(t('careForecast'))}</p>
    <dl class="care-forecast" aria-label="${escape(t('careForecast'))}">
      ${
        key === 'rest'
          ? plan.wolves
              .map(
                (wolf) =>
                  `<div class="care-wolf-forecast" data-recovery-wolf="${wolf.id}"><dt>${escape(
                    name(
                      state.wolves.find((entry) => entry.id === wolf.id),
                      t,
                    ),
                  )}</dt><dd>${value(`${key}-${wolf.id}-health`, health(wolf.before, wolf.after, wolf.maxHp, language))}${value(`${key}-${wolf.id}-gain`, `+${number(wolf.gain, language)} ${t('careHp')}`, 'class="care-gain"')}</dd></div>`,
              )
              .join('')
          : `<div class="care-unchanged"><dt>${escape(t('careGuardians'))}</dt><dd>${escape(t('careWolfUnchanged'))}</dd></div>`
      }
      <div data-recovery-herd-health><dt>${escape(t('careHerdHealth'))}</dt><dd>${value(`${key}-herd-health`, health(herd.before, herd.after, herd.maxHp, language))}${value(`${key}-herd-gain`, herdGain, 'class="care-gain"')}</dd></div>
      <div data-recovery-herd-panic><dt>${escape(t('panic'))}</dt><dd>${value(`${key}-herd-panic`, `${number(herd.panicBefore, language)}% → ${number(herd.panicAfter, language)}%`)}${value(`${key}-panic-reduction`, panicGain, 'class="care-gain"')}</dd></div>
    </dl>
    <div class="care-cost"><strong>${escape(t('careCost'))}</strong>${Object.entries(plan.cost)
      .map(
        ([resource, amount]) =>
          `<div data-recovery-cost="${resource}"><span>${icon(resource, 15)}${escape(t(resource))}</span>${value(`${key}-cost-${resource}`, `${number(state.resources[resource], language)} / ${number(amount, language)}`)}</div>`,
      )
      .join('')}<small>${escape(t('careAvailableRequired'))}</small></div>
    <p id="care-reason-${key}" class="care-reason" data-recovery-reason>${value(`${key}-reason`, reason(plan, context))}</p>
    <button id="${key === 'rest' ? 'recovery-rest' : 'recovery-heal-herd'}" class="button outline care-execute" data-action="${key}" aria-describedby="care-reason-${key}" ${busy || readOnly || !plan.ready ? 'disabled' : ''}>${escape(t(key))}</button>
  </article>`;
}

export function recoveryPanel(state, options = {}) {
  const context = { language: 'tr', busy: false, readOnly: false, ...options };
  const { t, language, readOnly } = context;
  const suggested = recommendedRecovery(state);
  return `<section id="recovery-panel" class="camp-care-panel" aria-labelledby="recovery-title" ${readOnly ? 'data-readonly="true"' : ''}>
    <div class="care-heading"><div><span class="eyebrow">${escape(t('careEyebrow'))}</span><h2 id="recovery-title" tabindex="-1">${escape(t('careTitle'))}</h2><p>${escape(t('careIntro'))}</p></div>${icon('heart', 28)}</div>
    <div class="care-current"><div class="care-current-pack"><h3>${escape(t('careGuardians'))}</h3><dl>${state.wolves.map((wolf) => `<div><dt>${escape(name(wolf, t))}</dt><dd>${value(`current-${wolf.id}`, `${number(wolf.hp, language)} / ${number(wolf.maxHp, language)}`)}</dd></div>`).join('')}</dl></div><div class="care-current-herd"><h3>${escape(t('herd'))}</h3><dl><div><dt>${escape(t('health'))}</dt><dd>${value('current-herd-health', `${number(state.herd.hp, language)} / ${number(state.herd.maxHp, language)}`)}</dd></div><div><dt>${escape(t('panic'))}</dt><dd>${value('current-herd-panic', `${number(state.herd.panic, language)}%`)}</dd></div></dl></div></div>
    <p class="care-next">${value('recommendation', t(suggested === 'rest' ? 'careRecommendRest' : suggested === 'healHerd' ? 'careRecommendHerd' : state.wolves.every((wolf) => wolf.hp === wolf.maxHp) && state.herd.hp === state.herd.maxHp && state.herd.panic === 0 ? 'careAllHealthy' : 'careChooseWhenReady'))}</p>
    <div class="care-options">${['rest', 'healHerd'].map((kind) => option(recoveryPlan(state, kind), state, suggested, context)).join('')}</div>
    ${readOnly ? `<p class="care-readonly">${escape(t('careReadOnly'))}</p>` : ''}
  </section>`;
}

/** Update quantities and availability without replacing focused controls or selected guardians. */
export function updateRecoveryPanel(root, state, options) {
  const panel = root.querySelector('#recovery-panel');
  if (!panel) return;
  const template = document.createElement('template');
  template.innerHTML = recoveryPanel(state, {
    ...options,
    readOnly: panel.dataset.readonly === 'true' || options?.readOnly,
  });
  const fresh = template.content.firstElementChild;
  for (const item of panel.querySelectorAll('[data-care-value]')) {
    const next = fresh.querySelector(`[data-care-value="${item.dataset.careValue}"]`);
    if (next && next.textContent !== item.textContent) item.textContent = next.textContent;
  }
  for (const item of panel.querySelectorAll('button, .care-suggestion')) {
    const next = fresh.querySelector('#' + item.id);
    if (!next) continue;
    item.hidden = next.hidden;
    if (item.matches('button')) item.disabled = next.disabled;
  }
  for (const item of panel.querySelectorAll('[data-recovery-kind]')) {
    const next = fresh.querySelector(`[data-recovery-kind="${item.dataset.recoveryKind}"]`);
    item.className = next.className;
  }
}
