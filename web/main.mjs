import './style.css';
import {
  createGame,
  advanceGame,
  applyAction,
  resumeGame,
  validateGame,
  BUILDINGS,
  FORMATIONS,
  getProduction,
  getUpgradeCost,
} from '../shared/game.mjs';
import { translations } from './i18n.mjs';
import { icon, miniBuilding, scene, wolfArt } from './art.mjs';
import { createAnalytics } from './analytics.mjs';

const analytics = createAnalytics();

const SAVE_KEY = 'bozkurt.web.v1';
let storageOk = true;
const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    storageOk = false;
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    storageOk = false;
  }
};
let language = read('bozkurt.language') === 'en' ? 'en' : 'tr';
let state = loadLocal();
let mode = 'local',
  view = 'village',
  selected = 'building-hall',
  selectedWolf = 'wolf-alpha',
  modal = '',
  zoom = 1,
  revision = 0,
  busy = false;
let polling = null,
  sessionGeneration = 0,
  renderedSignature = '';
let notice = '',
  noticeUntil = 0;
const root = document.querySelector('#app');
const t = (key) => translations[language][key] || key;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const number = (value) => Math.floor(value).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US');
const roleName = (role) => t(role === 'healer' ? 'healerPath' : role);
const logLabels = {
  villageFounded: 'noActivity',
  buildingBuilt: 'logBuilt',
  buildingUpgraded: 'logUpgraded',
  resourcesCollected: 'logGathered',
  battleStarted: 'logBattle',
  battleWon: 'logWon',
  battleLost: 'logLost',
  wolfTrained: 'logTrained',
  herdHealed: 'logHealed',
  packRested: 'logRested',
  journeyStarted: 'logTravel',
  journeyArrived: 'logArrived',
  questClaimed: 'logClaimed',
  formationChanged: 'formation',
  battlePrepared: 'prepare',
  battleResumed: 'prepare',
};

function loadLocal() {
  for (const key of [SAVE_KEY, `${SAVE_KEY}.backup`]) {
    try {
      const candidate = JSON.parse(read(key) || 'null');
      if (validateGame(candidate)) {
        resumeGame(candidate, Date.now());
        return candidate;
      }
    } catch {
      /* Try the previous valid generation without deleting the damaged save. */
    }
  }
  return createGame();
}

function saveLocal() {
  if (mode !== 'local') return;
  const next = JSON.stringify(state);
  if (!validateGame(JSON.parse(next))) return;
  const old = read(SAVE_KEY);
  try {
    if (old && validateGame(JSON.parse(old))) write(`${SAVE_KEY}.backup`, old);
  } catch {
    /* Retain last backup. */
  }
  write(SAVE_KEY, next);
}

function toast(key) {
  notice = t(key);
  noticeUntil = Date.now() + 4200;
  renderNotice();
}
function renderNotice() {
  const item = document.querySelector('#notice');
  if (item) {
    item.textContent = notice;
    item.classList.toggle('show', Boolean(notice) && Date.now() < noticeUntil);
  }
}
function costView(cost) {
  return `<span class="cost">${Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(
      ([key, value]) =>
        `<span class="${state.resources[key] < value ? 'short' : ''}">${icon(key, 14)} ${number(value)}</span>`,
    )
    .join('')}</span>`;
}
function affordable(cost) {
  return Object.entries(cost).every(([key, value]) => state.resources[key] >= value);
}
function button(label, action, cls = 'button', disabled = false, extra = '') {
  return `<button class="${cls}" data-action="${action}" ${disabled ? 'disabled' : ''} ${extra}>${label}</button>`;
}
function progress(value, max, cls = '') {
  return `<div class="progress ${cls}"><span style="width:${Math.min(100, Math.max(0, (value / max) * 100))}%"></span></div>`;
}

