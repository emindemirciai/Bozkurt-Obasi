// Original procedural vector artwork. No remote images, fonts or model downloads.
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

function pine(x, y, scale = 1, tone = 0) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="8" rx="21" ry="9" fill="#5e8053" opacity=".19"/><path d="M-3 1h6v18h-6" fill="#7e6c46"/><path d="M0-65-24-12h11l-18 24H31L13-12h11Z" fill="${tone ? '#64836a' : '#456d56'}"/><path d="M0-65v77h31L13-12h11Z" fill="${tone ? '#759776' : '#5b8264'}"/></g>`;
}

function sheep(x, y, scale = 1, cow = false, facing = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale * facing} ${scale})"><ellipse cy="9" rx="11" ry="5" fill="#254534" opacity=".15"/><path d="M-7 1v10m12-10v10" stroke="#786b55" stroke-width="3"/><ellipse cy="-1" rx="12" ry="8" fill="${cow ? '#b69d72' : '#f6f0d6'}"/><circle cx="10" cy="-5" r="5" fill="${cow ? '#745c46' : '#ddcfb4'}"/><path d="m8-9-3-4m8 4 3-3" stroke="#786b55" stroke-width="2"/><circle cx="12" cy="-6" r="1" fill="#283c31"/></g>`;
}

