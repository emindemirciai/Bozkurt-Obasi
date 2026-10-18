import './style.css';
import './v2.css';
import './battle-feedback.css';
import './village-camera.css';
import { mountVillageCamera, villageCameraControls } from './village-camera.mjs';
import { battleCommandStatus } from '../shared/battle-commands.mjs';
import {
  battleCommandPanel,
  battleCommandQuickbar,
  updateBattleCommandQuickbar,
  updateBattleCommandPanel,
  battleCommandBadge,
  updateBattleCommandBadge,
} from './battle-command-panel.mjs';
import { PLOTS, getWallUpgradeCost, demolitionQuote } from '../shared/settlement.mjs';
import { demolitionDialog, demolitionStatus, updateDemolitionDialog } from './demolition-panel.mjs';
import { adventureQuote } from '../shared/adventures.mjs';
import { adventurePartySuggestions } from './adventure-party.mjs';
import {
  placementDialog,
  settlementControls,
  narrativePanel,
  battlePhase,
  adventureView,
  updateAdventurePlanning,
} from './v2-view.mjs';
import { socialPanel } from './social-view.mjs';
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
import { firstWatchProgress } from '../shared/first-watch.mjs';
import { firstWatchPanel, updateFirstWatchPanel } from './first-watch-panel.mjs';
import { constructionPlan } from './planning.mjs';
import { economyPanel, updateEconomyPanel } from './economy-panel.mjs';
import { herdPanel, updateHerdPanel } from './herd-panel.mjs';
import { guardianPanel, updateGuardianPanel } from './guardian-panel.mjs';
import { brandMark, brandName } from './logo.mjs';
import releaseNotes from '../releases.json';
import { icon, miniBuilding, scene, wolfArt } from './art.mjs';
import { createAnalytics } from './analytics.mjs';
import { profileDialog, verificationDialog, recoveryDialog, friendsView } from './player-panel.mjs';

const analytics = createAnalytics();

const GAME_VIEWS = new Set([
  'village',
  'battle',
  'world',
  'wolves',
  'quests',
  'friends',
  'updates',
]);
const initialView = GAME_VIEWS.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
const privacyHref = location.protocol === 'file:' ? '../public/privacy.html' : '/privacy.html';
const termsHref = location.protocol === 'file:' ? '../public/terms.html' : '/terms.html';
let auth = {
  loading: location.protocol !== 'file:',
  enabled: false,
  emailEnabled: false,
  mailEnabled: false,
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
let villageCamera = null,
  villageCameraState = {};
let plannedBuilding = 'quarry';
let herdAmount = 1;
let selectedPlot = '',
  movingId = '';
let demolitionSelection = null,
  demolitionError = '';
const demolitionContext = () => ({ t, language, busy, error: demolitionError });
let adventureSelection = {
  kind: 'expedition',
  plan: 'standard',
  region: 'spring',
  difficulty: 'easy',
  wolfIds: ['wolf-alpha'],
};
let conversation = { userCode: '', messages: [], nextBefore: null },
  conversationRequest = 0,
  conversationPending = 0,
  conversationPollAt = 0;
const economyContext = () => ({ t, number, escape, language, busy });
let notice = '',
  noticeUntil = 0;
let profileDraft = {},
  friendsDraft = {},
  friendsData = { friends: [], incoming: [], outgoing: [], transfers: [] },
  friendsLoaded = false;
let accountDraft = { name: '', email: '', password: '', code: '' },
  accountError = '',
  accountOpener = '',
  accountRequest = 0;
let recoveryDraft = { email: '', code: '', password: '', confirmPassword: '' },
  recoveryStep = 'request',
  recoveryError = '';
const root = document.querySelector('#app');
const t = (key) => translations[language][key] || key;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const number = (value) => Math.floor(value).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US');
const resourceNumber = (value) =>
  value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 3 });