function interfaceSignature() {
  const { resources, updatedAt, ...visibleState } = state;
  const costs = [
    ...BUILDINGS.map((building) => building.cost),
    ...state.buildings.map(getUpgradeCost),
    { herbs: 1 },
    { water: 25, feed: 30 },
    { herbs: 8, feed: 12 },
    { water: 20, feed: 20 },
  ];
  return JSON.stringify([
    visibleState,
    costs.map((cost) => Object.entries(cost).map(([key, value]) => resources[key] >= value)),
  ]);
}

function identifyControls() {
  const duplicates = new Map();
  for (const element of root.querySelectorAll('button, [role="button"], a.brand-mark')) {
    if (element.id) continue;
    const key = [
      element.tagName.toLowerCase(),
      ...Object.entries(element.dataset)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => `${name}-${value}`),
    ].join('-');
    const occurrence = duplicates.get(key) || 0;
    duplicates.set(key, occurrence + 1);
    element.id = `control-${encodeURIComponent(key)}-${occurrence}`;
  }
}

function render(restoreFocus) {
  const active = document.activeElement;
  const focusId = restoreFocus || active?.id;
  document.documentElement.lang = language;
  document.title = `Bozkurt Obası: Ay-Yıldız Nöbeti · ${t(view)}`;
  analytics.view(view);
  const navigation = ['village', 'battle', 'world', 'wolves', 'quests'];
  root.innerHTML = `<div class="game-shell">
    <nav class="rail" aria-label="${t('village')}"><a href="#village" class="brand-mark" aria-label="Bozkurt Obası: Ay-Yıldız Nöbeti"><svg viewBox="0 0 42 42"><path d="M26 6a16 16 0 1 0 0 30 15 15 0 0 1 0-30" fill="currentColor"/><path d="m29 15 2 4 5 .5-3.7 3.2 1.2 4.8-4.5-2.5-4.3 2.5 1-4.8-3.7-3.2 5-.5Z" fill="currentColor"/></svg></a>
    <div class="nav-links">${navigation.map((key) => `<button data-view="${key}" class="nav-item ${view === key ? 'active' : ''}" aria-current="${view === key ? 'page' : 'false'}" title="${t(key)}">${icon(key, 24)}<span>${t(key)}</span>${key === 'quests' && state.quests.some((q) => !q.claimed && q.progress === q.target) ? '<i class="nav-dot"></i>' : ''}</button>`).join('')}</div>
    <div class="rail-bottom">${button(icon('help', 23), 'help', 'rail-help', false, `aria-label="${t('help')}"`)}<span class="rail-version">v1.0</span></div></nav>
    <div class="workspace"><header class="topbar"><div class="wordmark">BOZKURT OBASI <span>AY-YILDIZ NÖBETİ</span></div><div class="topbar-end"><button class="connection" data-action="online"><i class="status-dot ${mode === 'online' ? 'live' : ''}"></i>${t(mode)}${icon('cloud', 16)}</button><button class="language" data-action="language" aria-label="${language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}">${language.toUpperCase()}<span>⌄</span></button><button class="profile" data-action="help" aria-label="${t('help')}">${icon('wolves', 23)}</button></div></header>
    <main><section class="page-heading"><div><div class="eyebrow">${t('subtitle')}</div><h1>${t(view === 'village' ? 'greeting' : view)}</h1><p>${t(view === 'village' ? 'villageDesc' : `${view}Desc`)}</p></div><div class="weather">${icon('sun', 29)}<span>${t('sunny')}<small>${t(state.location)}</small></span></div></section>
    <section class="resource-bar" aria-label="${t('production')}">${['wood', 'stone', 'water', 'feed', 'herbs'].map((key) => `<div class="resource ${key}" title="${t('resourceTip')}"><span class="resource-icon">${icon(key, 23)}</span><div><span class="resource-label">${t(key)}</span><strong data-resource="${key}">${number(state.resources[key])}<small> / ${number(state.capacity)}</small></strong></div><span class="resource-rate">+${number(getProduction(state)[key])}<small>${t('perMinute')}</small></span></div>`).join('')}</section>
    ${view === 'village' || view === 'battle' ? playView() : view === 'world' ? worldView() : view === 'wolves' ? wolvesView() : questsView()}
    <footer><span>${icon('save', 13)} ${t(storageOk || mode === 'online' ? 'saved' : 'storageFailed')}</span><span>${t('projectVersion')} · ${mode === 'online' ? 'VPS' : t('local')} · <a href="mailto:info@bozkurtobasi.com">info@bozkurtobasi.com</a></span></footer></main></div></div>
    <div id="notice" class="toast" role="status" aria-live="polite"></div>${modalView()}`;
  identifyControls();
  renderedSignature = interfaceSignature();
  renderNotice();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  if (modal) {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog.contains(document.activeElement))
      dialog.querySelector('button')?.focus({ preventScroll: true });
  }
}

