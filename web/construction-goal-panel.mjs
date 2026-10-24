import './construction-goal.css';
import { RESOURCE_KEYS } from '../shared/game.mjs';
import { constructionGoalStatus } from './construction-goal.mjs';
import { productionForecast } from './planning.mjs';
import { buildingSiteLabel } from './settlement-labels.mjs';
import { icon } from './art.mjs';

const HOURS = [1, 4, 8, 12, 24];
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const phrase = (t, key, values = {}) =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll('{' + name + '}', value),
    t(key),
  );
const format = (value, language = 'tr') =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 6,
  }).format(value);
const whole = (value, language = 'tr') =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 0,
  }).format(value);

function details(state, goal, options) {
  const ctx = { language: 'tr', busy: false, readOnly: false, forecastHours: 8, ...options };
  ctx.escape ||= escape;
  const { t, language } = ctx;
  let result = null;
  if (goal) {
    try {
      result = constructionGoalStatus(state, goal);
    } catch {
      // Invalid local preferences cannot make the village or its planning panel fail.
    }
  }
  const selected = result?.goal || null;
  const status = result?.status || 'empty';
  const plan = result?.plan || null;
  const hasGoal = Boolean(selected && result);
  const forecastHours = HOURS.includes(Number(ctx.forecastHours)) ? Number(ctx.forecastHours) : 8;
  const forecast = productionForecast(state, forecastHours);
  const building =
    selected?.buildingId && state.buildings.find((entry) => entry.id === selected.buildingId);
  const name = hasGoal
    ? phrase(t, selected.mode === 'build' ? 'goalBuildTarget' : 'goalUpgradeTarget', {
        type: t(selected.type),
        count: whole(selected.count, language),
        level: whole(selected.level, language),
      })
    : t('goalEmptyTitle');
  const site = building ? buildingSiteLabel(building, t) : '';
  const statusKey =
    {
      completed: 'goalCompletedHint',
      missing: 'goalMissingHint',
      changed: 'goalChangedHint',
      ready: 'goalReadyHint',
    }[status] ||
    {
      battle: 'planningBattleBlocked',
      capacity: 'planningCapacityBlocked',
      production: 'planningProductionBlocked',
      buildingLimit: 'buildingLimit',
      plotsFull: 'planningPlotsFull',
      maxLevel: 'planningMaxLevel',
      targetMissing: 'planningTargetMissing',
    }[plan?.blocked] ||
    'goalProgressHint';
  return {
    ctx,
    selected,
    status,
    plan,
    hasGoal,
    name,
    site,
    statusText: hasGoal ? t(statusKey) : t('goalEmptyHint'),
    forecastHours,
    forecast,
  };
}

function goalResource(key, detail) {
  const {
    ctx: { t, language },
  } = detail;
  const deficit = detail.plan?.deficits.find((entry) => entry.key === key);
  const available = deficit?.available || 0;
  const required = deficit?.required || 0;
  const credited = Math.min(available, required);
  const ratio = required > 0 ? Math.min(100, Math.max(0, (credited / required) * 100)) : 0;
  const disabled =
    !deficit ||
    deficit.missing <= 0 ||
    available >= detail.forecast.resources.find((entry) => entry.key === key)?.capacity ||
    detail.ctx.busy ||
    detail.ctx.readOnly;
  return `<article class="construction-goal-resource" data-goal-resource="${key}" ${deficit ? '' : 'hidden'}>
    <div class="construction-goal-resource-heading"><strong>${icon(key, 16)}${escape(t(key))}</strong><span><b data-goal-available>${escape(format(available, language))}</b> / <b data-goal-required>${escape(format(required, language))}</b></span></div>
    <div class="construction-goal-fill" role="progressbar" aria-label="${escape(t(key))}" aria-valuemin="0" aria-valuemax="${required}" aria-valuenow="${credited}"><span style="width:${ratio}%"></span></div>
    <div class="construction-goal-resource-footer"><span>${escape(t('planningShortfall'))}: <b data-goal-missing>${escape(format(deficit?.missing || 0, language))}</b></span><button class="button outline construction-goal-gather" data-action="goalGather" data-resource="${key}" ${disabled ? 'disabled' : ''}>${escape(phrase(t, 'goalGather', { resource: t(key) }))}${icon('arrow', 14)}</button></div>
  </article>`;
}

