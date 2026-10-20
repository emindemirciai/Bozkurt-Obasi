import { PLOTS, TOWER_PLOTS } from '../shared/settlement.mjs';

/** Give reserved wall sites a name rather than treating them as ordinary plot numbers. */
export function buildingSiteLabel(site, t) {
  const matches = (plot) => plot.id === site?.id || (plot.x === site?.x && plot.y === site?.y);
  const tower = TOWER_PLOTS.findIndex(matches);
  if (tower >= 0) return `${t('towerPlot')} ${tower + 1}`;
  const plot = PLOTS.findIndex(matches);
  return plot >= 0 ? `${t('plot')} ${plot + 1}` : t('plot');
}