function playView() {
  const isBattle = view === 'battle';
  return `<div class="play-layout"><section class="map-card"><div class="map-top"><span class="map-title"><i class="status-dot live"></i>${isBattle ? t('defense') : t('homeland')}<span class="map-chip">${isBattle ? `${t('wave')} ${state.battle.wave}` : `${state.buildings.length} ${t('buildingCount')}`}</span></span><span class="map-coordinates">${isBattle ? '04 · 12' : '38 · 42'}</span></div><div class="scene-wrap" id="scene-wrap">${scene(state, { battle: isBattle, zoom, selected, t })}<div class="map-location">${icon(isBattle ? 'battle' : 'flag', 14)} ${t(isBattle ? (state.battle.status === 'preparing' ? 'prepare' : state.battle.status) : state.location)}</div><div class="zoom-controls">${button(icon('plus', 17), 'zoomIn', 'icon-button', zoom >= 1.5, `aria-label="${t('zoomIn')}"`)}${button(icon('minus', 17), 'zoomOut', 'icon-button', zoom <= 0.8, `aria-label="${t('zoomOut')}"`)}<span></span>${button(icon('target', 17), 'resetZoom', 'icon-button', false, `aria-label="${t('resetView')}"`)}${button(icon('expand', 17), 'fullscreen', 'icon-button', false, `aria-label="${t('expand')}"`)}</div><div class="map-bottom-note">${icon(isBattle ? 'wolves' : 'village', 14)} ${isBattle ? t('formation') : t('villageDesc')}</div></div><div class="map-toolbar"><span>${icon(isBattle ? 'heart' : 'feed', 18)}${isBattle ? `${t('herd')}: ${Math.ceil(state.herd.hp)}/${state.herd.maxHp}` : `${state.herd.count} ${t('herd')} · ${state.wolves.length} ${t('wolfCount')}`}</span>${isBattle ? button(icon('battle', 17) + t(state.battle.status === 'preparing' ? 'startBattle' : state.battle.status === 'active' ? 'active' : 'newBattle'), state.battle.status === 'preparing' ? 'startBattle' : 'newBattle', 'button primary', state.battle.status === 'active' || busy) : button(icon('plus', 17) + `<span data-collect-label>${t('collect')}</span>`, 'collect', 'button primary', Date.now() < state.collectReadyAt || busy, 'id="collect-button"')}</div></section>
    <aside class="overview">${isBattle ? battlePanel() : villagePanel()}</aside></div>
    ${isBattle ? battleRecovery() : buildingList()}`;
}

