import { visualTier } from '../shared/settlement.mjs';

const WALL_SEGMENTS = [
  [
    [720, 112],
    [1345, 477],
  ],
  [
    [1345, 477],
    [720, 844],
  ],
  [
    [720, 844],
    [475, 700],
  ],
  [
    [360, 633],
    [95, 477],
  ],
  [
    [95, 477],
    [720, 112],
  ],
];

/** The entrance is a real break in the perimeter; all artwork remains non-interactive. */
function perimeter(level) {
  const stone = level >= 3;
  const height = stone ? 33 + (level - 3) * 3 : 27 + (level - 1) * 4;
  const faces = WALL_SEGMENTS.map(([[ax, ay], [bx, by]], index) => {
    const length = Math.hypot(bx - ax, by - ay);
    const count = Math.ceil(length / (stone ? 35 : 12));
    const pieces = Array.from({ length: count }, (_, part) => {
      const fraction = (part + 0.5) / count;
      const x = ax + (bx - ax) * fraction;
      const y = ay + (by - ay) * fraction;
      if (!stone)
        return `<path d="M${x} ${y - 2}v-${height + (part % 3 === 0 ? 4 : 0)}" stroke="${part % 3 === 0 ? '#a48355' : '#81613f'}" stroke-width="8" stroke-linecap="round"/><path d="M${x - 1.5} ${y - 6}v-${height - 7}" stroke="#c2a574" stroke-opacity=".45" stroke-width="1.3"/>`;
      return `<path d="M${x} ${y - 2}v-${height - 3}m-13 9h26m-13 12h26" stroke="#514d43" stroke-opacity=".4" stroke-width="1.4"/>${level === 5 && part % 2 === 0 ? `<path d="M${x - 8} ${y - height}v-10h16v10" fill="#c3b79d" stroke="#655f50" stroke-width="1.5"/>` : ''}`;
    }).join('');
    return `<g data-wall-segment="${index}"><path d="M${ax} ${ay + 6}L${bx} ${by + 6}" stroke="#22271e" stroke-opacity=".36" stroke-width="23" stroke-linecap="round"/><path d="M${ax} ${ay}L${bx} ${by}V${by - height}L${ax} ${ay - height}Z" fill="${stone ? 'url(#fortification-stone)' : '#664d34'}" stroke="#494334" stroke-width="2"/>${pieces}<path d="M${ax} ${ay - height}L${bx} ${by - height}" stroke="${stone ? '#d0c4aa' : '#c0a16b'}" stroke-width="${stone ? 5 : 3}" stroke-linecap="round"/>${level >= 2 && !stone ? `<path d="M${ax} ${ay - 10}L${bx} ${by - 10}" stroke="#5b432e" stroke-width="5"/>` : ''}</g>`;
  }).join('');
  return `<g class="village-wall" data-wall-level="${level}">${faces}</g>`;
}

function gate(tier) {
  const stone = tier >= 2;
  const posts = stone
    ? `<path d="M-78 0v-56Q0-119 78-56V0H58v-51Q0-94-58-51V0Z" fill="url(#fortification-stone)" stroke="#514b3f" stroke-width="3"/><path d="M-76-19h16m-16-16h16m-16-16h16m120 32h16m-16-16h16m-16-16h16M-36-91l9 15m27-23v17m36-9-9 15" stroke="#635d50" stroke-width="2"/><path d="M-78-56Q0-119 78-56" fill="none" stroke="#d5c7a8" stroke-width="5"/>${tier === 3 ? '<path d="M-86-58v-24h13v9h13v-12h13v10h13v-14h13v10H-6v-14H8v14h14v-10h13v14h13v-10h13v12h13v-9h13v24" fill="#b6a98e" stroke="#5d5749" stroke-width="2"/><path d="M-82-58H82" stroke="#d3c7a9" stroke-width="4"/>' : ''}`
    : '<path d="M-75 0v-87h17V0m116 0v-87h17V0" fill="url(#fortification-timber)" stroke="#463829" stroke-width="3"/><path d="M-85-81H85v-15H-85Z" fill="url(#fortification-timber)" stroke="#4d3a28" stroke-width="3"/><path d="M-60-58-38-80m98 22L38-80" stroke="#bd9c62" stroke-width="8"/><path d="M-86-98 0-119l86 21Z" fill="#626449" stroke="#414735" stroke-width="2"/>';
  return `<g class="village-gate" data-gate-tier="${tier}" transform="matrix(.863 .504 0 1 417.5 666.5)"><ellipse cy="5" rx="97" ry="9" fill="#29281f" opacity=".25"/>${posts}<g class="village-gate-leaves" fill="url(#fortification-timber)" stroke="#4a3827" stroke-width="2"><path d="M-58-66-90-39v63l32-24Z"/><path d="M58-66 90-39v63L58 0Z"/><path d="M-62-48-86-28m24 27-24 20m148-67 24 20M62-1l24 20" fill="none" stroke="#423b32" stroke-width="4"/></g><path d="M-53 4H53" stroke="#d3bd8a" stroke-width="7" stroke-linecap="round"/></g>`;
}

