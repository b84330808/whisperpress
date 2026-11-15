'use strict';
// Run with `npm test` (node --test). Detecting wake-ups and a silently broken keyboard
// hook, and bounding how long a transcription may take.
const test = require('node:test');
const assert = require('node:assert/strict');
const { clockJumped, inferenceTimeoutMs, HookWatchdog } = require('../src/main/recovery');

test('recovery: a timer firing far too late means the PC slept', () => {
  assert.equal(clockJumped(0, 15000, 15000, 30000), false);
  assert.equal(clockJumped(0, 44000, 15000, 30000), false); // a busy moment, not sleep
  assert.equal(clockJumped(0, 46000, 15000, 30000), true);
  assert.equal(clockJumped(0, 8 * 3600 * 1000, 15000, 30000), true);
});

test('recovery: inference timeout grows with the recording', () => {
  assert.equal(inferenceTimeoutMs(44), 60000); // empty clip
  assert.equal(inferenceTimeoutMs(44 + 32 * 10000), 60000 + 30000); // 10 s of audio
  assert.ok(inferenceTimeoutMs(44 + 32 * 600000) >= 30 * 60000); // 10 min clip, slow CPU
});

const S = 1000;
// One watchdog round: `inputAgo` = seconds since Windows last saw input,
// `eventAgo` = seconds since the hook last delivered an event.
function round(w, now, inputAgo, eventAgo, quiet = false) {
  return w.check({ now: now * S, idleMs: inputAgo * S, lastEventAt: (now - eventAgo) * S, quiet });
}

test('watchdog: a working hook is never restarted', () => {
  const w = new HookWatchdog();
  for (let t = 100; t < 2000; t += 15) {
    assert.equal(round(w, t, 0, 0), false); // user active, hook sees it
    assert.equal(round(w, t + 5, 600, 600), false); // nobody at the PC
  }
});

test('watchdog: restarts after two silent rounds, then backs off and gives up', () => {
  const w = new HookWatchdog({ backoffMs: 60 * S, maxBackoffMs: 240 * S, maxRestarts: 3 });
  let t = 1000;
  const restarts = [];
  for (let i = 0; i < 200; i++, t += 15) {
    // Windows sees input all the time, the hook has been silent since t=990
    if (round(w, t, 0, t - 990)) restarts.push(t);
  }
  assert.deepEqual(restarts, [1015, 1075, 1195]); // 60 s, then 120 s apart; max 3
});

test('watchdog: signs of life reset the backoff; quiet rounds never restart', () => {
  const w = new HookWatchdog({ backoffMs: 60 * S });
  assert.equal(round(w, 100, 0, 30), false);
  assert.equal(round(w, 115, 0, 45), true);
  assert.equal(round(w, 130, 0, 0), false); // hook alive again
  assert.equal(w.restarts, 0);
  // locked screen / just woke up / dictating: input the hook can't see is expected
  for (let t = 200; t < 400; t += 15) assert.equal(round(w, t, 0, 100, true), false);
  // input older than the hook's last event is fine (getSystemIdleTime has 1 s steps)
  assert.equal(round(w, 500, 4, 0), false);
  assert.equal(round(w, 515, 4, 0), false);
});