function villagePanel() {
  const b = state.buildings.find((b) => b.id === selected) || state.buildings[0];
  const def = BUILDINGS.find((d) => d.id === b.type),
    cost = getUpgradeCost(b);
  return `<section class="detail-card"><div class="section-label">${t('villageOverview')}${icon('sun', 16)}</div><div class="selected-building-art">${miniBuilding(b.type)}</div><div class="building-detail-title"><h2>${t(b.type)}</h2><span>${t('level')} ${b.level}</span></div><p class="muted">${t(`${b.type}Desc`)}</p><div class="detail-stats">${
    Object.entries(def.production)
      .filter(([, v]) => v > 0)
      .map(
        ([key, rate]) =>
          `<div><span>${icon(key, 15)} ${t('production')}</span><strong>+${rate * b.level} ${t('perMinute')}</strong></div>`,
      )
      .join('') ||
    `<div><span>${t('capacity')}</span><strong>${number(state.capacity)}</strong></div>`
  }</div>${b.level < 5 ? `<div class="upgrade-row">${costView(cost)}${button(t('upgrade') + icon('arrow', 15), 'upgrade', 'button outline', !affordable(cost) || busy, `data-id="${b.id}"`)}</div>` : `<div class="completed">${icon('check', 16)}${t('maxLevel')}</div>`}</section>
    <section class="quest-callout"><div class="eyebrow">${t('nextStep')}</div><h3>${t('nextTitle')}</h3><p>${t('nextDesc')}</p><button data-view="quests">${t('viewQuests')}${icon('arrow', 17)}</button><span class="callout-symbol">☽</span></section>
    <section class="activity-card"><h3>${t('activity')}<span class="pulse"></span></h3>${state.log
      .slice(-3)
      .reverse()
      .map(
        (entry) =>
          `<div class="activity-line"><i></i><p>${escape(t(logLabels[entry.key] || 'actionDone'))}<time>${new Date(entry.at).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}</time></p></div>`,
      )
      .join('')}</section>`;
}

function buildingList() {
  return `<section class="buildings-section"><div class="section-heading"><div><h2>${t('buildings')}</h2><p>${t('buildingDesc')}</p></div><span class="subtle-count">${state.buildings.length} / ${BUILDINGS.length}</span></div><div class="buildings-grid">${BUILDINGS.filter(
    (b) => b.id !== 'hall',
  )
    .map((def) => {
      const b = state.buildings.find((b) => b.type === def.id);
      return `<article class="build-card ${b ? 'is-built' : ''}"><div class="build-art">${miniBuilding(def.id)}${b ? `<span class="level-badge">${t('level')} ${b.level}</span>` : ''}</div><h3>${t(def.id)}</h3><p>${t(`${def.id}Desc`)}</p><div class="build-card-bottom">${b ? `<span class="built-label">${icon('check', 13)}${t('built')}</span>${button(icon('arrow', 17), 'selectBuilding', 'small-button', false, `data-id="${b.id}" aria-label="${t(def.id)}"`)}` : `${costView(def.cost)}${button(icon('plus', 17), 'build', 'small-button', !affordable(def.cost) || state.battle.status === 'active' || busy, `data-building-type="${def.id}" aria-label="${t('build')} ${t(def.id)}"`)}`}</div></article>`;
    })
    .join('')}</div></section>`;
}

function battlePanel() {
  const status = state.battle.status;
  const active = status === 'active';
  const tacticKnown = status !== 'preparing';
  return `<section class="detail-card battle-settings"><div class="section-label">${t('prepare')}${icon('battle', 17)}</div><div class="battle-status"><span>${t(status === 'preparing' ? 'battleReady' : status)}</span>${active ? `<strong class="battle-elapsed" aria-hidden="true">${state.battle.tick} ${t('seconds')}</strong>` : ''}</div><h3>${t('tactic')}</h3><div class="tactic-reveal ${tacticKnown ? 'revealed' : 'concealed'}" aria-live="polite">${icon(tacticKnown ? 'battle' : 'help', 19)}<strong>${t(tacticKnown ? state.battle.tactic : 'tacticUnknown')}</strong></div><h3>${t('formation')}</h3>${['wolf', 'herd'].map((unit) => `<label class="formation-label">${t(unit === 'wolf' ? 'wolfFormation' : 'herdFormation')}</label><div class="segmented">${FORMATIONS.map((formation) => button(t(formation), 'formation', state.formation[unit] === formation ? 'chosen' : '', active || busy, `data-unit="${unit}" data-value="${formation}" aria-pressed="${state.formation[unit] === formation}"`)).join('')}</div>`).join('')}<p class="battle-help">${t('battleReward')}</p></section><section class="detail-card battle-count"><span>${t('enemies')}</span><strong>${state.battle.enemies.filter((enemy) => enemy.hp > 0).length}<small> / ${state.battle.enemies.length}</small></strong>${progress(state.herd.hp, state.herd.maxHp)}<p>${t('panic')} <b>${Math.round(state.herd.panic)}%</b></p></section>`;
}