export function buildingArt(type, level = 1) {
  const base = `<ellipse cx="0" cy="22" rx="64" ry="25" fill="#324c38" opacity=".14"/>`;
  if (type === 'hall' || type === 'healer') {
    const roof = type === 'hall' ? '#b06f40' : '#4f8773';
    return `${base}<path d="M-51-17v41Q0 57 51 24v-41" fill="#e6d7b5"/><path d="M0-11v57q32-2 51-22v-41" fill="#ccbb96"/><path d="M-58-19 0-65 58-19Q0 18-58-19Z" fill="${roof}"/><path d="M0-65 58-19Q25 3 0 7Z" fill="#000" opacity=".11"/><path d="M-50 1Q0 31 50 1M-50 13Q0 44 50 13" fill="none" stroke="#ac7c51" stroke-width="3"/><path d="M-10 43V15q13-8 23 1v26" fill="#735c42"/><path d="M-6 41V21h14v20" fill="#3c4c40"/><path d="M0-66v-38" stroke="#79664b" stroke-width="3"/><path d="M1-101h30l-6 10 6 10H1" fill="${roof}"/><path d="M13-97a7 7 0 1 0 0 12 6 6 0 0 1 0-12" fill="#fff0c7"/>${type === 'healer' ? '<path d="M28-23v20m-10-10h20" stroke="#f1e6cc" stroke-width="5"/>' : ''}<path d="M-32-36Q-18-19-13 3M30-36Q18-19 13 3" fill="none" stroke="#e5b580" stroke-width="2" opacity=".6"/>`;
  }
  if (type === 'well')
    return `${base}<ellipse cy="12" rx="30" ry="18" fill="#788779"/><path d="M-30 0v16q30 28 60 0V0" fill="#acb0a0"/><ellipse rx="30" ry="17" fill="#d7d3b4"/><ellipse rx="20" ry="10" fill="#579b9b"/><path d="M-31 0v-52m62 52v-52" stroke="#816949" stroke-width="7"/><path d="m-42-47 39-29 44 26-40 23Z" fill="#b17649"/><path d="M-3-76 41-50 1-27" fill="#925e3d"/><path d="M0-43V-1" stroke="#d6ba80" stroke-width="2"/><path d="M-7-2h14l-2 13H-5Z" fill="#ad834f"/>`;
  if (type === 'pasture')
    return `<path d="m-75-17 75-38 75 38v42L0 63-75 25Z" fill="#8ba65a"/><path d="m-70-13 70-34 70 34M-70 4 0 38 70 4m-70 34v18" fill="none" stroke="#b3bb72" stroke-width="4"/>${[-65, -32, 0, 32, 65].map((x) => `<path d="M${x} ${24 - Math.abs(x) * 0.48}v26" stroke="#ad8958" stroke-width="5"/>`).join('')}<path d="m-65 35 65 29 65-29" fill="none" stroke="#c3a36d" stroke-width="4"/>${sheep(-30, 5, 0.8)}${sheep(6, -8, 0.9, true)}${sheep(27, 19, 0.85)}${sheep(-4, 26, 0.7)}`;
  if (type === 'watchtower')
    return `${base}<path d="m-26 28 6-79m46 79-6-79m-44 62 43-43m-41 1 41 43" stroke="#8e704c" stroke-width="7"/><path d="M-36-59v27l37 20 36-20v-27" fill="#ac8757"/><path d="m-44-63 44-36 44 36-44 22Z" fill="#607c66"/><path d="M0-99 44-63 0-41" fill="#456251"/><path d="M-32-45 0-29l32-16" fill="none" stroke="#d2b078" stroke-width="4"/>`;
  if (type === 'quarry')
    return `${base}<path d="m-55 16 10-37 32-16 23 32-19 32Z" fill="#a5a794"/><path d="m-13-37 23 32-19 32V-7" fill="#8b9589"/><path d="m-10 26 14-57 24-14 32 46-20 36Z" fill="#bbb9a2"/><path d="M28-45 60 1 40 37 27 3Z" fill="#959e92"/><path d="m-40 27 9-17 19 4 5 20m48-4 20-9 11 16" fill="#d1cbb0"/><path d="m-15-24 31 32m-29-29 17-4" stroke="#745b3d" stroke-width="5"/>`;
  return `${base}<path d="m-44-12 44-22 44 22v45L0 57-44 33Z" fill="#ba9361"/><path d="M0 10v47l44-24v-45" fill="#97734d"/><path d="m-54-16 43-43 64 32-43 44Z" fill="${type === 'lumber' ? '#66794d' : '#a97248'}"/><path d="m-11-59 64 32-43 44-21-42Z" fill="${type === 'lumber' ? '#7d8c58' : '#ba8555'}"/><path d="m8 50 0-26 16-8v24" fill="#5c533d"/><path d="m-31 1 17 8v15l-17-8Z" fill="#e4c485"/>${type === 'lumber' ? '<g fill="#aa8450" stroke="#745c3e" stroke-width="2"><path d="m-55 29 25 12 0 12-25-12Z"/><ellipse cx="-29" cy="47" rx="7" ry="8"/><path d="m-54 15 25 12v12l-25-12Z"/><ellipse cx="-29" cy="33" rx="7" ry="8"/></g>' : '<path d="m-57 26 10-6 12 6v20l-12 6-10-6Z" fill="#c5a06b"/>'}<path d="m-42 34 42 21" stroke="#d3b17b" stroke-width="2"/>${level > 1 ? '<path d="M34-40v-29m1 0h18l-4 7 4 6H35" stroke="#786342" fill="#527a68" stroke-width="2"/>' : ''}`;
}

export function miniBuilding(type) {
  return `<svg viewBox="-90 -112 180 190" aria-hidden="true">${buildingArt(type)}</svg>`;
}

