'use strict';
const { EventEmitter } = require('events');
const config = require('./config');
const engine = require('./engine');
const injector = require('./injector');
const notes = require('./notes');
const windows = require('./windows');

// Strip non-speech artifacts whisper emits for silence/noise: [BLANK_AUDIO], (music), ♪ …
// and merge whisper's per-segment line breaks: dictation should come out as ONE line
// (a stray Enter in type mode would even submit chat messages). CJK joins directly,
// Latin gets a space between segments.
function cleanTranscript(text) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/[\[(][^\])]{0,40}[\])]/g, (m) => (/[a-zA-Z_ ]+|音樂|雜音|掌聲/.test(m.slice(1, -1)) && m.length < 30 ? '' : m)).trim())
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
  }

  _overlay(cmd, data) {
    windows.sendOverlay({ cmd, ...data });
  }

  start() {
    if (this.state !== 'idle') return;
    const cfg = config.get();
    const es = engine.getState();
    if (!es.engineInstalled || !es.models.some((m) => m.installed && m.id === cfg.model)) {
      windows.showOverlay();
      this._overlay('phase', { phase: 'error', msgKey: 'overlay.noModel' });
      setTimeout(() => { if (this.state === 'idle') windows.hideOverlay(); }, 2600);
      windows.showMain('onboarding');
      return;
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
    // wake the model if it is not loaded yet so transcription is instant on stop
    if (es.server !== 'ready' && es.server !== 'starting') engine.start();
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
  }

  cancel() {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this._overlay('cancel', {});
    windows.hideOverlay();
    this.emit('state', this.state);
  }

  // called from the overlay renderer once the WAV is encoded
  async onAudio(wavBuffer, durationMs) {
    if (this.state !== 'transcribing') return; // cancelled meanwhile
    if (durationMs < 350) { this._finish(); return; }
    const cfg = config.get();
    try {
      const result = await engine.transcribe(wavBuffer);
      if (this.state !== 'transcribing') return;
      const text = cleanTranscript(result.text);
      if (!text) {
        this._overlay('phase', { phase: 'empty' });
        setTimeout(() => this._finish(), 1400);
        return;
      }
      if (cfg.injectMode === 'paste' || cfg.injectMode === 'type') {
        await injector.inject(text, { mode: cfg.injectMode, restoreClipboard: cfg.restoreClipboard });
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
      setTimeout(() => this._finish(), 1000);
    } catch (e) {
      console.error('dictation failed', e);
      const msgKey = String(e.message).includes('engine-not-ready') ? 'overlay.engineError' : 'overlay.transcribeError';
      this._overlay('phase', { phase: 'error', msgKey });
      setTimeout(() => this._finish(), 2600);
    }
  }

  onRecorderError(message) {
    console.error('recorder error', message);
    this.state = 'idle';
    this._overlay('phase', { phase: 'error', msgKey: 'overlay.micError' });
    setTimeout(() => { if (this.state === 'idle') windows.hideOverlay(); }, 2600);
    this.emit('state', this.state);
  }

  _finish() {
    this.state = 'idle';
    windows.hideOverlay();
    this.emit('state', this.state);
  }

  toggle() {
    if (this.state === 'idle') {
      require('./hotkeys').externalStart();
      this.start();
    } else if (this.state === 'recording') {
      require('./hotkeys').externalStop();
      this.stop();
    }
  }
}

module.exports = new Dictation();
