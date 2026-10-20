import { regionArtwork } from './region-art.mjs';
import { villageFortifications, villageCornerSites } from './village-fortifications.mjs';
import { buildingSiteLabel } from './settlement-labels.mjs';
import { formatJourneyDuration } from './journey-time.mjs';
import { villageAtmosphere } from './village-camera.mjs';
import {
  BUILDINGS,
  PLOTS,
  ALL_PLOTS,
  CORNER_PLOT_IDS,
  visualTier,
  getWallUpgradeCost,
} from '../shared/settlement.mjs';
import {
  REGIONS,
  DIFFICULTIES,
  ITEM_DEFINITIONS,
  adventureQuote,
  outingQuote,
} from '../shared/adventures.mjs';
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
const riverTerrainUrl = new URL('./assets/v2/village-terrain-river.webp', import.meta.url).href;
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
  const plots = PLOTS.filter((p) => !state.buildings.some((b) => b.x === p.x && b.y === p.y))
    .map((p) => {
      const [x, y] = point(p.x, p.y);
      return `<g class="empty-plot scene-building" data-plot="${p.id}" tabindex="0" role="button" aria-label="${escape(buildingSiteLabel(p, t))}" transform="translate(${x} ${y})"><path d="M0-45 83 0 0 45-83 0Z" fill="#eddeb4" fill-opacity=".3" stroke="#f8e6b8" stroke-width="2" stroke-dasharray="5 6"/><circle r="20" fill="#273d2c" fill-opacity=".84"/><path d="M-9 0H9M0-9V9" stroke="#f4e2b5" stroke-width="3"/></g>`;
    })
    .join('');
  const buildings = state.buildings
    .filter((building) => building.type !== 'watchtower')
    .sort((a, b) => a.x + a.y - (b.x + b.y))
    .map((b) => {
      const [x, y] = point(b.x, b.y);
      const hall = b.type === 'hall';
      const foundation = hall
        ? '<g class="hall-foundation" aria-hidden="true" pointer-events="none"><ellipse cy="11" rx="97" ry="43" fill="#243e2b" fill-opacity=".43" stroke="#d6bb74" stroke-width="2"/><ellipse cy="11" rx="89" ry="36" fill="none" stroke="#85966a" stroke-opacity=".8" stroke-width="2"/></g><g class="hall-standard" aria-hidden="true" pointer-events="none"><path d="M73-156v58" stroke="#b89d65" stroke-width="2.5"/><path d="M74-155h29l-7 11 7 11H74Z" fill="#294b36" stroke="#dbc27e" stroke-width="1.5"/><path d="M85-150a6 6 0 1 0 0 12 5 5 0 1 1 0-12Z" fill="#e0c47e"/></g>'
        : '';
      const sprite = hall
        ? `<g class="hall-building-sprite" pointer-events="none" transform="scale(1.28)">${buildingImage(b.type, b.level)}</g><rect class="hall-building-hit" x="-78" y="-118" width="156" height="156" fill="transparent" pointer-events="all"/>`
        : buildingImage(b.type, b.level);
      return `<g data-building="${b.id}" role="button" tabindex="0" aria-label="${escape(t(b.type))}, ${escape(t('level'))} ${b.level}" class="scene-building ${hall ? 'hall-building' : ''} ${selected === b.id ? 'selected' : ''}" transform="translate(${x} ${y})">${foundation}<ellipse class="selection-ring" ${hall ? 'cy="11" rx="102" ry="47"' : 'rx="74" ry="36"'} fill="none" stroke="#ffe3a2" stroke-width="3"/>${sprite}<g class="${hall ? 'hall-building-label' : 'building-label'}" transform="translate(0 ${hall ? 75 : 49})"><rect x="${hall ? -88 : -79}" y="-16" width="${hall ? 176 : 158}" height="${hall ? 27 : 24}" rx="8" fill="${hall ? '#243e2b' : '#172d23'}" fill-opacity="${hall ? '.96' : '.92'}" ${hall ? 'stroke="#d6bb74" stroke-width="1.7"' : ''}/><text text-anchor="middle" fill="#fff0c8" font-size="${hall ? 13 : 12}" font-weight="${hall ? 700 : 400}">${escape(t(b.type))} · ${b.level}</text></g></g>`;
    })
    .join('');

  return `<svg class="landscape settlement-scene" viewBox="0 0 1440 980" role="group" aria-label="${escape(t('village'))}"><image class="village-world-backdrop" href="${terrainUrl}" width="1440" height="980" preserveAspectRatio="xMidYMid slice"/><defs><linearGradient id="village-terrain-edge-x"><stop stop-color="white" stop-opacity="0"/><stop offset=".025" stop-color="white"/><stop offset=".975" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><linearGradient id="village-terrain-edge-y" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".025" stop-color="white"/><stop offset=".975" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="village-terrain-feather-x" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="980"><rect width="1440" height="980" fill="url(#village-terrain-edge-x)"/></mask><mask id="village-terrain-feather-y" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="980"><rect width="1440" height="980" fill="url(#village-terrain-edge-y)"/></mask></defs><g mask="url(#village-terrain-feather-x)"><image mask="url(#village-terrain-feather-y)" class="village-terrain-detail" data-river-source="mountain-foothills" href="${riverTerrainUrl}" width="1440" height="980" preserveAspectRatio="none" pointer-events="none"/></g>${villageAtmosphere()}${villageFortifications(state)}${plots}${buildings}${villageCornerSites(state, { t, selected })}</svg>`;
}
export function settlementControls(state, { t, busy, movingId }) {
  const cost = getWallUpgradeCost(state.walls);
  const towers = state.buildings.filter((building) => building.type === 'watchtower').length;
  const towerLimit = BUILDINGS.find((building) => building.id === 'watchtower').maxCount;
  const count = t('cornerTowerCount').replace('{count}', towers).replace('{max}', towerLimit);
  return `<section class="settlement-controls detail-card"><div><span class="eyebrow">${t('wall')} · ${t('level')} ${state.walls.level}</span><h3>${t('wall' + state.walls.level)}</h3><p>${t('architecture')}</p></div><div><span>${costs(cost, t)}</span><button class="button outline" data-action="upgradeWall" ${!cost || busy || state.battle.status === 'active' || Object.entries(cost || {}).some(([k, v]) => state.resources[k] < v) ? 'disabled' : ''}>${t(cost ? 'wallUpgrade' : 'maxLevel')}</button></div>${movingId ? `<p role="status">${t('movingBuilding')} <button class="button outline" data-action="cancelMove">${t('cancelMove')}</button></p>` : ''}<div class="fortification-overview"><h4>${t('cornerFortificationsTitle')}</h4><p>${t('cornerFortificationsHint')}</p><p>${escape(count)}</p><p>${t('cornerTowerBonusHint')}</p><p>${t('villageGateHint')}</p></div></section>`;
}
export function placementDialog(state, { plotId, t, busy }) {
  const plot = ALL_PLOTS.find((p) => p.id === plotId);
  if (!plot) return '';
  const corner = CORNER_PLOT_IDS.includes(plotId);
  const towerLimit = BUILDINGS.find((building) => building.id === 'watchtower').maxCount;
  const towers = state.buildings.filter((building) => building.type === 'watchtower').length;
  const count = t('cornerTowerCount').replace('{count}', towers).replace('{max}', towerLimit);
  return `<div class="modal-backdrop"><section class="modal placement-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}">×</button><span class="eyebrow">${escape(buildingSiteLabel(plot, t))}</span><h2 id="modal-title">${t('placeTitle')}</h2>${corner ? '' : `<p>${t('producerLimit')}</p>`}${corner ? `<p class="corner-placement-hint" data-corner-placement>${t('cornerPlacementHint')} · ${escape(count)}${towers >= towerLimit ? ' · ' + t('cornerTowerLimitHint') : ''}</p>` : ''}<div class="placement-grid">${BUILDINGS.filter(
    (d) =>
      (corner ? d.id === 'watchtower' : d.id !== 'watchtower') &&
      state.buildings.filter((b) => b.type === d.id).length < d.maxCount,
  )
    .map(
      (d) =>
        `<button class="placement-choice ${corner && d.id === 'watchtower' ? 'is-corner-recommended' : ''}" data-action="placeBuilding" data-building-type="${d.id}" data-plot-id="${plotId}" ${busy || state.battle.status === 'active' || Object.entries(d.cost).some(([k, v]) => state.resources[k] < v) ? 'disabled' : ''}><svg viewBox="-82 -122 164 180">${buildingImage(d.id)}</svg><strong>${t(d.id)}</strong>${corner && d.id === 'watchtower' ? `<em class="corner-recommendation">${t('cornerTowerRecommended')}</em>` : ''}<small>${costs(d.cost, t)}</small><span>${t('placeHere')}</span></button>`,
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

function routeCards(state, selection, { t, busy, lock, language = 'tr' }) {
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
      return `<button class="route-card route-${region.id} ${selection.region === region.id ? 'selected' : ''}" data-action="selectRegion" data-region="${region.id}" aria-pressed="${selection.region === region.id}" ${busy || lock || unavailableHome ? 'disabled' : ''}><span class="route-image"><img class="route-landscape" src="${escape(regionArtwork(region.id))}" alt="" width="640" height="360" loading="lazy" decoding="async"></span><span class="route-number" aria-hidden="true">0${index + 1}</span><span class="route-card-content"><span class="route-status" data-region-status="${region.id}">${t(label)}</span><strong>${t(region.id)}</strong><span class="route-detail">${formatJourneyDuration(routeQuote.seconds, { t, language })} · ${t(routeQuote.item)}</span><span class="route-affordance">${t(unavailableHome ? 'routeHomeBase' : selection.region === region.id ? 'routeSelected' : 'routeInspect')}<span aria-hidden="true">${selection.region === region.id ? '✓' : '→'}</span></span></span></button>`;
    },
  ).join('')}</div></section>`;
}

