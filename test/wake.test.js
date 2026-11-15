'use strict';
// Run with `npm test` (node --test). Recovering from what sleep, the lock screen and a
// slow microphone do to push-to-talk, dictation and the whisper server.
require('./helpers/stubs');
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/main/config');
const engine = require('../src/main/engine');
const windows = require('../src/main/windows');
const hotkeys = require('../src/main/hotkeys');
const dictation = require('../src/main/dictation');

for (const k of ['showOverlay', 'hideOverlay', 'sendOverlay', 'showMain', 'broadcast']) windows[k] = () => {};
const realGetState = engine.getState.bind(engine);
let micBroken = false;
config.set({ model: 'base', hotkeyMode: 'hold', tapToLock: true });
dictation.attachHotkeys(hotkeys);

const F9 = { keycode: 67, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
const press = (e = F9) => hotkeys._down(e);
const release = (e = F9) => hotkeys._up(e);

test.beforeEach((t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.mock.timers.tick(10000);
  engine.getState = () => ({ engineInstalled: true, server: 'ready', models: [{ id: 'base', installed: true }] });
  micBroken = false;
  dictation.cancel();
  hotkeys.reset();
  hotkeys.pausedUntil = 0; // the mocked clock restarts for every test
  hotkeys.lastHealAt = 0;
  dictation.interrupted = false;
});
test.after(() => { engine.getState = realGetState; });

test('hotkey: holding the key through a mic error does not start recording after recording', (t) => {
  t.mock.method(console, 'error', () => {});
  let starts = 0;
  const onStart = () => {
    starts += 1;
    if (micBroken) dictation.onRecorderError('Could not start audio source');
  };
  dictation.on('state', onStart);
  micBroken = true;
  press();
  assert.equal(dictation.state, 'idle');
  for (let i = 0; i < 20; i++) { t.mock.timers.tick(33); press(); } // Windows auto-repeat
  dictation.removeListener('state', onStart);
  assert.equal(starts, 2, 'one recording (and its error), not one per auto-repeat');
  release();
  micBroken = false;
  t.mock.timers.tick(500);
  press();
  assert.equal(dictation.state, 'recording', 'the next real press works');
});

test('hotkey: auto-repeat of a press dictation refused is ignored until key-up', (t) => {
  let shown = 0;
  t.mock.method(windows, 'showMain', () => { shown += 1; });
  engine.getState = () => ({ engineInstalled: true, server: 'ready', models: [{ id: 'base', installed: false }] });
  press();
  for (let i = 0; i < 10; i++) { t.mock.timers.tick(33); press(); }
  release();
  assert.equal(shown, 1, 'setup opened once, not once per auto-repeat');
  assert.equal(hotkeys.ptt, 'idle');
});

test('hotkey: the hotkey arriving with a phantom modifier reinstalls the hook', async (t) => {
  t.mock.method(console, 'log', () => {});
  const restarts = t.mock.method(hotkeys, 'restart', () => true);
  press({ ...F9, metaKey: true }); // Win key "still held" after Win+L on the lock screen
  await new Promise((r) => setImmediate(r));
  assert.equal(restarts.mock.callCount(), 1);
  assert.equal(dictation.state, 'idle');
  press({ ...F9, metaKey: true });
  await new Promise((r) => setImmediate(r));
  assert.equal(restarts.mock.callCount(), 1, 'rate-limited');
  release({ ...F9, metaKey: true });
});

test('hotkey: the key that wakes the PC is ignored for a moment', (t) => {
  hotkeys.pause(1800);
  press();
  release();
  assert.equal(dictation.state, 'idle');
  t.mock.timers.tick(2000);
  press();
  assert.equal(dictation.state, 'recording');
});

test('dictation: a stop the overlay never answers does not wedge the app', (t) => {
  t.mock.method(console, 'error', () => {});
  press();
  t.mock.timers.tick(1000);
  release();
  assert.equal(dictation.state, 'transcribing');
  t.mock.timers.tick(25000); // no audio from the overlay
  assert.equal(dictation.state, 'idle');
  t.mock.timers.tick(3000);
  press();
  assert.equal(dictation.state, 'recording');
});

test('dictation: going to sleep drops the recording and says so after wake-up', (t) => {
  const sent = [];
  t.mock.method(windows, 'sendOverlay', (p) => sent.push(p));
  press();
  assert.equal(dictation.interrupt(), true);
  assert.equal(dictation.state, 'idle');
  dictation.noticeInterrupted();
  assert.ok(sent.some((p) => p.cmd === 'phase' && p.msgKey === 'overlay.interruptedBySleep'));
  sent.length = 0;
  dictation.noticeInterrupted(); // only once
  assert.equal(sent.length, 0);
  assert.equal(dictation.interrupt(), false, 'nothing to drop when idle');
});

test('dictation: a crashed overlay mid-recording resets to idle', (t) => {
  t.mock.method(console, 'error', () => {});
  press();
  dictation.overlayLost();
  assert.equal(dictation.state, 'idle');
});

// ---------- whisper server ----------
function fakeServer(t) {
  const calls = { starts: 0, infers: 0 };
  t.mock.method(engine, '_start', async () => {
    calls.starts += 1;
    engine._setState('ready', 'base');
    return true;
  });
  engine._setState('ready', 'base');
  return calls;
}

test('engine: a failing server is restarted once and the clip retried', async (t) => {
  t.mock.timers.reset();
  t.mock.method(console, 'warn', () => {});
  const calls = fakeServer(t);
  let fail = true;
  t.mock.method(engine, '_infer', async () => {
    calls.infers += 1;
    if (fail) { fail = false; throw Object.assign(new TypeError('fetch failed'), { restartable: true }); }
    return { text: 'ok' };
  });
  assert.deepEqual(await engine.transcribe(Buffer.alloc(100)), { text: 'ok' });
  assert.deepEqual(calls, { starts: 1, infers: 2 });
});

test('engine: a hung server is restarted and the clip given up on', async (t) => {
  t.mock.timers.reset();
  t.mock.method(console, 'warn', () => {});
  const calls = fakeServer(t);
  t.mock.method(engine, '_infer', async () => {
    calls.infers += 1;
    throw Object.assign(new DOMException('timed out', 'TimeoutError'), { restartable: true });
  });
  await assert.rejects(engine.transcribe(Buffer.alloc(100)), /engine-timeout/);
  assert.deepEqual(calls, { starts: 1, infers: 1 });
});

test('engine: callers failing at the same time share one restart', async (t) => {
  t.mock.timers.reset();
  t.mock.method(console, 'warn', () => {});
  const calls = fakeServer(t);
  let release;
  t.mock.method(engine, '_start', () => {
    calls.starts += 1;
    engine._setState('starting', 'base');
    return new Promise((r) => { release = () => { engine._setState('ready', 'base'); r(true); }; });
  });
  const a = engine.restartServer('a');
  const b = engine.restartServer('b');
  assert.equal(a, b);
  const waiting = engine.ensureReady();
  release();
  assert.equal(await waiting, true);
  assert.equal(calls.starts, 1);
});

test('engine: a bad request is not a reason to restart', async (t) => {
  t.mock.timers.reset();
  const calls = fakeServer(t);
  t.mock.method(engine, '_infer', async () => { throw Object.assign(new Error('inference failed: HTTP 400'), { restartable: false }); });
  await assert.rejects(engine.transcribe(Buffer.alloc(100)), /HTTP 400/);
  assert.equal(calls.starts, 0);
});
