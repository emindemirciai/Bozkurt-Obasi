export const VILLAGE_ZOOM = Object.freeze({ min: 1, max: 2.5, step: 0.25 });
const WIDTH = 1440;
const HEIGHT = 980;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

/** Decorative SVG layers share the camera, but never intercept a plot or alter game data. */
export function villageAtmosphere() {
  const river =
    'M1294 128C1308 181 1372 184 1380 253S1427 351 1413 425S1439 500 1397 559S1302 626 1284 691S1200 783 1167 839S1108 938 1090 1020';
  const rain = Array.from({ length: 72 }, (_, index) => {
    const x = 26 + (index % 12) * 131;
    const y = -180 + Math.floor(index / 12) * 237;
    return '<path d="M' + x + ' ' + y + 'l-64 183"/>';
  }).join('');
  const stones = [
    [1272, 48, 25, 15],
    [1294, 91, 17, 10],
    [1262, 114, 16, 10],
    [1322, 147, 15, 8],
    [1330, 201, 11, 7],
    [1406, 243, 13, 8],
    [1372, 330, 10, 6],
    [1440, 381, 16, 9],
    [1387, 447, 12, 7],
    [1431, 527, 14, 8],
    [1360, 580, 13, 7],
    [1325, 643, 11, 7],
    [1257, 708, 15, 8],
    [1242, 780, 10, 6],
    [1138, 850, 12, 7],
    [1142, 915, 14, 8],
    [1061, 966, 11, 6],
  ]
    .map(
      ([x, y, rx, ry], index) =>
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') rotate(' +
        (index % 3) * 23 +
        ')"><ellipse cy="4" rx="' +
        (rx + 3) +
        '" ry="' +
        ry +
        '" fill="#383b2a" opacity=".24"/><path d="M' +
        -rx +
        ' 0L' +
        -rx * 0.6 +
        ' ' +
        -ry +
        'L' +
        rx * 0.5 +
        ' ' +
        -ry * 0.8 +
        'L' +
        rx +
        ' 0L' +
        rx * 0.4 +
        ' ' +
        ry +
        'L' +
        -rx * 0.7 +
        ' ' +
        ry * 0.65 +
        'Z" fill="url(#village-river-rock)"/><path d="M' +
        -rx * 0.6 +
        ' ' +
        -ry +
        'L0 1L' +
        rx * 0.5 +
        ' ' +
        -ry * 0.8 +
        '" fill="none" stroke="#ddd0ae" stroke-width="1.5" opacity=".5"/></g>',
    )
    .join('');
  const reeds = [
    [1304, 168],
    [1350, 222],
    [1400, 294],
    [1386, 371],
    [1435, 468],
    [1373, 531],
    [1358, 615],
    [1265, 665],
    [1297, 715],
    [1205, 819],
    [1128, 885],
    [1114, 975],
  ]
    .map(
      ([x, y], index) =>
        '<g class="village-reeds" transform="translate(' +
        x +
        ' ' +
        y +
        ')"><ellipse rx="15" ry="5" fill="#555a36" opacity=".35"/><path d="M0 1Q-8-9-13-16M-2 0Q0-14-2-24M2 1Q5-12 12-18M5 3Q13-4 16-9" fill="none" stroke="' +
        (index % 2 ? '#616f40' : '#78834c') +
        '" stroke-width="3" stroke-linecap="round"/><path d="M-1 0L1-17M3 1L9-11" stroke="#b4ae69" stroke-width="1.1"/></g>',
    )
    .join('');
  return `<g class="village-weather" aria-hidden="true" pointer-events="none">
    <defs>
      <linearGradient id="village-water" x1="0" y1="0" x2="1" y2=".2"><stop stop-color="#4e7470"/><stop offset=".35" stop-color="#6f958c"/><stop offset=".7" stop-color="#4e7b79"/><stop offset="1" stop-color="#94aaa0"/></linearGradient>
      <linearGradient id="village-river-rock" x2=".35" y2="1"><stop stop-color="#aaa58d"/><stop offset=".45" stop-color="#85856e"/><stop offset="1" stop-color="#555a48"/></linearGradient>
      <radialGradient id="village-cloud-light"><stop stop-color="#f3efd8" stop-opacity=".6"/><stop offset=".6" stop-color="#e8e4d1" stop-opacity=".25"/><stop offset="1" stop-color="#e9e4ce" stop-opacity="0"/></radialGradient>
      <radialGradient id="village-cloud-shadow"><stop stop-color="#354334" stop-opacity=".37"/><stop offset=".7" stop-color="#3d4b3a" stop-opacity=".14"/><stop offset="1" stop-color="#3d4b3a" stop-opacity="0"/></radialGradient>
      <linearGradient id="village-rain-tint" x2=".3" y2="1"><stop stop-color="#273f42" stop-opacity=".44"/><stop offset=".7" stop-color="#687a73" stop-opacity=".22"/><stop offset="1" stop-color="#829288" stop-opacity=".12"/></linearGradient>
      <filter id="village-soft-water"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <g class="village-river" data-village-river>
      <path d="${river}" fill="none" stroke="#3e4833" stroke-width="78" stroke-opacity=".4"/>
      <path d="${river}" fill="none" stroke="#85876a" stroke-width="65" stroke-opacity=".78"/>
      <path d="${river}" fill="none" stroke="#b4ae89" stroke-width="55" stroke-opacity=".8"/>
      <path class="village-river-channel" d="${river}" fill="none" stroke="url(#village-water)" stroke-width="44" stroke-linecap="round"/>
      <path class="village-river-depth" d="${river}" fill="none" stroke="#315d5a" stroke-opacity=".24" stroke-width="20"/>
      <path class="village-river-current" d="${river}" fill="none" stroke="#dbe4ce" stroke-opacity=".56" stroke-width="3.2" stroke-dasharray="25 38 8 55" stroke-linecap="round"/>
      <path class="village-river-current village-river-current-secondary" d="${river}" transform="translate(8 -2)" fill="none" stroke="#b7d3c8" stroke-opacity=".4" stroke-width="1.6" stroke-dasharray="12 57 24 49" stroke-linecap="round"/>
      <g class="village-river-ripples" fill="none" stroke="#d4dfcb" stroke-width="2" stroke-opacity=".55"><path d="M1370 244q13 7 24-2M1403 412q12 8 23 1M1385 558q9 10 21 7M1274 697q10 8 23 6M1155 848q12 8 23 5"/><path d="M1370 249q8 6 15 3M1390 566q7 5 12 4M1276 704q5 4 12 3" stroke-width="1"/></g>
      <g class="village-river-shore">${stones}${reeds}</g>
    </g>
    <g class="village-waterfall">
      <path d="M1264 28l28 16 7 40-12 28 16 26-26 12-23-31 8-27-9-30Z" fill="#626955" opacity=".8"/>
      <path d="M1272 42c9 25-1 43 8 64s10 18 14 30" fill="none" stroke="#3d5049" stroke-width="27" stroke-linecap="round"/>
      <path d="M1272 42c9 25-1 43 8 64s10 18 14 30" fill="none" stroke="url(#village-water)" stroke-width="19" stroke-linecap="round"/>
      <path class="village-waterfall-flow" d="M1272 42c9 25-1 43 8 64s10 18 14 30" fill="none" stroke="#e2e8d7" stroke-opacity=".85" stroke-width="8" stroke-dasharray="9 9" stroke-linecap="round"/>
      <path class="village-waterfall-flow village-waterfall-fine" d="M1267 44c7 24-1 42 9 65s9 19 13 29" fill="none" stroke="#f0f1de" stroke-opacity=".7" stroke-width="2" stroke-dasharray="4 11"/>
      <ellipse cx="1294" cy="138" rx="25" ry="10" fill="#dce5ce" opacity=".35" filter="url(#village-soft-water)"/>
      <ellipse class="village-waterfall-foam" cx="1294" cy="138" rx="22" ry="7" fill="none" stroke="#e7ead7" stroke-opacity=".74" stroke-width="2.5"/>
      <ellipse class="village-waterfall-foam village-waterfall-foam-delayed" cx="1296" cy="145" rx="16" ry="5" fill="none" stroke="#d9e4d1" stroke-opacity=".6" stroke-width="1.5"/>
    </g>
    <g class="village-sunlight"><path d="M900-100L1230-100 670 1100 460 1100Z" fill="#f5dc9a" opacity=".07"/><path d="M1030-100L1140-100 580 1100 490 1100Z" fill="#fff1bd" opacity=".09"/></g>
    <g class="village-cloud"><ellipse cx="280" cy="155" rx="340" ry="145" fill="url(#village-cloud-shadow)"/><ellipse cx="310" cy="107" rx="300" ry="120" fill="url(#village-cloud-light)"/><ellipse cx="1100" cy="685" rx="300" ry="150" fill="url(#village-cloud-shadow)"/><ellipse cx="1150" cy="610" rx="310" ry="120" fill="url(#village-cloud-light)"/></g>
    <rect class="village-rain-haze" x="-900" y="-700" width="3240" height="2380" fill="url(#village-rain-tint)"/>
    <g class="village-rain" fill="none" stroke="#d5e4dd" stroke-width="2.7" stroke-dasharray="18 38" stroke-opacity=".64">${rain}</g>
    <g class="village-dust" fill="#ecd49d" opacity=".62"><circle cx="310" cy="730" r="2.5"/><circle cx="510" cy="215" r="2"/><circle cx="955" cy="625" r="2.5"/><circle cx="1160" cy="390" r="2"/><circle cx="220" cy="440" r="2"/><circle cx="745" cy="850" r="2"/></g>
  </g>`;
}

