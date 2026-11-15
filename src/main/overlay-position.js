'use strict';
// Where the recording pill goes. Pure math (no Electron) so it can be unit-tested.
//
// The overlay window is a little larger than the pill so its shadow fits; the pill is
// centered vertically and aligned left/center/right inside it. Presets keep the pill
// 34 px from the work-area edges, which is exactly where the bottom-center pill has
// always been. A dragged position is stored as fractions of the free space on the
// display (0 = flush left/top, 1 = flush right/bottom), so it applies to any monitor
// and can never end up off-screen.

const OVERLAY_W = 400;
const OVERLAY_H = 96;
const MARGIN_X = 20; // window edge to work-area edge; the pill sits 14 px further in
const MARGIN_Y = 18; // the pill sits 16 px further in (34 px, as before)
const SNAP_PX = 24; // a dragged pill this close to the horizontal center snaps to it

const DEFAULT_POSITION = 'bottom-center';
const PRESETS = ['bottom-center', 'top-center', 'bottom-left', 'bottom-right', 'top-left', 'top-right'];
const POSITIONS = [...PRESETS, 'custom'];

function normalizePosition(value) {
  return POSITIONS.includes(value) ? value : DEFAULT_POSITION;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

// {x, y} fractions, or null when missing/invalid
function normalizeCustom(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

// Sanitize the overlay keys of a settings object read from disk.
function normalizeOverlaySettings(data) {
  const overlayPosition = normalizePosition(data && data.overlayPosition);
  const overlayCustom = normalizeCustom(data && data.overlayCustom);
  return { overlayPosition, overlayCustom };
}

// How the pill is aligned inside the window: { h: 'left'|'center'|'right' }
function alignmentFor(position) {
  const p = normalizePosition(position);
  if (p.endsWith('-left')) return { h: 'left' };
  if (p.endsWith('-right')) return { h: 'right' };
  return { h: 'center' };
}

// Window bounds for a position on a display's work area ({x, y, width, height}).
function overlayBounds(workArea, position, custom) {
  const wa = workArea;
  const freeX = Math.max(0, wa.width - OVERLAY_W);
  const freeY = Math.max(0, wa.height - OVERLAY_H);
  let p = normalizePosition(position);
  const c = normalizeCustom(custom);
  if (p === 'custom' && !c) p = DEFAULT_POSITION;
  let x;
  let y;
  if (p === 'custom') {
    x = wa.x + freeX * c.x;
    y = wa.y + freeY * c.y;
  } else {
    const [v, h] = p.split('-');
    if (h === 'left') x = wa.x + Math.min(MARGIN_X, freeX);
    else if (h === 'right') x = wa.x + Math.max(0, freeX - MARGIN_X);
    else x = wa.x + freeX / 2;
    y = v === 'top' ? wa.y + Math.min(MARGIN_Y, freeY) : wa.y + Math.max(0, freeY - MARGIN_Y);
  }
  return { x: Math.round(x), y: Math.round(y), width: OVERLAY_W, height: OVERLAY_H };
}

// Keep a window position (top-left) inside the work area; snap to the horizontal center.
function clampToWorkArea(workArea, pos) {
  const wa = workArea;
  const maxX = wa.x + Math.max(0, wa.width - OVERLAY_W);
  const maxY = wa.y + Math.max(0, wa.height - OVERLAY_H);
  let x = Math.min(maxX, Math.max(wa.x, pos.x));
  const y = Math.min(maxY, Math.max(wa.y, pos.y));
  const centerX = wa.x + (wa.width - OVERLAY_W) / 2;
  if (Math.abs(x - centerX) <= SNAP_PX) x = centerX;
  return { x: Math.round(x), y: Math.round(y) };
}

// Fractions to store after a drag ended with the window at `pos` on this work area.
function customFromBounds(workArea, pos) {
  const wa = workArea;
  const freeX = Math.max(0, wa.width - OVERLAY_W);
  const freeY = Math.max(0, wa.height - OVERLAY_H);
  const round = (n) => Math.round(n * 10000) / 10000;
  return {
    x: freeX ? round(clamp01((pos.x - wa.x) / freeX)) : 0.5,
    y: freeY ? round(clamp01((pos.y - wa.y) / freeY)) : 1,
  };
}

module.exports = {
  OVERLAY_W,
  OVERLAY_H,
  DEFAULT_POSITION,
  PRESETS,
  POSITIONS,
  normalizePosition,
  normalizeCustom,
  normalizeOverlaySettings,
  alignmentFor,
  overlayBounds,
  clampToWorkArea,
  customFromBounds,
};