export function scene(state, { battle = false, zoom = 1, selected = '', t }) {
  const trees = Array.from({ length: 45 }, (_, i) => {
    const x = 24 + ((i * 137) % 870),
      y = 38 + ((i * 73) % 570);
    if (x > 140 && x < 738 && y > 108 && y < 532) return '';
    return pine(x, y, 0.65 + (i % 4) * 0.13, i % 3 === 0);
  }).join('');
  let middle;
  if (battle) {
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 47 : 109;
      star.push(`${470 + Math.cos(a) * r},${325 + Math.sin(a) * r * 0.8}`);
    }
    middle = `<path d="${'M' + star.join('L')}Z" fill="#efdda8" fill-opacity=".35" stroke="#e4d3a1" stroke-dasharray="5 7" stroke-width="2"/><path d="M410 179C219 174 219 474 410 477C304 410 304 247 410 179Z" fill="#dfeddc" fill-opacity=".6" stroke="#d9e9cd" stroke-width="2"/>`;
    const herdSpread = { tight: 0.8, balanced: 1, wide: 1.18 }[state.formation.herd];
    middle += Array.from({ length: Math.min(state.herd.count, 24) }, (_, i) => {
      const a = i < 4 ? (i * Math.PI) / 2 : -Math.PI / 2 + (((i - 4) % 5) * Math.PI * 2) / 5,
        r = (i < 4 ? 12 : 34 + Math.floor((i - 4) / 5) * 20) * herdSpread;
      return sheep(470 + Math.cos(a) * r, 326 + Math.sin(a) * r * 0.8, 0.66, i % 5 === 0, -1);
    }).join('');
    const wolfSpread = { tight: 0.84, balanced: 1, wide: 1.14 }[state.formation.wolf];
    middle += state.wolves
      .map((w, i) => {
        const a = -1.18 + i * 0.59,
          x = 370 - Math.cos(a) * 66 * wolfSpread,
          y = 328 + Math.sin(a) * 139 * wolfSpread;
        return `<g data-wolf="${w.id}" role="button" tabindex="0" aria-label="${t(w.name === 'healer' ? 'healerPath' : w.name)}" class="scene-building" transform="translate(${x} ${y})"><ellipse cy="9" rx="29" ry="17" fill="${w.hp > 0 ? '#c5dec3' : '#cfafa0'}" opacity=".75"/>${wolfArt(w.name === 'healer' ? '#749b78' : '#626e66', 0.85, -1)}<rect x="-21" y="-40" width="42" height="4" rx="2" fill="#708474"/><rect x="-21" y="-40" width="${(42 * w.hp) / w.maxHp}" height="4" rx="2" fill="#c3df96"/></g>`;
      })
      .join('');
    const enemies = state.battle.enemies?.length
      ? state.battle.enemies
      : Array.from({ length: 6 }, (_, i) => ({ id: i, hp: 100, maxHp: 100 }));
    middle += enemies
      .filter((e) => e.hp > 0)
      .map((e, i) => {
        let x = 175 + (i % 2) * 36,
          y = 197 + i * 45;
        if (state.battle.status === 'active') x += 60 + (state.battle.tick % 3) * 12;
        if (state.battle.tactic === 'left') y -= 65;
        if (state.battle.tactic === 'right') y += 50;
        if (state.battle.tactic === 'double') y += i % 2 ? 100 : -70;
        return `<g class="enemy" transform="translate(${x} ${y})">${wolfArt('#ad7c55', 0.68)}<rect x="-16" y="-29" width="${(32 * e.hp) / e.maxHp}" height="3" fill="#bd7752"/></g>`;
      })
      .join('');
  } else {
    const spots = {
      hall: [431, 288],
      lumber: [226, 250],
      well: [578, 315],
      pasture: [445, 448],
      quarry: [253, 411],
      healer: [615, 438],
      storage: [630, 190],
      watchtower: [389, 139],
      shelter: [190, 140],
    };
    middle = `<path d="M255 258Q445 363 635 181M434 274Q466 355 450 443M434 302Q337 367 260 414M447 340 609 440M436 289 389 140M225 250 186 143" fill="none" stroke="#c1bc84" stroke-width="35" stroke-linecap="round"/><path d="M255 258Q445 363 635 181M434 274Q466 355 450 443M434 302Q337 367 260 414M447 340 609 440" fill="none" stroke="#d9caa0" stroke-width="24" stroke-linecap="round"/>`;
    middle += Object.entries(spots)
      .filter(([id]) => !state.buildings.some((b) => b.type === id))
      .map(
        ([type, [x, y]]) =>
          `<g class="empty-plot scene-building" data-plot="${type}" tabindex="0" role="button" aria-label="${t('build')} ${t(type)}" transform="translate(${x} ${y})"><path d="M0-29 53 0 0 29-53 0Z" fill="#d8d4a6" fill-opacity=".6" stroke="#f7f0d4" stroke-width="2" stroke-dasharray="5 5"/><path d="M-7 0H7M0-7V7" stroke="#7c9270" stroke-width="3"/></g>`,
      )
      .join('');
    middle += [...state.buildings]
      .sort((a, b) => (spots[a.type]?.[1] || 0) - (spots[b.type]?.[1] || 0))
      .map((b) => {
        const [x, y] = spots[b.type] || [400, 300];
        return `<g class="scene-building ${selected === b.id ? 'selected' : ''}" data-building="${b.id}" role="button" tabindex="0" aria-label="${t(b.type)}, ${t('level')} ${b.level}" transform="translate(${x} ${y})"><ellipse class="selection-ring" rx="72" ry="36" cy="20" fill="none" stroke="#fff4c8" stroke-width="3"/>${buildingArt(b.type, b.level)}<g class="building-label" transform="translate(0 75)"><rect x="-65" y="-16" width="130" height="25" rx="12" fill="#f8f3e1"/><text text-anchor="middle" y="1" fill="#4b5f46" font-size="11" font-weight="700">${t(b.type)} · ${b.level}</text></g></g>`;
      })
      .join('');
    middle += `<g transform="translate(373 370)">${wolfArt('#67766a', 0.55)}</g><g transform="translate(513 242)">${wolfArt('#819486', 0.45)}</g>`;
  }
  return `<svg class="landscape" viewBox="0 0 900 650" role="img" aria-label="${t(battle ? 'battle' : 'village')}"><defs><radialGradient id="grass"><stop stop-color="#cbd2a0"/><stop offset="1" stop-color="#a3ba8b"/></radialGradient><linearGradient id="river" x2="1" y2="1"><stop stop-color="#8fbfbb"/><stop offset="1" stop-color="#6aa6a5"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="8"/></filter></defs><rect width="900" height="650" fill="url(#grass)"/><g transform="translate(${450 * (1 - zoom)} ${325 * (1 - zoom)}) scale(${zoom})"><path d="M770-50C698 110 816 180 777 284S697 390 808 474 797 670 810 710" fill="none" stroke="#e1d8ad" stroke-width="112"/><path d="M775-50C703 110 821 180 782 284S702 390 813 474 802 670 815 710" fill="none" stroke="url(#river)" stroke-width="91"/><path d="M772-30C735 105 818 171 783 256M786 392Q750 430 822 486M814 535 826 592" fill="none" stroke="#c4e0c9" stroke-width="3" opacity=".6"/><g opacity=".18" fill="#759665">${Array.from({ length: 19 }, (_, i) => `<ellipse cx="${(i * 131) % 900}" cy="${(i * 83) % 650}" rx="${25 + (i % 5) * 11}" ry="18"/>`).join('')}</g>${trees}${Array.from({ length: 60 }, (_, i) => `<path d="m${34 + ((i * 151) % 825)} ${50 + ((i * 93) % 552)} 2-5 2 5m-2-2 5-3" fill="none" stroke="#7f9b6c" stroke-width="1.5" opacity=".5"/>`).join('')}${middle}${pine(85, 540, 1.4)}${pine(125, 602, 1.65, 1)}${pine(685, 600, 1.3)}<g fill="#eee9bf">${Array.from({ length: 22 }, (_, i) => `<circle cx="${110 + ((i * 151) % 600)}" cy="${98 + ((i * 127) % 476)}" r="2"/>`).join('')}</g><g opacity=".12" filter="url(#soft)" fill="#fff"><ellipse cx="100" cy="80" rx="170" ry="25"/><ellipse cx="650" cy="70" rx="130" ry="24"/></g></g></svg>`;
}
