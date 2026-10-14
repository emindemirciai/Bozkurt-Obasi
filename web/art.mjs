import { battleAnimal } from './animal-sprites.mjs';
import { buildingImage, settlementScene, battlefieldUrl, battlePhase } from './v2-view.mjs';

// Original scene artwork with local wildlife cutouts for the battlefield.
export function icon(name, size = 20) {
  const paths = {
    village: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
    battle: 'm5 3 14 14m0-14L5 17M3 15l6 6m6 0 6-6M3 3l4 1-3 3Z',
    world: 'M3 5 9 3l6 3 6-2v16l-6 2-6-3-6 2ZM9 3v16m6-13v16',
    wolves: 'm4 3 6 6h4l6-6-1 14-7 5-7-5ZM8 13h1m6 0h1m-6 4h4',
    quests: 'M8 4H5v17h14V4h-3M8 2h8v5H8Zm0 10 2 2 5-4m-7 8h7',
    wood: 'm4 7 5-4 11 11-5 5L4 8Zm11 6 5 1m-5-1v6M5 7l4-4m-1 9 5-4',
    stone: 'm3 15 3-9 8-3 7 9-3 8H8Zm3-9 7 8 8-2M13 14l-5 6',
    water: 'M12 2C10 6 4 11 4 15a8 8 0 0 0 16 0c0-4-6-9-8-13Zm-4 13c0 3 2 4 4 4',
    feed: 'M12 22V3m0 6C5 9 5 3 5 3s7 0 7 6Zm0 6c7 0 7-6 7-6s-7 0-7 6Zm0 6c-7 0-7-6-7-6s7 0 7 6Z',
    herbs: 'M5 21 17 8M5 16C2 3 13 2 21 3c1 10-4 18-16 13Z',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    close: 'm6 6 12 12M6 18 18 6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    check: 'm5 12 4 4L19 6',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
    expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3v1M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0',
    cloud: 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11Zm3-5 3-3 3 3m-3-3v8',
    save: 'M4 3h13l4 4v14H3V3Zm3 0v7h9V3M7 21v-7h10v7',
    target: 'M12 3v4m0 10v4M3 12h4m10 0h4M19 12a7 7 0 1 0-14 0 7 7 0 0 0 14 0',
    heart: 'M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z',
    flag: 'M5 22V3m0 0c6-4 8 4 15 0v10c-7 4-9-4-15 0',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.village}"/></svg>`;
}

export function wolfArt(color = '#596967', scale = 1, facing = 1) {
  return `<g transform="scale(${scale * facing} ${scale})"><ellipse cy="20" rx="25" ry="9" fill="#2e493e" opacity=".12"/><path d="M-19 4-32-5-25 12-12 17 13 17 26 4 20-10 11-14 5-7-14-8Z" fill="${color}"/><path d="m11-13 0-13 9 11m-12 2-7-10-2 15" fill="${color}"/><path d="m13 0 11 4-8 10-11-4Z" fill="#d5ded4"/><path d="M-16 12v12h7l3-11m16 0 1 11h6l3-18" fill="${color}"/><circle cx="17" cy="-5" r="1.8" fill="#f7d789"/><path d="m23 2 6 1-5 4" fill="#283b37"/></g>`;
}

export function buildingArt(type, level = 1) {
  return buildingImage(type, level);
}

export function miniBuilding(type, level = 1) {
  return `<svg viewBox="-90 -130 180 190" aria-hidden="true">${buildingArt(type, level)}</svg>`;
}

// Each animal keeps its battle position in the outer SVG transform. The inner
// group starts along the trail and transitions to that position during formation.
function deployment(art, fromX, fromY, toX, toY) {
  return `<g class="battle-deployment" style="--march-x:${(fromX - toX).toFixed(2)}px;--march-y:${(fromY - toY).toFixed(2)}px">${art}</g>`;
}

