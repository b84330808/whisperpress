'use strict';
const { EventEmitter } = require('events');
const config = require('./config');
const engine = require('./engine');
const injector = require('./injector');
const notes = require('./notes');
const windows = require('./windows');
const coding = require('./coding');
const i18n = require('./i18n');

// Strip non-speech artifacts whisper emits for silence/noise: [BLANK_AUDIO], (music), ♪ …
// and merge whisper's per-segment line breaks: dictation should come out as ONE line
// (a stray Enter in type mode would even submit chat messages). CJK joins directly,
// Latin gets a space between segments. Brackets right after a word are code, not
// an annotation: foo(bar), list[0].
function cleanTranscript(text) {
  const isNoise = (inner) => !inner.trim() || /[a-zA-Z_ ]+|音樂|雜音|掌聲/.test(inner);
  const lines = text
    .split('\n')
    .map((l) => l
      .replace(/[♪♫♬]/g, '')
      .replace(/(?<![A-Za-z0-9_])[[(][^\])]{0,40}[\])]/g, (m) => (isNoise(m.slice(1, -1)) && m.length < 30 ? '' : m))
      .trim())
    .filter(Boolean);
  const CJK = /[　-鿿＀-￯]/;
  let out = '';
  for (const l of lines) {
    if (!out) out = l;
    else out += CJK.test(out[out.length - 1]) || CJK.test(l[0]) ? l : ` ${l}`;
  }
  return out.replace(/[ \t]+/g, ' ').trim();
}

class Dictation extends EventEmitter {
  constructor() {
    super();
    this.state = 'idle'; // idle | recording | transcribing
    this.locked = false;
    this.startedAt = 0;
    this.codingActive = Promise.resolve(false); // decided when recording starts
    this.session = 0; // bumps on every recording/preview, so stale timers do nothing
    this.audioTimer = null;
    this.previewTimer = null;
    this.previewing = false;
    this.interrupted = false; // a recording was cut off by sleep
  }

  // Run fn later only if nothing new started meanwhile.
  _later(ms, fn) {
    const session = this.session;
    return setTimeout(() => { if (this.session === session) fn(); }, ms);
  }

  // Coding mode follows the window that had focus when the hotkey went down:
  // that's where the text will be inserted (the overlay never takes focus).
  _detectCoding(cfg) {
    const mode = cfg.codingMode || 'off';
    if (mode === 'off') return Promise.resolve(false);
    if (mode === 'on') return Promise.resolve(true);
    return injector.foregroundApp().then((app) => coding.shouldUseCodingMode(mode, app, cfg.codingApps));
  }

  _overlay(cmd, data) {
    windows.sendOverlay({ cmd, ...data });
  }

  // Push-to-talk: the hotkeys drive dictation, and their state follows it back.
  // A press dictation ignored (still transcribing, no model) or a recording that
  // ended without the key (mic error) must not leave them waiting for a "stop"
  // press, or the next press would be swallowed. While the key is still held its
  // auto-repeat must not start (or retry) a recording either.
  attachHotkeys(hotkeys) {
    hotkeys.on('start', () => { if (!this.start()) hotkeys.rejectPress(); });
    hotkeys.on('stop', () => this.stop());
    hotkeys.on('cancel', () => this.cancel());
    hotkeys.on('lock', () => this.lock());
    this.on('state', (s) => { if (s === 'idle') hotkeys.syncIdle(); });
  }

  // true if recording started
  start() {
    if (this.state !== 'idle') return false;
    this._endPreview(false);
    this.session += 1;
    const cfg = config.get();
    const es = engine.getState();
    if (!es.engineInstalled || !es.models.some((m) => m.installed && m.id === cfg.model)) {
      windows.showOverlay();
      this._overlay('phase', { phase: 'error', msgKey: 'overlay.noModel' });
      this._later(2600, () => { if (this.state === 'idle') windows.hideOverlay(); });
      windows.showMain('onboarding');
      return false;
    }
    this.state = 'recording';
    this.locked = false;
    this.startedAt = Date.now();
    windows.showOverlay();
    this._overlay('start', {
      deviceId: cfg.micDeviceId,
      sounds: cfg.sounds,
      mode: cfg.hotkeyMode,
      tapToLock: cfg.tapToLock,
      hotkeyLabel: (cfg.hotkey && cfg.hotkey.label) || 'F9',
    });
    this.emit('state', this.state);
    this.codingActive = this._detectCoding(cfg).catch(() => false);
    this.codingActive.then((on) => { if (on && this.state !== 'idle') this._overlay('coding', { on: true }); });
    // wake the model if it is not loaded yet so transcription is instant on stop
    if (es.server !== 'ready' && es.server !== 'starting' && !engine.recovering) engine.start();
    return true;
  }

  lock() {
    if (this.state !== 'recording') return;
    this.locked = true;
    this._overlay('phase', { phase: 'locked' });
  }

  stop() {
    if (this.state !== 'recording') return;
    this.state = 'transcribing';
    this._overlay('stop', {});
    this._overlay('phase', { phase: 'transcribing' });
    this.emit('state', this.state);
    // The overlay always answers a stop with audio (or an error). If it doesn't, its page
    // is wedged: without this the app would sit in 'transcribing' and ignore the hotkey
    // until restarted. Long recordings get more time to encode.
    const waitMs = 20000 + Math.round((Date.now() - this.startedAt) / 20);
    clearTimeout(this.audioTimer);
    this.audioTimer = this._later(waitMs, () => {
      if (this.state !== 'transcribing') return;
      console.error('[dictation] the overlay never sent the recording; resetting');
      this._fail('overlay.micError', { replaceOverlay: true });
    });
  }

