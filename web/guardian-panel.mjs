import {
  guardianStats,
  trainingPlan,
  equipmentPlan,
  TRAINING_PATHS,
} from '../shared/guardian-planning.mjs';
import { ITEM_DEFINITIONS, isWolfBusy } from '../shared/adventures.mjs';
import { wolfPortrait } from './v2-view.mjs';
import { icon } from './art.mjs';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const statKeys = ['attack', 'mitigation', 'healing', 'scouting'];
const reasons = {
  BATTLE_ACTIVE: 'guardianBattleBlocked',
  WOLF_BUSY: 'guardianBusyBlocked',
  NO_SKILL_POINTS: 'guardianPointsBlocked',
  MAX_LEVEL: 'guardianRankMax',
  INSUFFICIENT_RESOURCES: 'guardianResourceBlocked',
  ITEM_UNAVAILABLE: 'guardianItemMissing',
  INVENTORY_FULL: 'guardianInventoryFull',
  ALREADY_EQUIPPED: 'guardianEquipped',
  NO_EQUIPMENT: 'noEquipment',
  INVALID_TRAINING: 'error',
  INVALID_EQUIPMENT: 'error',
};
const roleName = (key, t) => t(key === 'healer' ? 'healerPath' : key);
const format = (value, ctx) =>
  new Intl.NumberFormat(ctx.language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 1,
  }).format(value);
const statValue = (key, value, ctx) =>
  format(value, ctx) + (['mitigation', 'scouting'].includes(key) ? '%' : '');