function forecastRow(key, detail) {
  const {
    ctx: { t, language },
  } = detail;
  const row = detail.forecast.resources.find((entry) => entry.key === key);
  return `<div class="construction-forecast-row" data-forecast-resource="${key}"><span class="construction-forecast-resource">${icon(key, 15)}${escape(t(key))}</span><span><b data-forecast-gain>+${escape(format(row.credited, language))}</b><small>${escape(t('offlineForecastAdded'))}</small></span><span><b data-forecast-projected>${escape(format(row.projected, language))}</b><small>${escape(t('offlineForecastProjected'))}</small></span><small class="construction-forecast-overflow" data-forecast-overflow ${row.overflow > 0 ? '' : 'hidden'}>${escape(phrase(t, 'offlineForecastOverflow', { amount: format(row.overflow, language) }))}</small></div>`;
}

/** Read-only goal tracking. Buttons navigate/select; spending stays in existing explicit controls. */
export function constructionGoalPanel(state, goal, options = {}) {
  const detail = details(state, goal, options);
  const {
    ctx: { t, language, busy, readOnly },
    hasGoal,
    status,
    forecast,
  } = detail;
  const canReview = hasGoal && ['active', 'ready'].includes(status);
  return `<section id="construction-goal-panel" class="construction-goal" data-goal-status="${status}" aria-labelledby="construction-goal-title" ${readOnly ? 'data-readonly="true"' : ''}>
    <header class="construction-goal-heading"><div><span class="eyebrow">${escape(t('goalEyebrow'))}</span><h3 id="construction-goal-title" tabindex="-1">${escape(t('goalTitle'))}</h3></div>${icon('target', 25)}</header>
    <p class="construction-goal-empty" data-goal-empty ${hasGoal ? 'hidden' : ''}>${escape(t('goalEmptyHint'))}</p>
    <div class="construction-goal-content" data-goal-content ${hasGoal ? '' : 'hidden'}>
      <h4 data-goal-name>${escape(detail.name)}</h4><p class="construction-goal-site" data-goal-site ${detail.site ? '' : 'hidden'}>${escape(detail.site)}</p>
      <p id="construction-goal-status" class="construction-goal-status" data-goal-status-text role="status">${escape(detail.statusText)}</p>
      <div class="construction-goal-resources" data-goal-resources ${detail.plan ? '' : 'hidden'}>${RESOURCE_KEYS.map((key) => goalResource(key, detail)).join('')}</div>
      <p class="construction-goal-stock-note" data-goal-stock-note ${detail.plan ? '' : 'hidden'}>${escape(t('goalStockHint'))}</p>
      <div class="construction-goal-actions"><button class="button primary" data-action="reviewConstructionGoal" aria-describedby="construction-goal-status" ${busy || readOnly || !canReview ? 'disabled' : ''}>${escape(t('goalReview'))}${icon('arrow', 15)}</button><button class="button outline" data-action="clearConstructionGoal" ${busy || readOnly || !hasGoal ? 'disabled' : ''}>${escape(t('goalClear'))}</button></div>
      <p class="construction-goal-device-note">${escape(t('goalSavedDevice'))}</p>
      <section class="construction-forecast" aria-labelledby="construction-forecast-title"><div class="construction-forecast-heading"><div><h4 id="construction-forecast-title">${escape(t('offlineForecastTitle'))}</h4><p>${escape(t('offlineForecastIntro'))}</p></div><label for="goal-absence-hours">${escape(t('offlineForecastAbsence'))}<select id="goal-absence-hours">${HOURS.map((hours) => `<option value="${hours}" ${hours === detail.forecastHours ? 'selected' : ''}>${escape(phrase(t, 'offlineForecastHours', { hours: whole(hours, language) }))}</option>`).join('')}</select></label></div>
        <p class="construction-forecast-time">${escape(t('offlineForecastCreditedTime'))}: <strong data-forecast-credited-time>${escape(phrase(t, 'offlineForecastHours', { hours: format(forecast.creditedSeconds / 3600, language) }))}</strong></p>
        <p class="construction-forecast-cap" data-forecast-cap-warning ${forecast.capped ? '' : 'hidden'}>${escape(phrase(t, 'offlineForecastCap', { requested: whole(detail.forecastHours, language), credited: format(forecast.creditedSeconds / 3600, language) }))}</p>
        <div class="construction-forecast-rows">${RESOURCE_KEYS.map((key) => forecastRow(key, detail)).join('')}</div>
        <p class="construction-forecast-assumptions">${escape(t('offlineForecastAssumption'))}</p>
      </section>
    </div>
  </section>`;
}