/** Refresh quantities without replacing selects, checkboxes or the focused departure button. */
export function updateAdventurePlanning(root, state, { t, busy, selection, language = 'tr' }) {
  const outing = state.adventure.active;
  selection = outing || selection;
  const readiness = adventureReadiness(state, selection, { outing });
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
    `${costs(readiness.quote.cost, t)} · ${formatJourneyDuration(readiness.quote.seconds, { t, language })}`,
  );
  updateAdventurePartyPanel(root, state, selection, { t, busy, language, outing });
  for (const card of root.querySelectorAll('[data-mission-plan]')) {
    const quote = outing
      ? outingQuote(state, { ...outing, plan: card.dataset.missionPlan })
      : adventureQuote(state, { ...selection, plan: card.dataset.missionPlan });
    const quantities = {
      '[data-plan-seconds]': formatJourneyDuration(quote.seconds, { t, language }),
      '[data-plan-cost]': costs(quote.cost, t),
      '[data-plan-reward]': costs(quote.reward, t),
      '[data-plan-xp]': '+' + quote.xp,
      '[data-plan-fatigue]': '−' + quote.fatigue + ' ' + t('missionHp'),
    };
    for (const [selector, content] of Object.entries(quantities)) {
      const node = card.querySelector(selector);
      if (node && node.innerHTML !== content) node.innerHTML = content;
    }
  }
  set(
    '[data-selected-party-count]',
    escape(t('adventurePartySelectedCount').replace('{count}', selection.wolfIds.length)),
  );
  for (const card of root.querySelectorAll('[data-action="selectRegion"]')) {
    const quote = adventureQuote(state, { ...selection, region: card.dataset.region });
    const detail = card.querySelector('.route-detail');
    if (detail)
      detail.textContent =
        formatJourneyDuration(quote.seconds, { t, language }) + ' · ' + t(quote.item);
  }
  const depart = root.querySelector('[data-action="startAdventure"]');
  if (depart) depart.disabled = Boolean(busy) || !readiness.ready;
}

