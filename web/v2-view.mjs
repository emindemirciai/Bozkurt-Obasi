import { BUILDINGS, PLOTS, visualTier, getWallUpgradeCost } from '../shared/settlement.mjs';
import { REGIONS, DIFFICULTIES, ITEM_DEFINITIONS, adventureQuote } from '../shared/adventures.mjs';
import { adventureReadiness } from './adventure-planning.mjs';
import {
  adventurePartySuggestionsPanel,
  adventurePartyForecastPanel,
  updateAdventurePartyPanel,
} from './adventure-party-panel.mjs';
import {
  missionPlanPicker,
  journeyStory,
  missionBrief,
  missionReport,
} from './adventure-stories.mjs';
const atlas = new URL('./assets/v2/building-tiers.webp', import.meta.url).href;
const portraits = new URL('./assets/v2/wolf-roles.webp', import.meta.url).href;
export const terrainUrl = new URL('./assets/v2/village-terrain.webp', import.meta.url).href;
export const battlefieldUrl = new URL('./assets/v2/battlefield.webp', import.meta.url).href;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const costs = (cost, t) =>
  Object.entries(cost || {})
    .map(([key, n]) => `${Math.ceil(n)} ${escape(t(key))}`)
    .join(' · ');
export function buildingImage(type, level = 1) {
  const col = BUILDINGS.findIndex((d) => d.id === type),
    tier = visualTier(level) - 1;
  const crop =
    type === 'watchtower'
      ? [
          [1750, 0, 175, 220],
          [1750, 217, 175, 238],
          [1750, 454, 175, 250],
        ][tier]
      : [(col * 2172) / 9, (tier * 724) / 3, 2172 / 9, 724 / 3];
  // A full-sized SVG <image> expands its ancestor's geometry to the whole atlas,
  // even when the nested viewport clips it. Keep the sprite's hit geometry inside
  // its crop so clicking or focusing a building targets the visible building.
  const [x, y, width, height] = crop;
  return `<svg x="-78" y="-118" width="156" height="156" viewBox="${crop.join(' ')}" aria-hidden="true"><foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background-image:url(&quot;${escape(atlas)}&quot;);background-repeat:no-repeat;background-size:2172px 724px;background-position:${-x}px ${-y}px"></div></foreignObject></svg>`;
}