function progress(value, max, t, label) {
  return `<div class="progress" role="progressbar" aria-label="${escape(t(label))}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(max, Math.max(0, value))}"><span style="width:${Math.min(100, Math.max(0, (value / max) * 100))}%"></span></div>`;
}
function comparison(before, after, ctx) {
  const changed = [...statKeys, 'maxHp'].filter(
    (key) => Math.abs(after[key] - before[key]) > 0.000001,
  );
  if (!changed.length)
    return `<p class="guardian-no-change">${escape(ctx.t('guardianUnchanged'))}</p>`;
  return `<ul class="guardian-comparison">${changed
    .map((key) => {
      const delta = after[key] - before[key];
      const unit = ['mitigation', 'scouting'].includes(key)
        ? ' ' + ctx.t('guardianPercentagePoints')
        : '';
      return `<li><span>${escape(ctx.t('guardianStat_' + key))}</span><strong>${statValue(key, before[key], ctx)} → ${statValue(key, after[key], ctx)}</strong><small class="${delta > 0 ? 'positive' : 'negative'}">${delta > 0 ? '+' : ''}${format(delta, ctx)}${escape(unit)}</small></li>`;
    })
    .join('')}</ul>`;
}
function planReason(plan, ctx) {
  const text = ctx.t(
    reasons[plan.reason] || (ctx.readOnly ? 'guardianPreviewReady' : 'guardianReady'),
  );
  const missing = (plan.shortages || [])
    .map(({ resource, amount }) => format(Math.ceil(amount), ctx) + ' ' + ctx.t(resource))
    .join(' · ');
  return `<p class="guardian-plan-reason">${escape(text)}${plan.reason === 'INSUFFICIENT_RESOURCES' ? ' ' + escape(missing) : ''}</p>`;
}
export function guardianPanel(state, selectedId, ctx) {
  const { t, busy = false, readOnly = false } = ctx;
  const wolf = state.wolves.find((w) => w.id === selectedId) || state.wolves[0];
  const stats = guardianStats(wolf);
  const atMax = wolf.level >= 20;
  return `<section class="guardian-layout guardian-planning" id="guardian-panel" aria-label="${escape(t('wolfDetails'))}">
 <div class="guardian-cards">${state.wolves.map((w) => `<button class="guardian-card ${w.id === wolf.id ? 'selected' : ''}" data-wolf="${w.id}" aria-pressed="${w.id === wolf.id}"><span class="guardian-card-content" data-guardian-live="card-${w.id}"><span class="guardian-portrait">${wolfPortrait(w, roleName(w.name, t))}</span><span class="guardian-info"><small>${escape(t('level'))} ${w.level}${isWolfBusy(state, w.id) ? ' · ' + escape(t('away')) : ''}</small><strong>${escape(roleName(w.name, t))}</strong>${progress(w.hp, w.maxHp, t, 'health')}<span>${Math.ceil(w.hp)} / ${w.maxHp} ${escape(t('health'))}</span></span></span>${icon('arrow', 18)}</button>`).join('')}</div>
 <section class="wolf-detail detail-card"><div data-guardian-live="identity"><div class="section-label">${escape(t('wolfDetails'))}${icon('wolves', 20)}</div><div class="large-wolf">${wolfPortrait(wolf, roleName(wolf.name, t))}</div><h2 class="guardian-name">${escape(roleName(wolf.name, t))}</h2><p class="guardian-xp">${escape(t('level'))} ${wolf.level} · ${atMax ? escape(t('guardianLevelCap')) : wolf.xp + ' / ' + wolf.level * 45 + ' ' + escape(t('xp'))}</p>${atMax ? '' : progress(wolf.xp, wolf.level * 45, t, 'xp')}<p class="guardian-xp-hint">${escape(t(atMax ? 'guardianLevelCapHint' : 'guardianXpHint'))}</p></div>
 <div data-guardian-live="stats"><dl class="guardian-stat-grid">${statKeys.map((key) => `<div><dt>${escape(t('guardianStat_' + key))}</dt><dd data-guardian-stat="${key}">${statValue(key, stats[key], ctx)}</dd></div>`).join('')}</dl><p class="guardian-stats-hint">${escape(t('guardianStatsHint'))}</p><div class="training-points"><span>${escape(t('points'))}</span><b>${wolf.points}</b></div></div>
 <div class="guardian-training">${TRAINING_PATHS.map((path) => {
   const plan = trainingPlan(state, wolf.id, path);
   return `<article class="training-row"><div data-guardian-live="train-${path}"><h3>${escape(roleName(path, t))} <small>${plan.rank} / 5</small></h3><p class="guardian-effect">${escape(t('guardianEffect_' + path))}</p>${comparison(plan.before, plan.after, ctx)}<p class="guardian-action-cost">${escape(t('guardianTrainingCost'))}</p><div id="guardian-training-reason-${path}">${planReason(plan, ctx)}</div></div><button class="button outline" id="guardian-train-${path}" data-action="train" data-id="${wolf.id}" data-path="${path}" aria-describedby="guardian-training-reason-${path}" ${busy || readOnly || !plan.ready ? 'disabled' : ''}>${escape(t('train'))} ${icon('plus', 14)}</button></article>`;
 }).join('')}</div>
 <section class="equipment-panel"><h3>${escape(t('equipment'))}</h3><p data-guardian-live="equipment-current">${escape(t('guardianCurrentEquipment'))}: <strong>${escape(t(wolf.equipment || 'noEquipment'))}</strong>${isWolfBusy(state, wolf.id) ? ' · ' + escape(t('away')) : ''}</p><p class="guardian-equipment-hint">${escape(t('guardianEquipmentHint'))}</p>
 <div class="equipment-options">${ITEM_DEFINITIONS.map((item) => {
   const plan = equipmentPlan(state, wolf.id, item.id);
   return `<article class="guardian-item"><div data-guardian-live="item-${item.id}"><h4>${escape(t(item.id))}</h4><p>${escape(t('guardianInBag'))}: ${state.inventory[item.id]}</p>${comparison(plan.before, plan.after, ctx)}<div id="guardian-item-reason-${item.id}">${planReason(plan, ctx)}</div></div><button class="button outline" id="guardian-equip-${item.id}" data-action="equip" data-id="${wolf.id}" data-item="${item.id}" aria-describedby="guardian-item-reason-${item.id}" ${busy || readOnly || !plan.ready ? 'disabled' : ''}>${escape(t('equip'))}</button></article>`;
 }).join('')}</div>
 <div class="guardian-remove"><div data-guardian-live="unequip">${comparison(equipmentPlan(state, wolf.id, null).before, equipmentPlan(state, wolf.id, null).after, ctx)}<div id="guardian-unequip-reason">${planReason(equipmentPlan(state, wolf.id, null), ctx)}</div></div><button class="button outline" id="guardian-unequip" data-action="unequip" data-id="${wolf.id}" aria-describedby="guardian-unequip-reason" ${busy || readOnly || !equipmentPlan(state, wolf.id, null).ready ? 'disabled' : ''}>${escape(t('unequip'))}</button></div>
 <p class="guardian-portrait-hint">${escape(t('guardianPortraitHint'))}</p></section>
 ${readOnly ? `<p class="guardian-readonly">${escape(t('guardianPreviewHint'))}</p>` : ''}</section></section>`;
}

export function updateGuardianPanel(root, state, selectedId, ctx) {
  const panel = root.querySelector('#guardian-panel');
  if (!panel) return;
  const fragment = document.createElement('template');
  fragment.innerHTML = guardianPanel(state, selectedId, ctx);
  for (const fresh of fragment.content.querySelectorAll('[data-guardian-live]')) {
    const old = panel.querySelector('[data-guardian-live="' + fresh.dataset.guardianLive + '"]');
    if (old && old.innerHTML !== fresh.innerHTML) old.innerHTML = fresh.innerHTML;
  }
  for (const fresh of fragment.content.querySelectorAll('button[id]')) {
    const old = panel.querySelector('#' + fresh.id);
    if (old) old.disabled = fresh.disabled;
  }
}
