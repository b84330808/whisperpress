'use strict';
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const DEFAULTS = {
  locale: 'auto', // 'auto' | 'en' | 'zh-Hant'
  hotkey: { keycode: 67, alt: false, ctrl: false, shift: false, meta: false, label: 'F9' }, // uiohook F9 = 67
  hotkeyMode: 'hold', // 'hold' | 'toggle'
  tapToLock: true, // quick tap locks recording in hold mode
  injectMode: 'paste', // 'paste' | 'type' | 'off'
  restoreClipboard: true,
  language: 'auto', // whisper language code or 'auto'
  translate: false, // translate to English
  model: '', // e.g. 'large-v3-turbo-q5_0'
  micDeviceId: 'default',
  sounds: true,
  saveDictationNotes: true,
  saveAudio: false,
  launchAtLogin: false,
  closeToTray: true,
  threads: 0, // 0 = auto
  engineFlavor: 'cpu', // 'cpu' | 'cuda'
  storageDir: '', // where engine+models live; '' = userData
  initialPrompt: '', // custom vocabulary / spelling hints passed to whisper
  ai: { enabled: false, baseUrl: 'http://localhost:11434/v1', apiKey: '', model: '' },
  onboarded: false,
};

class Config extends EventEmitter {
  constructor() {
    super();
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = { ...DEFAULTS };
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^﻿/, ''));
      this.data = { ...DEFAULTS, ...raw, ai: { ...DEFAULTS.ai, ...(raw.ai || {}) } };
    } catch { /* first run */ }
  }
  get() { return this.data; }
  set(patch) {
    if (patch && typeof patch === 'object') {
      if (patch.ai) patch = { ...patch, ai: { ...this.data.ai, ...patch.ai } };
      this.data = { ...this.data, ...patch };
      this.save();
      this.emit('changed', this.data, patch);
    }
    return this.data;
  }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (e) { console.error('config save failed', e); }
  }
}

module.exports = new Config();
