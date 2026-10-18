import { adventurePartySuggestions, adventurePartyForecast } from './adventure-party.mjs';

const portraits = new URL('./assets/v2/wolf-roles.webp', import.meta.url).href;
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const roleName = (wolf, t) => t(wolf.name === 'healer' ? 'healerPath' : wolf.name);
const number = (value, language) =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 1 }).format(
    value,
  );
const phrase = (t, key, values = {}) =>
  escape(t(key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '')));
const detail = (label, value, attrs = '') =>
  '<div><dt>' + escape(label) + '</dt><dd ' + attrs + '>' + value + '</dd></div>';

function suggestionContent(state, suggestion, { t, busy = false, language = 'tr' }) {
  const wolves = suggestion.wolfIds.map((id) => state.wolves.find((wolf) => wolf.id === id));
  const lead = wolves[0];
  const col = lead ? ['alpha', 'guardian', 'hunter', 'scout', 'healer'].indexOf(lead.name) : -1;
  const reason = busy ? 'updating' : suggestion.reason;
  const portrait =
    col >= 0
      ? '<span class="party-suggestion-portrait" aria-hidden="true" style="background-image:url(&quot;' +
        escape(portraits) +
        '&quot;);background-position:' +
        col * 25 +
        '% 53.571%"></span>'
      : '';
  return (
    '<div class="party-suggestion-heading">' +
    portrait +
    '<h4>' +
    escape(t('partySuggestion_' + suggestion.id)) +
    '</h4></div><p class="party-suggestion-purpose">' +
    escape(t('partySuggestion_' + suggestion.id + 'Hint')) +
    '</p><p class="party-suggestion-names">' +
    (wolves.length
      ? wolves.map((wolf) => escape(roleName(wolf, t))).join(' · ')
      : escape(t('partySuggestionNoGuardians'))) +
    '</p><dl>' +
    detail(t('partySuggestionCount'), wolves.length + ' / ' + suggestion.proposedCount) +
    detail(
      t('missionTime'),
      suggestion.quote.seconds + ' ' + escape(t('seconds')),
      'data-party-seconds',
    ) +
    detail(t('partySuggestionScoutingTotal'), number(suggestion.scouting, language) + '%') +
    '</dl><p class="party-suggestion-scouting-cap">' +
    escape(t('partySuggestionScoutingCap')) +
    '</p><p class="party-suggestion-reason" id="party-suggestion-reason-' +
    suggestion.id +
    '">' +
    (reason
      ? phrase(t, 'partySuggestionBlocked_' + reason, {
          eligible: suggestion.eligibleCount,
          required: suggestion.proposedCount,
        })
      : escape(t('partySuggestionLocalOnly'))) +
    '</p>'
  );
}
function buttonLabel(suggestion, t) {
  return (
    escape(t(suggestion.sameAsSelection ? 'partySuggestionSelected' : 'partySuggestionApply')) +
    '<span class="sr-only"> · ' +
    escape(t('partySuggestion_' + suggestion.id)) +
    '</span>'
  );
}
export function adventurePartySuggestionsPanel(state, selection, ctx) {
  const { t, busy = false } = ctx;
  return (
    '<section class="party-suggestions" id="adventure-party-suggestions" aria-labelledby="party-suggestion-title"><div class="party-section-heading"><h3 id="party-suggestion-title">' +
    escape(t('partySuggestionTitle')) +
    '</h3><p>' +
    escape(t('partySuggestionHint')) +
    '</p></div><div class="party-suggestion-grid">' +
    adventurePartySuggestions(state, selection)
      .map(
        (suggestion) =>
          '<article class="party-suggestion-card ' +
          (suggestion.sameAsSelection ? 'selected' : '') +
          '" data-party-card="' +
          suggestion.id +
          '"><div data-party-live="suggestion-' +
          suggestion.id +
          '">' +
          suggestionContent(state, suggestion, ctx) +
          '</div><button type="button" class="button outline" id="party-suggestion-' +
          suggestion.id +
          '" data-party-suggestion="' +
          suggestion.id +
          '" aria-pressed="' +
          suggestion.sameAsSelection +
          '" aria-describedby="party-suggestion-reason-' +
          suggestion.id +
          '" ' +
          (busy || !suggestion.ready ? 'disabled' : '') +
          '>' +
          buttonLabel(suggestion, t) +
          '</button></article>',
      )
      .join('') +
    '</div></section>'
  );
}
function forecastContent(state, selection, { t, language = 'tr' }) {
  const forecast = adventurePartyForecast(state, selection);
  const rows = forecast.wolves
    .map((result) => {
      const wolf = state.wolves.find((entry) => entry.id === result.id);
      const format = (value) => number(value, language);
      const experience = (entry) =>
        entry.level >= 20
          ? phrase(t, 'partyForecastMaxXp', { xp: entry.xp })
          : entry.xp + ' / ' + entry.level * 45;
      return (
        '<article class="party-forecast-wolf" data-party-forecast="' +
        escape(result.id) +
        '"><div class="party-forecast-name"><h4>' +
        escape(roleName(wolf, t)) +
        '</h4>' +
        (result.levelsGained
          ? '<strong class="party-level-up">' +
            phrase(t, 'partyForecastLevelUp', { before: wolf.level, after: result.level }) +
            '</strong>'
          : '') +
        (!result.eligible
          ? '<span class="party-forecast-ineligible">' +
            escape(t('partyForecastIneligible')) +
            '</span>'
          : '') +
        '</div><dl>' +
        detail(
          t('partyForecastHealth'),
          format(result.currentHp) +
            ' / ' +
            wolf.maxHp +
            ' → <strong>' +
            format(result.hp) +
            ' / ' +
            result.maxHp +
            '</strong>',
          'data-party-arrival-hp',
        ) +
        detail(
          t('partyForecastFatigue'),
          format(result.currentHp) +
            ' → ' +
            format(result.postFatigueHp) +
            ' ' +
            escape(t('missionHp')),
        ) +
        detail(
          t('partyForecastXp'),
          experience(wolf) +
            ' → <strong>' +
            experience(result) +
            '</strong> <span>(+' +
            result.xpGained +
            ' ' +
            escape(t('xp')) +
            ')</span>',
          'data-party-arrival-xp',
        ) +
        '</dl>' +
        (result.levelsGained
          ? '<p class="party-forecast-level-note">' +
            phrase(t, 'partyForecastHealing', {
              count: result.levelsGained,
              points: result.points - wolf.points,
            }) +
            '</p>'
          : '') +
        (result.xpGained < result.nominalXp
          ? '<p class="party-forecast-level-note">' + escape(t('partyForecastXpCapped')) + '</p>'
          : '') +
        '</article>'
      );
    })
    .join('');
  return (
    '<p class="party-forecast-note">' +
    escape(t('partyForecastHint')) +
    '</p>' +
    (forecast.locked
      ? '<p class="party-forecast-lock">' + escape(t('partyForecastLocked')) + '</p>'
      : '') +
    (rows || '<p class="party-forecast-empty">' + escape(t('partyForecastEmpty')) + '</p>') +
    (forecast.invalidIds.length || forecast.duplicateIds.length
      ? '<p class="party-forecast-lock">' + escape(t('partyForecastInvalid')) + '</p>'
      : '')
  );
}
export function adventurePartyForecastPanel(state, selection, ctx) {
  return (
    '<section class="party-forecast" id="adventure-party-forecast" aria-labelledby="party-forecast-title"><h3 id="party-forecast-title">' +
    escape(ctx.t('partyForecastTitle')) +
    '</h3><div data-party-live="forecast">' +
    forecastContent(state, selection, ctx) +
    '</div></section>'
  );
}
/** Preserve native suggestion buttons while refreshing all read-only calculations. */
export function updateAdventurePartyPanel(root, state, selection, ctx) {
  const suggestions = root.querySelector('#adventure-party-suggestions');
  if (!suggestions) return;
  for (const suggestion of adventurePartySuggestions(state, selection)) {
    const live = suggestions.querySelector('[data-party-live="suggestion-' + suggestion.id + '"]');
    const content = suggestionContent(state, suggestion, ctx);
    if (live && live.innerHTML !== content) live.innerHTML = content;
    suggestions
      .querySelector('[data-party-card="' + suggestion.id + '"]')
      ?.classList.toggle('selected', suggestion.sameAsSelection);
    const button = suggestions.querySelector('[data-party-suggestion="' + suggestion.id + '"]');
    if (button) {
      button.disabled = Boolean(ctx.busy) || !suggestion.ready;
      button.setAttribute('aria-pressed', String(suggestion.sameAsSelection));
      const label = buttonLabel(suggestion, ctx.t);
      if (button.innerHTML !== label) button.innerHTML = label;
    }
  }
  const forecast = root.querySelector('[data-party-live="forecast"]');
  const content = forecastContent(state, selection, ctx);
  if (forecast && forecast.innerHTML !== content) forecast.innerHTML = content;
}