function refreshBattleView() {
  const svg = root.querySelector('.battle-scene.is-active');
  if (
    !svg ||
    state.battle.status !== 'active' ||
    svg.dataset.startedAt !== String(state.battle.startedAt)
  )
    return false;
  for (const actor of svg.querySelectorAll('[data-enemy-id]')) {
    const enemy = state.battle.enemies.find((entry) => entry.id === actor.dataset.enemyId);
    if (!enemy) return false;
    actor.style.display = enemy.hp > 0 ? '' : 'none';
    actor
      .querySelector('[data-hp-bar]')
      ?.setAttribute('width', String((32 * enemy.hp) / enemy.maxHp));
  }
  for (const actor of svg.querySelectorAll('[data-wolf]')) {
    const wolf = state.wolves.find((entry) => entry.id === actor.dataset.wolf);
    if (!wolf) return false;
    actor
      .querySelector('[data-hp-bar]')
      ?.setAttribute('width', String((42 * wolf.hp) / wolf.maxHp));
    actor.classList.toggle('is-wounded', wolf.hp < wolf.maxHp * 0.35);
  }
  const enemyCount = root.querySelector('.battle-count > strong');
  if (enemyCount)
    enemyCount.innerHTML = `${state.battle.enemies.filter((enemy) => enemy.hp > 0).length}<small> / ${state.battle.enemies.length}</small>`;
  const herdProgress = root.querySelector('.battle-count .progress > span');
  if (herdProgress)
    herdProgress.style.width = `${Math.max(0, (100 * state.herd.hp) / state.herd.maxHp)}%`;
  const panic = root.querySelector('.battle-count p b');
  if (panic) panic.textContent = `${Math.round(state.herd.panic)}%`;
  const elapsed = root.querySelector('.battle-elapsed');
  if (elapsed) elapsed.textContent = `${state.battle.tick} ${t('seconds')}`;
  const herd = root.querySelector('.map-toolbar > span');
  if (herd?.lastChild)
    herd.lastChild.textContent = ` ${t('herd')}: ${Math.ceil(state.herd.hp)}/${state.herd.maxHp}`;
  const recovery = root.querySelector('.recovery-bar p');
  if (recovery)
    recovery.textContent = `${state.herd.count} · ${t('health')} ${Math.ceil(state.herd.hp)}/${state.herd.maxHp}`;
  renderedSignature = interfaceSignature();
  return true;
}

function battleRecovery() {
  return `<div class="recovery-bar"><div><h3>${t('herd')}</h3><p>${state.herd.count} · ${t('health')} ${Math.ceil(state.herd.hp)}/${state.herd.maxHp}</p></div><div class="recovery-actions">${button(icon('herbs', 18) + t('healHerd') + costView({ herbs: 1 }), 'healHerd', 'button outline', state.battle.status === 'active' || busy)}${button(icon('heart', 18) + t('rest') + costView({ water: 25, feed: 30 }), 'rest', 'button outline', state.battle.status === 'active' || busy)}</div></div>`;
}