function guardianChoiceCards(state, selection, { t, lock, busy, quote }) {
  return `<fieldset class="adventure-party" aria-describedby="adventure-party-hint"><legend>${t('party')} · ${t('minimumParty')}: ${quote.minimumWolves}</legend><p id="adventure-party-hint" class="adventure-choice-hint">${t('adventurePartyChoiceHint')}</p><p class="adventure-selected-count" data-selected-party-count>${t('adventurePartySelectedCount').replace('{count}', selection.wolfIds.length)}</p><div class="adventure-guardian-grid">${state.wolves
    .map((wolf) => {
      const unavailable = lock || busy || wolf.hp < 20;
      const name = t(wolf.name === 'healer' ? 'healerPath' : wolf.name);
      return `<label class="guardian-choice ${wolf.hp < 20 ? 'guardian-needs-rest' : ''}" data-guardian-choice="${wolf.id}"><input type="checkbox" id="adventure-${wolf.id}" name="adventure-wolf" aria-labelledby="adventure-label-${wolf.id}" value="${wolf.id}" ${selection.wolfIds.includes(wolf.id) ? 'checked' : ''} ${unavailable ? 'disabled' : ''}>${wolfPortrait(wolf, name)}<span class="guardian-choice-info"><strong id="adventure-label-${wolf.id}">${name}</strong><small>${Math.ceil(wolf.hp)}/${wolf.maxHp} · ${t('level')} ${wolf.level}${wolf.hp < 20 ? ` · ${t('guardianNeedsRest')}` : ''}</small><span class="guardian-choice-state" aria-hidden="true"><span class="choice-selected">✓ ${t('adventureChoiceSelected')}</span><span class="choice-unselected">${t(unavailable ? 'adventureChoiceLocked' : 'adventureChoiceSelect')}</span></span></span></label>`;
    })
    .join('')}</div></fieldset>`;
}

