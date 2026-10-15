import { herdRecoveryPlan, REPLENISH_BATCH_LIMIT } from '../shared/herd.mjs';
import { icon } from './art.mjs';

const reasonKeys = {
  INVALID_REPLENISH_AMOUNT: 'herdInvalidAmount',
  BATTLE_ACTIVE: 'herdBattleBlocked',
  JOURNEY_ACTIVE: 'herdJourneyBlocked',
  HERD_FULL: 'herdFull',
  PASTURE_REQUIRED: 'herdPastureRequired',
  HERD_LIMIT: 'herdLimit',
  INSUFFICIENT_RESOURCES: 'herdResourcesRequired',
};

function details(state, plan, { t, escape, number }) {
  return `<div class="herd-replenish-resources">${Object.entries(plan.cost)
    .map(([resource, amount]) => {
      const missing = Math.max(0, amount - state.resources[resource]);
      return `<div class="herd-replenish-resource ${missing ? 'is-short' : ''}">${icon(resource, 22)}<div><strong>${escape(t(resource))}</strong><span>${escape(t('herdCost'))}: ${number(amount)} · ${escape(t('herdAvailable'))}: ${number(state.resources[resource])}</span><small>${missing ? escape(t('herdShortage')) + ': ' + number(Math.ceil(missing)) : escape(t('planningEnough'))}</small></div></div>`;
    })
    .join('')}</div>
  <p class="herd-replenish-status ${plan.ready ? 'is-ready' : ''}" role="status">${escape(t(reasonKeys[plan.reason] || 'herdReady'))}</p>`;
}

export function herdPanel(state, amount = 1, ctx) {
  const { t, escape, number, busy = false, readOnly = false } = ctx;
  const plan = herdRecoveryPlan(state, amount);
  return `<section class="herd-recovery-panel" id="herd-recovery-panel" aria-labelledby="herd-recovery-title">
    <div class="herd-recovery-heading"><div><span class="eyebrow">${escape(t('pasture'))}</span><h2 id="herd-recovery-title">${escape(t('herdReplenish'))}</h2><p>${escape(t('herdReplenishIntro'))}</p></div><strong class="herd-count" data-herd-count>${number(state.herd.count)} / ${number(plan.maxCount)}</strong></div>
    <div class="herd-replenish-layout"><div class="herd-replenish-choice"><label for="herd-replenish-amount">${escape(t('herdAmount'))}</label><select id="herd-replenish-amount" aria-describedby="herd-replenish-hint" ${busy || plan.missing === 0 ? 'disabled' : ''}>${Array.from(
      { length: REPLENISH_BATCH_LIMIT },
      (_, i) => i + 1,
    )
      .map(
        (value) =>
          `<option value="${value}" ${value === amount ? 'selected' : ''} ${value > plan.maxAmount ? 'disabled' : ''}>${number(value)}</option>`,
      )
      .join('')}</select><p id="herd-replenish-hint">${escape(t('herdSelectionHint'))}</p></div>
    <div><div data-herd-quote>${details(state, plan, ctx)}</div><button class="button primary herd-replenish-button" id="herd-replenish-button" data-action="replenishHerd" ${busy || readOnly || !plan.ready ? 'disabled' : ''}>${icon('plus', 18)}${escape(t('herdReplenish'))}</button></div></div>
    <p class="herd-replenish-note">${escape(t(readOnly ? 'herdPreviewHint' : 'herdWoundsHint'))}</p>
  </section>`;
}

// Keep the quantity control and button nodes stable during background production polls.
export function updateHerdPanel(root, state, amount = 1, ctx) {
  const panel = root.querySelector('#herd-recovery-panel');
  if (!panel) return;
  const plan = herdRecoveryPlan(state, amount);
  panel.querySelector('[data-herd-count]').textContent =
    ctx.number(state.herd.count) + ' / ' + ctx.number(plan.maxCount);
  const quote = panel.querySelector('[data-herd-quote]');
  const html = details(state, plan, ctx);
  if (quote.innerHTML !== html) quote.innerHTML = html;
  const select = panel.querySelector('#herd-replenish-amount');
  select.disabled = Boolean(ctx.busy || !plan.missing);
  for (const option of select.options) option.disabled = Number(option.value) > plan.maxAmount;
  if (select.value !== String(amount)) select.value = String(amount);
  panel.querySelector('#herd-replenish-button').disabled = Boolean(
    ctx.busy || ctx.readOnly || !plan.ready,
  );
}