const roleName = (role) => t(role === 'healer' ? 'healerPath' : role);
const logLabels = {
  villageFounded: 'noActivity',
  buildingBuilt: 'logBuilt',
  buildingUpgraded: 'logUpgraded',
  buildingDemolished: 'logDemolished',
  resourcesCollected: 'logGathered',
  battleStarted: 'logBattle',
  battleWon: 'logWon',
  battleLost: 'logLost',
  battleCommandBrace: 'bcBrace',
  battleCommandFocus: 'bcFocus',
  battleCommandRally: 'bcRally',
  wolfTrained: 'logTrained',
  herdHealed: 'logHealed',
  herdReplenished: 'logHerdReplenished',
  packRested: 'logRested',
  journeyStarted: 'logTravel',
  journeyArrived: 'logArrived',
  questClaimed: 'logClaimed',
  firstWatchClaimed: 'logClaimed',
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
let costSequence = 0;
function costHint(key, required) {
  const format = (value) =>
    value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 3 });
  return (
    t(key) +
    ' · ' +
    t('buildingCostRequired') +
    ': ' +
    format(required) +
    ' · ' +
    t('buildingCostAvailable') +
    ': ' +
    format(state.resources[key])
  );
}
function costView(cost, { focusable = true } = {}) {
  return `<span class="cost">${Object.entries(cost)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => {
      const id = 'resource-cost-' + costSequence++;
      const hint = escape(costHint(key, value));
      return `<span id="${id}" role="group" class="resource-cost ${state.resources[key] < value ? 'short' : ''}" data-cost-resource="${key}" data-cost-required="${value}" ${focusable ? 'tabindex="0"' : ''} aria-label="${hint}" aria-describedby="${id}-tooltip" title="${hint}">${icon(key, 14)}<span class="cost-resource-name">${t(key)}</span><b>${number(value)}</b><span id="${id}-tooltip" class="cost-tooltip" role="tooltip"><strong>${t(key)}</strong><span>${t('buildingCostRequired')}: ${number(value)}</span><span data-cost-available>${t('buildingCostAvailable')}: ${state.resources[key].toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 3 })}</span></span></span>`;
    })
    .join('')}</span>`;
}
function updateCostHints() {
  for (const node of root.querySelectorAll('[data-cost-resource]')) {
    const key = node.dataset.costResource,
      required = Number(node.dataset.costRequired);
    node.setAttribute('aria-label', costHint(key, required));
    node.title = costHint(key, required);
    node.classList.toggle('short', state.resources[key] < required);
    node.querySelector('[data-cost-available]').textContent =
      t('buildingCostAvailable') +
      ': ' +
      state.resources[key].toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', {
        maximumFractionDigits: 3,
      });
  }
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
    getWallUpgradeCost(state.walls) || {},
    adventureQuote(state, adventureSelection).cost,
    { herbs: 1 },
    { water: 25, feed: 30 },
    { herbs: 8, feed: 12 },
    { water: 20, feed: 20 },
  ];
  return JSON.stringify([
    visibleState,
    view === 'world'
      ? []
      : costs.map((cost) => Object.entries(cost).map(([key, value]) => resources[key] >= value)),
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
  if (busy && ['recovery', 'demolition'].includes(modal)) return;
  if (next !== 'home' && !GAME_VIEWS.has(next)) return;
  if (next !== 'home' && (!auth.authenticated || mode !== 'online')) {
    toast('signInRequired');
    return;
  }
  if (next === 'friends') void loadFriends();
  view = next;
  demolitionSelection = null;
  demolitionError = '';
  zoom = 1;
  villageCamera?.reset();
  villageCameraState = { ...villageCameraState, zoom: 1, centerX: 720, centerY: 490 };
  modal = '';
  const target = next === 'home' ? `${location.pathname}${location.search}` : `#${next}`;
  history.pushState(null, '', target);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function googleSignInControl(label = 'googleSignIn') {
  if (!auth.enabled) {
    return `<div class="landing-google-unavailable"><button class="landing-google" disabled><img class="google-g" src="${googleIcon}" alt="" aria-hidden="true">${t(label)}</button><small>${t(auth.loading ? 'googleChecking' : 'googleUnavailable')}</small></div>`;
  }
  return `<a class="landing-google" href="/api/auth/google/start"><img class="google-g" src="${googleIcon}" alt="" aria-hidden="true">${t(label)}</a>`;
}

function googleControl() {
  if (auth.verificationRequired)
    return button(t('openVerification'), 'openVerification', 'landing-account-manage');
  if (auth.authenticated) {
    const name = auth.user?.name || auth.user?.email || t('playerAccount');
    return `<div class="landing-account"><span class="landing-avatar" aria-hidden="true">${auth.user?.avatarUrl ? `<img src="${escape(auth.user.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : escape(name.slice(0, 1).toLocaleUpperCase(language))}</span><span><strong>${escape(name)}</strong><small>${t(mode === 'online' ? 'accountReady' : 'googleGameUnavailable')}</small></span>${button(t('manageAccount'), 'account', 'landing-account-manage')}</div>`;
  }
  return `${googleSignInControl()}<div class="landing-email-actions">${button(t('emailLogin'), 'login', 'landing-email-button', auth.loading)}${button(t('emailRegister'), 'register', 'landing-email-button emphasis', auth.loading)}</div>`;
}

function landingView() {
  return `<div class="landing-shell">
    <header class="landing-header"><button class="landing-brand" data-action="brandHome" aria-label="BOZKURT OBASI · ${t('landingHome')}"><span class="landing-brand-symbol">${brandMark}</span>${brandName}</button>
      <nav class="landing-nav" aria-label="${t('landingNavigation')}"><button data-action="scroll" data-target="landing-story">${t('landingStoryNav')}</button><button data-action="scroll" data-target="landing-features">${t('landingFeaturesNav')}</button></nav>
      <div class="landing-header-actions"><button class="language" data-action="language" aria-label="${language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}">${language.toUpperCase()}<span>⌄</span></button><button class="theme-toggle" data-action="theme" aria-label="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}" title="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}"><span aria-hidden="true">${theme === 'dark' ? '&#9788;' : '&#9790;'}</span></button></div>
    </header>
    <main class="landing-main"><section class="landing-hero" aria-labelledby="landing-title"><img class="landing-hero-art" src="${heroImage}" alt="${t('landingHeroAlt')}" fetchpriority="high"><div class="landing-hero-shade"></div><div class="landing-hero-content"><span class="landing-kicker"><i></i>${t('landingKicker')}</span><h1 id="landing-title">${t('landingTitleLine1')}<em>${t('landingTitleLine2')}</em></h1><p>${t('landingLead')}</p><div class="landing-hero-actions">${auth.authenticated && mode === 'online' ? button(t('landingPlay') + icon('arrow', 19), 'play', 'landing-play') : ''}${googleControl()}</div><span class="landing-hero-hint">${t('landingGuestHint')}</span></div><div class="landing-hero-caption"><span>01 / 03</span><span>${t('landingSceneCaption')}</span></div></section>
    <section class="landing-intro" id="landing-story"><div class="landing-intro-copy"><span class="landing-section-label">${t('landingChapterOne')}</span><h2>${t('landingStoryTitle')}</h2><p>${t('landingStoryText')}</p><div class="landing-story-pills"><span>${icon('village', 17)}${t('landingPillBuild')}</span><span>${icon('wolves', 17)}${t('landingPillGuard')}</span><span>${icon('world', 17)}${t('landingPillExplore')}</span></div></div><div class="landing-intro-art" aria-hidden="true"><div class="landing-art-moon">☾</div><div class="landing-art-building">${miniBuilding('hall')}</div><svg class="landing-art-wolf" viewBox="-60 -45 120 90">${wolfArt('#536e65', 1.2, 1)}</svg><span class="landing-art-horizon"></span></div></section>
    <section class="landing-features" id="landing-features"><div class="landing-section-heading"><span class="landing-section-label">${t('landingChapterTwo')}</span><h2>${t('landingFeaturesTitle')}</h2><p>${t('landingFeaturesLead')}</p></div><div class="landing-feature-grid"><article class="landing-feature"><span class="landing-feature-number">01</span><div class="landing-feature-art building">${miniBuilding('watchtower')}</div><h3>${t('landingBuildTitle')}</h3><p>${t('landingBuildText')}</p></article><article class="landing-feature"><span class="landing-feature-number">02</span><div class="landing-feature-art wolf"><svg viewBox="-60 -45 120 90" aria-hidden="true">${wolfArt('#5b716a', 1.35, 1)}</svg></div><h3>${t('landingDefendTitle')}</h3><p>${t('landingDefendText')}</p></article><article class="landing-feature"><span class="landing-feature-number">03</span><div class="landing-feature-art horizon"><span class="landing-feature-sun"></span><span class="landing-feature-hill first"></span><span class="landing-feature-hill second"></span>${icon('world', 42)}</div><h3>${t('landingExploreTitle')}</h3><p>${t('landingExploreText')}</p></article></div></section>
    <section class="landing-finale"><span class="landing-section-label">${t('landingFinalKicker')}</span><h2>${t('landingFinalTitle')}</h2><p>${t('landingFinalText')}</p></section></main>
    <footer class="landing-footer"><span>© 2026 Bozkurt Obası</span><nav aria-label="${t('landingFooterNav')}"><a href="${privacyHref}">${t('privacyPolicy')}</a><a href="${termsHref}">${t('termsOfUse')}</a><a href="mailto:info@bozkurtobasi.com">info@bozkurtobasi.com</a></nav><span>v${escape(releaseNotes.version)}</span></footer></div><div id="notice" class="toast" role="status" aria-live="polite"></div>${modalView()}`;
}

async function refreshGoogleAuth() {
  if (location.protocol === 'file:') {
    auth = {
      loading: false,
      enabled: false,
      emailEnabled: false,
      mailEnabled: false,
      authenticated: false,
      user: null,
    };
    denyGameAccess();
    render();
    return;
  }
  try {
    const response = await fetch('/api/auth/player/status', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('status_failed');
    const result = await response.json();
    auth = {
      loading: false,
      enabled: result.enabled === true,
      emailEnabled: result.emailEnabled === true,
      mailEnabled: result.mailEnabled === true,
      authenticated: result.authenticated === true,
      user: result.authenticated ? result.user : null,
      verificationRequired: result.verificationRequired === true,
      pendingEmail: result.pendingEmail || '',
      reason: result.reason,
    };
  } catch {
    auth = {
      loading: false,
      enabled: false,
      emailEnabled: false,
      mailEnabled: false,
      authenticated: false,
      user: null,
    };
  }
  if (!auth.authenticated) denyGameAccess();
  if (auth.verificationRequired) modal = 'verify';
  render();
}

function denyGameAccess() {
  villageCamera?.destroy();
  villageCamera = null;
  villageCameraState = {};
  analytics.reset();
  sessionGeneration++;
  polling = null;
  mode = 'local';
  view = 'home';
  modal = '';
  plannedBuilding = 'quarry';
  selectedPlot = movingId = '';
  demolitionSelection = null;
  demolitionError = '';
  adventureSelection = {
    kind: 'expedition',
    plan: 'standard',
    region: 'spring',
    difficulty: 'easy',
    wolfIds: ['wolf-alpha'],
  };
  conversationRequest++;
  conversationPending = 0;
  conversation = { userCode: '', messages: [], nextBefore: null };
  friendsDraft = {};
  friendsData = { friends: [], incoming: [], outgoing: [], transfers: [], gifts: [] };
  friendsLoaded = false;
  clearAccountDraft();
  clearRecoveryDraft();
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
    else if (result === 'account_deleted') toast('accountDeleted');
    else if (result === 'account_link_required' || result === 'account_link_email_mismatch') {
      clearAccountDraft();
      accountError =
        result === 'account_link_required' ? 'accountLinkRequired' : 'accountLinkEmailMismatch';
      modal = auth.authenticated ? 'account' : 'login';
      render();
    }
  }
  if (!auth.authenticated) return;
  const generation = ++sessionGeneration;
  try {
    await api('session', {}, generation);
    mode = 'online';
    if (view === 'friends') void loadFriends();
    render();
  } catch (error) {
    if (error.code !== 'obsolete_response') toast('googleGameUnavailable');
  }
}

function render(restoreFocus, preservePlanning = false) {
  costSequence = 0;
  const active = document.activeElement;
  if (villageCamera) {
    villageCameraState = villageCamera.getState();
    villageCamera.destroy();
    villageCamera = null;
  }
  const focusId = restoreFocus || active?.id;
  const textSelection = active?.matches('textarea, input[type=text]')
    ? [active.selectionStart, active.selectionEnd]
    : null;
  const previousPlanning =
    preservePlanning && view === 'village' ? root.querySelector('#economy-panel') : null;
  const previousHerd = preservePlanning ? root.querySelector('#herd-recovery-panel') : null;
  const previousGuardian =
    preservePlanning && view === 'wolves' ? root.querySelector('#guardian-panel') : null;
  const previousParty =
    preservePlanning && view === 'world'
      ? root.querySelector('#adventure-party-suggestions')
      : null;
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
    focusDialog();
    return;
  }
  const navigation = ['village', 'battle', 'world', 'wolves', 'quests', 'friends', 'updates'];
  root.innerHTML = `<div class="game-shell">
    <nav class="rail" aria-label="${t('village')}"><a href="/" class="brand-mark" aria-label="${t('landingHome')}">${brandMark}</a>
    <div class="nav-links">${navigation.map((key) => `<button data-view="${key}" class="nav-item ${view === key ? 'active' : ''}" aria-current="${view === key ? 'page' : 'false'}" title="${t(key)}">${icon(key === 'updates' ? 'save' : key === 'friends' ? 'wolves' : key, 24)}<span>${t(key)}</span>${key === 'quests' && (state.quests.some((q) => !q.claimed && q.progress === q.target) || firstWatchProgress(state).steps.some((step) => step.claimable)) ? '<i class="nav-dot"></i>' : ''}</button>`).join('')}</div>
    <div class="rail-bottom">${button(icon('help', 23), 'help', 'rail-help', false, `aria-label="${t('help')}"`)}<span class="rail-version">v${releaseNotes.version}</span></div></nav>
    <div class="workspace"><header class="topbar"><button class="wordmark" data-action="brandHome" title="${t('landingHome')}" aria-label="BOZKURT OBASI · ${t('landingHome')}">${brandName}</button><div class="topbar-end"><span class="connection"><i class="status-dot live"></i>${t('online')}${icon('cloud', 16)}</span><button class="language" data-action="language" aria-label="${language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}">${language.toUpperCase()}<span>⌄</span></button><button class="theme-toggle" data-action="theme" aria-label="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}" title="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}"><span aria-hidden="true">${theme === 'dark' ? '&#9788;' : '&#9790;'}</span></button>${button(auth.user?.avatarUrl ? `<img src="${escape(auth.user.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : icon('wolves', 19), 'account', 'profile', false, `aria-label="${t('manageAccount')}"`)}</div></header>
    <main><section class="page-heading"><div><div class="eyebrow">${t('subtitle')}</div><h1>${t(view === 'village' ? 'greeting' : view)}</h1><p>${t(view === 'village' ? 'villageDesc' : `${view}Desc`)}</p></div><div class="weather">${icon('sun', 29)}<span>${t('sunny')}<small>${t(state.location)}</small></span></div></section>
    <section class="resource-bar" aria-label="${t('production')}">${['wood', 'stone', 'water', 'feed', 'herbs'].map((key) => `<div class="resource ${key}" title="${t('resourceTip')}"><span class="resource-icon">${icon(key, 23)}</span><div><span class="resource-label">${t(key)}</span><strong data-resource="${key}">${number(state.resources[key])}<small> / ${number(state.capacity)}</small></strong></div><span class="resource-rate">+${resourceNumber(getProduction(state)[key])}<small>${t('perMinute')}</small></span></div>`).join('')}</section>
    ${view === 'village' || view === 'battle' ? playView() : view === 'world' ? worldView() : view === 'wolves' ? wolvesView() : view === 'quests' ? questsView() : view === 'friends' ? friendsView({ t, escape, number, button, data: friendsData, user: auth.user, loaded: friendsLoaded, busy, draft: friendsDraft }) + socialPanel({ t, escape, data: friendsData, conversation, draft: friendsDraft, busy, language }) : updatesView()}
    <footer><span>${icon('save', 13)} ${t(storageOk || mode === 'online' ? 'saved' : 'storageFailed')}</span><span>${t('projectVersion')} ${releaseNotes.version} · ${mode === 'online' ? 'VPS' : t('local')} · <a href="${privacyHref}">${t('privacyPolicy')}</a> · <a href="${termsHref}">${t('termsOfUse')}</a></span></footer></main></div></div>
    <div id="notice" class="toast" role="status" aria-live="polite"></div>${modalView()}`;
  villageCamera = mountVillageCamera(root.querySelector('.scene-wrap:has(.settlement-scene)'), {
    saved: villageCameraState,
    t,
    onChange: (next) => {
      villageCameraState = next;
      const badge = root.querySelector('.page-heading .weather');
      if (badge && view === 'village') {
        badge.title = t('villageWeatherLabel');
        const html =
          icon(next.weather === 'rain' ? 'water' : 'sun', 29) +
          '<span>' +
          t(next.weather === 'rain' ? 'villageRain' : 'villageClear') +
          '<small>' +
          t(state.location) +
          '</small></span>';
        if (badge.innerHTML !== html) badge.innerHTML = html;
      }
    },
    canInteract: () => !modal && !busy,
  });
  if (previousPlanning) {
    root.querySelector('#economy-panel')?.replaceWith(previousPlanning);
    updateEconomyPanel(root, state, plannedBuilding, economyContext());
  }
  if (previousHerd) {
    root.querySelector('#herd-recovery-panel')?.replaceWith(previousHerd);
    updateHerdPanel(root, state, herdAmount, economyContext());
  }
  if (previousGuardian) {
    root.querySelector('#guardian-panel')?.replaceWith(previousGuardian);
    updateGuardianPanel(root, state, selectedWolf, { t, language, busy });
  }
  if (previousParty) {
    root.querySelector('#adventure-party-suggestions')?.replaceWith(previousParty);
    updateAdventurePlanning(root, state, { t, busy, selection: adventureSelection, language });
  }
  identifyControls();
  renderedSignature = interfaceSignature();
  renderNotice();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  if (textSelection && focusId)
    document.getElementById(focusId)?.setSelectionRange?.(...textSelection);
  focusDialog();
}

function focusDialog() {
  const dialog = document.querySelector('[role="dialog"]');
  if (dialog && !dialog.contains(document.activeElement))
    (
      dialog.querySelector('#demolition-cancel:not(:disabled)') ||
      dialog.querySelector('[data-account-field="email"]:not([readonly])') ||
      dialog.querySelector('[data-recovery-field="email"]:not([readonly])') ||
      dialog.querySelector('#recovery-code') ||
      dialog.querySelector('#account-password') ||
      dialog.querySelector('button')
    )?.focus({
      preventScroll: true,
    });
}

function clearAccountDraft() {
  accountDraft = { name: '', email: '', password: '', code: '' };
  accountError = '';
}

function clearRecoveryDraft() {
  recoveryDraft = { email: '', code: '', password: '', confirmPassword: '' };
  recoveryStep = 'request';
  recoveryError = '';
}

function closeDialog() {
  if (busy && modal === 'demolition') return;
  demolitionSelection = null;
  demolitionError = '';
  const opener = accountOpener;
  accountOpener = '';
  accountRequest++;
  modal = '';
  clearAccountDraft();
  clearRecoveryDraft();
  profileDraft = {};
  render(opener);
}

function playView() {
  const isBattle = view === 'battle';
  return `${isBattle ? narrativePanel(state, { t }) : settlementControls(state, { t, busy, movingId })}<div class="play-layout"><section class="map-card"><div class="map-top"><span class="map-title"><i class="status-dot live"></i>${isBattle ? t('defense') : t('homeland')}<span class="map-chip">${isBattle ? `${t('wave')} ${state.battle.wave}` : `${state.buildings.length} ${t('buildingCount')}`}</span></span><span class="map-coordinates">${isBattle ? '04 · 12' : '38 · 42'}</span></div><div class="scene-wrap" id="scene-wrap">${scene(state, { battle: isBattle, zoom, selected, t })}${isBattle ? battleCommandBadge(state, { t }) : ''}<div class="map-location">${icon(isBattle ? 'battle' : 'flag', 14)} ${t(isBattle ? (state.battle.status === 'preparing' ? 'prepare' : state.battle.status) : state.location)}</div>${isBattle ? `<div class="zoom-controls">${button(icon('plus', 17), 'zoomIn', 'icon-button', zoom >= 1.5, `aria-label="${t('zoomIn')}"`)}${button(icon('minus', 17), 'zoomOut', 'icon-button', zoom <= 0.8, `aria-label="${t('zoomOut')}"`)}<span></span>${button(icon('target', 17), 'resetZoom', 'icon-button', false, `aria-label="${t('resetView')}"`)}${button(icon('expand', 17), 'fullscreen', 'icon-button', false, `aria-label="${t('expand')}"`)}</div>` : villageCameraControls({ t })}<div class="map-bottom-note">${icon(isBattle ? 'wolves' : 'village', 14)} ${isBattle ? t('formation') : t('villageDesc')}</div></div><div class="map-toolbar"><span>${icon(isBattle ? 'heart' : 'feed', 18)}${isBattle ? `${t('herd')}: ${Math.ceil(state.herd.hp)}/${state.herd.maxHp}` : `${state.herd.count} ${t('herd')} · ${state.wolves.length} ${t('wolfCount')}`}</span>${isBattle ? button(icon('battle', 17) + t(state.battle.status === 'preparing' ? 'startBattle' : state.battle.status === 'active' ? 'active' : 'newBattle'), state.battle.status === 'preparing' ? 'startBattle' : 'newBattle', 'button primary', state.battle.status === 'active' || Boolean(state.adventure.active) || Boolean(state.journey) || busy) : button(icon('plus', 17) + `<span data-collect-label>${t('collect')}</span>`, 'collect', 'button primary', Date.now() < state.collectReadyAt || busy, 'id="collect-button"')}</div>${isBattle ? battleCommandQuickbar(state, { t, busy }) : ''}</section>
    <aside class="overview">${isBattle ? battlePanel() : villagePanel()}</aside></div>
    ${isBattle ? battleCommandPanel(state, { t, busy }) + battleRecovery() : buildingList() + battleRecovery() + economyPanel(state, plannedBuilding, economyContext())}`;
}

function firstStepsView() {
  return firstWatchPanel(state, { t, language, compact: true, busy });
}

function followFirstWatch(id) {
  const chapter = firstWatchProgress(state);
  const step = chapter.steps.find((entry) => entry.id === id);
  if (!step || step.locked || step.claimed) return;
  const targets = {
    gather: ['village', '#collect-button'],
    build: ['village', '[data-plot]'],
    train: ['wolves', '[data-action="train"]:not(:disabled)'],
    battle: ['battle', '[data-action="startBattle"], [data-action="newBattle"]'],
    recover: ['wolves', '[data-action="rest"]'],
    explore: ['world', '#adventure-difficulty'],
    equip: ['wolves', '[data-action="equip"]:not(:disabled)'],
    escort: ['world', '#adventure-difficulty'],
  };
  if (id === 'train')
    selectedWolf = state.wolves.find((wolf) => wolf.points > 0)?.id || selectedWolf;
  if ((id === 'explore' || id === 'escort') && !state.adventure.active)
    adventureSelection.kind = id === 'escort' ? 'caravan' : 'expedition';
  const [destination, selector] = targets[id];
  navigate(destination);
  const control = root.querySelector(selector);
  const target = control && !control.disabled ? control : root.querySelector('.page-heading h1');
  if (!target) return;
  if (!target.matches('button, a, input, select, [role="button"]')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'center',
  });
}

function villagePanel() {
  const b = state.buildings.find((b) => b.id === selected) || state.buildings[0];
  if (!b)
    return `<section class="detail-card"><h2 id="empty-village-title" tabindex="-1">${t('emptyVillage')}</h2><p class="empty-village-hint">${t('emptyVillageText')}</p></section>${firstStepsView()}`;
  const def = BUILDINGS.find((d) => d.id === b.type),
    cost = getUpgradeCost(b);
  return `<section class="detail-card"><div class="section-label">${t('villageOverview')}${icon('sun', 16)}</div><div class="selected-building-art">${miniBuilding(b.type, b.level)}</div><div class="building-detail-title"><h2>${t(b.type)}</h2><span>${t('level')} ${b.level}</span></div><p class="muted">${t(`${b.type}Desc`)}</p><div class="detail-stats">${
    Object.entries(def.production)
      .filter(([, v]) => v > 0)
      .map(
        ([key, rate]) =>
          `<div><span>${icon(key, 15)} ${t('production')}</span><strong>+${resourceNumber(getProduction({ ...state, buildings: [b] })[key])} ${t('perMinute')}</strong></div>`,
      )
      .join('') ||
    `<div><span>${t('capacity')}</span><strong>${number(state.capacity)}</strong></div>`
  }</div>${b.level < 5 ? `<div class="upgrade-row">${costView(cost)}${button(t('upgrade') + icon('arrow', 15), 'upgrade', 'button outline', !affordable(cost) || busy, `data-id="${b.id}"`)}</div>` : `<div class="completed">${icon('check', 16)}${t('maxLevel')}</div>`}</section>
    <div class="building-layout-actions">${button(t('moveBuilding'), 'moveBuilding', 'button outline move-building', busy || state.battle.status === 'active', `data-id="${b.id}"`)}${button(t('removeBuilding'), 'openDemolition', 'button outline remove-building', busy, `id="demolish-building-button" data-id="${b.id}"`)}</div>${firstStepsView()}
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
  return `<section class="buildings-section"><div class="section-heading"><div><h2>${t('buildings')}</h2><p>${t('producerLimit')} · ${t('choosePlot')}</p><p class="building-plot-hint">${t('buildingPlotHint')}</p></div><span class="subtle-count">${state.buildings.length} / ${PLOTS.length}</span></div><div class="buildings-grid">${BUILDINGS.map(
    (def) => {
      const owned = state.buildings.filter((b) => b.type === def.id);
      return `<article class="build-card"><div class="build-art">${miniBuilding(def.id, owned[0]?.level || 1)}</div><h3>${t(def.id)}</h3><p class="building-owned-count">${t('buildingOwnedCount')}: ${owned.length} / ${def.maxCount}</p><p>${t(def.id + 'Desc')}</p><div class="placed-building-list">${owned.map((b) => button(t('level') + ' ' + b.level + ' · ' + t('plot') + ' ' + (PLOTS.findIndex((p) => p.x === b.x && p.y === b.y) + 1), 'selectBuilding', 'button outline', busy, `data-id="${b.id}"`)).join('')}</div><div class="build-card-bottom"><div class="building-cost-group"><span class="building-cost-caption">${t('buildingConstructionCost')}</span>${costView(def.cost)}</div>${button(icon('plus', 17), 'build', 'small-button', owned.length >= def.maxCount || busy || state.battle.status === 'active', `data-building-type="${def.id}" aria-label="${t('chooseSite')} · ${t(def.id)}"`)}</div></article>`;
    },
  ).join('')}</div></section>`;
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
  svg.dataset.phase = battlePhase(state);
  svg.dataset.command = battleCommandStatus(state).activeCommand || '';
  const lastCommand = state.battle.commands.at(-1);
  svg.dataset.rally =
    lastCommand?.id === 'rally' && state.battle.tick - lastCommand.tick < 2 ? 'true' : 'false';
  updateBattleCommandPanel(root, state, { t, busy });
  updateBattleCommandQuickbar(root, state, { t, busy });
  updateBattleCommandBadge(root, state, { t });
  const story = root.querySelector('.battle-narrative');
  if (story) story.outerHTML = narrativePanel(state, { t });
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
  return `<div class="recovery-bar"><div><h3>${t('herd')}</h3><p>${state.herd.count} · ${t('health')} ${Math.ceil(state.herd.hp)}/${state.herd.maxHp}</p></div><div class="recovery-actions">${button(icon('herbs', 18) + t('healHerd') + costView({ herbs: 1 }, { focusable: false }), 'healHerd', 'button outline', state.battle.status === 'active' || busy)}${button(icon('heart', 18) + t('rest') + costView({ water: 25, feed: 30 }, { focusable: false }), 'rest', 'button outline', state.battle.status === 'active' || busy)}</div></div>${herdPanel(state, herdAmount, economyContext())}`;
}

function wolvesView() {
  return guardianPanel(state, selectedWolf, { t, language, busy }) + battleRecovery();
}

function worldView() {
  if (state.adventure.active) {
    const { kind, region, difficulty, wolfIds, plan = 'standard' } = state.adventure.active;
    adventureSelection = { kind, region, difficulty, plan, wolfIds: [...wolfIds] };
  }
  if (!state.adventure.active)
    adventureSelection.wolfIds = adventureSelection.wolfIds.filter((id) =>
      state.wolves.some((w) => w.id === id && w.hp >= 20),
    );
  return adventureView(state, { t, busy, selection: adventureSelection, language });
}

function questsView() {
  return `${firstWatchPanel(state, { t, language, busy })}<section class="first-watch-legacy"><h2>${t('fwLegacy')}</h2><p>${t('fwLegacyText')}</p></section><div class="quest-grid">${state.quests.map((q, i) => `<article class="quest-card ${q.claimed ? 'quest-complete' : ''}"><div class="quest-number">0${i + 1}</div><div class="quest-icon">${icon(['village', 'feed', 'battle', 'wolves'][i], 34)}</div><span class="quest-tag">${t(q.claimed ? 'claimed' : 'inProgress')}</span><h2>${t(q.id)}</h2><p>${t(`${q.id}Desc`)}</p><div class="quest-progress-label"><span>${t('quests')}</span><strong>${q.progress} / ${q.target}</strong></div>${progress(q.progress, q.target)}${button((q.claimed ? icon('check', 17) : icon('flag', 17)) + t(q.claimed ? 'claimed' : 'claim'), 'claimQuest', 'button ' + (q.claimed ? 'outline' : 'primary'), q.claimed || q.progress < q.target || busy, `data-id="${q.id}"`)}</article>`).join('')}</div>`;
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

function accountAppearanceControls() {
  return `<div class="account-appearance"><button class="language" data-action="language" aria-label="${language === 'tr' ? 'Switch to English' : 'Türkçeye geç'}">${language.toUpperCase()}</button><button class="theme-toggle" data-action="theme" aria-label="${t(theme === 'dark' ? 'switchLight' : 'switchDark')}"><span aria-hidden="true">${theme === 'dark' ? '&#9788;' : '&#9790;'}</span></button></div>`;
}

function accountMethodControls() {
  const user = auth.user || {};
  if (user.googleLinked && user.passwordEnabled)
    return `<div class="account-methods"><p class="modal-note">${t('accountMethodsLinked')}</p></div>`;
  if (user.provider === 'google')
    return `<div class="account-methods"><p>${t('setPasswordIntro')}</p>${button(t('setPassword'), 'setPassword', 'button primary', busy)}</div>`;
  return `<div class="account-methods"><p>${t('connectGoogleHint')}</p>${googleSignInControl('connectGoogle')}</div>`;
}

function accountFormView() {
  const registering = modal === 'register';
  const settingPassword = modal === 'password';
  const title = settingPassword ? 'setPassword' : registering ? 'registerTitle' : 'loginTitle';
  const introduction = settingPassword
    ? 'setPasswordIntro'
    : registering
      ? 'registerIntro'
      : 'loginIntro';
  return `<div class="modal-backdrop"><section class="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="account-intro"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}" ${busy ? 'disabled' : ''}>${icon('close', 20)}</button>${accountAppearanceControls()}<div class="eyebrow">BOZKURT OBASI</div><h2 id="modal-title">${t(title)}</h2><p id="account-intro">${t(introduction)}</p><form id="account-form" class="account-form" aria-busy="${busy}"><label for="account-email">${t('accountEmail')}</label><input id="account-email" data-account-field="email" name="email" type="email" autocomplete="email" maxlength="254" required value="${escape(accountDraft.email)}" ${settingPassword ? 'readonly' : ''} ${busy ? 'disabled' : ''}>${registering ? `<label for="account-name">${t('accountName')}</label><input id="account-name" data-account-field="name" name="name" type="text" autocomplete="nickname" maxlength="60" value="${escape(accountDraft.name)}" ${busy ? 'disabled' : ''}>` : ''}<label for="account-password">${t('accountPassword')}</label><input id="account-password" data-account-field="password" name="password" type="password" autocomplete="${registering || settingPassword ? 'new-password' : 'current-password'}" required aria-describedby="account-password-hint" value="${escape(accountDraft.password)}" ${busy ? 'disabled' : ''}><small id="account-password-hint">${t('passwordHint')}</small>${accountError ? `<p id="account-error" class="account-error" role="alert">${t(accountError)}</p>` : ''}${!auth.emailEnabled ? `<p class="account-error" role="status">${t('emailUnavailable')}</p>` : ''}<button class="button primary account-submit" type="submit" ${busy || !auth.emailEnabled ? 'disabled' : ''}>${t(busy ? 'accountSubmitting' : settingPassword ? 'setPassword' : registering ? 'emailRegister' : 'emailLogin')}</button></form>${!registering && !settingPassword ? button(t('forgotPassword'), 'forgotPassword', 'account-switch-button forgot-password', busy) : ''}${settingPassword ? '' : `<p class="account-switch">${t(registering ? 'alreadyRegistered' : 'newPlayer')} ${button(t(registering ? 'emailLogin' : 'emailRegister'), registering ? 'login' : 'register', 'account-switch-button', busy)}</p><div class="account-google">${googleSignInControl()}</div>`}<p class="account-provider-note">${t('accountLinkNote')}</p><div class="account-legal"><a href="${privacyHref}">${t('privacyPolicy')}</a><a href="${termsHref}">${t('termsOfUse')}</a></div></section></div>`;
}

function modalView() {
  if (!modal) return '';
  if (modal === 'demolition' && demolitionSelection)
    return demolitionDialog(state, demolitionSelection, demolitionContext());
  if (modal === 'placement') return placementDialog(state, { plotId: selectedPlot, t, busy });
  if (['login', 'register', 'password'].includes(modal)) return accountFormView();
  if (modal === 'recovery')
    return recoveryDialog({
      t,
      escape,
      button,
      icon,
      appearance: accountAppearanceControls(),
      draft: recoveryDraft,
      step: recoveryStep,
      mailEnabled: auth.mailEnabled,
      busy,
      error: recoveryError,
    });
  if (modal === 'verify')
    return verificationDialog({
      t,
      escape,
      button,
      icon,
      email: auth.pendingEmail,
      mailEnabled: auth.mailEnabled,
      busy,
      error: accountError,
      code: accountDraft.code,
    });
  if (modal === 'account')
    return profileDialog({
      t,
      escape,
      button,
      icon,
      user: auth.user,
      draft: profileDraft,
      busy,
      error: accountError,
      methods: accountMethodControls(),
    });

  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}">${icon('close', 20)}</button><div class="modal-icon">${icon('wolves', 38)}</div><div class="eyebrow">BOZKURT OBASI · AY-YILDIZ NÖBETİ</div><h2 id="modal-title">${t('helpTitle')}</h2><p>${t('helpText')}</p><p class="modal-note">${t('helpOffline')}</p>${button(t('understood') + icon('arrow', 18), 'close', 'button primary')}${button(icon('save', 16) + t('exportSave'), 'exportSave', 'button text-button')}</section></div>`;
}

const accountErrorKeys = {
  insufficient_gift: 'resourcesError',
  invalid_message: 'invalidMessage',
  invalid_gift: 'invalidGift',
  insufficient_resources: 'resourcesError',
  insufficient_items: 'itemUnavailable',
  recipient_inventory_full: 'inventoryFull',
  gift_conflict: 'transferConflict',
  message_conflict: 'transferConflict',
  message_rate_limited: 'accountRateLimited',
  invalid_avatar: 'invalidAvatar',
  invalid_verification_code: 'invalidVerificationCode',
  verification_expired: 'verificationExpired',
  email_verification_required: 'verifyTitle',
  player_not_found: 'playerNotFound',
  self_friend: 'selfFriend',
  friend_exists: 'friendExists',
  friend_required: 'friendRequired',
  friend_request_required: 'friendRequired',
  insufficient_stone: 'insufficientStone',
  recipient_storage_full: 'recipientStorageFull',
  invalid_transfer: 'invalidTransfer',
  transfer_conflict: 'transferConflict',
  friend_limit: 'friendLimit',
  stale_revision: 'transferConflict',
  invalid_email: 'invalidEmail',
  invalid_password: 'invalidPassword',
  invalid_name: 'invalidName',
  invalid_credentials: 'invalidCredentials',
  email_in_use: 'emailInUse',
  account_conflict: 'accountConflict',
  login_rate_limited: 'accountRateLimited',
  origin_rejected: 'accountOriginRejected',
  account_session_required: 'signInRequired',
  google_session_required: 'signInRequired',
  google_login_required: 'googleLoginRequired',
  account_link_required: 'accountLinkRequired',
  account_link_email_mismatch: 'accountLinkEmailMismatch',
  password_already_set: 'passwordAlreadySet',
  recovery_code_invalid: 'recoverInvalidCode',
  recovery_code_expired: 'recoverExpired',
  recovery_rate_limited: 'recoverRateLimited',
  password_changed: 'recoverRetry',
  mail_unavailable: 'recoverUnavailable',
};

async function submitAccount(form) {
  if (busy || !auth.emailEnabled || !['login', 'register', 'password'].includes(modal)) return;
  if (!form.reportValidity()) return;
  const registering = modal === 'register';
  const settingPassword = modal === 'password';
  const fields = new FormData(form);
  const body = {
    ...(!settingPassword ? { email: String(fields.get('email') || '') } : {}),
    password: String(fields.get('password') || ''),
    ...(registering ? { name: String(fields.get('name') || '') } : {}),
  };
  const passwordLength = Array.from(body.password).length;
  if (passwordLength > 128 || ((registering || settingPassword) && passwordLength < 12)) {
    accountError = 'invalidPassword';
    render('account-password');
    return;
  }
  const request = ++accountRequest;
  const generation = ++sessionGeneration;
  accountError = '';
  busy = true;
  let accepted = false;
  render();
  try {
    const response = await fetch(
      `/api/auth/player/${settingPassword ? 'password' : registering ? 'register' : 'login'}`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
    );
    const result = await response.json();
    if (request !== accountRequest) return;
    if (!response.ok)
      throw Object.assign(new Error(result?.error || 'request_failed'), { code: result?.error });
    if (result.verificationRequired) {
      auth.authenticated = false;
      auth.user = null;
      auth.verificationRequired = true;
      auth.pendingEmail = result.pendingEmail;
      clearAccountDraft();
      modal = 'verify';
      mode = 'local';
      view = 'home';
      toast(result.verificationSent ? 'verificationSent' : 'verificationSendFailed');
      return;
    }
    if (result?.authenticated !== true || !result.user?.email) throw new Error('invalid_response');
    auth.authenticated = true;
    auth.verificationRequired = false;
    auth.user = result.user;
    accepted = true;
    clearAccountDraft();
    await api('session', {}, generation);
    mode = 'online';
    accountOpener = '';
    if (settingPassword) {
      profileDraft = {};
      modal = 'account';
      toast('passwordSet');
    } else {
      navigate('village');
      toast(
        registering
          ? result.verificationSent
            ? 'accountCreatedWithMail'
            : 'accountCreated'
          : 'emailWelcome',
      );
    }
  } catch (error) {
    if (request !== accountRequest) return;
    if (accepted) {
      modal = '';
      toast('googleGameUnavailable');
    } else {
      accountError = accountErrorKeys[error.code] || 'accountRequestFailed';
    }
  } finally {
    busy = false;
    render();
  }
}

root.addEventListener('input', (event) => {
  const field = event.target.dataset.accountField;
  if (field && Object.hasOwn(accountDraft, field)) accountDraft[field] = event.target.value;
  const recoveryField = event.target.dataset.recoveryField;
  if (recoveryField && Object.hasOwn(recoveryDraft, recoveryField))
    recoveryDraft[recoveryField] = event.target.value;
});

root.addEventListener('submit', (event) => {
  if (!['account-form', 'recovery-form'].includes(event.target.id)) return;
  event.preventDefault();
  if (event.target.id === 'recovery-form') void submitRecovery(event.target);
  else void submitAccount(event.target);
});

async function playerRequest(path, body) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || 'request_failed'), { code: result.error });
  return result;
}

