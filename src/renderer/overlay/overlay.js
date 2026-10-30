'use strict';
/* global wp */

const pill = document.getElementById('pill');
const barsCanvas = document.getElementById('bars');
const barsCtx = barsCanvas.getContext('2d');
const timerEl = document.getElementById('timer');
const hintEl = document.getElementById('hint');
const iconEl = document.getElementById('icon');
const msgEl = document.getElementById('msg');
const cancelBtn = document.getElementById('cancel');
const codeEl = document.getElementById('code');

let dict = {};
wp.dict().then((d) => { dict = d.strings; });
const t = (k, vars) => {
  let s = dict[k] || k;
  if (vars) for (const [key, v] of Object.entries(vars)) s = s.replaceAll(`{${key}}`, String(v));
  return s;
};

// ---------------- audio capture ----------------
let stream = null;
let ctx = null;
let chunks = [];
let recording = false;
let capturing = null; // startCapture() still opening the mic
let startedAt = 0;
let levels = new Array(24).fill(0);
let rafId = 0;
let soundsOn = true;

function beep(freq, ms, gainV = 0.05) {
  if (!soundsOn) return;
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = freq;
    g.gain.value = gainV;
    o.connect(g).connect(ac.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000);
    o.stop(ac.currentTime + ms / 1000);
    setTimeout(() => ac.close(), ms + 150);
  } catch { /* no output device */ }
}

async function startCapture(deviceId) {
  chunks = [];
  const constraints = {
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
    },
  };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.audioWorklet.addModule('../common/pcm-worklet.js');
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'pcm-capture');
  // worklet messages arrive every ~8 ms; aggregate to ~70 ms per bar or the
  // waveform scrolls uncomfortably fast
  const acc = { sum: 0, n: 0, last: performance.now() };
  node.port.onmessage = (e) => {
    if (!recording) return;
    const f32 = e.data;
    chunks.push(f32);
    for (let i = 0; i < f32.length; i++) acc.sum += f32[i] * f32[i];
    acc.n += f32.length;
    const now = performance.now();
    if (now - acc.last >= 70 && acc.n > 0) {
      levels.push(Math.min(1, Math.sqrt(acc.sum / acc.n) * 4.5));
      if (levels.length > 24) levels.shift();
      acc.sum = 0; acc.n = 0; acc.last = now;
    }
  };
  src.connect(node);
  // worklet output not connected anywhere: capture only, no monitoring
  recording = true;
  startedAt = Date.now();
}

async function stopCapture() {
  recording = false;
  await new Promise((r) => setTimeout(r, 140)); // let in-flight worklet messages land
  if (stream) { for (const tr of stream.getTracks()) tr.stop(); stream = null; }
  if (ctx) { try { await ctx.close(); } catch { /* ignore */ } ctx = null; }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const pcm = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { pcm.set(c, off); off += c.length; }
  chunks = [];
  return pcm;
}

function encodeWav(f32, sampleRate = 16000) {
  const buf = new ArrayBuffer(44 + f32.length * 2);
  const v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + f32.length * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, f32.length * 2, true);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

// ---------------- UI ----------------
let codingOn = false; // coding-mode chip, set per recording
function setState(cls) {
  pill.className = `visible ${cls}${codingOn ? ' coding' : ''}`;
}
function drawLoop() {
  const w = barsCanvas.width, h = barsCanvas.height;
  barsCtx.clearRect(0, 0, w, h);
  const bw = w / 24;
  for (let i = 0; i < levels.length; i++) {
    const lh = Math.max(4, levels[i] * h);
    barsCtx.fillStyle = 'rgba(167, 139, 250, 0.95)';
    barsCtx.beginPath();
    barsCtx.roundRect(i * bw + 2, (h - lh) / 2, bw - 4, lh, 3);
    barsCtx.fill();
  }
  if (recording) {
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    timerEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  rafId = requestAnimationFrame(drawLoop);
}

let currentMode = 'hold';
let currentKey = 'F9';

wp.onCmd(async (payload) => {
  const { cmd } = payload;
  if (cmd === 'localeChanged') {
    wp.dict().then((d) => { dict = d.strings; });
  } else if (cmd === 'start') {
    soundsOn = payload.sounds !== false;
    currentMode = payload.mode || 'hold';
    currentKey = payload.hotkeyLabel || 'F9';
    codingOn = false;
    setState('state-recording');
    hintEl.textContent = currentMode === 'toggle'
      ? t('overlay.hintToggle', { key: currentKey })
      : t('overlay.hintHold', { key: currentKey });
    levels = new Array(24).fill(0);
    cancelAnimationFrame(rafId);
    drawLoop();
    beep(880, 90);
    capturing = startCapture(payload.deviceId);
    try {
      await capturing;
    } catch (err) {
      wp.sendError(String(err.message || err));
      recording = false;
    }
  } else if (cmd === 'stop') {
    // opening the mic can take longer than a short press (e.g. Bluetooth headsets);
    // a stop that arrives meanwhile must wait for it, or it is lost and the pill
    // stays on "transcribing" while the mic keeps recording
    if (capturing) await capturing.catch(() => {});
    if (!recording) return;
    beep(620, 90);
    const pcm = await stopCapture();
    const durationMs = Math.round((pcm.length / 16000) * 1000);
    wp.sendAudio(encodeWav(pcm), durationMs);
  } else if (cmd === 'cancel') {
    if (capturing) await capturing.catch(() => {});
    if (recording) { await stopCapture(); }
    cancelAnimationFrame(rafId);
  } else if (cmd === 'coding') {
    codingOn = !!payload.on;
    codeEl.textContent = `</> ${t('overlay.coding')}`;
    pill.classList.toggle('coding', codingOn);
  } else if (cmd === 'phase') {
    if (payload.phase === 'locked') {
      pill.classList.add('locked');
      hintEl.textContent = t('overlay.hintLocked', { key: currentKey });
    } else if (payload.phase === 'transcribing') {
      setState('state-transcribing');
      msgEl.textContent = t('overlay.transcribing');
    } else if (payload.phase === 'done') {
      setState('state-done');
      iconEl.textContent = '✓';
      iconEl.style.color = '#34d399';
      msgEl.textContent = payload.preview || t('overlay.done');
    } else if (payload.phase === 'empty') {
      setState('state-empty');
      iconEl.textContent = '∅';
      iconEl.style.color = '#9b96ad';
      msgEl.textContent = t('overlay.noSpeech');
    } else if (payload.phase === 'error') {
      setState('state-error');
      iconEl.textContent = '⚠';
      iconEl.style.color = '#f87171';
      msgEl.textContent = t(payload.msgKey || 'overlay.transcribeError');
      beep(220, 180);
    }
  }
});

pill.addEventListener('click', (e) => {
  if (e.target === cancelBtn) return;
  if (recording) wp.stopClick();
});
cancelBtn.addEventListener('click', () => { if (recording) wp.cancelClick(); });
