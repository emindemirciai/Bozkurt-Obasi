import './style.css';
import heroImage from './assets/hero-bozkurt.webp';
import googleIcon from './assets/google-g.png';
import {
  createGame,
  validateGame,
  BUILDINGS,
  FORMATIONS,
  getProduction,
  getUpgradeCost,
} from '../shared/game.mjs';
import { translations } from './i18n.mjs';
import releaseNotes from '../releases.json';
import { icon, miniBuilding, scene, wolfArt } from './art.mjs';
import { createAnalytics } from './analytics.mjs';

const analytics = createAnalytics();

const GAME_VIEWS = new Set(['village', 'battle', 'world', 'wolves', 'quests', 'updates']);
const initialView = GAME_VIEWS.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
const privacyHref = location.protocol === 'file:' ? '../public/privacy.html' : '/privacy.html';
const termsHref = location.protocol === 'file:' ? '../public/terms.html' : '/terms.html';
let auth = {
  loading: location.protocol !== 'file:',
  enabled: false,
  authenticated: false,
  user: null,
};
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
let theme = read('bozkurt.theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = theme;
let state = createGame();
let mode = 'local',
  view = initialView,
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

function navigate(next) {
  if (next !== 'home' && !GAME_VIEWS.has(next)) return;
  if (next !== 'home' && (!auth.authenticated || mode !== 'online')) {
    toast('signInRequired');
    return;
  }
  view = next;
  zoom = 1;
  modal = '';
  const target = next === 'home' ? `${location.pathname}${location.search}` : `#${next}`;
  history.pushState(null, '', target);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function googleControl() {
  if (auth.authenticated) {
    const name = auth.user?.name || auth.user?.email || t('googleAccount');
    return `<div class="landing-account"><span class="landing-avatar" aria-hidden="true">${escape(name.slice(0, 1).toLocaleUpperCase(language))}</span><span><strong>${escape(name)}</strong><small>${t(mode === 'online' ? 'accountReady' : 'googleGameUnavailable')}</small></span>${button(t('manageAccount'), 'account', 'landing-account-manage')}</div>`;
  }
  if (!auth.enabled) {
    return `<div class="landing-google-unavailable"><button class="landing-google" disabled><img class="google-g" src="${googleIcon}" alt="" aria-hidden="true">${t('googleSignIn')}</button><small>${t(auth.loading ? 'googleChecking' : 'googleUnavailable')}</small></div>`;
  }
  return `<a class="landing-google" href="/api/auth/google/start"><img class="google-g" src="${googleIcon}" alt="" aria-hidden="true">${t('googleSignIn')}</a>`;
}

function landingView() {
  return `<div class="landing-shell">
    <header class="landing-header"><button class="landing-brand" data-action="home" aria-label="${t('landingHome')}"><span class="landing-brand-symbol" aria-hidden="true">☾✦</span><span>BOZKURT <b>OBASI</b><small>AY-YILDIZ NÖBETİ</small></span></button>
      <nav class="landing-nav" aria-label="${t('landingNavigation')}"><button data-action="scroll" data-target="landing-story">${t('landingStoryNav')}</button><button data-action="scroll" data-target="landing-features">${t('landingFeaturesNav')}</button></nav>
      <div class="landing-header-actions"><button class="language" data-action="language" aria-label="${language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}">${language.toUpperCase()}<span>⌄</span></button><button class="theme-toggle" data-action="theme" aria-label="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}" title="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}"><span aria-hidden="true">${theme === 'dark' ? '&#9788;' : '&#9790;'}</span></button></div>
    </header>
    <main class="landing-main"><section class="landing-hero" aria-labelledby="landing-title"><img class="landing-hero-art" src="${heroImage}" alt="${t('landingHeroAlt')}" fetchpriority="high"><div class="landing-hero-shade"></div><div class="landing-hero-content"><span class="landing-kicker"><i></i>${t('landingKicker')}</span><h1 id="landing-title">${t('landingTitleLine1')}<em>${t('landingTitleLine2')}</em></h1><p>${t('landingLead')}</p><div class="landing-hero-actions">${auth.authenticated && mode === 'online' ? button(t('landingPlay') + icon('arrow', 19), 'play', 'landing-play') : ''}${googleControl()}</div><span class="landing-hero-hint">${t('landingGuestHint')}</span></div><div class="landing-hero-caption"><span>01 / 03</span><span>${t('landingSceneCaption')}</span></div></section>
    <section class="landing-intro" id="landing-story"><div class="landing-intro-copy"><span class="landing-section-label">${t('landingChapterOne')}</span><h2>${t('landingStoryTitle')}</h2><p>${t('landingStoryText')}</p><div class="landing-story-pills"><span>${icon('village', 17)}${t('landingPillBuild')}</span><span>${icon('wolves', 17)}${t('landingPillGuard')}</span><span>${icon('world', 17)}${t('landingPillExplore')}</span></div></div><div class="landing-intro-art" aria-hidden="true"><div class="landing-art-moon">☾</div><div class="landing-art-building">${miniBuilding('hall')}</div><svg class="landing-art-wolf" viewBox="-60 -45 120 90">${wolfArt('#536e65', 1.2, 1)}</svg><span class="landing-art-horizon"></span></div></section>
    <section class="landing-features" id="landing-features"><div class="landing-section-heading"><span class="landing-section-label">${t('landingChapterTwo')}</span><h2>${t('landingFeaturesTitle')}</h2><p>${t('landingFeaturesLead')}</p></div><div class="landing-feature-grid"><article class="landing-feature"><span class="landing-feature-number">01</span><div class="landing-feature-art building">${miniBuilding('watchtower')}</div><h3>${t('landingBuildTitle')}</h3><p>${t('landingBuildText')}</p></article><article class="landing-feature"><span class="landing-feature-number">02</span><div class="landing-feature-art wolf"><svg viewBox="-60 -45 120 90" aria-hidden="true">${wolfArt('#5b716a', 1.35, 1)}</svg></div><h3>${t('landingDefendTitle')}</h3><p>${t('landingDefendText')}</p></article><article class="landing-feature"><span class="landing-feature-number">03</span><div class="landing-feature-art horizon"><span class="landing-feature-sun"></span><span class="landing-feature-hill first"></span><span class="landing-feature-hill second"></span>${icon('world', 42)}</div><h3>${t('landingExploreTitle')}</h3><p>${t('landingExploreText')}</p></article></div></section>
    <section class="landing-finale"><span class="landing-section-label">${t('landingFinalKicker')}</span><h2>${t('landingFinalTitle')}</h2><p>${t('landingFinalText')}</p>${auth.authenticated && mode === 'online' ? button(t('landingPlay') + icon('arrow', 18), 'play', 'landing-play') : googleControl()}</section></main>
    <footer class="landing-footer"><span>© 2026 Emin DEMİRCİ · Bozkurt Obası · MIT</span><nav aria-label="${t('landingFooterNav')}"><a href="${privacyHref}">${t('privacyPolicy')}</a><a href="${termsHref}">${t('termsOfUse')}</a><a href="mailto:info@bozkurtobasi.com">info@bozkurtobasi.com</a></nav><span>v${escape(releaseNotes.version)}</span></footer></div><div id="notice" class="toast" role="status" aria-live="polite"></div>${modalView()}`;
}

async function refreshGoogleAuth() {
  if (location.protocol === 'file:') {
    auth = { loading: false, enabled: false, authenticated: false, user: null };
    denyGameAccess();
    render();
    return;
  }
  try {
    const response = await fetch('/api/auth/google/status', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('status_failed');
    const result = await response.json();
    auth = {
      loading: false,
      enabled: result.enabled === true,
      authenticated: result.authenticated === true,
      user: result.authenticated ? result.user : null,
      reason: result.reason,
    };
  } catch {
    auth = { loading: false, enabled: false, authenticated: false, user: null };
  }
  if (!auth.authenticated) denyGameAccess();
  render();
}

function denyGameAccess() {
  sessionGeneration++;
  polling = null;
  mode = 'local';
  view = 'home';
  modal = '';
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);
}

async function initGoogleAuth() {
  await refreshGoogleAuth();
  const result = new URL(location.href).searchParams.get('auth');
  if (result) {
    const url = new URL(location.href);
    url.searchParams.delete('auth');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    if (result === 'success' && auth.authenticated) toast('googleWelcome');
    else if (result === 'cancelled') toast('googleCancelled');
  }
  if (!auth.authenticated) return;
  const generation = ++sessionGeneration;
  try {
    await api('session', {}, generation);
    mode = 'online';
    render();
  } catch (error) {
    if (error.code !== 'obsolete_response') toast('googleGameUnavailable');
  }
}

function render(restoreFocus) {
  const active = document.activeElement;
  const focusId = restoreFocus || active?.id;
  document.documentElement.lang = language;
  document.documentElement.dataset.theme = theme;
  const visibleView = auth.authenticated && mode === 'online' ? view : 'home';
  document.title =
    visibleView === 'home'
      ? 'Bozkurt Obası: Ay-Yıldız Nöbeti'
      : `Bozkurt Obası: Ay-Yıldız Nöbeti · ${t(visibleView)}`;
  // Resolve the session before counting a screen so an authenticated deep link
  // does not create a transient homepage visit while its village is loading.
  if (!auth.loading && (!auth.authenticated || mode === 'online')) analytics.view(visibleView);
  if (visibleView === 'home') {
    root.innerHTML = landingView();
    identifyControls();
    renderedSignature = interfaceSignature();
    renderNotice();
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    if (modal) document.querySelector('[role="dialog"] button')?.focus({ preventScroll: true });
    return;
  }
  const navigation = ['village', 'battle', 'world', 'wolves', 'quests', 'updates'];
  root.innerHTML = `<div class="game-shell">
    <nav class="rail" aria-label="${t('village')}"><a href="/" class="brand-mark" aria-label="${t('landingHome')}"><svg viewBox="0 0 42 42"><path d="M26 6a16 16 0 1 0 0 30 15 15 0 0 1 0-30" fill="currentColor"/><path d="m29 15 2 4 5 .5-3.7 3.2 1.2 4.8-4.5-2.5-4.3 2.5 1-4.8-3.7-3.2 5-.5Z" fill="currentColor"/></svg></a>
    <div class="nav-links">${navigation.map((key) => `<button data-view="${key}" class="nav-item ${view === key ? 'active' : ''}" aria-current="${view === key ? 'page' : 'false'}" title="${t(key)}">${icon(key === 'updates' ? 'save' : key, 24)}<span>${t(key)}</span>${key === 'quests' && state.quests.some((q) => !q.claimed && q.progress === q.target) ? '<i class="nav-dot"></i>' : ''}</button>`).join('')}</div>
    <div class="rail-bottom">${button(icon('help', 23), 'help', 'rail-help', false, `aria-label="${t('help')}"`)}<span class="rail-version">v${releaseNotes.version}</span></div></nav>
    <div class="workspace"><header class="topbar"><button class="wordmark" data-action="home" title="${t('landingHome')}">BOZKURT OBASI <span>AY-YILDIZ NÖBETİ</span></button><div class="topbar-end"><span class="connection"><i class="status-dot live"></i>${t('online')}${icon('cloud', 16)}</span><button class="language" data-action="language" aria-label="${language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}">${language.toUpperCase()}<span>⌄</span></button><button class="theme-toggle" data-action="theme" aria-label="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}" title="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}"><span aria-hidden="true">${theme === 'dark' ? '&#9788;' : '&#9790;'}</span></button>${button(icon('wolves', 19), 'account', 'profile', false, `aria-label="${t('manageAccount')}"`)}</div></header>
    <main><section class="page-heading"><div><div class="eyebrow">${t('subtitle')}</div><h1>${t(view === 'village' ? 'greeting' : view)}</h1><p>${t(view === 'village' ? 'villageDesc' : `${view}Desc`)}</p></div><div class="weather">${icon('sun', 29)}<span>${t('sunny')}<small>${t(state.location)}</small></span></div></section>
    <section class="resource-bar" aria-label="${t('production')}">${['wood', 'stone', 'water', 'feed', 'herbs'].map((key) => `<div class="resource ${key}" title="${t('resourceTip')}"><span class="resource-icon">${icon(key, 23)}</span><div><span class="resource-label">${t(key)}</span><strong data-resource="${key}">${number(state.resources[key])}<small> / ${number(state.capacity)}</small></strong></div><span class="resource-rate">+${number(getProduction(state)[key])}<small>${t('perMinute')}</small></span></div>`).join('')}</section>
    ${view === 'village' || view === 'battle' ? playView() : view === 'world' ? worldView() : view === 'wolves' ? wolvesView() : view === 'quests' ? questsView() : updatesView()}
    <footer><span>${icon('save', 13)} ${t(storageOk || mode === 'online' ? 'saved' : 'storageFailed')}</span><span>${t('projectVersion')} ${releaseNotes.version} · ${mode === 'online' ? 'VPS' : t('local')} · <a href="${privacyHref}">${t('privacyPolicy')}</a> · <a href="${termsHref}">${t('termsOfUse')}</a></span></footer></main></div></div>
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

function updatesView() {
  const releases = [...releaseNotes.releases].sort((a, b) => b.date.localeCompare(a.date));
  return (
    '<section class="release-intro"><div><span class="eyebrow">' +
    t('updatesEyebrow') +
    '</span><h2>' +
    t('currentVersion') +
    '</h2><p>' +
    t('updatesIntro') +
    '</p></div><strong>v' +
    escape(releaseNotes.version) +
    '</strong></section>' +
    '<ol class="release-timeline" aria-label="' +
    t('updatesHistory') +
    '">' +
    releases
      .map((release) => {
        const date = new Date(release.date + 'T12:00:00Z').toLocaleDateString(
          language === 'tr' ? 'tr-TR' : 'en-US',
          { year: 'numeric', month: 'long', day: 'numeric' },
        );
        const changes = release.changes?.[language] || [];
        return (
          '<li class="release-card" data-release-version="' +
          escape(release.version) +
          '"><div class="release-marker" aria-hidden="true"></div><article><header><div><span class="release-version">v' +
          escape(release.version) +
          '</span>' +
          (release.version === releaseNotes.version
            ? '<span class="release-latest">' + t('latestRelease') + '</span>'
            : '') +
          '</div><time datetime="' +
          escape(release.date) +
          '">' +
          escape(date) +
          '</time></header><ul>' +
          changes.map((change) => '<li>' + escape(change) + '</li>').join('') +
          '</ul></article></li>'
        );
      })
      .join('') +
    '</ol>'
  );
}

function modalView() {
  if (!modal) return '';
  if (modal === 'account') {
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}">${icon('close', 20)}</button><div class="modal-icon">${icon('wolves', 38)}</div><div class="eyebrow">BOZKURT OBASI</div><h2 id="modal-title">${t('googleAccount')}</h2><p>${escape(auth.user?.name || auth.user?.email || '')}</p><p class="modal-note">${escape(auth.user?.email || '')}</p>${button(t('googleLogout'), 'googleLogout', 'button outline', busy)}<div class="account-legal"><a href="${privacyHref}">${t('privacyPolicy')}</a><a href="${termsHref}">${t('termsOfUse')}</a></div></section></div>`;
  }
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}">${icon('close', 20)}</button><div class="modal-icon">${icon('wolves', 38)}</div><div class="eyebrow">BOZKURT OBASI · AY-YILDIZ NÖBETİ</div><h2 id="modal-title">${t('helpTitle')}</h2><p>${t('helpText')}</p><p class="modal-note">${t('helpOffline')}</p>${button(t('understood') + icon('arrow', 18), 'close', 'button primary')}${button(icon('save', 16) + t('exportSave'), 'exportSave', 'button text-button')}</section></div>`;
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
  if (!response.ok && response.status === 401) {
    auth.authenticated = false;
    auth.user = null;
    denyGameAccess();
    render();
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
  if (!auth.authenticated || mode !== 'online') {
    toast('signInRequired');
    return;
  }
  const focusId = document.activeElement?.id;
  const generation = sessionGeneration;
  busy = true;
  render();
  try {
    // A click during polling waits for its revision instead of being dropped or sent stale.
    if (polling) await polling;
    if (generation !== sessionGeneration) return;
    await api('action', { action, revision }, generation);
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
    navigate('home');
    return;
  }
  if (target.dataset.view) {
    navigate(target.dataset.view);
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
  if (a === 'scroll') {
    document.getElementById(target.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (a === 'home' || a === 'play' || a === 'updates') {
    navigate(a === 'home' ? 'home' : a === 'play' ? 'village' : 'updates');
    return;
  }
  if (a === 'account') {
    modal = 'account';
    render();
    return;
  }
  if (a === 'googleLogout') {
    if (busy) return;
    busy = true;
    render();
    try {
      const response = await fetch('/api/auth/google/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('auth_request_failed');
      auth.authenticated = false;
      auth.user = null;
      denyGameAccess();
      await refreshGoogleAuth();
      toast('googleLoggedOut');
    } catch {
      toast('failed');
    } finally {
      busy = false;
      render();
    }
    return;
  }
  if (a === 'language') {
    language = language === 'tr' ? 'en' : 'tr';
    write('bozkurt.language', language);
    notice = '';
    render();
    return;
  }
  if (a === 'theme') {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    write('bozkurt.theme', theme);
    render();
    return;
  }
  if (a === 'help') {
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
    if (!auth.authenticated || mode !== 'online') return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'bozkurt-obasi-save.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('exportDone');
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
  if (generation !== sessionGeneration || busy) return;
  if (view === 'home') {
    renderNotice();
    return;
  }
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
window.addEventListener('popstate', () => {
  view = GAME_VIEWS.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  modal = '';
  if (!auth.authenticated || mode !== 'online') denyGameAccess();
  render();
});
render();
void initGoogleAuth();