async function submitRecovery(form, resend = false) {
  if (busy || modal !== 'recovery' || !auth.mailEnabled) return;
  if (!resend && !form.reportValidity()) return;
  const confirming = recoveryStep === 'confirm' && !resend;
  if (!resend) {
    const fields = new FormData(form);
    recoveryDraft.email = String(fields.get('email') || '');
    if (confirming) {
      recoveryDraft.code = String(fields.get('code') || '');
      recoveryDraft.password = String(fields.get('password') || '');
      recoveryDraft.confirmPassword = String(fields.get('confirmPassword') || '');
    }
  }
  const email = recoveryDraft.email.trim();
  if (confirming) {
    const length = Array.from(recoveryDraft.password).length;
    if (length < 12 || length > 128) {
      recoveryError = 'invalidPassword';
      render('recovery-password');
      return;
    }
    if (recoveryDraft.password !== recoveryDraft.confirmPassword) {
      recoveryError = 'recoverPasswordMismatch';
      render('recovery-confirm-password');
      return;
    }
  }
  const request = ++accountRequest;
  recoveryError = '';
  busy = true;
  render();
  try {
    const result = await playerRequest(
      `auth/player/password/reset/${confirming ? 'confirm' : 'request'}`,
      {
        email,
        ...(confirming ? { code: recoveryDraft.code, password: recoveryDraft.password } : {}),
      },
    );
    if (request !== accountRequest || modal !== 'recovery') return;
    if (result.ok !== true) throw new Error('invalid_response');
    if (confirming) {
      auth.authenticated = false;
      auth.user = null;
      auth.verificationRequired = false;
      auth.pendingEmail = '';
      profileDraft = {};
      friendsDraft = {};
      friendsData = { friends: [], incoming: [], outgoing: [], transfers: [] };
      friendsLoaded = false;
      state = createGame();
      revision = 0;
      denyGameAccess();
      accountDraft.email = email;
      modal = 'login';
      toast('recoverSuccess');
    } else {
      recoveryDraft.email = email;
      recoveryDraft.code = '';
      recoveryStep = 'confirm';
      toast('recoverCodeSent');
    }
  } catch (error) {
    if (request !== accountRequest || modal !== 'recovery') return;
    recoveryError = accountErrorKeys[error.code] || 'accountRequestFailed';
  } finally {
    busy = false;
    render(confirming && modal === 'login' ? 'account-password' : undefined);
  }
}

