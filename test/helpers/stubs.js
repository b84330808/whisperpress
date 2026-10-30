'use strict';
// Lets the main-process modules load under plain Node for `npm test`: stand-ins
// for Electron and the native keyboard hook, with only what those modules touch
// when they are required. Settings and notes go to a temporary folder.
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisperpress-test-'));
process.on('exit', () => fs.rmSync(userData, { recursive: true, force: true }));

function stub(id, exports) {
  const file = require.resolve(id);
  const m = new Module(file, module);
  m.filename = file;
  m.loaded = true;
  m.exports = exports;
  require.cache[file] = m;
}

// one copy in several formats at once; writing replaces all of them, like Windows'
let board = {};
const noImage = { isEmpty: () => true };
stub('electron', {
  app: { getPath: () => userData, getLocale: () => 'en', getAppPath: () => process.cwd() },
  clipboard: {
    readText: () => board.text || '',
    readHTML: () => board.html || '',
    readRTF: () => board.rtf || '',
    readImage: () => board.image || noImage,
    writeText: (text) => { board = { text }; },
    write: (data) => { board = { ...data }; },
  },
});

// uiohook keycodes the hotkey code looks up by name (F9 is the default hotkey)
stub('uiohook-napi', {
  uIOhook: { on() {}, start() {}, stop() {} },
  UiohookKey: { Escape: 1, Ctrl: 29, Shift: 42, Alt: 56, F9: 67, CtrlRight: 3613, ShiftRight: 54, AltRight: 3640, Meta: 3675, MetaRight: 3676 },
});

module.exports = { userData };
