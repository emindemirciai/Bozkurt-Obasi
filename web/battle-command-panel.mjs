import './battle-command.css';
import {
  BATTLE_COMMANDS,
  battleCommandPlan,
  battleCommandStatus,
} from '../shared/battle-commands.mjs';
import { icon } from './art.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const titles = { brace: 'bcBrace', focus: 'bcFocus', rally: 'bcRally' };
const icons = { brace: 'wolves', focus: 'target', rally: 'heart' };
const reasonKeys = {
  invalid: 'bcInvalidError',
  inactive: 'bcInactiveError',
  intro: 'bcIntroError',
  cooldown: 'bcCooldownError',
  noPanic: 'bcNoPanicError',
};
const fill = (text, values) =>
  text.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
const commandTitle = (id, t) => t(titles[id] || 'bcTitle');
const commandList = () =>
  Array.isArray(BATTLE_COMMANDS) ? BATTLE_COMMANDS : Object.values(BATTLE_COMMANDS);

function panelStatus(state, status, t) {
  if (state.battle.status === 'preparing') return t('bcPreparing');
  if (state.battle.status !== 'active') return t('bcFinished');
  if (state.battle.tick < 6) return t('bcIntroError');
  if (status.activeCommand)
    return fill(t('bcActiveStatus'), {
      command: commandTitle(status.activeCommand, t),
      seconds: status.activeTicksLeft,
    });
  if (status.cooldownTicksLeft > 0)
    return fill(t('bcCooldownStatus'), { seconds: status.cooldownTicksLeft });
  return t('bcReady');
}
function reason(plan, { t, busy, readOnly }) {
  if (busy) return t('bcSending');
  if (plan.blocked === 'cooldown')
    return fill(t('bcCooldownStatus'), { seconds: plan.remainingTicks });
  if (plan.blocked) return t(reasonKeys[plan.blocked] || 'bcInvalidError');
  return t(readOnly ? 'bcReadOnly' : 'bcCommandReady');
}
function history(state, t) {
  const entries = (state.battle.commands || []).slice(-3).reverse();
  return entries.length
    ? entries
        .map(
          (entry) =>
            `<li><span>${escape(commandTitle(entry.id, t))}</span><time>${escape(fill(t('bcHistoryTime'), { seconds: entry.tick }))}</time></li>`,
        )
        .join('')
    : `<li class="battle-command-history-empty">${escape(t('bcNoHistory'))}</li>`;
}
function announcement(state, status, t) {
  const last = status.lastCommand;
  if (state.battle.status !== 'active') return '';
  if (last)
    return fill(t('bcConfirmed'), {
      command: commandTitle(last.id, t),
      seconds: last.tick,
    });
  return state.battle.tick >= 6 ? t('bcReady') : '';
}

export function battleCommandPanel(state, options = {}) {
  const { t, busy = false, readOnly = false } = options;
  const status = battleCommandStatus(state);
  const cooldown = Math.max(0, status.cooldownTicksLeft);
  return `<section id="battle-command-panel" class="battle-commands" aria-labelledby="battle-command-title" aria-busy="${busy}">
    <header class="battle-command-heading"><div><span class="battle-command-eyebrow">${escape(t('bcEyebrow'))}</span><h2 id="battle-command-title">${escape(t('bcTitle'))}</h2></div><span class="battle-command-free">${icon('check', 14)}${escape(t('bcFree'))}</span></header>
    <p class="battle-command-intro">${escape(t('bcIntro'))}</p>
    <div class="battle-command-status-row"><p class="battle-command-status" data-command-live="status">${escape(panelStatus(state, status, t))}</p><div class="battle-command-cooldown" ${cooldown > 0 ? '' : 'hidden'}><span data-command-live="cooldown">${escape(fill(t('bcCooldownShort'), { seconds: cooldown }))}</span><div class="battle-command-cooldown-track" role="progressbar" aria-label="${escape(t('bcCooldownProgress'))}" aria-valuemin="0" aria-valuemax="12" aria-valuenow="${Math.max(0, 12 - cooldown)}"><span style="width:${(Math.max(0, 12 - cooldown) / 12) * 100}%"></span></div></div></div>
    <div class="battle-command-grid">${commandList()
      .map((definition) => {
        const id = definition.id;
        const plan = battleCommandPlan(state, id);
        return `<article class="battle-command-card ${plan.active ? 'is-active' : ''}" data-command-card="${id}"><div class="battle-command-card-heading"><span class="battle-command-icon">${icon(icons[id], 21)}</span><div><h3>${escape(commandTitle(id, t))}</h3><span class="battle-command-duration">${escape(t(id === 'rally' ? 'bcInstant' : 'bcDuration'))}</span></div><span class="battle-command-active" ${plan.active ? '' : 'hidden'}>${escape(t('bcActive'))}</span></div><p id="battle-command-effect-${id}" class="battle-command-benefit">${escape(t(`bc${id[0].toUpperCase() + id.slice(1)}Effect`))}</p><p id="battle-command-tradeoff-${id}" class="battle-command-tradeoff">${escape(t(`bc${id[0].toUpperCase() + id.slice(1)}Tradeoff`))}</p><p id="battle-command-reason-${id}" class="battle-command-reason" data-command-live="reason-${id}">${escape(reason(plan, { t, busy, readOnly }))}</p><button id="battle-command-${id}" class="button outline battle-command-button" data-action="battleCommand" data-command="${id}" aria-label="${escape(t('bcIssue') + ': ' + commandTitle(id, t))}" aria-describedby="battle-command-effect-${id} battle-command-tradeoff-${id} battle-command-reason-${id}" ${busy || readOnly || !plan.ready ? 'disabled' : ''}>${icon(icons[id], 16)}${escape(t('bcIssue'))}</button></article>`;
      })
      .join('')}</div>
    <div class="battle-command-history"><h3>${escape(t('bcHistory'))}</h3><ol>${history(state, t)}</ol></div>
    <p class="battle-command-announcement" role="status" aria-live="polite" aria-atomic="true" data-command-live="announcement">${escape(announcement(state, status, t))}</p>
  </section>`;
}