async function verifyCode(form) {
  if (busy || !auth.verificationRequired || !form.reportValidity()) return;
  const code = String(new FormData(form).get('code') || '');
  busy = true;
  accountError = '';
  render();
  try {
    const result = await playerRequest('auth/player/verify/confirm', { code });
    auth.user = result.user;
    auth.authenticated = true;
    auth.verificationRequired = false;
    clearAccountDraft();
    await api('session', {}, ++sessionGeneration);
    mode = 'online';
    navigate('village');
    toast('emailVerified');
  } catch (error) {
    accountError = accountErrorKeys[error.code] || 'accountRequestFailed';
  } finally {
    busy = false;
    render();
  }
}

async function saveProfile(form) {
  if (busy || !auth.authenticated || !form.reportValidity()) return;
  const fields = new FormData(form);
  const body = { nickname: String(fields.get('nickname') || '') };
  if (Object.hasOwn(profileDraft, 'avatarDataUrl')) body.avatarDataUrl = profileDraft.avatarDataUrl;
  const password = String(fields.get('password') || '');
  const currentPassword = String(fields.get('currentPassword') || '');
  if (
    password &&
    (!currentPassword || Array.from(password).length < 12 || Array.from(password).length > 128)
  ) {
    accountError = 'invalidPassword';
    render();
    return;
  }
  busy = true;
  accountError = '';
  render();
  try {
    if (password) await playerRequest('auth/player/password/change', { password, currentPassword });
    const result = await playerRequest('player/profile', body);
    auth.user = result.user;
    profileDraft = {};
    toast('profileSaved');
  } catch (error) {
    accountError = accountErrorKeys[error.code] || 'accountRequestFailed';
  } finally {
    busy = false;
    profileDraft.password = '';
    profileDraft.currentPassword = '';
    render();
  }
}

