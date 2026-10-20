import { COLLECTION_TASKS, COLLECT_COOLDOWN_MS } from '../shared/economy.mjs';
import { icon } from './art.mjs';

const taskFor = (resource) =>
  COLLECTION_TASKS.find((task) => task.id === resource) || COLLECTION_TASKS[0];

function workDetails(
  state,
  resource,
  { t, number, language = 'tr', now = Date.now(), busy = false, readOnly = false },
) {
  const task = taskFor(resource);
  const remaining = Math.max(0, Math.ceil((state.collectReadyAt - now) / 1000));
  const credit = Object.fromEntries(
    Object.entries(task.reward).map(([key, amount]) => [
      key,
      Math.max(0, Math.min(amount, state.capacity - state.resources[key])),
    ]),
  );
  const full = Object.values(credit).every((amount) => amount <= 0);
  const partial = Object.entries(task.reward).some(([key, amount]) => credit[key] < amount);
  const describe = (amounts) =>
    Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(
        ([key, amount]) =>
          `+${Number.isInteger(amount) ? number(amount) : new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 6 }).format(amount)} ${t(key)}`,
      )
      .join(' · ');
  return {
    task,
    remaining,
    full,
    reward: describe(task.reward),
    status: readOnly
      ? t('workReadOnly')
      : full
        ? t('workStorageFull')
        : remaining > 0
          ? t('workWaiting')
          : partial
            ? `${t('workPartial')}: ${describe(credit)}`
            : t('workReady'),
    disabled: readOnly || busy || remaining > 0 || full,
    label: remaining ? `${t('collecting')} · ${remaining}${t('seconds')}` : t('collect'),
  };
}

export function resourceWorkPanel(state, resource = 'mixed', ctx) {
  const { t, escape, number } = ctx;
  const details = workDetails(state, resource, ctx);
  return `<section class="resource-work" id="resource-work-panel" aria-labelledby="resource-work-title">
    <div class="resource-work-heading"><h3 id="resource-work-title">${escape(t('workTitle'))}</h3><span>${number(COLLECT_COOLDOWN_MS / 1000)} ${escape(t('seconds'))} · ${escape(t('workSharedCooldown'))}</span></div>
    <p class="resource-work-intro">${escape(t('workIntro'))}</p>
    <div class="resource-work-controls"><div><label for="collection-resource">${escape(t('workChoose'))}</label><select id="collection-resource" aria-describedby="work-reward work-status">${COLLECTION_TASKS.map((task) => `<option value="${task.id}" ${task.id === details.task.id ? 'selected' : ''}>${escape(t(`workTask_${task.id}`))}</option>`).join('')}</select></div>
      <div class="resource-work-yield"><span>${escape(t('workYield'))}</span><strong id="work-reward" data-work-reward>${escape(details.reward)}</strong><small id="work-status" data-work-status>${escape(details.status)}</small></div>
      <button class="button primary" data-action="collect" id="collect-button" ${details.disabled ? 'disabled' : ''}>${icon('plus', 17)}<span data-collect-label>${escape(details.label)}</span></button>
    </div>
  </section>`;
}

export function updateResourceWorkPanel(root, state, resource = 'mixed', ctx) {
  const panel = root.querySelector('#resource-work-panel');
  if (!panel) return;
  const details = workDetails(state, resource, ctx);
  const select = panel.querySelector('#collection-resource');
  if (select.value !== details.task.id) select.value = details.task.id;
  panel.querySelector('[data-work-reward]').textContent = details.reward;
  panel.querySelector('[data-work-status]').textContent = details.status;
  const button = panel.querySelector('#collect-button');
  button.disabled = details.disabled;
  button.querySelector('[data-collect-label]').textContent = details.label;
}