function wolvesView() {
  const wolf = state.wolves.find((w) => w.id === selectedWolf) || state.wolves[0];
  return `<div class="guardian-layout"><section class="guardian-cards">${state.wolves.map((w) => `<button class="guardian-card ${w.id === wolf.id ? 'selected' : ''}" data-wolf="${w.id}"><span class="guardian-portrait"><svg viewBox="-55 -45 110 90">${wolfArt(w.name === 'healer' ? '#7c9877' : '#657975', 1.3)}</svg></span><span class="guardian-info"><small>${t('level')} ${w.level}</small><strong>${roleName(w.name)}</strong>${progress(w.hp, w.maxHp)}<span>${Math.ceil(w.hp)} / ${w.maxHp} ${t('health')}</span></span>${icon('arrow', 18)}</button>`).join('')}</section><section class="wolf-detail detail-card"><div class="section-label">${t('wolfDetails')}${icon('wolves', 20)}</div><div class="large-wolf"><svg viewBox="-60 -40 120 80">${wolfArt(wolf.name === 'healer' ? '#7c9877' : '#657975', 1.2)}</svg></div><h2>${roleName(wolf.name)}</h2><p>${t('level')} ${wolf.level} · ${wolf.xp} / ${wolf.level * 45} ${t('xp')}</p>${progress(wolf.xp, wolf.level * 45)}<div class="training-points">${t('points')} <b>${wolf.points}</b></div>${['guardian', 'hunter', 'leader', 'healer'].map((path) => `<div class="training-row"><span>${roleName(path)} <small>${wolf.ranks[path]} / 5</small></span>${button(t('train') + icon('plus', 14), 'train', 'button outline', wolf.points <= 0 || wolf.ranks[path] >= 5 || busy || state.battle.status === 'active', `data-id="${wolf.id}" data-path="${path}"`)}</div>`).join('')}<div class="training-cost">${costView({ herbs: 8, feed: 12 })}</div></section></div>${battleRecovery()}`;
}

function worldView() {
  return `<section class="world-banner"><div><div class="eyebrow">${t('world')}</div><h2>${t(state.location)}</h2><p>${t('journeyNote')}</p>${state.journey ? `<div class="journey-pill">${icon('world', 19)}${t('travelling')} → ${t(state.journey.destination)} <b data-journey>${Math.max(0, Math.ceil((state.journey.endsAt - Date.now()) / 1000))} ${t('seconds')}</b></div>` : ''}</div><div class="world-mountain"><span></span><span></span><span></span><i>☽</i></div></section><div class="region-grid">${['homeland', 'spring', 'meadow', 'highland'].map((location, i) => `<article class="region-card"><div class="region-art region-${i}">${icon(['village', 'water', 'herbs', 'world'][i], 64)}<span>0${i + 1}</span></div><div class="region-body"><h2>${t(location)}</h2><p>${t(`${location}Detail`)}</p><div>${costView({ water: 20, feed: 20 })}${button(t(state.location === location ? 'arrived' : 'travel'), 'travel', 'button outline', state.location === location || Boolean(state.journey) || state.battle.status === 'active' || busy, `data-destination="${location}"`)}</div></div></article>`).join('')}</div>`;
}

function questsView() {
  return `<div class="quest-grid">${state.quests.map((q, i) => `<article class="quest-card ${q.claimed ? 'quest-complete' : ''}"><div class="quest-number">0${i + 1}</div><div class="quest-icon">${icon(['village', 'feed', 'battle', 'wolves'][i], 34)}</div><span class="quest-tag">${t(q.claimed ? 'claimed' : 'inProgress')}</span><h2>${t(q.id)}</h2><p>${t(`${q.id}Desc`)}</p><div class="quest-progress-label"><span>${t('quests')}</span><strong>${q.progress} / ${q.target}</strong></div>${progress(q.progress, q.target)}${button((q.claimed ? icon('check', 17) : icon('flag', 17)) + t(q.claimed ? 'claimed' : 'claim'), 'claimQuest', 'button ' + (q.claimed ? 'outline' : 'primary'), q.claimed || q.progress < q.target || busy, `data-id="${q.id}"`)}</article>`).join('')}</div>`;
}

function modalView() {
  if (!modal) return '';
  const online = modal === 'online';
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}">${icon('close', 20)}</button><div class="modal-icon">${icon(online ? 'cloud' : 'wolves', 38)}</div><div class="eyebrow">BOZKURT OBASI · AY-YILDIZ NÖBETİ</div><h2 id="modal-title">${t(online ? 'onlineTitle' : 'helpTitle')}</h2><p>${t(online ? 'onlineDesc' : 'helpText')}</p><p class="modal-note">${t(online ? 'onlineNote' : 'helpOffline')}</p>${online ? button(t(mode === 'online' ? 'disconnect' : 'connect') + icon('arrow', 18), mode === 'online' ? 'disconnect' : 'connect', 'button primary', busy) : button(t('understood') + icon('arrow', 18), 'close', 'button primary')}${button(icon('save', 16) + t('exportSave'), 'exportSave', 'button text-button')}</section></div>`;
}

