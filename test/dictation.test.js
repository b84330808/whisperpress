'use strict';
// Run with `npm test` (node --test). Push-to-talk hotkeys driving dictation, and
// the cleanup of whisper's raw output before it is typed.
require('./helpers/stubs');
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/main/config');
const engine = require('../src/main/engine');
const windows = require('../src/main/windows');
const hotkeys = require('../src/main/hotkeys');
const dictation = require('../src/main/dictation');

// no windows and no whisper: only the state machines run
for (const k of ['showOverlay', 'hideOverlay', 'sendOverlay', 'showMain', 'broadcast']) windows[k] = () => {};
let modelInstalled = true;
engine.getState = () => ({ engineInstalled: true, server: 'ready', models: [{ id: 'base', installed: modelInstalled }] });
config.set({ model: 'base', hotkeyMode: 'hold', tapToLock: true });
dictation.attachHotkeys(hotkeys);

const F9 = { keycode: 67, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
const press = () => hotkeys._down(F9);
const release = () => hotkeys._up(F9);

test.beforeEach((t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  modelInstalled = true;
  dictation.cancel();
  hotkeys.externalStop();
});

test('hotkey: hold to talk, release to transcribe', (t) => {
  press();
  assert.equal(dictation.state, 'recording');
  t.mock.timers.tick(1000);
  release();
  assert.equal(dictation.state, 'transcribing');
});

test('hotkey: a tap while the last dictation is still transcribing does not swallow the next press', (t) => {
  press();
  t.mock.timers.tick(1000);
  release();
  assert.equal(dictation.state, 'transcribing');
  press(); // too early: ignored
  release(); // a quick tap would lock a recording
  dictation._finish(); // the text has been typed
  t.mock.timers.tick(1000);
  press();
  assert.equal(dictation.state, 'recording');
});

test('hotkey: a tap without a model does not swallow the first press after installing one', (t) => {
  modelInstalled = false;
  press();
  release();
  assert.equal(dictation.state, 'idle');
  modelInstalled = true;
  t.mock.timers.tick(1000);
  press();
  assert.equal(dictation.state, 'recording');
});

test('hotkey: a locked recording that fails (no mic) does not swallow the next press', (t) => {
  press();
  release(); // quick tap: locked, hands-free
  assert.equal(dictation.state, 'recording');
  t.mock.method(console, 'error', () => {});
  dictation.onRecorderError('Requested device not found');
  assert.equal(dictation.state, 'idle');
  t.mock.timers.tick(1000);
  press();
  assert.equal(dictation.state, 'recording');
});

test('tray toggle without a model leaves the hotkey ready', () => {
  modelInstalled = false;
  dictation.toggle();
  assert.equal(dictation.state, 'idle');
  assert.equal(hotkeys.ptt, 'idle');
});

test('transcript cleanup: non-speech annotations and music notes go', () => {
  const clean = dictation.cleanTranscript;
  assert.equal(clean('[BLANK_AUDIO]'), '');
  assert.equal(clean('♪ ♪'), '');
  assert.equal(clean('(♪)'), '');
  assert.equal(clean('♪ hello world ♪'), 'hello world');
  assert.equal(clean('(music) okay, let us start'), 'okay, let us start');
  assert.equal(clean('(音樂) 我們開始吧'), '我們開始吧');
});

test('transcript cleanup: segments become one line, code brackets stay', () => {
  const clean = dictation.cleanTranscript;
  assert.equal(clean('first part\nsecond part'), 'first part second part');
  assert.equal(clean('你好，\n我們開始吧。'), '你好，我們開始吧。');
  assert.equal(clean('call foo(bar) and foo()'), 'call foo(bar) and foo()');
  assert.equal(clean('print items[0]'), 'print items[0]');
});