export function adventureView(state, { t, busy, selection, language = 'tr', now = Date.now() }) {
  const a = state.adventure.active,
    s = a || selection,
    readiness = adventureReadiness(state, s, { outing: a }),
    quote = readiness.quote,
    lock = state.battle.status === 'active' || Boolean(a) || Boolean(state.journey);
  return `<section class="adventure-intro"><div class="eyebrow">${t('world')}</div><h2>${t('adventureTitle')}</h2><p>${t('adventureIntro')}</p><p class="muted" data-journey-schedule>${t('journeyScheduleHint')}</p></section>${a ? journeyStory(a, { t, language, now }) : ''}${routeCards(state, s, { t, busy, lock, language })}<div class="adventure-layout"><section class="detail-card adventure-preparation"><div class="adventure-fields"><label>${t('world')}<select id="adventure-kind" ${lock || busy ? 'disabled' : ''}>${['expedition', 'caravan'].map((k) => `<option value="${k}" ${s.kind === k ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label><label>${t('route')}<select id="adventure-region" ${lock || busy ? 'disabled' : ''}>${REGIONS.filter(
    (r) => s.kind === 'caravan' || r.id !== 'homeland',
  )
    .map(
      (r) =>
        `<option value="${r.id}" ${s.region === r.id ? 'selected' : ''}>${t(r.id)}${state.adventure.unlocked.includes(r.id) ? ' · ' + t('discovered') : ''}</option>`,
    )
    .join(
      '',
    )}</select></label><label>${t('difficulty')}<select id="adventure-difficulty" ${lock || busy ? 'disabled' : ''}>${DIFFICULTIES.map((d) => `<option value="${d}" ${s.difficulty === d ? 'selected' : ''}>${t(d)}</option>`).join('')}</select></label></div><p class="adventure-selection-note">${t('adventureSelectionLocalHint')}</p>${missionPlanPicker(state, s, { t, language, disabled: lock || busy, active: Boolean(a), outing: a })}${adventurePartySuggestionsPanel(state, s, { t, busy, language })}${guardianChoiceCards(state, s, { t, lock, busy, quote })}${adventurePartyForecastPanel(state, s, { t, language, outing: a })}<p class="adventure-cost" data-adventure-cost>${costs(quote.cost, t)} · ${formatJourneyDuration(quote.seconds, { t, language })}</p><section class="preparation-summary" id="adventure-readiness" data-adventure-readiness data-ready="${readiness.ready}" aria-live="polite" aria-atomic="true">${readinessContent(readiness, t)}</section><button class="button primary adventure-depart" data-action="startAdventure" aria-describedby="adventure-readiness" ${busy || !readiness.ready ? 'disabled' : ''}>${t('depart')}<span aria-hidden="true">→</span></button></section><aside class="detail-card adventure-brief">${missionBrief(s, { t })}<h3>${t('expectedReward')}</h3><p data-adventure-reward>${costs(quote.reward, t)}</p>${a && (a.economyVersion ?? 1) < 3 ? `<p class="muted" data-active-economy="legacy">${t('missionLegacyReward')}</p>` : ''}<p>+${quote.xp} ${t('xp')} / ${t('wolfCount')} · ${t(quote.item)}</p><div data-adventure-warnings>${preparationWarnings(readiness, t)}</div><p class="muted">${t('expeditionNote')}</p><h3>${t('inventory')}</h3>${ITEM_DEFINITIONS.map((i) => `<div class="inventory-row"><span>${t(i.id)}</span><b>${state.inventory[i.id]}</b></div>`).join('')}</aside></div><section class="adventure-reports"><h2>${t('report')}</h2>${state.adventure.history.length ? state.adventure.history.map((r) => missionReport(r, { t, language })).join('') : `<p>${t('noReports')}</p>`}</section>`;
}