async function api(path, body, generation = sessionGeneration) {
  const response = await fetch(`/api/${path}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json();
  if (generation !== sessionGeneration)
    throw Object.assign(new Error('obsolete_response'), { code: 'obsolete_response' });
  const conflict = response.status === 409 && payload?.error === 'stale_revision';
  if (response.ok || conflict) {
    if (
      !payload ||
      !validateGame(payload.state) ||
      !Number.isSafeInteger(payload.revision) ||
      payload.revision < 0 ||
      (path === 'session' && payload.mode !== 'online')
    ) {
      throw Object.assign(new Error('invalid_response'), { code: 'invalid_response' });
    }
    state = payload.state;
    revision = payload.revision;
  }
  if (!response.ok)
    throw Object.assign(new Error(payload?.error || 'request_failed'), {
      code: payload?.error || 'request_failed',
    });
  return payload;
}

function pollOnline() {
  const generation = sessionGeneration;
  const request = api('state', undefined, generation).catch((error) => {
    if (generation === sessionGeneration && error.code !== 'obsolete_response') toast('failed');
  });
  polling = request;
  void request.finally(() => {
    if (polling === request) polling = null;
  });
  return request;
}

function reportError(error) {
  const code = String(error.code || error.message).toUpperCase();
  const keys = {
    INSUFFICIENT_RESOURCES: 'resourcesError',
    BATTLE_ACTIVE: 'activeError',
    COLLECT_COOLDOWN: 'cooldownError',
    ALREADY_HEALTHY: 'nothingError',
    NO_SKILL_POINTS: 'pointsError',
    STALE_REVISION: 'staleError',
    PACK_EXHAUSTED: 'rest',
    JOURNEY_ACTIVE: 'travelling',
    ALREADY_THERE: 'arrived',
    MAX_LEVEL: 'maxLevel',
    BUILDING_EXISTS: 'built',
  };
  toast(keys[code] || 'error');
}

async function command(action) {
  if (busy) return;
  const focusId = document.activeElement?.id;
  const generation = sessionGeneration;
  busy = true;
  render();
  try {
    if (mode === 'online') {
      // A click during polling waits for its revision instead of being dropped or sent stale.
      if (polling) await polling;
      if (generation !== sessionGeneration) return;
      await api('action', { action, revision }, generation);
    } else {
      applyAction(state, action, Date.now());
      saveLocal();
    }
    if (action.type === 'build') selected = `building-${action.building}`;
    toast(logLabels[state.log.at(-1)?.key] || 'actionDone');
  } catch (error) {
    reportError(error);
  } finally {
    busy = false;
    render(focusId);
  }
}

root.addEventListener('click', async (event) => {
  const target = event.target.closest(
    'button,[data-building],[data-plot],[data-wolf],a.brand-mark',
  );
  if (!target || target.disabled) return;
  if (target.matches('a.brand-mark')) {
    event.preventDefault();
    view = 'village';
    render();
    return;
  }
  if (target.dataset.view) {
    view = target.dataset.view;
    zoom = 1;
    render();
    return;
  }
  if (target.dataset.wolf) {
    selectedWolf = target.dataset.wolf;
    view = 'wolves';
    render();
    return;
  }
  if (target.hasAttribute('data-building')) {
    selected = target.dataset.building;
    render();
    return;
  }
  if (target.dataset.plot) {
    document
      .querySelector(`[data-building-type="${target.dataset.plot}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const a = target.dataset.action;
  if (a === 'language') {
    language = language === 'tr' ? 'en' : 'tr';
    write('bozkurt.language', language);
    notice = '';
    render();
    return;
  }
  if (a === 'help' || a === 'online') {
    modal = a;
    render();
    return;
  }
  if (a === 'close') {
    modal = '';
    render();
    return;
  }
  if (a === 'zoomIn' || a === 'zoomOut' || a === 'resetZoom') {
    zoom =
      a === 'resetZoom' ? 1 : Math.min(1.5, Math.max(0.8, zoom + (a === 'zoomIn' ? 0.1 : -0.1)));
    render();
    return;
  }
  if (a === 'fullscreen') {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector('.map-card').requestFullscreen();
    } catch {
      toast('error');
    }
    return;
  }
  if (a === 'selectBuilding') {
    selected = target.dataset.id;
    document.querySelector('.play-layout').scrollIntoView({ behavior: 'smooth', block: 'start' });
    render();
    return;
  }
  if (a === 'exportSave') {
    saveLocal();
    const local = mode === 'local' ? state : loadLocal();
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'bozkurt-local-save.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('exportDone');
    return;
  }
  if (a === 'connect') {
    if (busy) return;
    saveLocal();
    busy = true;
    const generation = ++sessionGeneration;
    render();
    try {
      await api('session', {}, generation);
      mode = 'online';
      modal = '';
      toast('connected');
    } catch {
      toast('failed');
    } finally {
      busy = false;
      render();
    }
    return;
  }
  if (a === 'disconnect') {
    if (busy) return;
    sessionGeneration++;
    polling = null;
    mode = 'local';
    state = loadLocal();
    modal = '';
    render();
    return;
  }
  const actions = {
    collect: { type: 'collect' },
    upgrade: { type: 'upgrade', id: target.dataset.id },
    build: { type: 'build', building: target.dataset.buildingType },
    formation: { type: 'formation', unit: target.dataset.unit, value: target.dataset.value },
    startBattle: { type: 'startBattle' },
    newBattle: { type: 'newBattle' },
    healHerd: { type: 'healHerd' },
    rest: { type: 'rest' },
    train: { type: 'train', id: target.dataset.id, path: target.dataset.path },
    travel: { type: 'travel', destination: target.dataset.destination },
    claimQuest: { type: 'claimQuest', id: target.dataset.id },
  };
  if (actions[a]) await command(actions[a]);
});

