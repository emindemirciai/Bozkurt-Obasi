import './arrival-panel.css';
import { icon } from './art.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const resources = ['wood', 'stone', 'water', 'feed', 'herbs'];
const number = (value, language) =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 20,
  }).format(value);

/** A saved journey receipt. Displaying or opening it never claims rewards. */
export function arrivalPanel(report, state, { t, language = 'tr', readOnly = false }) {
  if (!report) return '';
  const source = report.source === 'existing' ? 'existing' : 'returned';
  return `<section id="arrival-notice" class="arrival-panel" data-arrival-source="${source}" data-arrival-id="${escape(report.id)}" aria-labelledby="arrival-title" ${readOnly ? 'data-readonly="true"' : ''}>
    <div class="arrival-heading"><div class="arrival-heading-icon">${icon('world', 23)}</div><div><p class="arrival-eyebrow">${escape(t(report.kind))} · ${escape(t(report.region))} · ${escape(t(report.difficulty))}</p><h2 id="arrival-title">${escape(t(source === 'existing' ? 'arrivalExistingTitle' : 'arrivalReturnedTitle'))}</h2></div></div>
    <p id="arrival-credit-note" class="arrival-credit-note">${escape(t('arrivalAlreadyCredited'))}</p>
    <div class="arrival-receipt">
      <div class="arrival-materials"><h3>${escape(t('arrivalMaterials'))}</h3><dl>${resources.map((resource) => `<div data-arrival-resource="${resource}" data-arrival-reward="${resource}"><dt>${icon(resource, 15)}${escape(t(resource))}</dt><dd>+${escape(number(report.reward[resource], language))}</dd></div>`).join('')}</dl><p class="arrival-limit-note">${escape(t('arrivalStorageNote'))}</p></div>
      <div class="arrival-item"><h3>${escape(t('arrivalItem'))}</h3><p data-arrival-item>${escape(t(report.item))} <strong>×${escape(number(report.itemCount, language))}</strong></p>${report.itemCount === 0 ? `<p class="arrival-limit-note">${escape(t('arrivalNoItem'))}</p>` : ''}</div>
      <div class="arrival-experience"><h3>${escape(t('arrivalExperience'))}</h3><ul data-arrival-xp>${report.wolfIds
        .map((id) => {
          const wolf = state.wolves.find((entry) => entry.id === id);
          const label = wolf
            ? t(wolf.name === 'healer' ? 'healerPath' : wolf.name)
            : t('arrivalUnknownGuardian');
          return `<li data-arrival-wolf="${escape(id)}"><span>${escape(label)}</span><strong>+${escape(number(report.xp, language))} ${escape(t('xp'))}</strong></li>`;
        })
        .join('')}</ul><p class="arrival-limit-note">${escape(t('arrivalXpLimit'))}</p></div>
    </div>
    <div class="arrival-actions"><button id="arrival-report" class="button primary" data-action="openArrivalReport" aria-describedby="arrival-credit-note">${escape(t('arrivalOpenReport'))}${icon('arrow', 16)}</button><button id="arrival-dismiss" class="button outline" data-action="dismissArrival" ${readOnly ? 'disabled aria-describedby="arrival-readonly-note"' : ''}>${escape(t('arrivalDismiss'))}</button></div>
    ${readOnly ? `<p id="arrival-readonly-note" class="arrival-readonly-note">${escape(t('arrivalReadOnly'))}</p>` : ''}
  </section>`;
}
