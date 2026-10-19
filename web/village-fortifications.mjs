import { visualTier } from '../shared/settlement.mjs';

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

function fixedTower(corner, tier) {
  const crop = TOWER_CROPS[tier - 1];
  const [x, y, width, height] = crop;
  return `<g class="village-fixed-tower fixed-wall-tower" data-corner="${corner.name}" data-tower-tier="${tier}" data-corner-x="${corner.x}" data-corner-y="${corner.y}" transform="translate(${corner.x} ${corner.y})"><svg x="${corner.dx}" y="${corner.dy}" width="${corner.width}" height="${corner.height}" viewBox="${crop.join(' ')}" preserveAspectRatio="none"><foreignObject x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background-image:url(&quot;${ATLAS}&quot;);background-size:2172px 724px;background-position:${-x}px ${-y}px;background-repeat:no-repeat"></div></foreignObject></svg></g>`;
}

/**
 * Four wall towers are always present and inherit the wall's visual tier.
 * They are scenery belonging to the existing wall, not new saved buildings:
 * player-built watchtowers and combat bonuses remain authoritative elsewhere.
 */
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
  return `<g class="village-fortifications" aria-hidden="true" pointer-events="none"><defs><mask id="${prefix}-wall" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/><rect x="${gate[0]}" y="${gate[1]}" width="${gate[2]}" height="${gate[3]}" fill="black"/></mask><mask id="${prefix}-gate" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/>${guardCuts}</mask></defs><g class="village-fortification-raster" transform="matrix(.919 0 0 .846 21.5 19)"><g class="village-wall" data-wall-level="${level}"><image class="village-wall-art" href="${url}" width="${width}" height="${height}" mask="url(#${prefix}-wall)"/></g><g class="village-gate" data-gate-tier="${tier}" mask="url(#${prefix}-gate)">${rasterCrop(url, dimensions, gate)}</g>${guards.map(({ side, crop }) => `<g class="village-sentry" data-sentry="${side}">${rasterCrop(url, dimensions, crop)}</g>`).join('')}</g>${CORNERS.map((corner) => fixedTower(corner, tier)).join('')}</g>`;
}
