import { BUILDINGS } from '../shared/game.mjs';
import { buildingSiteLabel } from './settlement-labels.mjs';
import { icon } from './art.mjs';
import { resourceOutlook, constructionPlan } from './planning.mjs';

const sourceBuildings = {
  water: 'well',
  feed: 'pasture',
  herbs: 'healer',
  wood: 'lumber',
  stone: 'quarry',
};

function duration(seconds, { t, number }) {
  const total = Math.max(1, Math.ceil(seconds));
  const units = [
    [86_400, 'planningDays'],
    [3600, 'planningHours'],
    [60, 'planningMinutes'],
    [1, 'seconds'],
  ];
  let remaining = total;
  const parts = [];
  for (const [size, label] of units) {
    const amount = Math.floor(remaining / size);
    remaining %= size;
    if (amount) parts.push(`${number(amount)} ${t(label)}`);
    if (parts.length === 2) break;
  }
  return parts.join(' ');
}

function resourceDetails(resource, ctx) {
  const { t, number, language = 'tr' } = ctx;
  const rate = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 2,
  }).format(resource.rate);
  return {
    stock: `${number(resource.amount)} / ${number(resource.capacity)}`,
    rate: `+${rate} ${t('perMinute')}`,
    status: resource.isFull
      ? t('planningFull')
      : resource.fullInSeconds === null
        ? t('planningNoProduction')
        : `${t('planningFullIn')} ${duration(resource.fullInSeconds, ctx)}`,
    fill: Math.min(100, Math.max(0, (resource.amount / resource.capacity) * 100)),
  };
}

function resourceCard(resource, ctx) {
  const { t, escape } = ctx;
  const details = resourceDetails(resource, ctx);
  return `<article class="economy-resource ${resource.isFull ? 'is-full' : ''}" data-economy-resource="${resource.key}">
    <div class="economy-resource-name">${icon(resource.key, 17)}<h3>${escape(t(resource.key))}</h3></div>
    <strong class="economy-stock" data-economy-stock>${escape(details.stock)}</strong>
    <span class="economy-capacity">${escape(t('capacity'))}</span>
    <div class="economy-fill" role="progressbar" aria-label="${escape(t(resource.key))}" aria-valuemin="0" aria-valuemax="${resource.capacity}" aria-valuenow="${Math.floor(resource.amount)}"><span style="width:${details.fill}%"></span></div>
    <div class="economy-production"><span>${escape(t('production'))}</span><strong data-economy-rate>${escape(details.rate)}</strong></div>
    <p class="economy-fill-status" data-economy-fill-status>${escape(details.status)}</p>
  </article>`;
}

function targetLabel(plan, { t }) {
  return `${t(plan.type)} · ${t('level')} ${plan.level}`;
}

function statusLabel(plan, ctx) {
  const { t } = ctx;
  if (plan.blocked) {
    return t(
      {
        battle: 'planningBattleBlocked',
        maxLevel: 'planningMaxLevel',
        capacity: 'planningCapacityBlocked',
        production: 'planningProductionBlocked',
        buildingLimit: 'buildingLimit',
        plotsFull: 'planningPlotsFull',
        targetMissing: 'planningTargetMissing',
      }[plan.blocked],
    );
  }
  return plan.affordable
    ? t('planningReady')
    : `${t('planningReadyIn')} ${duration(plan.waitSeconds, ctx)}`;
}

function deficitLabel(deficit, capacity, ctx) {
  const { t } = ctx;
  if (deficit.missing <= 0) return t('planningEnough');
  if (deficit.required > capacity) return t('planningExceedsCapacity');
  if (deficit.seconds === null)
    return `${t('planningGatherOrBuild')} ${t(sourceBuildings[deficit.key])}`;
  return `${t('planningEstimatedWait')} ${duration(deficit.seconds, ctx)}`;
}

function planBody(plan, capacity, ctx) {
  const { t, number, escape } = ctx;
  return `<div class="economy-plan-heading"><h3>${escape(targetLabel(plan, ctx))}</h3><span>${escape(t(plan.blocked === 'maxLevel' ? 'maxLevel' : plan.mode === 'build' ? 'planningNewBuilding' : 'planningNextLevel'))}</span></div>
    <div class="economy-deficits" role="table" aria-label="${escape(t('planningRequiredResources'))}">
      <div class="economy-deficit-labels" role="row"><span role="columnheader">${escape(t('planningResource'))}</span><span role="columnheader">${escape(t('planningAvailableRequired'))}</span><span role="columnheader">${escape(t('planningShortfall'))}</span><span class="economy-status-heading" role="columnheader">${escape(t('planningResourceStatus'))}</span></div>
      ${plan.deficits
        .map(
          (
            deficit,
          ) => `<div class="economy-deficit ${deficit.missing > 0 ? 'is-short' : 'is-enough'}" role="row" data-economy-deficit="${deficit.key}">
          <span class="economy-deficit-name" role="cell">${icon(deficit.key, 15)}${escape(t(deficit.key))}</span>
          <span class="economy-deficit-stock" role="cell">${escape(number(deficit.available))} / ${escape(number(deficit.required))}</span>
          <span class="economy-deficit-missing" role="cell">${escape(number(Math.ceil(deficit.missing)))}</span>
          <span class="economy-deficit-hint" role="cell">${escape(deficitLabel(deficit, capacity, ctx))}</span>
        </div>`,
        )
        .join('')}
    </div>
    <p class="economy-plan-status ${plan.blocked ? 'is-blocked' : plan.affordable ? 'is-ready' : ''}" data-economy-plan-status>${icon(plan.affordable && !plan.blocked ? 'check' : 'sun', 16)}<span>${escape(statusLabel(plan, ctx))}</span></p>`;
}

