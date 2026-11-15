'use strict';
const { EventEmitter } = require('events');
const config = require('./config');

let uIOhook = null;
let UiohookKey = null;
try {
  ({ uIOhook, UiohookKey } = require('uiohook-napi'));
} catch (e) {
  console.error('uiohook-napi failed to load:', e.message);
}

const MODIFIER_CODES = new Set();
const KEY_NAMES = {};
if (UiohookKey) {
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (!(code in KEY_NAMES)) KEY_NAMES[code] = name;
  }
  for (const n of ['Ctrl', 'CtrlRight', 'Shift', 'ShiftRight', 'Alt', 'AltRight', 'Meta', 'MetaRight']) {
    if (UiohookKey[n] != null) MODIFIER_CODES.add(UiohookKey[n]);
  }
}

function comboLabel(e) {
  const parts = [];
  const isMod = MODIFIER_CODES.has(e.keycode);
  if (e.ctrlKey && !(isMod && /Ctrl/.test(KEY_NAMES[e.keycode] || ''))) parts.push('Ctrl');
  if (e.altKey && !(isMod && /Alt/.test(KEY_NAMES[e.keycode] || ''))) parts.push('Alt');
  if (e.shiftKey && !(isMod && /Shift/.test(KEY_NAMES[e.keycode] || ''))) parts.push('Shift');
  if (e.metaKey && !(isMod && /Meta/.test(KEY_NAMES[e.keycode] || ''))) parts.push('Win');
  let name = KEY_NAMES[e.keycode] || `Key${e.keycode}`;
  name = name.replace('Right', ' (Right)').replace('Meta', 'Win');
  parts.push(name);
  return parts.join('+');
}

// Global push-to-talk state machine on top of uiohook's passive keyboard hook.
class Hotkeys extends EventEmitter {
  constructor() {
    super();
    this.available = !!uIOhook;
    this.ptt = 'idle'; // idle | held | locked | ignored (a refused press, until key-up)
    this.downAt = 0;
    this.capture = null; // {resolve, candidate}
    this.started = false;
    this.listening = false;
    this.lastEventAt = 0; // last keyboard/mouse event seen by the hook (liveness)
    this.pausedUntil = 0; // ignore new recordings until then (just woke up)
    this.lastHealAt = 0;
    this.hotkeyDown = false; // the hotkey's key is physically held (as far as the hook saw)
  }

  _listen() {
    if (this.listening) return;
    this.listening = true;
    uIOhook.on('input', () => { this.lastEventAt = Date.now(); });
    uIOhook.on('keydown', (e) => this._down(e));
    uIOhook.on('keyup', (e) => this._up(e));
    uIOhook.on('mouseup', () => this.emit('mouseup'));
  }

  start() {
    if (!uIOhook) return false;
    if (this.started) return true;
    this._listen();
    try {
      uIOhook.start();
      this.started = true;
      this.available = true;
      this.lastEventAt = Date.now();
    } catch (err) {
      console.error('uiohook start failed', err);
      this.available = false;
    }
    return this.available;
  }
  stop() {
    if (uIOhook && this.started) { try { uIOhook.stop(); } catch { /* ignore */ } this.started = false; }
  }

  // Reinstall the hook. Besides replacing a hook Windows may have dropped, this makes
  // libuiohook re-read which modifiers are really held: a modifier key-up the hook
  // never saw (released on the lock screen after Win+L, or lost while the hook thread
  // was too slow right after resume) otherwise sticks forever, and every later key
  // carries the phantom modifier, so the hotkey never matches again.
  restart(reason) {
    if (!uIOhook) return false;
    console.log(`[hotkeys] restarting keyboard hook: ${reason}`);
    this.stop();
    this.reset();
    return this.start();
  }

  // Forget any half-finished press (a key-up lost across sleep would leave it 'held').
  reset() {
    this.ptt = 'idle';
    this.downAt = 0;
    this.hotkeyDown = false;
  }

  // Dictation ended on its own (error, click, timeout): forget a lock so the next press
  // starts a new recording instead of "stopping" one that is already over. Not while
  // the key is held, or its auto-repeat would immediately start another recording.
  syncIdle() {
    if (this.ptt === 'ignored') return;
    if (this.ptt !== 'idle') this.ptt = this.hotkeyDown ? 'ignored' : 'idle';
  }

  // Dictation refused this press (still busy, no model): ignore the rest of it,
  // auto-repeat included, and be ready again once the key is released.
  rejectPress() {
    this.ptt = this.hotkeyDown ? 'ignored' : 'idle';
  }

  // Ignore the hotkey for a moment, e.g. a key pressed to wake the PC.
  pause(ms) { this.pausedUntil = Date.now() + ms; }

