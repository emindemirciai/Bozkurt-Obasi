import { visualTier, TOWER_PLOTS } from '../shared/settlement.mjs';
import { buildingSiteLabel } from './settlement-labels.mjs';

const ATLAS = new URL('./assets/v2/building-tiers.webp', import.meta.url).href;
const RINGS = [
  new URL('./assets/v2/fortification-timber.webp', import.meta.url).href,
  new URL('./assets/v2/fortification-stone.webp', import.meta.url).href,
  new URL('./assets/v2/fortification-castle.webp', import.meta.url).href,
];
const DIMENSIONS = [
  [1519, 1036],
  [1518, 1036],
  [1518, 1036],
];
const TOWER_CROPS = [
  [1750, 0, 175, 220],
  [1750, 217, 175, 238],
  [1750, 454, 175, 250],
];
const CORNERS = [
  { name: 'back', x: 720, y: 112, dx: -32, dy: -88, width: 64, height: 88 },
  { name: 'right', x: 1345, y: 477, dx: -22, dy: -60, width: 70, height: 100 },
  { name: 'front', x: 720, y: 844, dx: -30, dy: -32, width: 60, height: 76 },
  { name: 'left', x: 95, y: 477, dx: -48, dy: -60, width: 70, height: 100 },
];

// Cropped, genuine raster pieces retain bounded geometry. No invisible marker
// represents a tower or guard: each semantic element paints its own artwork.
function rasterCrop(url, dimensions, crop, attrs = '') {
  const [x, y, width, height] = crop;
  const [imageWidth, imageHeight] = dimensions;
  return `<svg ${attrs} x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${crop.join(' ')}"><foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background-image:url(&quot;${url}&quot;);background-size:${imageWidth}px ${imageHeight}px;background-position:${-x}px ${-y}px;background-repeat:no-repeat"></div></foreignObject></svg>`;
}

function towerArtwork(corner, tier) {
  const crop = TOWER_CROPS[tier - 1];
  const [x, y, width, height] = crop;
  return `<svg x="${corner.dx}" y="${corner.dy}" width="${corner.width}" height="${corner.height}" viewBox="${crop.join(' ')}" preserveAspectRatio="none"><foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background-image:url(&quot;${ATLAS}&quot;);background-size:2172px 724px;background-position:${-x}px ${-y}px;background-repeat:no-repeat"></div></foreignObject></svg>`;
}

/** Wall artwork contains no automatic tower buildings. */
export function villageFortifications(state) {
  const level = state.walls?.level || 1;
  const tier = visualTier(level);
  const url = RINGS[tier - 1];
  const dimensions = DIMENSIONS[tier - 1];
  const [width, height] = dimensions;
  const prefix = `fortification-${tier}`;
  const gate = [260, 585, 290, 285];
  const guards = [
    { side: 'left', crop: [265, 650, 62, 125] },
    { side: 'right', crop: [449, 730, 67, 130] },
  ];
  const guardCuts = guards
    .map(
      ({ crop: [x, y, w, h] }) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/>`,
    )
    .join('');
  return `<g class="village-fortifications" aria-hidden="true" pointer-events="none"><defs><mask id="${prefix}-wall" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/><rect x="${gate[0]}" y="${gate[1]}" width="${gate[2]}" height="${gate[3]}" fill="black"/></mask><mask id="${prefix}-gate" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/>${guardCuts}</mask></defs><g class="village-fortification-raster" transform="matrix(.919 0 0 .846 21.5 19)"><g class="village-wall" data-wall-level="${level}"><image class="village-wall-art" href="${url}" width="${width}" height="${height}" mask="url(#${prefix}-wall)"/></g><g class="village-gate" data-gate-tier="${tier}" mask="url(#${prefix}-gate)">${rasterCrop(url, dimensions, gate)}</g>${guards.map(({ side, crop }) => `<g class="village-sentry" data-sentry="${side}">${rasterCrop(url, dimensions, crop)}</g>`).join('')}</g></g>`;
}

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

/** Four reserved sites. A tower appears only after the server records construction. */
export function villageCornerSites(state, { t, selected = '' }) {
  return (
    '<g class="village-corner-sites">' +
    TOWER_PLOTS.map((plot, index) => {
      const corner = CORNERS[index];
      const building = state.buildings.find(
        (entry) => entry.type === 'watchtower' && entry.x === plot.x && entry.y === plot.y,
      );
      const siteName = buildingSiteLabel(plot, t);
      const title = building
        ? `${t('watchtower')}, ${t('level')} ${building.level}, ${siteName}`
        : `${siteName} · ${t('cornerPlotHint')}`;
      const labelY = building ? corner.dy + corner.height + 20 : 49;
      const label = building ? `${t('watchtower')} · ${building.level}` : siteName;
      const body = building
        ? `<ellipse class="selection-ring" cy="${corner.dy + corner.height - 3}" rx="43" ry="19" fill="none" stroke="#ffe3a2" stroke-width="3"/>${towerArtwork(corner, visualTier(building.level))}`
        : '<path d="M0-26 45 0 0 26-45 0Z" fill="#392f23" fill-opacity=".92" stroke="#f3d68f" stroke-width="2" stroke-dasharray="5 4"/><circle r="21" fill="#273d2c"/><path d="M-9 0H9M0-9V9" stroke="#f4e2b5" stroke-width="3"/>';
      return `<g class="scene-building ${building ? 'village-corner-tower' : 'village-corner-plot'} ${building?.id === selected ? 'selected' : ''}" ${building ? `data-building="${escape(building.id)}" data-tower-tier="${visualTier(building.level)}"` : `data-plot="${plot.id}" data-corner-plot="true" aria-describedby="corner-plot-hint-${plot.id}"`} data-corner="${corner.name}" role="button" tabindex="0" aria-label="${escape(title)}" transform="translate(${corner.x} ${corner.y})"><title ${building ? '' : `id="corner-plot-hint-${plot.id}"`}>${escape(building ? t('towerFixedHint') : t('cornerPlotHint'))}</title>${body}<g class="building-label" transform="translate(0 ${labelY})"><rect x="-61" y="-13" width="122" height="23" rx="7" fill="#172d23" stroke="#b99a55"/><text text-anchor="middle" fill="#fff0c8" font-size="12" font-weight="600" y="3">${escape(label)}</text></g></g>`;
    }).join('') +
    '</g>'
  );
}