function executeLabel(plan, ctx) {
  return `${ctx.t(plan.mode === 'build' ? 'chooseSite' : 'upgrade')} · ${targetLabel(plan, ctx)}`;
}

function executeCost(plan, { t, number }) {
  const costs = Object.entries(plan.cost)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => `${number(amount)} ${t(key)}`)
    .join(' · ');
  return costs ? `${t('planningCost')}: ${costs}` : t('maxLevel');
}

function buildingOptions(state, selected, { t }) {
  const options = BUILDINGS.flatMap((definition) => {
    const owned = state.buildings.filter((entry) => entry.type === definition.id);
    const targets = [definition.id, ...owned.slice(1).map((entry) => `building:${entry.id}`)];
    if (owned.length && owned.length < definition.maxCount) targets.push(`new:${definition.id}`);
    return targets;
  });
  // Retain an unavailable selection so a refresh explains why it cannot execute.
  if (!options.includes(selected)) options.push(selected);
  return options.map((target) => {
    const plan = constructionPlan(state, target);
    const building = state.buildings.find((entry) => entry.id === plan.buildingId);
    const plot = building && buildingSiteLabel(building, t);
    const detail = building
      ? `${plot} · ${t('level')} ${building.level} · ${t(plan.blocked === 'maxLevel' ? 'maxLevel' : 'upgrade')}${plan.blocked === 'maxLevel' ? '' : ` ${plan.level}`}`
      : `${target.startsWith('new:') ? t('planningNewCopy') : t('build')} · ${t('level')} 1`;
    return { value: target, label: `${t(plan.type)} — ${detail}` };
  });
}

function buildingOption(option, selected, { escape }) {
  return `<option value="${escape(option.value)}" ${option.value === selected ? 'selected' : ''}>${escape(option.label)}</option>`;
}

export function economyPanel(state, planType = 'quarry', ctx) {
  const { t, escape, busy = false } = ctx;
  const plan = constructionPlan(state, planType);
  return `<section class="economy-panel" id="economy-panel" aria-labelledby="economy-title">
    <div class="section-heading"><div><h2 id="economy-title">${escape(t('planningTitle'))}</h2><p>${escape(t('planningIntro'))}</p></div></div>
    <div class="economy-resources">${resourceOutlook(state)
      .map((resource) => resourceCard(resource, ctx))
      .join('')}</div>
    <div class="economy-construction">
      <div class="economy-plan-choice"><label for="construction-plan">${escape(t('planningChooseBuilding'))}</label><select id="construction-plan" aria-describedby="construction-plan-hint">${buildingOptions(
        state,
        plan.target,
        ctx,
      )
        .map((option) => buildingOption(option, plan.target, ctx))
        .join(
          '',
        )}</select><p id="construction-plan-hint">${escape(t('planningChoiceHint'))}</p></div>
      <div class="economy-plan-detail"><div data-economy-plan-body>${planBody(plan, state.capacity, ctx)}</div>
        <button class="button primary economy-execute" id="execute-construction-plan" data-action="executePlan" data-plan-type="${plan.type}" data-plan-target="${plan.target}" ${busy || plan.blocked || !plan.affordable ? 'disabled' : ''}><span data-economy-execute-label>${escape(executeLabel(plan, ctx))}</span><span class="economy-execute-cost" data-economy-execute-cost>${escape(executeCost(plan, ctx))}</span></button>
      </div>
    </div>
    <p class="economy-estimate-note">${escape(t('planningEstimateNote'))}</p>
  </section>`;
}

export function updateEconomyPanel(root, state, planType = 'quarry', ctx) {
  const panel = root.querySelector('#economy-panel');
  if (!panel) return;
  for (const resource of resourceOutlook(state)) {
    const card = panel.querySelector(`[data-economy-resource="${resource.key}"]`);
    if (!card) continue;
    const details = resourceDetails(resource, ctx);
    card.classList.toggle('is-full', resource.isFull);
    card.querySelector('[data-economy-stock]').textContent = details.stock;
    card.querySelector('[data-economy-rate]').textContent = details.rate;
    card.querySelector('[data-economy-fill-status]').textContent = details.status;
    const fill = card.querySelector('.economy-fill');
    fill.setAttribute('aria-valuemax', resource.capacity);
    fill.setAttribute('aria-valuenow', Math.floor(resource.amount));
    fill.firstElementChild.style.width = `${details.fill}%`;
  }
  const plan = constructionPlan(state, planType);
  const body = panel.querySelector('[data-economy-plan-body]');
  const html = planBody(plan, state.capacity, ctx);
  if (body.innerHTML !== html) body.innerHTML = html;
  const button = panel.querySelector('#execute-construction-plan');
  button.disabled = Boolean(ctx.busy || plan.blocked || !plan.affordable);
  button.dataset.planType = plan.type;
  button.dataset.planTarget = plan.target;
  button.querySelector('[data-economy-execute-label]').textContent = executeLabel(plan, ctx);
  button.querySelector('[data-economy-execute-cost]').textContent = executeCost(plan, ctx);
  const select = panel.querySelector('#construction-plan');
  const options = buildingOptions(state, plan.target, ctx);
  const wanted = new Set(options.map((option) => option.value));
  for (const option of [...select.options]) if (!wanted.has(option.value)) option.remove();
  for (const [index, entry] of options.entries()) {
    let option = [...select.options].find((option) => option.value === entry.value);
    if (!option) {
      option = document.createElement('option');
      option.value = entry.value;
    }
    if (option.textContent !== entry.label) option.textContent = entry.label;
    if (select.options[index] !== option)
      select.insertBefore(option, select.options[index] || null);
  }
  if (select.value !== plan.target) select.value = plan.target;
}