const symbol = (path) =>
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="' +
  path +
  '"/></svg>';

export function villageCameraControls({ t }) {
  return `<div class="zoom-controls village-zoom-controls" role="group" aria-label="${escape(t('villageCameraControls'))}"><button class="icon-button" data-action="zoomIn" aria-label="${escape(t('zoomIn'))}">${symbol('M12 5v14M5 12h14')}</button><button class="icon-button" data-action="zoomOut" aria-label="${escape(t('zoomOut'))}">${symbol('M5 12h14')}</button><span></span><button class="icon-button" data-action="resetZoom" aria-label="${escape(t('resetView'))}">${symbol('M12 3v4m0 10v4M3 12h4m10 0h4M19 12a7 7 0 1 0-14 0 7 7 0 0 0 14 0')}</button><button class="icon-button" data-action="fullscreen" aria-label="${escape(t('expand'))}">${symbol('M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5')}</button></div><div class="village-environment-controls"><button type="button" data-camera-action="weather" title="${escape(t('villageWeatherLabel'))}"></button><button type="button" data-camera-action="motion"></button></div><p class="village-camera-help"><span data-camera-scale>1×</span> · ${escape(t('villagePanHint'))}</p>`;
}

/** A local SVG camera: fixed viewport, no scroll container, no server or persistent save mutation. */
export function mountVillageCamera(
  viewport,
  { saved = {}, t, onChange = () => {}, canInteract = () => true } = {},
) {
  const svg = viewport?.querySelector('.settlement-scene');
  if (!svg) return null;
  const state = {
    zoom: clamp(Number(saved.zoom) || 1, VILLAGE_ZOOM.min, VILLAGE_ZOOM.max),
    centerX: Number.isFinite(saved.centerX) ? saved.centerX : WIDTH / 2,
    centerY: Number.isFinite(saved.centerY) ? saved.centerY : HEIGHT / 2,
    motion: saved.motion !== false,
    weather: saved.weather === 'rain' ? 'rain' : 'clear',
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointers = new Map();
  const cleanups = [];
  let viewWidth = WIDTH,
    viewHeight = HEIGHT,
    dragged = false,
    suppressClick = false;
  let lastPinch = null,
    suppressionTimer = null;
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'group');
  viewport.setAttribute('aria-label', t('villageCameraHelp'));
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    cleanups.push(() => target.removeEventListener(name, handler, options));
  };
  const snapshot = () => ({ ...state });
  function apply() {
    const aspect = Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight);
    const fitWidth = Math.max(WIDTH, HEIGHT * aspect);
    const fitHeight = fitWidth / aspect;
    viewWidth = fitWidth / state.zoom;
    viewHeight = fitHeight / state.zoom;
    const canvasX = (WIDTH - fitWidth) / 2;
    const canvasY = (HEIGHT - fitHeight) / 2;
    state.centerX = clamp(
      state.centerX,
      canvasX + viewWidth / 2,
      canvasX + fitWidth - viewWidth / 2,
    );
    state.centerY = clamp(
      state.centerY,
      canvasY + viewHeight / 2,
      canvasY + fitHeight - viewHeight / 2,
    );
    const backdrop = svg.querySelector('.village-world-backdrop');
    if (backdrop) {
      backdrop.setAttribute('x', String(canvasX));
      backdrop.setAttribute('y', String(canvasY));
      backdrop.setAttribute('width', String(fitWidth));
      backdrop.setAttribute('height', String(fitHeight));
    }
    svg.setAttribute(
      'viewBox',
      [state.centerX - viewWidth / 2, state.centerY - viewHeight / 2, viewWidth, viewHeight].join(
        ' ',
      ),
    );
    viewport.dataset.cameraZoom = String(state.zoom);
    viewport.dataset.motion = state.motion && !reduced.matches ? 'on' : 'off';
    viewport.dataset.weather = state.weather;
    viewport.dataset.canPan = String(state.zoom > VILLAGE_ZOOM.min);
    const plus = viewport.querySelector('[data-action="zoomIn"]');
    const minus = viewport.querySelector('[data-action="zoomOut"]');
    if (plus) plus.disabled = state.zoom >= VILLAGE_ZOOM.max;
    if (minus) minus.disabled = state.zoom <= VILLAGE_ZOOM.min;
    const scale = viewport.querySelector('[data-camera-scale]');
    if (scale)
      scale.textContent =
        state.zoom.toLocaleString(document.documentElement.lang === 'tr' ? 'tr-TR' : 'en-US', {
          maximumFractionDigits: 2,
        }) + '×';
    const weather = viewport.querySelector('[data-camera-action="weather"]');
    if (weather) {
      const label = t(state.weather === 'rain' ? 'villageRain' : 'villageClear');
      if (weather.dataset.weatherState !== state.weather) {
        const path =
          state.weather === 'rain'
            ? 'M6 15a4 4 0 0 1-1-7 6 6 0 0 1 11-1 4 4 0 0 1 1 8M8 17l-1 3m6-3-1 3m6-3-1 3'
            : 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5';
        weather.innerHTML =
          symbol(path) + '<span data-camera-weather-label>' + escape(label) + '</span>';
        weather.dataset.weatherState = state.weather;
      } else {
        weather.querySelector('[data-camera-weather-label]').textContent = label;
      }
      weather.setAttribute('aria-label', t('villageWeatherLabel') + ': ' + label);
      weather.setAttribute('aria-pressed', String(state.weather === 'rain'));
    }
    const motion = viewport.querySelector('[data-camera-action="motion"]');
    if (motion) {
      motion.textContent = viewport.dataset.motion === 'on' ? 'Ⅱ' : '▷';
      motion.setAttribute('aria-pressed', String(viewport.dataset.motion === 'on'));
      motion.setAttribute(
        'aria-label',
        t(
          reduced.matches
            ? 'villageMotionReduced'
            : state.motion
              ? 'villagePauseMotion'
              : 'villageResumeMotion',
        ),
      );
      motion.title = motion.getAttribute('aria-label');
      motion.disabled = reduced.matches;
    }
    onChange(snapshot());
  }
  function zoomTo(value, clientX, clientY) {
    const next = clamp(Math.round(value * 1000) / 1000, VILLAGE_ZOOM.min, VILLAGE_ZOOM.max);
    if (next === state.zoom) return;
    const rect = viewport.getBoundingClientRect();
    const fractionX = clientX === undefined ? 0 : (clientX - rect.left) / rect.width - 0.5;
    const fractionY = clientY === undefined ? 0 : (clientY - rect.top) / rect.height - 0.5;
    state.centerX += fractionX * viewWidth * (1 - state.zoom / next);
    state.centerY += fractionY * viewHeight * (1 - state.zoom / next);
    state.zoom = next;
    apply();
  }
  function pan(dx, dy) {
    state.centerX -= (dx * viewWidth) / Math.max(1, viewport.clientWidth);
    state.centerY -= (dy * viewHeight) / Math.max(1, viewport.clientHeight);
    apply();
  }
  listen(
    viewport,
    'click',
    (event) => {
      if (suppressClick && event.detail > 0 && event.target.closest('svg.settlement-scene')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const target = event.target.closest('button');
      const action = target?.dataset.cameraAction || target?.dataset.action;
      if (!['zoomIn', 'zoomOut', 'resetZoom', 'motion', 'weather'].includes(action)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!canInteract() || target.disabled) return;
      if (action === 'zoomIn' || action === 'zoomOut')
        zoomTo(state.zoom + (action === 'zoomIn' ? VILLAGE_ZOOM.step : -VILLAGE_ZOOM.step));
      if (action === 'resetZoom') {
        state.zoom = 1;
        state.centerX = WIDTH / 2;
        state.centerY = HEIGHT / 2;
        apply();
      }
      if (action === 'motion') {
        state.motion = !state.motion;
        apply();
      }
      if (action === 'weather') {
        state.weather = state.weather === 'clear' ? 'rain' : 'clear';
        apply();
      }
    },
    true,
  );
  listen(viewport, 'pointerdown', (event) => {
    if (
      !canInteract() ||
      event.target.closest('button') ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });
    // A tap must retain its original plot/building click target.
    if (pointers.size === 1) dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  listen(viewport, 'pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous || !canInteract()) return;
    pointers.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch > 0)
        zoomTo((state.zoom * distance) / lastPinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      lastPinch = distance;
      dragged = true;
    } else if (
      state.zoom > 1 &&
      (dragged || Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) > 5)
    ) {
      pan(event.clientX - previous.x, event.clientY - previous.y);
      dragged = true;
    }
    if (dragged) {
      viewport.dataset.dragging = 'true';
      if (!viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
    }
  });
  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    lastPinch = null;
    if (!pointers.size) {
      delete viewport.dataset.dragging;
      if (dragged) {
        suppressClick = true;
        clearTimeout(suppressionTimer);
        suppressionTimer = setTimeout(() => {
          suppressClick = false;
        }, 150);
      }
    }
  };
  listen(viewport, 'pointerup', endPointer);
  listen(viewport, 'pointercancel', endPointer);
  listen(
    viewport,
    'wheel',
    (event) => {
      if (!canInteract() || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      zoomTo(state.zoom * Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY);
    },
    { passive: false },
  );
  listen(viewport, 'keydown', (event) => {
    if (!canInteract() || event.target.closest('button')) return;
    if (
      ['+', '=', '-', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      if (event.key === 'Home') {
        state.zoom = 1;
        state.centerX = WIDTH / 2;
        state.centerY = HEIGHT / 2;
        apply();
      } else if (event.key === '+' || event.key === '=') zoomTo(state.zoom + VILLAGE_ZOOM.step);
      else if (event.key === '-') zoomTo(state.zoom - VILLAGE_ZOOM.step);
      else if (state.zoom > 1)
        pan(
          event.key === 'ArrowLeft' ? 45 : event.key === 'ArrowRight' ? -45 : 0,
          event.key === 'ArrowUp' ? 45 : event.key === 'ArrowDown' ? -45 : 0,
        );
    }
  });
  listen(viewport, 'focusin', (event) => {
    const target = event.target.closest('[data-plot], [data-building]');
    // A pointer press already identifies its visible target; moving it during focus loses the click.
    // Keyboard/programmatic focus still brings distant plots into view.
    if (!target || state.zoom === 1 || pointers.size > 0) return;
    const rect = target.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    if (
      rect.left >= bounds.left + 10 &&
      rect.right <= bounds.right - 10 &&
      rect.top >= bounds.top + 10 &&
      rect.bottom <= bounds.bottom - 10
    )
      return;
    const box = target.getBBox();
    const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
      .matrixTransform(target.getCTM())
      .matrixTransform(svg.getCTM().inverse());
    state.centerX = center.x;
    state.centerY = center.y;
    apply();
  });
  listen(reduced, 'change', apply);
  const observer = new ResizeObserver(apply);
  observer.observe(viewport);
  apply();
  return {
    getState: snapshot,
    reset() {
      state.zoom = 1;
      state.centerX = WIDTH / 2;
      state.centerY = HEIGHT / 2;
      apply();
    },
    destroy() {
      observer.disconnect();
      for (const cleanup of cleanups) cleanup();
      clearTimeout(suppressionTimer);
    },
  };
}
