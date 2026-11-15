'use strict';
// Pure helpers for recovering after sleep/hibernate and from a silently broken
// keyboard hook (no Electron, so they can be unit-tested).

// A repeating timer that fires much later than scheduled means the process was frozen:
// the PC slept or hibernated (also caught when no suspend/resume event arrives,
// e.g. on some Modern Standby machines).
function clockJumped(prevTick, now, intervalMs, toleranceMs) {
  return now - prevTick > intervalMs + toleranceMs;
}

// Upper bound for one /inference request: a hung server must not wedge dictation,
// but large models on slow CPUs can legitimately need a while for long recordings.
// 16 kHz mono 16-bit WAV = 32 bytes per millisecond after the 44-byte header.
function inferenceTimeoutMs(wavBytes) {
  const audioMs = Math.max(0, (wavBytes - 44) / 32);
  return Math.round(60000 + 3 * audioMs);
}

// Decides when the global keyboard/mouse hook looks dead: Windows saw user input
// (GetLastInputInfo via powerMonitor.getSystemIdleTime) well after the hook's last
// event, on consecutive checks. An elevated foreground window also hides input from
// the hook (UIPI), so restarts back off exponentially and stop after a few tries;
// any sign of life resets everything.
class HookWatchdog {
  constructor({ silenceMs = 5000, strikes = 2, backoffMs = 60000, maxBackoffMs = 600000, maxRestarts = 6 } = {}) {
    this.silenceMs = silenceMs;
    this.minStrikes = strikes;
    this.baseBackoffMs = backoffMs;
    this.maxBackoffMs = maxBackoffMs;
    this.maxRestarts = maxRestarts;
    this.reset();
  }

  reset() {
    this.strikes = 0;
    this.restarts = 0;
    this.backoffMs = this.baseBackoffMs;
    this.nextAllowedAt = 0;
  }

  // now, lastEventAt: ms timestamps; idleMs: time since the last system input.
  // quiet: skip this round (locked, suspended, just woke up, dictation busy).
  // Returns true when the hook should be restarted now.
  check({ now, idleMs, lastEventAt, quiet = false }) {
    if (quiet) { this.strikes = 0; return false; }
    const lastInputAt = now - idleMs;
    const silent = lastEventAt > 0 && lastInputAt - lastEventAt > this.silenceMs;
    if (!silent) { this.reset(); return false; }
    this.strikes += 1;
    if (this.strikes < this.minStrikes) return false;
    if (now < this.nextAllowedAt || this.restarts >= this.maxRestarts) return false;
    this.strikes = 0;
    this.restarts += 1;
    this.nextAllowedAt = now + this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    return true;
  }
}

module.exports = { clockJumped, inferenceTimeoutMs, HookWatchdog };
