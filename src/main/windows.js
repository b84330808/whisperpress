'use strict';
const { BrowserWindow, screen, session, desktopCapturer, app } = require('electron');
const path = require('path');
const config = require('./config');
const pos = require('./overlay-position');

const ROOT = path.join(__dirname, '..', '..');
let mainWindow = null;
let overlayWindow = null;
let overlayReady = Promise.resolve();
let overlayGoneHandler = null; // set by main: resets dictation if the overlay dies mid-use
let drag = null; // { win, dx, dy, timer, display }

function setupSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    callback(['media', 'audioCapture', 'display-capture'].includes(permission));
  });
  // System-audio loopback for meeting recording (Windows WASAPI loopback).
  ses.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    }).catch(() => callback({}));
  }, { useSystemPicker: false });
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: '#0f0e14',
    autoHideMenuBar: true,
    icon: path.join(ROOT, 'assets', 'app.ico'),
    webPreferences: {
      preload: path.join(ROOT, 'src', 'preload', 'main-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(ROOT, 'src', 'renderer', 'main', 'index.html'));
  mainWindow.on('close', (e) => {
    if (config.get().closeToTray && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  const w = new BrowserWindow({
    width: pos.OVERLAY_W,
    height: pos.OVERLAY_H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'src', 'preload', 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayReady = new Promise((resolve) => w.webContents.once('did-finish-load', resolve));
  w.loadFile(path.join(ROOT, 'src', 'renderer', 'overlay', 'overlay.html'));
  w.on('closed', () => { if (overlayWindow === w) overlayWindow = null; });
  // The overlay also records the microphone: if its page crashes, commands would vanish
  // and dictation would wait forever. Replace it and let main reset. (A hung page is
  // caught by dictation's wait-for-audio timeout instead: 'unresponsive' also fires
  // while a very long recording is being encoded.)
  const lost = (why) => {
    if (overlayWindow !== w) return;
    console.error(`[overlay] ${why}; recreating the window`);
    const wasVisible = !w.isDestroyed() && w.isVisible();
    overlayWindow = null;
    endDrag(false);
    if (!w.isDestroyed()) w.destroy();
    createOverlayWindow();
    if (overlayGoneHandler) overlayGoneHandler(why, wasVisible);
  };
  w.webContents.on('render-process-gone', (e, details) => lost(`renderer gone (${details.reason})`));
  overlayWindow = w;
  return w;
}

function onOverlayGone(handler) { overlayGoneHandler = handler; }

// Commands wait for the overlay page to load, so none are lost on a freshly created window.
function sendOverlay(payload) {
  const w = createOverlayWindow();
  if (!w.webContents.isLoading()) { w.webContents.send('overlay:cmd', payload); return; }
  const ready = overlayReady;
  ready.then(() => { if (!w.isDestroyed()) w.webContents.send('overlay:cmd', payload); });
}

// Bounds for the overlay on the display the user is working on (the one with the cursor).
function overlayPlacement() {
  const cfg = config.get();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const position = pos.normalizePosition(cfg.overlayPosition);
  return {
    bounds: pos.overlayBounds(display.workArea, position, cfg.overlayCustom),
    align: pos.alignmentFor(position),
  };
}

function showOverlay() {
  const w = createOverlayWindow();
  if (drag && drag.win === w) { if (!w.isVisible()) w.showInactive(); return; }
  const { bounds, align } = overlayPlacement();
  w.setBounds(bounds);
  sendOverlay({ cmd: 'layout', ...align });
  if (!w.isVisible()) w.showInactive();
}

// Settings or displays changed: move a visible overlay to its new place.
function repositionOverlay() {
  const w = overlayWindow;
  if (!w || w.isDestroyed() || !w.isVisible() || drag) return;
  showOverlay();
}

// On Windows a long-lived transparent overlay can silently stop presenting frames: the page
// keeps rendering but nothing reaches the screen, and only a new window recovers. So each
// used overlay is replaced by a fresh (hidden, preloaded) one once it hides.
function hideOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;
  endDrag(true);
  const used = overlayWindow;
  used.hide();
  overlayWindow = null;
  used.destroy();
  createOverlayWindow();
}

// The idle, preloaded overlay can outlive a sleep, a GPU reset or a display change, which
// is exactly what breaks frame presentation. Swap it for a fresh one (never while shown).
function replaceIdleOverlay() {
  const w = overlayWindow;
  if (w && !w.isDestroyed() && w.isVisible()) return false;
  overlayWindow = null;
  if (w && !w.isDestroyed()) w.destroy();
  createOverlayWindow();
  return true;
}

// ---------------- dragging the pill ----------------
// The overlay never takes focus (so text still lands in the app you were using), which
// rules out the native title-bar drag. Instead the page reports "drag started/ended"
// and main moves the window with the global cursor, in DIPs, on any display.
function startDrag() {
  const w = overlayWindow;
  if (!w || w.isDestroyed() || !w.isVisible() || drag) return;
  const cur = screen.getCursorScreenPoint();
  const b = w.getBounds();
  drag = { win: w, dx: cur.x - b.x, dy: cur.y - b.y, startedAt: Date.now(), timer: null };
  const hotkeys = require('./hotkeys');
  drag.onMouseUp = () => endDrag(true); // global mouse-up, in case the page misses it
  hotkeys.on('mouseup', drag.onMouseUp);
  drag.timer = setInterval(() => {
    if (!drag || drag.win.isDestroyed()) { endDrag(false); return; }
    if (Date.now() - drag.startedAt > 60000) { endDrag(true); return; }
    const c = screen.getCursorScreenPoint();
    const wa = screen.getDisplayNearestPoint(c).workArea;
    const p = pos.clampToWorkArea(wa, { x: c.x - drag.dx, y: c.y - drag.dy });
    const cb = drag.win.getBounds();
    if (cb.x !== p.x || cb.y !== p.y) drag.win.setBounds({ x: p.x, y: p.y, width: pos.OVERLAY_W, height: pos.OVERLAY_H });
  }, 16);
}

function endDrag(save) {
  if (!drag) return;
  const d = drag;
  drag = null;
  clearInterval(d.timer);
  require('./hotkeys').removeListener('mouseup', d.onMouseUp);
  if (!save || d.win.isDestroyed()) return;
  const b = d.win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  config.set({ overlayPosition: 'custom', overlayCustom: pos.customFromBounds(wa, b) });
  // the pill is centered in the window for custom positions
  if (!d.win.isDestroyed()) d.win.webContents.send('overlay:cmd', { cmd: 'layout', h: 'center' });
}

function showMain(view) {
  const w = createMainWindow();
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
  if (view) w.webContents.send('app:navigate', view);
}

function broadcast(channel, payload) {
  for (const w of [mainWindow, overlayWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

module.exports = {
  setupSession,
  createMainWindow,
  createOverlayWindow,
  showOverlay,
  hideOverlay,
  repositionOverlay,
  replaceIdleOverlay,
  onOverlayGone,
  startDrag,
  endDrag,
  sendOverlay,
  showMain,
  broadcast,
  get main() { return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null; },
  get overlay() { return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : null; },
};