async function loadFriends() {
  if (!auth.authenticated) return;
  const generation = sessionGeneration;
  try {
    const result = await playerRequest('player/friends');
    if (generation !== sessionGeneration || !auth.authenticated) return;
    friendsData = result;
    friendsLoaded = true;
    if (view === 'friends') render();
  } catch (error) {
    if (generation === sessionGeneration) toast(accountErrorKeys[error.code] || 'failed');
  }
}

async function loadConversation(userCode, older = false, refresh = false) {
  // Explicit contact selections take priority over the periodic refresh.
  if (refresh && conversationPending) return;
  const generation = sessionGeneration,
    request = ++conversationRequest;
  conversationPending = request;
  const before = older && conversation.userCode === userCode ? conversation.nextBefore : null;
  try {
    const result = await playerRequest(
      'player/friends/messages?' +
        new URLSearchParams({ userCode, ...(before ? { before } : {}), limit: '30' }),
    );
    if (generation !== sessionGeneration || request !== conversationRequest || !auth.authenticated)
      return;
    const sameContact = conversation.userCode === userCode;
    const overlaps =
      sameContact &&
      result.messages.some((message) =>
        conversation.messages.some((previous) => previous.id === message.id),
      );
    // A sleeping tab may miss more than one page. Keep only a contiguous range,
    // so the returned cursor can still retrieve every intervening message.
    const keepHistory = sameContact && (older || (refresh && overlaps));
    const combined = keepHistory ? [...result.messages, ...conversation.messages] : result.messages;
    const previous = JSON.stringify(conversation);
    conversation = {
      userCode,
      messages: [...new Map(combined.map((m) => [m.id, m])).values()].sort((a, b) => a.id - b.id),
      nextBefore: refresh && keepHistory ? conversation.nextBefore : result.nextBefore,
    };
    if (view === 'friends' && previous !== JSON.stringify(conversation)) render();
  } catch (error) {
    if (generation === sessionGeneration && request === conversationRequest)
      toast(accountErrorKeys[error.code] || 'failed');
  } finally {
    if (conversationPending === request) conversationPending = 0;
  }
}
async function socialAction(action, body) {
  if (busy || !auth.authenticated) return;
  let generation = sessionGeneration;
  busy = true;
  render();
  const transfer = action === 'transfer' || action === 'gift';
  try {
    if (polling) await polling;
    if (generation !== sessionGeneration || !auth.authenticated) return;
    generation = ++sessionGeneration;
    if (transfer) {
      await api('state', undefined, generation);
      body = { ...body, revision };
    }
    await playerRequest(`player/friends/${action}`, body);
    if (generation !== sessionGeneration || !auth.authenticated) return;
    if (transfer) {
      await api('state', undefined, generation);
      delete friendsDraft[body.userCode];
      delete friendsDraft[`pending:${body.userCode}`];
      delete friendsDraft[`gift-pending:${body.userCode}`];
    } else if (action === 'messages') {
      delete friendsDraft[`message:${body.userCode}`];
      delete friendsDraft[`message-pending:${body.userCode}`];
      await loadConversation(body.userCode);
    } else if (action === 'request') friendsDraft.code = '';
    else if (action === 'remove' && conversation.userCode === body.userCode) {
      conversationRequest++;
      conversation = { userCode: '', messages: [], nextBefore: null };
    }
    await loadFriends();
    toast(
      action === 'transfer'
        ? 'stoneTransferDone'
        : action === 'gift'
          ? 'giftSent'
          : action === 'messages'
            ? 'messageSent'
            : 'friendUpdated',
    );
  } catch (error) {
    if (transfer && error.code === 'stale_revision')
      await api('state', undefined, generation).catch(() => {});
    if (generation === sessionGeneration) toast(accountErrorKeys[error.code] || 'failed');
  } finally {
    busy = false;
    render();
  }
}

