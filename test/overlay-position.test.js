'use strict';
// Run with `npm test` (node --test). Where the recording pill goes, and how a dragged
// position is stored and validated.
const test = require('node:test');
const assert = require('node:assert/strict');
const pos = require('../src/main/overlay-position');

const FHD = { x: 0, y: 0, width: 1920, height: 1040 }; // 1080p minus a 40 px taskbar
const PORTRAIT_LEFT = { x: -1080, y: -400, width: 1080, height: 1880 }; // secondary monitor

// The pill is 64 px tall and sits 16 px below the window's top edge.
const pillTop = (b) => b.y + 16;
const pillBottom = (b) => b.y + 16 + 64;

test('position: default stays exactly where the pill always was', () => {
  const b = pos.overlayBounds(FHD, 'bottom-center', null);
  // before: a 380x130 window at bottom - 150 with the pill 14 px above its bottom edge
  assert.equal(pillBottom(b), FHD.height - 150 + 130 - 14);
  assert.equal(b.x + b.width / 2, FHD.width / 2);
  assert.deepEqual([b.width, b.height], [pos.OVERLAY_W, pos.OVERLAY_H]);
});

test('position: presets keep the pill 34 px from the work-area edges', () => {
  const top = pos.overlayBounds(FHD, 'top-center', null);
  assert.equal(pillTop(top) - FHD.y, 34);
  const bl = pos.overlayBounds(FHD, 'bottom-left', null);
  assert.equal(bl.x + 14 - FHD.x, 34); // pill is left-aligned 14 px inside the window
  assert.equal(FHD.y + FHD.height - pillBottom(bl), 34);
  const tr = pos.overlayBounds(FHD, 'top-right', null);
  assert.equal(FHD.x + FHD.width - (tr.x + tr.width - 14), 34);
  assert.deepEqual(pos.alignmentFor('top-right'), { h: 'right' });
  assert.deepEqual(pos.alignmentFor('bottom-left'), { h: 'left' });
  assert.deepEqual(pos.alignmentFor('custom'), { h: 'center' });
});

test('position: works on a display with negative coordinates', () => {
  const b = pos.overlayBounds(PORTRAIT_LEFT, 'top-left', null);
  assert.equal(b.x, PORTRAIT_LEFT.x + 20);
  assert.equal(b.y, PORTRAIT_LEFT.y + 18);
  const c = pos.overlayBounds(PORTRAIT_LEFT, 'bottom-center', null);
  assert.equal(c.x, PORTRAIT_LEFT.x + (1080 - pos.OVERLAY_W) / 2);
});

test('position: custom fractions map onto any display and stay on screen', () => {
  const custom = { x: 1, y: 0 }; // flush top-right
  const a = pos.overlayBounds(FHD, 'custom', custom);
  assert.deepEqual([a.x, a.y], [FHD.width - pos.OVERLAY_W, 0]);
  const b = pos.overlayBounds(PORTRAIT_LEFT, 'custom', custom);
  assert.deepEqual([b.x, b.y], [PORTRAIT_LEFT.x + PORTRAIT_LEFT.width - pos.OVERLAY_W, PORTRAIT_LEFT.y]);
  // custom without a stored spot falls back to the default
  assert.deepEqual(pos.overlayBounds(FHD, 'custom', null), pos.overlayBounds(FHD, 'bottom-center', null));
});

test('position: a dragged spot round-trips through the stored fractions', () => {
  for (const wa of [FHD, PORTRAIT_LEFT]) {
    for (const p of [{ x: wa.x + 37, y: wa.y + 512 }, { x: wa.x, y: wa.y }, { x: wa.x + wa.width - pos.OVERLAY_W, y: wa.y + wa.height - pos.OVERLAY_H }]) {
      const frac = pos.customFromBounds(wa, p);
      const back = pos.overlayBounds(wa, 'custom', frac);
      assert.ok(Math.abs(back.x - p.x) <= 1 && Math.abs(back.y - p.y) <= 1, JSON.stringify({ wa, p, frac, back }));
    }
  }
});

test('position: dragging clamps to the work area and snaps to the center line', () => {
  assert.deepEqual(pos.clampToWorkArea(FHD, { x: -300, y: 5000 }), { x: 0, y: FHD.height - pos.OVERLAY_H });
  assert.deepEqual(pos.clampToWorkArea(FHD, { x: 99999, y: -10 }), { x: FHD.width - pos.OVERLAY_W, y: 0 });
  const center = (FHD.width - pos.OVERLAY_W) / 2;
  assert.equal(pos.clampToWorkArea(FHD, { x: center + 20, y: 300 }).x, center);
  assert.equal(pos.clampToWorkArea(FHD, { x: center - 30, y: 300 }).x, center - 30);
});

test('position: a work area smaller than the window does not break', () => {
  const tiny = { x: 10, y: 10, width: 300, height: 80 };
  for (const p of pos.POSITIONS) {
    const b = pos.overlayBounds(tiny, p, { x: 0.5, y: 0.5 });
    assert.deepEqual([b.x, b.y], [10, 10], p);
  }
  assert.deepEqual(pos.customFromBounds(tiny, { x: 10, y: 10 }), { x: 0.5, y: 1 });
});

test('settings: overlay keys from disk are validated', () => {
  assert.deepEqual(pos.normalizeOverlaySettings({}), { overlayPosition: 'bottom-center', overlayCustom: null });
  assert.deepEqual(pos.normalizeOverlaySettings({ overlayPosition: 'middle', overlayCustom: 'x' }), { overlayPosition: 'bottom-center', overlayCustom: null });
  assert.deepEqual(pos.normalizeOverlaySettings({ overlayPosition: 'top-left', overlayCustom: { x: 2, y: -1 } }), { overlayPosition: 'top-left', overlayCustom: { x: 1, y: 0 } });
  assert.deepEqual(pos.normalizeOverlaySettings({ overlayPosition: 'custom', overlayCustom: { x: '0.25', y: 0.75 } }), { overlayPosition: 'custom', overlayCustom: { x: 0.25, y: 0.75 } });
  assert.equal(pos.normalizeCustom({ x: NaN, y: 0 }), null);
  assert.equal(pos.normalizeCustom(null), null);
  for (const p of pos.POSITIONS) assert.equal(pos.normalizePosition(p), p);
});