export function wolfPortrait(wolf, label = wolf.name) {
  const col = ['alpha', 'guardian', 'hunter', 'scout', 'healer'].indexOf(wolf.name);
  return `<svg class="real-wolf-portrait" viewBox="${(col * 2172) / 5} 120 ${2172 / 5} 500" role="img" aria-label="${escape(label)}"><image href="${portraits}" width="2172" height="724"/></svg>`;
}
const point = (x, y) => [720 + (x - y) * 98, 240 + (x + y) * 57];
export function settlementScene(state, { t, zoom = 1, selected = '' }) {
  const wallLevel = state.walls?.level || 1,
    stone = wallLevel >= 3,
    color = stone ? '#aaa18c' : '#a67b49';
  const perimeter = '720,112 1345,477 720,844 95,477 720,112';
  const wall = `<polyline points="${perimeter}" fill="none" stroke="#30291f" stroke-width="${stone ? 32 : 22}" opacity=".7"/><polyline points="${perimeter}" fill="none" stroke="${color}" stroke-width="${stone ? 26 : 16}" stroke-dasharray="${stone ? '25 2' : '5 3'}"/>${wallLevel >= 2 ? `<polyline points="720,97 1345,462 720,829 95,462 720,97" fill="none" stroke="${stone ? '#d2c7b1' : '#d0a766'}" stroke-width="${wallLevel === 5 ? 14 : 6}" stroke-dasharray="${wallLevel === 5 ? '17 12' : 'none'}"/>` : ''}${stone ? [point(-0.9, -0.9), point(5.9, -0.9), point(5.9, 5.9), point(-0.9, 5.9)].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M-23 0v-44h46V0L0 13Z" fill="#827968" stroke="#4b443a" stroke-width="3"/><path d="M-26-44h52v-13h-9v7h-10v-7H-7v7h-10v-7h-9Z" fill="#c7bda7"/></g>`).join('') : ''}`;
  const plots = PLOTS.filter((p) => !state.buildings.some((b) => b.x === p.x && b.y === p.y))
    .map((p) => {
      const [x, y] = point(p.x, p.y);
      return `<g class="empty-plot scene-building" data-plot="${p.id}" tabindex="0" role="button" aria-label="${escape(t('plot'))} ${Number(p.id.slice(1)) + 1}" transform="translate(${x} ${y})"><path d="M0-45 83 0 0 45-83 0Z" fill="#eddeb4" fill-opacity=".3" stroke="#f8e6b8" stroke-width="2" stroke-dasharray="5 6"/><circle r="20" fill="#273d2c" fill-opacity=".84"/><path d="M-9 0H9M0-9V9" stroke="#f4e2b5" stroke-width="3"/></g>`;
    })
    .join('');
  const buildings = [...state.buildings]
    .sort((a, b) => a.x + a.y - (b.x + b.y))
    .map((b) => {
      const [x, y] = point(b.x, b.y);
      return `<g data-building="${b.id}" role="button" tabindex="0" aria-label="${escape(t(b.type))}, ${escape(t('level'))} ${b.level}" class="scene-building ${selected === b.id ? 'selected' : ''}" transform="translate(${x} ${y})"><ellipse class="selection-ring" rx="74" ry="36" fill="none" stroke="#ffe3a2" stroke-width="3"/>${buildingImage(b.type, b.level)}<g transform="translate(0 49)"><rect x="-79" y="-16" width="158" height="24" rx="8" fill="#172d23" fill-opacity=".92"/><text text-anchor="middle" fill="#fff0c8" font-size="12">${escape(t(b.type))} · ${b.level}</text></g></g>`;
    })
    .join('');
  return `<svg class="landscape settlement-scene" viewBox="0 0 1440 980" role="img" aria-label="${escape(t('village'))}" style="min-width:${Math.round(960 * zoom)}px"><image href="${terrainUrl}" width="1440" height="980" preserveAspectRatio="xMidYMid slice"/>${wall}${plots}${buildings}</svg>`;
}
export function settlementControls(state, { t, busy, movingId }) {
  const cost = getWallUpgradeCost(state.walls);
  return `<section class="settlement-controls detail-card"><div><span class="eyebrow">${t('wall')} · ${t('level')} ${state.walls.level}</span><h3>${t('wall' + state.walls.level)}</h3><p>${t('architecture')}</p></div><div><span>${costs(cost, t)}</span><button class="button outline" data-action="upgradeWall" ${!cost || busy || state.battle.status === 'active' || Object.entries(cost || {}).some(([k, v]) => state.resources[k] < v) ? 'disabled' : ''}>${t(cost ? 'wallUpgrade' : 'maxLevel')}</button></div>${movingId ? `<p role="status">${t('movingBuilding')} <button class="button outline" data-action="cancelMove">${t('cancelMove')}</button></p>` : ''}</section>`;
}
export function placementDialog(state, { plotId, t, busy }) {
  const plot = PLOTS.find((p) => p.id === plotId);
  if (!plot) return '';
  return `<div class="modal-backdrop"><section class="modal placement-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}">×</button><span class="eyebrow">${t('plot')} ${Number(plotId.slice(1)) + 1}</span><h2 id="modal-title">${t('placeTitle')}</h2><p>${t('producerLimit')}</p><div class="placement-grid">${BUILDINGS.filter(
    (d) => state.buildings.filter((b) => b.type === d.id).length < d.maxCount,
  )
    .map(
      (d) =>
        `<button class="placement-choice" data-action="placeBuilding" data-building-type="${d.id}" data-plot-id="${plotId}" ${busy || state.battle.status === 'active' || Object.entries(d.cost).some(([k, v]) => state.resources[k] < v) ? 'disabled' : ''}><svg viewBox="-82 -122 164 180">${buildingImage(d.id)}</svg><strong>${t(d.id)}</strong><small>${costs(d.cost, t)}</small><span>${t('placeHere')}</span></button>`,
    )
    .join('')}</div></section></div>`;
}
export const battlePhase = (state) =>
  state.battle.status === 'active'
    ? state.battle.tick < 3
      ? 'march'
      : state.battle.tick < 5
        ? 'ambush'
        : state.battle.tick < 7
          ? 'forming'
          : 'clash'
    : state.battle.status;
export function narrativePanel(state, { t }) {
  const phase = battlePhase(state),
    key =
      phase === 'preparing'
        ? 'battlePrologue'
        : phase === 'won'
          ? 'battleWonStory'
          : phase === 'lost'
            ? 'battleLostStory'
            : phase + 'Story';
  return `<section class="battle-narrative detail-card"><span class="eyebrow">${t('battleStory')} · ${state.battle.wave}</span><h2>${t('battleChapter' + ((state.battle.wave - 1) % 3))}</h2><div class="story-stages">${['march', 'ambush', 'forming', 'clash'].map((stage) => `<span class="${stage === phase ? 'current' : ''}">${t(stage)}</span>`).join('')}</div><p data-battle-story>${t(key)}</p></section>`;
}
const phrase = (t, key, values = {}) =>
  escape(
    t(key).replace(/\{(\w+)\}/g, (_, name) =>
      name === 'region' ? t(values[name]) : String(values[name] ?? ''),
    ),
  );

function readinessContent(readiness, t) {
  const failureKeys = new Set([
    'battleReadyCheck',
    'journeyReadyCheck',
    'partyReadyCheck',
    'wolvesReadyCheck',
    'herdReadyCheck',
    'suppliesReadyCheck',
  ]);
  return `<div class="preparation-heading"><h3>${t('preparationTitle')}</h3><span class="preparation-status ${readiness.ready ? 'ready' : 'waiting'}">${t(readiness.ready ? 'preparationReady' : 'preparationNeeded')}</span></div><ul class="preparation-checks">${readiness.checks.map((check) => `<li data-ready-check="${check.id}" data-ok="${check.ok}"><span class="check-mark" aria-hidden="true">${check.ok ? '✓' : '!'}</span><span>${phrase(t, !check.ok && failureKeys.has(check.key) ? check.key + 'Blocked' : check.key, { minHP: check.id === 'herd' ? 60 : 20, ...check.values })}${!check.ok && check.key === 'suppliesReadyCheck' ? `<small>${t('suppliesMissing')}: ${costs(Object.fromEntries(readiness.shortages.map(({ resource, amount }) => [resource, amount])), t)}</small>` : ''}</span></li>`).join('')}</ul>`;
}

function preparationWarnings(readiness, t) {
  return `<p class="fatigue-note">${phrase(t, 'journeyFatigue', { amount: readiness.fatigue })}</p>${readiness.overflow.length || readiness.itemFull ? `<div class="reward-warning"><strong>${t('storagePlanningTitle')}</strong>${readiness.overflow.length ? `<p>${t('storagePlanningOverflow')}: <b>${costs(Object.fromEntries(readiness.overflow.map(({ resource, amount }) => [resource, amount])), t)}</b></p>` : ''}${readiness.itemFull ? `<p>${t('inventoryPlanningFull')}</p>` : ''}<small>${t('storagePlanningNote')}</small></div>` : `<p class="storage-planning-note">${t('storagePlanningFits')}</p>`}`;
}

function routeCards(state, selection, { t, busy, lock }) {
  return `<section class="adventure-routes" aria-labelledby="route-map-title"><div class="route-map-heading"><div><span class="eyebrow">${t('routeMapEyebrow')}</span><h3 id="route-map-title">${t('routeMapTitle')}</h3></div><p>${t('routeMapHint')}</p></div><div class="route-card-grid">${REGIONS.map(
    (region, index) => {
      const discovered = state.adventure.unlocked.includes(region.id);
      const current = state.location === region.id;
      const available =
        selection.kind === 'caravan'
          ? discovered && !current
          : index > 0 && state.adventure.unlocked.includes(REGIONS[index - 1].id);
      const label = current
        ? 'routeCurrent'
        : discovered
          ? 'discovered'
          : available
            ? 'routeDiscoverable'
            : 'routeLocked';
      const routeQuote = adventureQuote(state, { ...selection, region: region.id });
      const unavailableHome = selection.kind === 'expedition' && region.id === 'homeland';
      return `<button class="route-card route-${region.id} ${selection.region === region.id ? 'selected' : ''}" data-action="selectRegion" data-region="${region.id}" aria-pressed="${selection.region === region.id}" ${busy || lock || unavailableHome ? 'disabled' : ''}><span class="route-number" aria-hidden="true">0${index + 1}</span><span class="route-status" data-region-status="${region.id}">${t(label)}</span><strong>${t(region.id)}</strong><span class="route-detail">${routeQuote.seconds} ${t('seconds')} · ${t(routeQuote.item)}</span><span class="route-affordance">${t(unavailableHome ? 'routeHomeBase' : selection.region === region.id ? 'routeSelected' : 'routeInspect')}<span aria-hidden="true">${selection.region === region.id ? '✓' : '→'}</span></span></button>`;
    },
  ).join('')}</div></section>`;
}

/** Refresh quantities without replacing selects, checkboxes or the focused departure button. */
export function updateAdventurePlanning(root, state, { t, busy, selection, language = 'tr' }) {
  const readiness = adventureReadiness(state, selection);
  const set = (selector, content) => {
    const node = root.querySelector(selector);
    if (node && node.innerHTML !== content) node.innerHTML = content;
  };
  set('[data-adventure-readiness]', readinessContent(readiness, t));
  const panel = root.querySelector('[data-adventure-readiness]');
  if (panel) panel.dataset.ready = String(readiness.ready);
  set('[data-adventure-warnings]', preparationWarnings(readiness, t));
  set(
    '[data-adventure-cost]',
    `${costs(readiness.quote.cost, t)} · ${readiness.quote.seconds} ${t('seconds')}`,
  );
  updateAdventurePartyPanel(root, state, selection, { t, busy, language });
  for (const card of root.querySelectorAll('[data-mission-plan]')) {
    const seconds = card.querySelector('[data-plan-seconds]');
    if (seconds)
      seconds.textContent =
        adventureQuote(state, { ...selection, plan: card.dataset.missionPlan }).seconds +
        ' ' +
        t('seconds');
  }
  for (const card of root.querySelectorAll('[data-action="selectRegion"]')) {
    const quote = adventureQuote(state, { ...selection, region: card.dataset.region });
    const detail = card.querySelector('.route-detail');
    if (detail) detail.textContent = quote.seconds + ' ' + t('seconds') + ' · ' + t(quote.item);
  }
  const depart = root.querySelector('[data-action="startAdventure"]');
  if (depart) depart.disabled = Boolean(busy) || !readiness.ready;
}

export function adventureView(state, { t, busy, selection, language = 'tr', now = Date.now() }) {
  const s = selection,
    readiness = adventureReadiness(state, s),
    quote = readiness.quote,
    a = state.adventure.active,
    lock = state.battle.status === 'active' || Boolean(a) || Boolean(state.journey);
  return `<section class="adventure-intro"><div class="eyebrow">${t('world')}</div><h2>${t('adventureTitle')}</h2><p>${t('adventureIntro')}</p></section>${a ? journeyStory(a, { t, now }) : ''}${routeCards(state, s, { t, busy, lock })}<div class="adventure-layout"><section class="detail-card adventure-preparation"><div class="adventure-fields"><label>${t('world')}<select id="adventure-kind" ${lock || busy ? 'disabled' : ''}>${['expedition', 'caravan'].map((k) => `<option value="${k}" ${s.kind === k ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label><label>${t('route')}<select id="adventure-region" ${lock || busy ? 'disabled' : ''}>${REGIONS.filter(
    (r) => s.kind === 'caravan' || r.id !== 'homeland',
  )
    .map(
      (r) =>
        `<option value="${r.id}" ${s.region === r.id ? 'selected' : ''}>${t(r.id)}${state.adventure.unlocked.includes(r.id) ? ' · ' + t('discovered') : ''}</option>`,
    )
    .join(
      '',
    )}</select></label><label>${t('difficulty')}<select id="adventure-difficulty" ${lock || busy ? 'disabled' : ''}>${DIFFICULTIES.map((d) => `<option value="${d}" ${s.difficulty === d ? 'selected' : ''}>${t(d)}</option>`).join('')}</select></label></div>${missionPlanPicker(state, s, { t, disabled: lock || busy, active: Boolean(a) })}${adventurePartySuggestionsPanel(state, s, { t, busy, language })}<fieldset class="adventure-party"><legend>${t('party')} · ${t('minimumParty')}: ${quote.minimumWolves}</legend>${state.wolves.map((w) => `<label class="${w.hp < 20 ? 'guardian-needs-rest' : ''}"><input type="checkbox" id="adventure-${w.id}" name="adventure-wolf" value="${w.id}" ${s.wolfIds.includes(w.id) ? 'checked' : ''} ${lock || busy || w.hp < 20 ? 'disabled' : ''}>${wolfPortrait(w, t(w.name === 'healer' ? 'healerPath' : w.name))}<span>${t(w.name === 'healer' ? 'healerPath' : w.name)}<small>${Math.ceil(w.hp)}/${w.maxHp} · ${t('level')} ${w.level}${w.hp < 20 ? ` · ${t('guardianNeedsRest')}` : ''}</small></span></label>`).join('')}</fieldset>${adventurePartyForecastPanel(state, s, { t, language })}<p class="adventure-cost" data-adventure-cost>${costs(quote.cost, t)} · ${quote.seconds} ${t('seconds')}</p><section class="preparation-summary" id="adventure-readiness" data-adventure-readiness data-ready="${readiness.ready}" aria-live="polite" aria-atomic="true">${readinessContent(readiness, t)}</section><button class="button primary adventure-depart" data-action="startAdventure" aria-describedby="adventure-readiness" ${busy || !readiness.ready ? 'disabled' : ''}>${t('depart')}<span aria-hidden="true">→</span></button></section><aside class="detail-card adventure-brief">${missionBrief(s, { t })}<h3>${t('expectedReward')}</h3><p>${costs(quote.reward, t)}</p><p>+${quote.xp} ${t('xp')} / ${t('wolfCount')} · ${t(quote.item)}</p><div data-adventure-warnings>${preparationWarnings(readiness, t)}</div><p class="muted">${t('expeditionNote')}</p><h3>${t('inventory')}</h3>${ITEM_DEFINITIONS.map((i) => `<div class="inventory-row"><span>${t(i.id)}</span><b>${state.inventory[i.id]}</b></div>`).join('')}</aside></div><section class="adventure-reports"><h2>${t('report')}</h2>${state.adventure.history.length ? state.adventure.history.map((r) => missionReport(r, { t, language })).join('') : `<p>${t('noReports')}</p>`}</section>`;
}