  cancel() {
    if (this.state === 'idle') return;
    clearTimeout(this.audioTimer);
    this.session += 1;
    this.state = 'idle';
    this._overlay('cancel', {});
    windows.hideOverlay();
    this.emit('state', this.state);
  }

  // Back to idle with an error on a fresh overlay (the old one may be the problem).
  _fail(msgKey, { replaceOverlay = false } = {}) {
    clearTimeout(this.audioTimer);
    this.session += 1;
    this.state = 'idle';
    this.emit('state', this.state);
    if (replaceOverlay) windows.hideOverlay();
    windows.showOverlay();
    this._overlay('phase', { phase: 'error', msgKey });
    this._later(2600, () => { if (this.state === 'idle') windows.hideOverlay(); });
  }

  // The overlay page crashed (windows.js already replaced the window).
  overlayLost() {
    if (this.state !== 'idle') this._fail('overlay.micError');
  }

  // The PC is going to sleep: drop the recording rather than paste stale text into
  // whatever has focus after wake-up, and say so once the PC is back.
  interrupt() {
    this._endPreview(true);
    if (this.state === 'idle') return false;
    this.interrupted = true;
    this.cancel();
    return true;
  }

  // After wake-up: tell the user their dictation was cut off (once).
  noticeInterrupted() {
    if (!this.interrupted) return;
    this.interrupted = false;
    if (this.state !== 'idle') return;
    this.session += 1;
    windows.showOverlay();
    this._overlay('phase', { phase: 'notice', msgKey: 'overlay.interruptedBySleep' });
    this._later(4000, () => { if (this.state === 'idle') windows.hideOverlay(); });
  }

  // Settings → "Show / move": show the pill without recording so it can be dragged.
  preview() {
    if (this.state !== 'idle') return false;
    this.session += 1;
    this.previewing = true;
    windows.showOverlay();
    this._overlay('preview', {});
    this.previewActivity();
    return true;
  }
  previewActivity() {
    if (!this.previewing) return;
    clearTimeout(this.previewTimer);
    this.previewTimer = this._later(20000, () => this._endPreview(true));
  }
  _endPreview(hide) {
    if (!this.previewing) return;
    this.previewing = false;
    clearTimeout(this.previewTimer);
    if (hide && this.state === 'idle') windows.hideOverlay();
  }
  endPreview() { this._endPreview(true); }

  // called from the overlay renderer once the WAV is encoded
  async onAudio(wavBuffer, durationMs) {
    if (this.state !== 'transcribing') return; // cancelled meanwhile
    clearTimeout(this.audioTimer);
    if (durationMs < 350) { this._finish(); return; }
    const cfg = config.get();
    const session = this.session;
    try {
      const codingOn = await this.codingActive;
      const prompt = codingOn
        ? coding.buildCodingPrompt({ basePrompt: cfg.initialPrompt, locale: i18n.resolveLocale(), vocabulary: cfg.codingVocabulary })
        : undefined;
      const result = await engine.transcribe(wavBuffer, { prompt });
      if (this.state !== 'transcribing' || this.session !== session) return;
      let text = cleanTranscript(result.text);
      if (codingOn) text = coding.postprocessCoding(text, cfg.codingVocabulary);
      if (!text) {
        this._overlay('phase', { phase: 'empty' });
        this._later(1400, () => this._finish());
        return;
      }
      if (cfg.injectMode === 'paste' || cfg.injectMode === 'type') {
        await injector.inject(text, {
          mode: cfg.injectMode,
          restoreClipboard: cfg.restoreClipboard,
          pressEnter: codingOn && !!cfg.codingPressEnter,
        });
      } else {
        const { clipboard } = require('electron');
        clipboard.writeText(text); // 'off' still lands the text somewhere useful
      }
      if (cfg.saveDictationNotes) {
        const note = notes.create({
          title: text.length > 40 ? `${text.slice(0, 40)}…` : text,
          text,
          segments: result.segments,
          durationMs,
          language: result.language,
          source: 'dictation',
        });
        if (cfg.saveAudio) notes.update(note.id, { audioFile: notes.saveAudio(note.id, wavBuffer) });
        windows.broadcast('notes:changed');
      }
      this._overlay('phase', { phase: 'done', preview: text.slice(0, 60) });
      this._later(1000, () => this._finish());
    } catch (e) {
      if (this.session !== session) return;
      console.error('dictation failed', e);
      const msgKey = /engine-not-ready|engine-timeout/.test(String(e.message)) ? 'overlay.engineError' : 'overlay.transcribeError';
      this._overlay('phase', { phase: 'error', msgKey });
      this._later(2600, () => this._finish());
    }
  }

  onRecorderError(message) {
    console.error('recorder error', message);
    if (this.state === 'idle') return;
    clearTimeout(this.audioTimer);
    this.session += 1;
    this.state = 'idle';
    this._overlay('phase', { phase: 'error', msgKey: 'overlay.micError' });
    this._later(2600, () => { if (this.state === 'idle') windows.hideOverlay(); });
    this.emit('state', this.state);
  }

  _finish() {
    if (this.state === 'idle') return;
    this.state = 'idle';
    windows.hideOverlay();
    this.emit('state', this.state);
  }

  toggle() {
    if (this.state === 'idle') {
      if (this.start()) require('./hotkeys').externalStart();
    } else if (this.state === 'recording') {
      require('./hotkeys').externalStop();
      this.stop();
    }
  }
}

module.exports = new Dictation();
module.exports.cleanTranscript = cleanTranscript;