export function updateBattleCommandPanel(root, state, options) {
  const panel = root.querySelector('#battle-command-panel');
  if (!panel) return;
  const template = document.createElement('template');
  template.innerHTML = battleCommandPanel(state, options);
  const fresh = template.content.firstElementChild;
  panel.setAttribute('aria-busy', fresh.getAttribute('aria-busy'));
  // Preserve button identity and focus while authoritative server ticks update the UI.
  for (const node of panel.querySelectorAll('[data-command-live]')) {
    const replacement = fresh.querySelector(`[data-command-live="${node.dataset.commandLive}"]`);
    if (replacement && node.textContent !== replacement.textContent)
      node.textContent = replacement.textContent;
  }
  for (const card of panel.querySelectorAll('[data-command-card]')) {
    const replacement = fresh.querySelector(`[data-command-card="${card.dataset.commandCard}"]`);
    card.classList.toggle('is-active', replacement.classList.contains('is-active'));
    card.querySelector('.battle-command-active').hidden =
      replacement.querySelector('.battle-command-active').hidden;
    card.querySelector('button').disabled = replacement.querySelector('button').disabled;
  }
  const cooldown = panel.querySelector('.battle-command-cooldown');
  cooldown.hidden = fresh.querySelector('.battle-command-cooldown').hidden;
  const track = cooldown.querySelector('[role="progressbar"]');
  const freshTrack = fresh.querySelector('[role="progressbar"]');
  track.setAttribute('aria-valuenow', freshTrack.getAttribute('aria-valuenow'));
  track.firstElementChild.style.width = freshTrack.firstElementChild.style.width;
  const list = panel.querySelector('.battle-command-history ol');
  const freshList = fresh.querySelector('.battle-command-history ol');
  if (list.innerHTML !== freshList.innerHTML) list.innerHTML = freshList.innerHTML;
}

function badgeStatus(state, t) {
  const status = battleCommandStatus(state);
  const active = Boolean(status.activeCommand);
  return {
    hidden: state.battle.status !== 'active' || (!active && status.cooldownTicksLeft <= 0),
    id: status.activeCommand || status.lastCommand?.id || '',
    active,
    title: active ? commandTitle(status.activeCommand, t) : t('bcCooldownLabel'),
    detail: fill(t(active ? 'bcEffectRemaining' : 'bcCooldownShort'), {
      seconds: active ? status.activeTicksLeft : status.cooldownTicksLeft,
    }),
  };
}
export function battleCommandBadge(state, { t }) {
  const status = badgeStatus(state, t);
  return `<div id="battle-command-badge" class="battle-command-badge" data-command="${status.id}" data-active="${status.active}" ${status.hidden ? 'hidden' : ''}><strong>${escape(status.title)}</strong><span>${escape(status.detail)}</span></div>`;
}
export function updateBattleCommandBadge(root, state, { t }) {
  const badge = root.querySelector('#battle-command-badge');
  if (!badge) return;
  const status = badgeStatus(state, t);
  badge.hidden = status.hidden;
  badge.dataset.command = status.id;
  badge.dataset.active = String(status.active);
  if (badge.querySelector('strong').textContent !== status.title)
    badge.querySelector('strong').textContent = status.title;
  if (badge.querySelector('span').textContent !== status.detail)
    badge.querySelector('span').textContent = status.detail;
}

function quickbarStatus(state, { t, busy }) {
  if (busy) return t('bcSending');
  const status = battleCommandStatus(state);
  return status.cooldownTicksLeft > 0
    ? fill(t('bcCooldownStatus'), { seconds: status.cooldownTicksLeft })
    : panelStatus(state, status, t);
}
export function battleCommandQuickbar(state, options = {}) {
  const { t, busy = false } = options;
  return `<section id="battle-command-quickbar" class="battle-command-quickbar" aria-label="${escape(t('bcTitle'))}" aria-busy="${busy}"><p id="battle-command-quick-title" class="battle-command-quick-status" tabindex="-1">${escape(quickbarStatus(state, { t, busy }))}</p><div class="battle-command-quick-buttons">${commandList()
    .map((definition) => {
      const id = definition.id;
      const plan = battleCommandPlan(state, id);
      return `<button id="battle-command-quick-${id}" class="button outline battle-command-quick-button ${plan.active ? 'is-active' : ''}" data-action="battleCommand" data-command="${id}" title="${escape(reason(plan, { t, busy }))}" aria-describedby="battle-command-quick-title battle-command-effect-${id} battle-command-tradeoff-${id} battle-command-reason-${id}" ${busy || !plan.ready ? 'disabled' : ''}>${escape(commandTitle(id, t))}</button>`;
    })
    .join('')}</div></section>`;
}
export function updateBattleCommandQuickbar(root, state, options) {
  const bar = root.querySelector('#battle-command-quickbar');
  if (!bar) return;
  const status = bar.querySelector('#battle-command-quick-title');
  const message = quickbarStatus(state, options);
  if (status.textContent !== message) status.textContent = message;
  bar.setAttribute('aria-busy', String(Boolean(options.busy)));
  for (const button of bar.querySelectorAll('[data-command]')) {
    const plan = battleCommandPlan(state, button.dataset.command);
    button.disabled = Boolean(options.busy || !plan.ready);
    button.title = reason(plan, options);
    button.classList.toggle('is-active', plan.active);
  }
}