/** Keep each button, forecast selector and focused control while resource polling refreshes data. */
export function updateConstructionGoalPanel(root, state, goal, options = {}) {
  const panel = root.querySelector('#construction-goal-panel');
  if (!panel) return;
  const context = { ...options, readOnly: panel.dataset.readonly === 'true' || options.readOnly };
  const detail = details(state, goal, context);
  const template = document.createElement('template');
  template.innerHTML = constructionGoalPanel(state, goal, context);
  const fresh = template.content.firstElementChild;
  panel.dataset.goalStatus = detail.status;
  for (const selector of [
    '[data-goal-name]',
    '[data-goal-site]',
    '[data-goal-status-text]',
    '[data-forecast-credited-time]',
    '[data-forecast-cap-warning]',
  ]) {
    const node = panel.querySelector(selector),
      next = fresh.querySelector(selector);
    if (node.textContent !== next.textContent) node.textContent = next.textContent;
  }
  for (const selector of [
    '[data-goal-empty]',
    '[data-goal-content]',
    '[data-goal-site]',
    '[data-goal-resources]',
    '[data-goal-stock-note]',
    '[data-forecast-cap-warning]',
  ])
    panel.querySelector(selector).hidden = fresh.querySelector(selector).hidden;
  for (const key of RESOURCE_KEYS) {
    const row = panel.querySelector('[data-goal-resource="' + key + '"]'),
      next = fresh.querySelector('[data-goal-resource="' + key + '"]');
    row.hidden = next.hidden;
    for (const selector of ['[data-goal-available]', '[data-goal-required]', '[data-goal-missing]'])
      row.querySelector(selector).textContent = next.querySelector(selector).textContent;
    const fill = row.querySelector('[role="progressbar"]'),
      nextFill = next.querySelector('[role="progressbar"]');
    for (const name of ['aria-valuemax', 'aria-valuenow'])
      fill.setAttribute(name, nextFill.getAttribute(name));
    fill.firstElementChild.style.width = nextFill.firstElementChild.style.width;
    const forecastRow = panel.querySelector('[data-forecast-resource="' + key + '"]'),
      nextForecastRow = fresh.querySelector('[data-forecast-resource="' + key + '"]');
    for (const selector of [
      '[data-forecast-gain]',
      '[data-forecast-projected]',
      '[data-forecast-overflow]',
    ])
      forecastRow.querySelector(selector).textContent =
        nextForecastRow.querySelector(selector).textContent;
    forecastRow.querySelector('[data-forecast-overflow]').hidden = nextForecastRow.querySelector(
      '[data-forecast-overflow]',
    ).hidden;
  }
  for (const button of panel.querySelectorAll('button')) {
    const action = button.dataset.action;
    const selector =
      '[data-action="' +
      action +
      '"]' +
      (button.dataset.resource ? '[data-resource="' + button.dataset.resource + '"]' : '');
    button.disabled = fresh.querySelector(selector).disabled;
  }
  const select = panel.querySelector('#goal-absence-hours');
  if (select.value !== String(detail.forecastHours)) select.value = String(detail.forecastHours);
}
