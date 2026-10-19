/** Render route durations and countdowns without converting hours into giant second counts. */
export function formatJourneyDuration(seconds, { t, language = 'tr' } = {}) {
  if (!Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const number = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 0,
  });
  const parts = [
    [hours, 'journeyHours'],
    [minutes, 'journeyMinutes'],
    [remainingSeconds, 'seconds'],
  ]
    .filter(([amount]) => amount > 0)
    .map(([amount, key]) => `${number.format(amount)} ${t(key)}`);
  return parts.length ? parts.join(' ') : `0 ${t('seconds')}`;
}