export function scene(state, { battle = false, zoom = 1, selected = '', t }) {
  if (!battle) return settlementScene(state, { t, zoom, selected });
  const star = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 47 : 109;
    star.push(`${470 + Math.cos(a) * r},${325 + Math.sin(a) * r * 0.8}`);
  }
  let middle = `<g class="formation-guide" aria-hidden="true"><path d="${'M' + star.join('L')}Z" fill="#efdda8" fill-opacity=".2" stroke="#e4d3a1" stroke-dasharray="5 7" stroke-width="2"/><path d="M410 179C219 174 219 474 410 477C304 410 304 247 410 179Z" fill="#dfeddc" fill-opacity=".24" stroke="#d9e9cd" stroke-width="2"/></g>`;
  const herdSpread = { tight: 0.8, balanced: 1, wide: 1.18 }[state.formation.herd];
  middle += Array.from({ length: Math.min(state.herd.count, 28) }, (_, i) => {
    const a = i < 4 ? (i * Math.PI) / 2 : -Math.PI / 2 + (((i - 4) % 5) * Math.PI * 2) / 5;
    const r = (i < 4 ? 12 : 34 + Math.floor((i - 4) / 5) * 20) * herdSpread;
    const x = 470 + Math.cos(a) * r;
    const y = 326 + Math.sin(a) * r * 0.8;
    const fromX = 605 + (i % 3) * 26 - Math.floor(i / 3) * 8;
    const fromY = 238 + Math.floor(i / 3) * 22 + (i % 3) * 7;
    const art = `<g class="battle-herd" style="--delay:-${(i % 7) * 0.28}s">${battleAnimal(i % 5 === 0 ? 'cow' : 'sheep', 1, -1)}</g>`;
    return `<g transform="translate(${x} ${y})">${deployment(art, fromX, fromY, x, y)}</g>`;
  }).join('');
  const wolfSpread = { tight: 0.84, balanced: 1, wide: 1.14 }[state.formation.wolf];
  middle += state.wolves
    .map((w, i) => {
      const a = -1.18 + i * 0.59;
      const x = 370 - Math.cos(a) * 66 * wolfSpread;
      const y = 328 + Math.sin(a) * 139 * wolfSpread;
      const art = `<g class="battle-motion" style="--delay:${(i % 5) * 0.16}s">${battleAnimal('wolf', 1, -1)}</g><rect x="-21" y="-40" width="42" height="4" rx="2" fill="#708474"/><rect x="-21" y="-40" data-hp-bar width="${(42 * w.hp) / w.maxHp}" height="4" rx="2" fill="#c3df96"/>`;
      return `<g data-wolf="${w.id}" role="button" tabindex="0" aria-label="${t(w.name === 'healer' ? 'healerPath' : w.name)}" class="scene-building battle-wolf ${w.hp < w.maxHp * 0.35 ? 'is-wounded' : ''}" transform="translate(${x} ${y})">${deployment(art, 555 - i * 8, 185 + i * 67, x, y)}</g>`;
    })
    .join('');
  const enemies = state.battle.enemies?.length
    ? state.battle.enemies
    : Array.from({ length: 6 }, (_, i) => ({ id: i, hp: 100, maxHp: 100 }));
  const tactic = state.battle.status === 'preparing' ? 'direct' : state.battle.tactic;
  middle += enemies
    .map((e, i) => {
      const x = 175 + (i % 2) * 36;
      const y = 197 + i * 45;
      const chargeX = tactic === 'rush' ? 118 : tactic === 'double' ? 94 : 84;
      const chargeY =
        tactic === 'left'
          ? -55
          : tactic === 'right'
            ? 45
            : tactic === 'double'
              ? i % 2
                ? 70
                : -70
              : 0;
      return `<g class="enemy battle-jackal" data-enemy-id="${e.id}" style="${e.hp > 0 ? '' : 'display:none'}" transform="translate(${x} ${y})"><g class="battle-motion" style="--delay:${i * 0.2}s;--charge-x:${chargeX}px;--charge-y:${chargeY}px">${battleAnimal('jackal')}<rect x="-16" y="-29" width="32" height="3" fill="#704c3b"/><rect data-hp-bar x="-16" y="-29" width="${(32 * e.hp) / e.maxHp}" height="3" fill="#bd7752"/></g></g>`;
    })
    .join('');
  middle +=
    '<g transform="translate(276 252)" aria-hidden="true"><g class="battle-impact"><path d="M0-13 0-4M-12 0-4 0M8-8 14-14M8 8 15 15" stroke="#fff4bf" stroke-width="3" stroke-linecap="round"/></g></g><g transform="translate(295 358)" aria-hidden="true"><g class="battle-impact" style="--delay:-.7s"><path d="M0-13 0-4M-12 0-4 0M8-8 14-14M8 8 15 15" stroke="#fff4bf" stroke-width="3" stroke-linecap="round"/></g></g>';
  return `<svg class="landscape battle-scene ${state.battle.status === 'active' ? 'is-active' : ''}" data-phase="${battlePhase(state)}" data-tactic="${state.battle.status === 'active' ? state.battle.tactic : ''}" data-started-at="${state.battle.startedAt ?? ''}" viewBox="0 0 900 650" role="img" aria-label="${t('battle')}"><defs></defs><g transform="translate(${450 * (1 - zoom)} ${325 * (1 - zoom)}) scale(${zoom})"><image class="battlefield-terrain" href="${battlefieldUrl}" width="900" height="650" preserveAspectRatio="xMidYMid slice"/>${middle}</g></svg>`;
}