root.addEventListener('input', (event) => {
  if (event.target.dataset.messageCode)
    friendsDraft['message:' + event.target.dataset.messageCode] = event.target.value;
  if (event.target.dataset.giftField) {
    const key = 'gift:' + event.target.dataset.code;
    friendsDraft[key] = {
      ...(friendsDraft[key] || { asset: 'resource:wood', amount: 1 }),
      [event.target.dataset.giftField]: event.target.value,
    };
  }
  const field = event.target.dataset.profileField;
  if (field) profileDraft[field] = event.target.value;
  if (event.target.hasAttribute('data-friend-code')) friendsDraft.code = event.target.value;
  if (event.target.dataset.transferCode)
    friendsDraft[event.target.dataset.transferCode] = event.target.value;
});

root.addEventListener('change', async (event) => {
  if (event.target.id === 'herd-replenish-amount') {
    herdAmount = Number(event.target.value);
    updateHerdPanel(root, state, herdAmount, economyContext());
    return;
  }
  if (event.target.id.startsWith('adventure-') || event.target.name === 'adventure-wolf') {
    if (busy || state.adventure.active || state.journey || state.battle.status === 'active') return;
    if (event.target.name === 'adventure-plan') adventureSelection.plan = event.target.value;
    else if (event.target.name === 'adventure-wolf')
      adventureSelection.wolfIds = [
        ...root.querySelectorAll('[name="adventure-wolf"]:checked'),
      ].map((input) => input.value);
    else adventureSelection[event.target.id.slice(10)] = event.target.value;
    if (adventureSelection.kind === 'expedition' && adventureSelection.region === 'homeland')
      adventureSelection.region = 'spring';
    render();
    return;
  }
  if (event.target.id === 'construction-plan') {
    plannedBuilding = constructionPlan(state, event.target.value).target;
    updateEconomyPanel(root, state, plannedBuilding, economyContext());
    return;
  }
  if (event.target.id !== 'profile-upload' || busy) return;
  const file = event.target.files?.[0],
    request = accountRequest;
  if (!file) return;
  if (
    !['image/png', 'image/jpeg', 'image/gif'].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  ) {
    accountError = 'invalidAvatar';
    render();
    return;
  }
  try {
    const data = await new Promise((resolveFile, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolveFile(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (modal !== 'account' || request !== accountRequest) return;
    profileDraft.avatarDataUrl = data;
    accountError = '';
    render();
  } catch {
    accountError = 'invalidAvatar';
    render();
  }
});

root.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.matches('.asset-gift,.private-message-form')) {
    event.preventDefault();
    if (busy || !auth.authenticated) return;
    const values = new FormData(form),
      userCode = form.dataset.code,
      isGift = form.matches('.asset-gift');
    const [kind, assetId] = String(values.get('asset') || '').split(':');
    const payload = isGift
      ? { userCode, kind, assetId, amount: Number(values.get('amount')) }
      : { userCode, body: String(values.get('body') || '').trim() };
    const key = (isGift ? 'gift-pending:' : 'message-pending:') + userCode,
      signature = JSON.stringify(payload),
      old = friendsDraft[key];
    const requestId = old?.signature === signature ? old.requestId : crypto.randomUUID();
    friendsDraft[key] = { signature, requestId };
    void socialAction(isGift ? 'gift' : 'messages', { ...payload, requestId });
    return;
  }
  if (
    !['verification-form', 'profile-form', 'friend-request-form'].includes(form.id) &&
    !form.matches('.stone-transfer')
  )
    return;
  event.preventDefault();
  if (form.id === 'verification-form') void verifyCode(form);
  else if (form.id === 'profile-form') void saveProfile(form);
  else if (form.id === 'friend-request-form')
    void socialAction('request', { userCode: String(new FormData(form).get('userCode') || '') });
  else {
    const userCode = form.dataset.code,
      amount = Number(new FormData(form).get('amount'));
    const previous = friendsDraft[`pending:${userCode}`];
    const requestId = previous?.amount === amount ? previous.requestId : crypto.randomUUID();
    friendsDraft[`pending:${userCode}`] = { amount, requestId };
    void socialAction('transfer', { userCode, amount, requestId, revision });
  }
});

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
    if (auth.authenticated)
      void analytics.progress(state, auth.user?.userCode || auth.user?.email || '');
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
    FIRST_WATCH_INVALID_STEP: 'fwClaimError',
    FIRST_WATCH_CLAIMED: 'fwClaimError',
    FIRST_WATCH_LOCKED: 'fwClaimError',
    FIRST_WATCH_INCOMPLETE: 'fwClaimError',
    FIRST_WATCH_STORAGE_FULL: 'fwStorageFull',
    INVALID_REPLENISH_AMOUNT: 'herdInvalidAmount',
    HERD_FULL: 'herdFull',
    PASTURE_REQUIRED: 'herdPastureRequired',
    HERD_LIMIT: 'herdLimit',
    USE_CARAVAN: 'adventureIntro',
    PLOT_REQUIRED: 'choosePlot',
    INVALID_PLOT: 'choosePlot',
    PLOT_OCCUPIED: 'plotOccupied',
    BUILDING_LIMIT: 'buildingLimit',
    BUILDING_CHANGED: 'demolitionChanged',
    INVALID_BUILDING: 'demolitionInvalid',
    INVALID_DEMOLITION_TARGET: 'demolitionChanged',
    DEMOLITION_STORAGE_FULL: 'demolition_DEMOLITION_STORAGE_FULL',
    WOLF_BUSY: 'wolfBusy',
    INVALID_PARTY: 'invalidParty',
    PARTY_TOO_SMALL: 'partyTooSmall',
    REGION_LOCKED: 'regionLocked',
    ITEM_UNAVAILABLE: 'itemUnavailable',
    INVENTORY_FULL: 'inventoryFull',
    ADVENTURE_ACTIVE: 'expeditionActive',
    INVALID_BATTLE_COMMAND: 'bcInvalidError',
    BATTLE_NOT_ACTIVE: 'bcInactiveError',
    BATTLE_COMMAND_INTRO: 'bcIntroError',
    BATTLE_COMMAND_COOLDOWN: 'bcCooldownError',
    BATTLE_COMMAND_NO_PANIC: 'bcNoPanicError',
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
  let succeeded = false;
  // Keep the active battlefield and its animation nodes while an order awaits the server.
  const updateCombat = () =>
    action.type === 'battleCommand' && view === 'battle' && !modal && refreshBattleView();
  const demolishing = action.type === 'demolishBuilding';
  busy = true;
  if (demolishing) {
    updateDemolitionDialog(root, state, demolitionSelection, demolitionContext());
    root.querySelector('#demolition-dialog')?.focus({ preventScroll: true });
  } else if (!updateCombat()) render();
  try {
    // A click during polling waits for its revision instead of being dropped or sent stale.
    if (polling) await polling;
    if (generation !== sessionGeneration) return;
    await api('action', { action, revision }, generation);
    succeeded = true;
    if (action.type === 'build') {
      const plot = PLOTS.find((p) => p.id === action.plotId);
      selected = state.buildings.find((b) => b.x === plot?.x && b.y === plot?.y)?.id || selected;
      modal = '';
    }
    if (action.type === 'moveBuilding') movingId = '';
    if (demolishing) {
      selected = state.buildings[0]?.id || '';
      selectedPlot = movingId = '';
      modal = '';
      demolitionSelection = null;
      demolitionError = '';
      accountOpener = '';
    }
    toast(logLabels[state.log.at(-1)?.key] || 'actionDone');
  } catch (error) {
    if (demolishing) {
      const code = String(error.code || error.message).toUpperCase();
      demolitionError =
        {
          STALE_REVISION: 'demolitionStale',
          BUILDING_CHANGED: 'demolitionChanged',
          INVALID_BUILDING: 'demolitionInvalid',
          INVALID_DEMOLITION_TARGET: 'demolitionChanged',
          DEMOLITION_STORAGE_FULL: 'demolition_DEMOLITION_STORAGE_FULL',
          BATTLE_ACTIVE: 'demolition_BATTLE_ACTIVE',
          JOURNEY_ACTIVE: 'demolition_JOURNEY_ACTIVE',
        }[code] || 'demolitionFailed';
    }
    reportError(error);
  } finally {
    busy = false;
    if (demolishing && !succeeded && modal === 'demolition' && demolitionSelection) {
      updateDemolitionDialog(root, state, demolitionSelection, demolitionContext());
      if (
        document.activeElement === root.querySelector('#demolition-dialog') ||
        document.activeElement === document.body
      )
        root.querySelector('#demolition-cancel')?.focus({ preventScroll: true });
      else focusDialog();
    } else if (!updateCombat()) render(focusId);
    else if (
      generation === sessionGeneration &&
      focusId?.startsWith('battle-command-') &&
      (document.activeElement === document.body || document.activeElement?.id === focusId)
    ) {
      // Native disabled controls lose focus. Keep keyboard users in the command area.
      const previous = document.getElementById(focusId);
      const target =
        succeeded || previous?.disabled
          ? root.querySelector(
              focusId.startsWith('battle-command-quick-')
                ? '#battle-command-quick-title'
                : '#battle-command-title',
            )
          : previous;
      if (target) {
        if (!target.matches('button')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
    if (succeeded && generation === sessionGeneration && demolishing) {
      (root.querySelector('[data-building]') || root.querySelector('#empty-village-title'))?.focus({
        preventScroll: true,
      });
    }
    if (succeeded && generation === sessionGeneration && action.type === 'claimFirstWatch') {
      const next = firstWatchProgress(state).current;
      const target =
        (next &&
          root.querySelector(
            `#fw-action-${next.id}:not(:disabled), #fw-storage-${next.id}:not([hidden]):not(:disabled)`,
          )) ||
        root.querySelector('#fw-title');
      if (target) {
        if (!target.matches('button')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
  }
}

root.addEventListener('click', async (event) => {
  if (event.target.matches('.modal-backdrop') && modal === 'demolition') {
    closeDialog();
    return;
  }
  const target = event.target.closest(
    'button,[data-building],[data-plot],[data-wolf],a.brand-mark',
  );
  if (!target || target.disabled) return;
  if (modal === 'demolition' && (busy || !target.closest('#demolition-dialog'))) {
    event.preventDefault();
    return;
  }
  if (busy && modal === 'recovery' && !['language', 'theme'].includes(target.dataset.action)) {
    event.preventDefault();
    return;
  }
  if (target.matches('a.brand-mark')) {
    event.preventDefault();
    navigate(auth.authenticated ? 'village' : 'home');
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
    if (busy) return;
    selectedPlot = target.dataset.plot;
    if (movingId) await command({ type: 'moveBuilding', id: movingId, plotId: selectedPlot });
    else {
      accountOpener = target.id;
      modal = 'placement';
      render();
    }
    return;
  }
  if (target.dataset.partySuggestion) {
    if (busy || state.battle.status === 'active' || state.adventure.active || state.journey) return;
    const suggestion = adventurePartySuggestions(state, adventureSelection).find(
      (entry) => entry.id === target.dataset.partySuggestion,
    );
    if (!suggestion?.ready) return;
    adventureSelection.wolfIds = [...suggestion.wolfIds];
    for (const input of root.querySelectorAll('[name="adventure-wolf"]'))
      input.checked = adventureSelection.wolfIds.includes(input.value);
    updateAdventurePlanning(root, state, { t, busy, selection: adventureSelection, language });
    return;
  }
  const a = target.dataset.action;
  if (a === 'openDemolition') {
    if (busy) return;
    try {
      const quote = demolitionQuote(state, target.dataset.id);
      demolitionSelection = { id: target.dataset.id, expected: { ...quote.expected }, quote };
      demolitionError = '';
      accountOpener = target.id;
      modal = 'demolition';
      render();
    } catch (error) {
      reportError(error);
    }
    return;
  }
  if (a === 'confirmDemolition') {
    if (busy || modal !== 'demolition' || !demolitionSelection) return;
    if (!demolitionStatus(state, demolitionSelection).ready) {
      updateDemolitionDialog(root, state, demolitionSelection, demolitionContext());
      return;
    }
    await command({
      type: 'demolishBuilding',
      id: demolitionSelection.id,
      expected: { ...demolitionSelection.expected },
    });
    return;
  }
  if (a === 'placeBuilding') {
    await command({
      type: 'build',
      building: target.dataset.buildingType,
      plotId: target.dataset.plotId,
    });
    return;
  }
  if (a === 'moveBuilding' || a === 'cancelMove') {
    movingId = a === 'moveBuilding' ? target.dataset.id : '';
    render();
    root.querySelector('.map-card')?.scrollIntoView({ block: 'start' });
    return;
  }
  if (a === 'build') {
    plannedBuilding = target.dataset.buildingType;
    toast('choosePlot');
    root.querySelector('[data-plot]')?.focus({ preventScroll: true });
    root.querySelector('.map-card')?.scrollIntoView({ block: 'start' });
    return;
  }
  if (a === 'selectRegion') {
    if (busy || state.battle.status === 'active' || state.adventure.active || state.journey) return;
    adventureSelection.region = target.dataset.region;
    render();
    return;
  }
  if (a === 'startAdventure') {
    await command({
      type: adventureSelection.kind,
      ...adventureSelection,
      wolfIds: [...adventureSelection.wolfIds],
    });
    return;
  }
  if (a === 'openConversation' || a === 'olderMessages') {
    void loadConversation(target.dataset.code, a === 'olderMessages');
    return;
  }
  if (a === 'forgotPassword') {
    if (busy || modal !== 'login') return;
    const email = accountDraft.email;
    clearRecoveryDraft();
    clearAccountDraft();
    recoveryDraft.email = email;
    modal = 'recovery';
    render();
    return;
  }
  if (a === 'recoverResend') {
    await submitRecovery(document.querySelector('#recovery-form'), true);
    return;
  }
  if (a === 'recoverChangeEmail') {
    if (busy || modal !== 'recovery') return;
    const email = recoveryDraft.email;
    clearRecoveryDraft();
    recoveryDraft.email = email;
    render('recovery-email');
    return;
  }
  if (a === 'recoverBackToLogin') {
    if (busy || modal !== 'recovery') return;
    const email = recoveryDraft.email;
    clearRecoveryDraft();
    clearAccountDraft();
    accountDraft.email = email;
    modal = 'login';
    render('account-password');
    return;
  }
  if (a === 'firstWatchStorage') {
    if (busy) return;
    plannedBuilding = 'storage';
    navigate('village');
    const target = root.querySelector('#economy-panel');
    if (target) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center' });
    }
    return;
  }
  if (a === 'firstWatchGo') {
    if (!busy) followFirstWatch(target.dataset.id);
    return;
  }
  if (a === 'scroll') {
    document.getElementById(target.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (a === 'brandHome') {
    navigate(auth.authenticated ? 'village' : 'home');
    return;
  }
  if (a === 'openVerification') {
    modal = 'verify';
    accountError = '';
    render();
    return;
  }
  if (a === 'removePhoto') {
    profileDraft.avatarDataUrl = null;
    render();
    return;
  }
  if (a === 'acceptFriend' || a === 'removeFriend') {
    if (!busy)
      await socialAction(a === 'acceptFriend' ? 'accept' : 'remove', {
        userCode: target.dataset.code,
      });
    return;
  }
  if (a === 'home' || a === 'play' || a === 'updates') {
    navigate(a === 'home' ? 'home' : a === 'play' ? 'village' : 'updates');
    return;
  }
  if (a === 'account') {
    accountOpener = target.id;
    profileDraft = {};
    accountError = '';
    modal = 'account';
    render();
    return;
  }
  if (a === 'setPassword') {
    if (
      busy ||
      !auth.authenticated ||
      auth.user?.provider !== 'google' ||
      auth.user?.passwordEnabled
    )
      return;
    clearAccountDraft();
    accountDraft.email = auth.user.email;
    modal = 'password';
    render('account-password');
    return;
  }
  if (a === 'verifyEmail') {
    if (busy || !auth.verificationRequired || !auth.mailEnabled) return;
    busy = true;
    render();
    try {
      const response = await fetch('/api/auth/player/verify/request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'request_failed');
      toast(result.sent ? 'verificationSent' : 'verificationSendFailed');
    } catch {
      toast('verificationSendFailed');
    } finally {
      busy = false;
      render();
    }
    return;
  }
  if (a === 'login' || a === 'register') {
    if (busy) return;
    if (!['login', 'register', 'password'].includes(modal)) {
      clearAccountDraft();
      accountOpener = target.id;
    }
    accountError = '';
    modal = a;
    render();
    return;
  }
  if (a === 'accountLogout') {
    if (busy) return;
    busy = true;
    render();
    try {
      const response = await fetch('/api/auth/player/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('auth_request_failed');
      auth.authenticated = false;
      auth.user = null;
      auth.verificationRequired = false;
      profileDraft = {};
      friendsDraft = {};
      friendsData = { friends: [], incoming: [], outgoing: [], transfers: [] };
      friendsLoaded = false;
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
    accountOpener = target.id;
    modal = a;
    render();
    return;
  }
  if (a === 'close') {
    if (busy && modal === 'recovery') return;
    closeDialog();
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
  if (target.dataset.action === 'executePlan') {
    const plan = constructionPlan(state, plannedBuilding);
    if (plan.blocked || !plan.affordable || busy) return;
    if (plan.mode === 'build') {
      toast('choosePlot');
      root.querySelector('.map-card')?.scrollIntoView({ block: 'start' });
      root.querySelector('[data-plot]')?.focus({ preventScroll: true });
      return;
    }
    await command(
      plan.mode === 'build'
        ? { type: 'build', building: plan.type }
        : { type: 'upgrade', id: plan.buildingId },
    );
    return;
  }
  const actions = {
    upgradeWall: { type: 'upgradeWall' },
    equip: { type: 'equip', id: target.dataset.id, item: target.dataset.item },
    unequip: { type: 'unequip', id: target.dataset.id },
    collect: { type: 'collect' },
    upgrade: { type: 'upgrade', id: target.dataset.id },
    formation: { type: 'formation', unit: target.dataset.unit, value: target.dataset.value },
    battleCommand: { type: 'battleCommand', id: target.dataset.command },
    startBattle: { type: 'startBattle' },
    newBattle: { type: 'newBattle' },
    healHerd: { type: 'healHerd' },
    replenishHerd: { type: 'replenishHerd', amount: herdAmount },
    rest: { type: 'rest' },
    train: { type: 'train', id: target.dataset.id, path: target.dataset.path },
    travel: { type: 'travel', destination: target.dataset.destination },
    claimQuest: { type: 'claimQuest', id: target.dataset.id },
    claimFirstWatch: { type: 'claimFirstWatch', id: target.dataset.id },
  };
  if (actions[a]) await command(actions[a]);
});

root.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal) {
    if (
      busy &&
      ['login', 'register', 'password', 'account', 'verify', 'recovery', 'demolition'].includes(
        modal,
      )
    )
      return;
    closeDialog();
    return;
  }
  if (event.key === 'Tab' && modal) {
    if (busy && modal === 'demolition') {
      event.preventDefault();
      root.querySelector('#demolition-dialog')?.focus({ preventScroll: true });
      return;
    }
    const focusable = [
      ...document.querySelectorAll(
        '.modal button:not(:disabled), .modal input:not(:disabled), .modal a[href], .modal [tabindex="0"]',
      ),
    ];
    const first = focusable[0],
      last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
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
      render(undefined, true);
      return;
    }
  }
  for (const key of ['wood', 'stone', 'water', 'feed', 'herbs']) {
    const el = document.querySelector(`[data-resource="${key}"]`);
    if (el)
      el.innerHTML = `${number(state.resources[key])}<small> / ${number(state.capacity)}</small>`;
  }
  updateCostHints();
  updateHerdPanel(root, state, herdAmount, economyContext());
  updateFirstWatchPanel(root, state, { t, language, busy });
  if (view === 'wolves') updateGuardianPanel(root, state, selectedWolf, { t, language, busy });
  if (view === 'village') updateEconomyPanel(root, state, plannedBuilding, economyContext());
  if (view === 'world')
    updateAdventurePlanning(root, state, { t, busy, selection: adventureSelection, language });
  if (modal === 'demolition' && demolitionSelection)
    updateDemolitionDialog(root, state, demolitionSelection, demolitionContext());
  // Keep an open placement chooser current without replacing its focused controls.
  if (modal === 'placement') {
    for (const choice of root.querySelectorAll('[data-action="placeBuilding"]')) {
      const definition = BUILDINGS.find((building) => building.id === choice.dataset.buildingType);
      const plot = PLOTS.find((entry) => entry.id === choice.dataset.plotId);
      choice.disabled =
        busy ||
        state.battle.status === 'active' ||
        !definition ||
        !plot ||
        state.buildings.some((building) => building.x === plot.x && building.y === plot.y) ||
        state.buildings.filter((building) => building.type === definition.id).length >=
          definition.maxCount ||
        !affordable(definition.cost);
    }
  }
  const collectButton = document.querySelector('#collect-button');
  if (collectButton) {
    const remaining = Math.max(0, Math.ceil((state.collectReadyAt - Date.now()) / 1000));
    collectButton.disabled = remaining > 0 || busy;
    collectButton.querySelector('[data-collect-label]').textContent = remaining
      ? `${t('collecting')} · ${remaining}${t('seconds')}`
      : t('collect');
  }
  if (
    view === 'friends' &&
    conversation.userCode &&
    !busy &&
    !conversationPending &&
    Date.now() - conversationPollAt > 5000
  ) {
    conversationPollAt = Date.now();
    void loadConversation(conversation.userCode, false, true);
  }
  const activeAdventure = root.querySelector('[data-active-adventure]');
  if (activeAdventure && state.adventure.active) {
    const fragment = document.createElement('template');
    fragment.innerHTML = worldView();
    activeAdventure.replaceWith(fragment.content.querySelector('[data-active-adventure]'));
  }
  const journey = document.querySelector('[data-journey]');
  if (journey && state.journey)
    journey.textContent = `${Math.max(0, Math.ceil((state.journey.endsAt - Date.now()) / 1000))} ${t('seconds')}`;
  renderNotice();
}, 1000);
window.addEventListener('popstate', () => {
  if (busy && ['recovery', 'demolition'].includes(modal)) return;
  demolitionSelection = null;
  demolitionError = '';
  clearRecoveryDraft();
  view = GAME_VIEWS.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  modal = '';
  if (!auth.authenticated || mode !== 'online') denyGameAccess();
  render();
});
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#verify=')) {
    history.replaceState(null, '', location.pathname + location.search);
    void initGoogleAuth();
  }
});
render();
void initGoogleAuth();