  _matches(e) {
    const hk = config.get().hotkey;
    if (!hk || e.keycode !== hk.keycode) return false;
    const self = KEY_NAMES[e.keycode] || '';
    // a modifier used AS the hotkey sets its own flag — ignore that flag in comparison
    const eff = {
      ctrl: e.ctrlKey && !/Ctrl/.test(self),
      alt: e.altKey && !/Alt/.test(self),
      shift: e.shiftKey && !/Shift/.test(self),
      meta: e.metaKey && !/Meta/.test(self),
    };
    return eff.ctrl === !!hk.ctrl && eff.alt === !!hk.alt && eff.shift === !!hk.shift && eff.meta === !!hk.meta;
  }

  // The hotkey's key arrived with a modifier the hotkey doesn't use. Usually that is a
  // stuck modifier (see restart()); a restart re-reads the real state, so the next
  // auto-repeat or press works. Harmless when the modifier really was held.
  _maybeStaleModifiers(e) {
    const hk = config.get().hotkey;
    if (!hk || e.keycode !== hk.keycode || this.ptt !== 'idle') return;
    const self = KEY_NAMES[e.keycode] || '';
    const extra = (e.ctrlKey && !hk.ctrl && !/Ctrl/.test(self))
      || (e.altKey && !hk.alt && !/Alt/.test(self))
      || (e.shiftKey && !hk.shift && !/Shift/.test(self))
      || (e.metaKey && !hk.meta && !/Meta/.test(self));
    const now = Date.now();
    if (!extra || now - this.lastHealAt < 3000) return;
    this.lastHealAt = now;
    setImmediate(() => this.restart('hotkey pressed with an unexpected modifier (stale modifier state?)'));
  }

  _down(e) {
    if (this.capture) {
      this.capture.candidate = {
        keycode: e.keycode, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey,
      };
      if (!MODIFIER_CODES.has(e.keycode)) this._finishCapture(e);
      return;
    }
    const cfg = config.get();
    if (UiohookKey && e.keycode === UiohookKey.Escape && this.ptt !== 'idle') {
      this.ptt = 'idle';
      this.emit('cancel');
      return;
    }
    const hk = config.get().hotkey;
    if (hk && e.keycode === hk.keycode) this.hotkeyDown = true;
    if (!this._matches(e)) { this._maybeStaleModifiers(e); return; }
    if (this.ptt === 'idle' && Date.now() < this.pausedUntil) return;
    if (cfg.hotkeyMode === 'toggle') {
      if (this.ptt === 'idle') { this.ptt = 'locked'; this.downAt = Date.now(); this.emit('start'); }
      else if (this.ptt === 'locked' && Date.now() - this.downAt > 300) { this.ptt = 'idle'; this.emit('stop'); }
      return;
    }
    // hold mode
    if (this.ptt === 'idle') {
      this.ptt = 'held';
      this.downAt = Date.now();
      this.emit('start');
    } else if (this.ptt === 'locked' && Date.now() - this.downAt > 300) {
      this.ptt = 'idle';
      this.emit('stop');
    }
  }

  _up(e) {
    if (this.capture) {
      if (this.capture.candidate && e.keycode === this.capture.candidate.keycode) this._finishCapture(e);
      return;
    }
    if (config.get().hotkey && e.keycode === config.get().hotkey.keycode) {
      this.hotkeyDown = false;
      if (this.ptt === 'ignored') { this.ptt = 'idle'; return; }
    }
    if (config.get().hotkeyMode === 'toggle') return;
    if (this.ptt !== 'held' || !config.get().hotkey || e.keycode !== config.get().hotkey.keycode) return;
    if (config.get().tapToLock && Date.now() - this.downAt < 350) {
      this.ptt = 'locked';
      this.downAt = Date.now();
      this.emit('lock');
    } else {
      this.ptt = 'idle';
      this.emit('stop');
    }
  }

  externalStop() { this.ptt = 'idle'; }
  externalStart() { this.ptt = 'locked'; this.downAt = Date.now(); }

  // resolves with {keycode, ctrl, alt, shift, meta, label} — Escape cancels (null)
  captureNext(timeoutMs = 15000) {
    return new Promise((resolve) => {
      if (!this.available) return resolve(null);
      const timer = setTimeout(() => { this.capture = null; resolve(null); }, timeoutMs);
      this.capture = { resolve, timer, candidate: null };
    });
  }
  _finishCapture(e) {
    const cap = this.capture;
    this.capture = null;
    clearTimeout(cap.timer);
    if (UiohookKey && e.keycode === UiohookKey.Escape) return cap.resolve(null);
    const c = cap.candidate || { keycode: e.keycode, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
    const self = KEY_NAMES[c.keycode] || '';
    const combo = {
      keycode: c.keycode,
      ctrl: c.ctrl && !/Ctrl/.test(self),
      alt: c.alt && !/Alt/.test(self),
      shift: c.shift && !/Shift/.test(self),
      meta: c.meta && !/Meta/.test(self),
    };
    combo.label = comboLabel({ keycode: c.keycode, ctrlKey: combo.ctrl, altKey: combo.alt, shiftKey: combo.shift, metaKey: combo.meta });
    cap.resolve(combo);
  }
}

module.exports = new Hotkeys();