root.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal) {
    modal = '';
    render();
    return;
  }
  if (event.key === 'Tab' && modal) {
    const focusable = [...document.querySelectorAll('.modal button:not(:disabled)')];
    const first = focusable[0],
      last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('g[role="button"]')) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});

setInterval(async () => {
  if (busy || polling) return;
  const generation = sessionGeneration;
  if (mode === 'online') await pollOnline();
  else advanceGame(state, Date.now());
  if (generation !== sessionGeneration || busy) return;
  if (interfaceSignature() !== renderedSignature && !modal) {
    if (view !== 'battle' || !refreshBattleView()) {
      render();
      return;
    }
  }
  for (const key of ['wood', 'stone', 'water', 'feed', 'herbs']) {
    const el = document.querySelector(`[data-resource="${key}"]`);
    if (el)
      el.innerHTML = `${number(state.resources[key])}<small> / ${number(state.capacity)}</small>`;
  }
  const collectButton = document.querySelector('#collect-button');
  if (collectButton) {
    const remaining = Math.max(0, Math.ceil((state.collectReadyAt - Date.now()) / 1000));
    collectButton.disabled = remaining > 0 || busy;
    collectButton.querySelector('[data-collect-label]').textContent = remaining
      ? `${t('collecting')} · ${remaining}${t('seconds')}`
      : t('collect');
  }
  const journey = document.querySelector('[data-journey]');
  if (journey && state.journey)
    journey.textContent = `${Math.max(0, Math.ceil((state.journey.endsAt - Date.now()) / 1000))} ${t('seconds')}`;
  renderNotice();
}, 1000);
setInterval(saveLocal, 20_000);
window.addEventListener('pagehide', saveLocal);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveLocal();
});
render();
