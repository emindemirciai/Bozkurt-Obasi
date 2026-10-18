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
  const rain = Array.from({ length: 36 }, (_, index) => {
    const x = 70 + (index % 9) * 170;
    const y = -80 + Math.floor(index / 9) * 310;
    return '<path d="M' + x + ' ' + y + 'l-54 220"/>';
  }).join('');
  return `<g class="village-weather" aria-hidden="true" pointer-events="none">
    <defs><linearGradient id="village-water" x2="0" y2="1"><stop stop-color="#c1c8b7"/><stop offset=".5" stop-color="#82998b"/><stop offset="1" stop-color="#b7c4b4"/></linearGradient></defs>
    <g class="village-waterfall" opacity=".8"><path d="M1272 54c9 18-1 27 3 43s8 22 4 36" fill="none" stroke="#3f4a3f" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"/><path d="M1272 54c9 18-1 27 3 43s8 22 4 36" fill="none" stroke="url(#village-water)" stroke-width="3.5" stroke-linecap="round"/><path class="village-waterfall-flow" d="M1272 54c9 18-1 27 3 43s8 22 4 36" fill="none" stroke="#dddccd" stroke-opacity=".65" stroke-width="1.3" stroke-dasharray="2 9"/><ellipse class="village-waterfall-foam" cx="1279" cy="135" rx="9" ry="2.5" fill="none" stroke="#d7dbca" stroke-opacity=".45" stroke-width="1"/></g>
    <g class="village-cloud"><ellipse cx="250" cy="130" rx="240" ry="100" fill="#fff4dc" opacity=".12"/><ellipse cx="1100" cy="690" rx="260" ry="130" fill="#292f26" opacity=".1"/></g>
    <g class="village-rain" fill="none" stroke="#d7e8dd" stroke-width="2.5" stroke-dasharray="7 25" opacity=".5">${rain}</g>
    <g class="village-dust" fill="#e8d3a0" opacity=".65"><circle cx="310" cy="730" r="2"/><circle cx="510" cy="215" r="2"/><circle cx="955" cy="625" r="2.5"/><circle cx="1160" cy="390" r="2"/><circle cx="220" cy="440" r="1.7"/><circle cx="745" cy="850" r="2"/></g>
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
      weather.textContent = t(state.weather === 'rain' ? 'villageRain' : 'villageClear');
      weather.setAttribute('aria-label', t('villageWeatherLabel') + ': ' + weather.textContent);
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
    if (!target || state.zoom === 1) return;
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