function sentry(side, tier) {
  const x = side === 'left' ? 325.5 : 467.5;
  const y = side === 'left' ? 661.5 : 743.7;
  const cloak = tier >= 2 ? '#4c5843' : '#68523a';
  const armor = tier >= 2 ? '#92958a' : '#9a7b51';
  return `<g class="village-sentry" data-sentry="${side}" transform="translate(${x} ${y})"><ellipse cy="1" rx="12" ry="4" fill="#292c21" opacity=".35"/><path d="M-7-41Q0-46 8-41l5 29-12 5-12-6Z" fill="${cloak}" stroke="#343c2b" stroke-width="1.3"/><path d="M-5-20-7-3-2-1 1-20m3 0 2 17 5 1-1-19" fill="#514b3c" stroke="#302f29" stroke-width="1.5"/><path d="M-8-3h7v4h-10Zm14 1h7l2 3H5Z" fill="#342e26"/><path d="M-6-41 6-42l3 20-8 4-8-4Z" fill="${armor}" stroke="#514e40" stroke-width="1.2"/><path d="M-6-31H7m-7-10v19m-7 16h14" stroke="${tier >= 2 ? '#c1bda9' : '#c6a572'}" stroke-opacity=".65" stroke-width="1.4"/><path d="M-7-39-12-28-8-21m15-18 8 12 1 9" fill="none" stroke="${cloak}" stroke-width="5" stroke-linecap="round"/><circle cx="-8" cy="-20" r="2.3" fill="#b79c77"/><circle cx="16" cy="-18" r="2.3" fill="#b79c77"/><path d="M0-45v5" stroke="#baa17c" stroke-width="4"/><ellipse cy="-51" rx="4.8" ry="6.3" fill="#bda17d"/><path d="M-5-51q-1-10 5-10t5 10l-4-1-2 7-2-7Z" fill="${tier >= 2 ? '#93978e' : '#715c43'}" stroke="#3d4137" stroke-width="1"/><path d="M3-50h2" stroke="#4f4b3d" stroke-width="1"/><path d="M18 3v-77" stroke="#664a30" stroke-width="2.4"/><path d="m18-83-3 10h6Z" fill="#b7bbaf" stroke="#495044" stroke-width=".8"/>${tier === 3 ? '<path d="M-2-62q3-7 7-5" fill="none" stroke="#9d6846" stroke-width="2.4"/>' : ''}</g>`;
}

export function villageFortifications(state) {
  const level = state.walls?.level || 1;
  const tier = visualTier(level);
  return `<g class="village-fortifications" aria-hidden="true" pointer-events="none"><defs><linearGradient id="fortification-stone" x2=".3" y2="1"><stop stop-color="#bdb49b"/><stop offset=".6" stop-color="#918b78"/><stop offset="1" stop-color="#746f60"/></linearGradient><linearGradient id="fortification-timber" x2="1" y2=".2"><stop stop-color="#6c4e31"/><stop offset=".45" stop-color="#ae8852"/><stop offset="1" stop-color="#765536"/></linearGradient></defs><g class="village-gate-road"><path d="M460 613Q435 657 403 713T348 827q-15 57 24 108" fill="none" stroke="#5e553c" stroke-opacity=".28" stroke-width="83" stroke-linecap="round"/><path d="M460 613Q435 657 403 713T348 827q-15 57 24 108" fill="none" stroke="#b3a17a" stroke-opacity=".75" stroke-width="65" stroke-linecap="round"/><path d="M445 641q-29 49-47 88m-11 26-22 54m-9 38q-4 46 17 77" fill="none" stroke="#cdbb91" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/></g>${perimeter(level)}${gate(tier)}${sentry('left', tier)}${sentry('right', tier)}</g>`;
}
