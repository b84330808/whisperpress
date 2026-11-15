'use strict';
// Keeps WhisperPress working across sleep, hibernation, screen locks, display changes
// and GPU resets, without a manual restart.
//
// Going to sleep: an unfinished dictation is dropped (pasting stale text into whatever
// has focus after wake-up would be worse) and a meeting recording is stopped and saved.
// Waking up / unlocking: one debounced, idempotent recovery pass reinstalls the keyboard
// hook (also clearing modifier keys stuck from the lock screen), replaces the idle
// overlay window, and checks that the whisper server still works.
// Between events: a cheap timer notices wake-ups that sent no event (the timer fires
// far too late) and a hook whose events stopped while Windows still sees input.
const { app, powerMonitor, screen } = require('electron');
const config = require('./config');
const { clockJumped, HookWatchdog } = require('./recovery');

const TICK_MS = 15000;
const LATE_TOLERANCE_MS = 30000; // a tick this late means the process was frozen
const QUIET_AFTER_WAKE_MS = 30000; // no hook verdicts while the system settles

function init({ hotkeys, dictation, windows, engine }) {
  let locked = false;
  let suspended = false;
  let quietUntil = 0;
  let timer = null;
  let deferrals = 0;
  let deep = false;
  const reasons = new Set();
  const watchdog = new HookWatchdog();

  function schedule(reason, delayMs, opts = {}) {
    reasons.add(reason);
    if (opts.deep) deep = true;
    quietUntil = Date.now() + QUIET_AFTER_WAKE_MS;
    hotkeys.pause(delayMs + 300); // the key that woke the PC is not a dictation request
    clearTimeout(timer);
    timer = setTimeout(recover, delayMs);
  }

  async function recover() {
    timer = null;
    // Someone is already dictating: don't pull the hook or the overlay out from under it.
    if (dictation.state !== 'idle' && deferrals < 30) {
      deferrals += 1;
      timer = setTimeout(recover, 2000);
      return;
    }
    deferrals = 0;
    const why = [...reasons].join(', ');
    const deepCheck = deep && config.get().engineFlavor === 'cuda';
    reasons.clear();
    deep = false;
    console.log(`[power] recovering after: ${why}`);
    hotkeys.restart(`recovering after: ${why}`);
    watchdog.reset();
    windows.replaceIdleOverlay();
    if (!locked) dictation.noticeInterrupted();
    try {
      await engine.checkHealth({ deep: deepCheck });
    } catch (e) {
      console.error('[power] engine check failed', e);
    }
  }

  powerMonitor.on('suspend', () => {
    suspended = true;
    console.log('[power] suspend');
    dictation.interrupt();
    hotkeys.reset();
    windows.broadcast('power:suspend'); // the main window stops and saves a meeting recording
  });
  powerMonitor.on('resume', () => {
    suspended = false;
    schedule('resume', 1500, { deep: true });
  });
  powerMonitor.on('lock-screen', () => { locked = true; });
  powerMonitor.on('unlock-screen', () => {
    locked = false;
    schedule('unlock', 500);
  });

  // A display was plugged in/out or changed resolution: move a visible pill, and give
  // the idle overlay a fresh window (display changes are a classic trigger for the
  // "transparent window stops showing" problem).
  let displayTimer = null;
  const onDisplays = (replace) => {
    clearTimeout(displayTimer);
    displayTimer = setTimeout(() => {
      windows.repositionOverlay();
      if (replace) windows.replaceIdleOverlay();
    }, 500);
  };
  screen.on('display-added', () => onDisplays(true));
  screen.on('display-removed', () => onDisplays(true));
  screen.on('display-metrics-changed', () => onDisplays(false));

  app.on('child-process-gone', (e, details) => {
    if (details.type === 'GPU') {
      console.error(`[power] GPU process gone (${details.reason}); replacing the idle overlay`);
      windows.replaceIdleOverlay();
    }
  });

  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const late = clockJumped(lastTick, now, TICK_MS, LATE_TOLERANCE_MS);
    lastTick = now;
    if (late) {
      suspended = false;
      schedule('wake-up (timer ran late)', 1500, { deep: true });
      return;
    }
    if (!hotkeys.started) {
      // installing the hook failed (it can, right after wake-up): keep trying
      if (hotkeys.start()) console.log('[power] keyboard hook installed on retry');
      return;
    }
    const quiet = locked || suspended || now < quietUntil || dictation.state !== 'idle';
    const idleMs = powerMonitor.getSystemIdleTime() * 1000;
    if (watchdog.check({ now, idleMs, lastEventAt: hotkeys.lastEventAt, quiet })) {
      hotkeys.restart('no events from the keyboard hook while Windows saw input');
    }
  }, TICK_MS);
}

module.exports = { init };
