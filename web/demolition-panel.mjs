import { buildingSiteLabel } from './settlement-labels.mjs';
import { demolitionQuote } from '../shared/settlement.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const amount = (value, language) =>
  value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 3 });

/** The opened target stays fixed even if another browser reuses its building ID. */
export function demolitionStatus(state, selection) {
  let quote = selection.quote;
  let changed = false;
  try {
    const current = demolitionQuote(state, selection.id);
    changed = Object.entries(selection.expected).some(
      ([key, value]) => current.expected[key] !== value,
    );
    if (!changed) quote = current;
  } catch {
    changed = true;
  }
  return { quote, changed, ready: !changed && quote.canDemolish };
}

function quoteContent(status, selection, { t, language }) {
  const { quote, changed } = status;
  const plot = buildingSiteLabel(selection.expected, t);
  return `<div class="demolition-building"><strong>${escape(t(selection.expected.type))}</strong><span>${t('level')} ${selection.expected.level} · ${escape(plot)}</span></div>
    <section class="demolition-refund" aria-labelledby="demolition-refund-title"><h3 id="demolition-refund-title">${t('demolitionRefund')}</h3><dl data-demolition-refund>${Object.entries(
      quote.refund,
    )
      .filter(([, value]) => value > 0)
      .map(
        ([key, value]) =>
          `<div><dt>${escape(t(key))}</dt><dd data-demolition-resource="${key}">+${amount(value, language)}</dd></div>`,
      )
      .join('')}</dl><small>${t('demolitionRefundExact')}</small></section>
    <p class="demolition-capacity" data-demolition-capacity>${t('capacity')}: <strong>${amount(quote.capacityBefore, language)} → ${amount(quote.capacityAfter, language)}</strong></p>
    <p class="demolition-rule">${t('demolitionPermanent')}</p>
    <div class="demolition-blocked" data-demolition-reason role="status" ${!changed && !quote.reason ? 'hidden' : ''}>${changed ? t('demolitionChanged') : quote.reason ? t('demolition_' + quote.reason) : ''}${
      !changed && quote.reason === 'DEMOLITION_STORAGE_FULL'
        ? `<span>${t('demolitionOverflow')}: ${Object.entries(quote.overflow)
            .map(
              ([key, value]) =>
                `${escape(t(key))} ${amount(Math.max(0.001, Math.ceil(value * 1000) / 1000), language)}`,
            )
            .join(' · ')}</span>`
        : ''
    }</div>`;
}

export function demolitionDialog(state, selection, context) {
  const { t, busy = false, readOnly = false, error = '' } = context;
  const status = demolitionStatus(state, selection);
  return `<div class="modal-backdrop"><section id="demolition-dialog" class="modal demolition-dialog" role="dialog" aria-modal="true" aria-labelledby="demolition-title" aria-describedby="demolition-intro" aria-busy="${busy}" tabindex="-1"><button class="modal-close icon-button" data-action="close" aria-label="${t('close')}" ${busy ? 'disabled' : ''}>×</button><span class="eyebrow">${t('demolitionEyebrow')}</span><h2 id="demolition-title">${t('demolitionTitle')}</h2><p id="demolition-intro">${t('demolitionIntro')}</p><div data-demolition-quote>${quoteContent(status, selection, context)}</div><p class="account-error" data-demolition-error role="alert" ${error ? '' : 'hidden'}>${error ? escape(t(error)) : ''}</p>${readOnly ? `<p class="demolition-readonly">${t('demolitionReadOnly')}</p>` : ''}<div class="demolition-actions"><button id="demolition-cancel" class="button outline" data-action="close" ${busy ? 'disabled' : ''}>${t('demolitionCancel')}</button><button id="demolition-confirm" class="button demolition-danger" data-action="confirmDemolition" ${busy || readOnly || !status.ready ? 'disabled' : ''}>${t(busy ? 'demolitionSending' : 'demolitionConfirm')}</button></div></section></div>`;
}

/** Polling updates quantities and validity without replacing focused buttons. */
export function updateDemolitionDialog(root, state, selection, context) {
  const dialog = root.querySelector('#demolition-dialog');
  if (!dialog || !selection) return;
  const status = demolitionStatus(state, selection);
  const content = dialog.querySelector('[data-demolition-quote]');
  const html = quoteContent(status, selection, context);
  if (content.innerHTML !== html) content.innerHTML = html;
  dialog.setAttribute('aria-busy', String(Boolean(context.busy)));
  for (const button of dialog.querySelectorAll('[data-action="close"]'))
    button.disabled = Boolean(context.busy);
  const confirm = dialog.querySelector('#demolition-confirm');
  const confirmWasFocused = document.activeElement === confirm;
  confirm.disabled = Boolean(context.busy || context.readOnly || !status.ready);
  if (confirmWasFocused && confirm.disabled && !context.busy)
    dialog.querySelector('#demolition-cancel')?.focus({ preventScroll: true });
  confirm.textContent = context.t(context.busy ? 'demolitionSending' : 'demolitionConfirm');
  const error = dialog.querySelector('[data-demolition-error]');
  error.hidden = !context.error;
  error.textContent = context.error ? context.t(context.error) : '';
}
