'use strict';
/* global wp */

// ---------------- state ----------------
let dict = {};
let settings = {};
let engineState = { models: [] };
let notesList = [];
let currentNoteId = null;
const selectedNotes = new Set();
let currentAudioUrl = null;
const jobs = new Map(); // id -> {id, name, source, phase, pct, lines: [], noteId}
const chatHistories = new Map(); // noteId -> [{role, content}]
let activeChatStream = null; // {reqId, el, content}
let saveTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const t = (k, vars) => {
  let s = dict[k] || k;
  if (vars) for (const [key, v] of Object.entries(vars)) s = s.replaceAll(`{${key}}`, String(v));
  return s;
};

const LANG_NAMES = {
  auto: '', zh: '中文', en: 'English', ja: '日本語', ko: '한국어', es: 'Español', fr: 'Français',
  de: 'Deutsch', it: 'Italiano', pt: 'Português', ru: 'Русский', ar: 'العربية', hi: 'हिन्दी',
  vi: 'Tiếng Việt', th: 'ไทย', id: 'Indonesia', ms: 'Melayu', nl: 'Nederlands', tr: 'Türkçe',
  pl: 'Polski', uk: 'Українська', sv: 'Svenska', cs: 'Čeština', ro: 'Română', el: 'Ελληνικά',
  he: 'עברית', da: 'Dansk', fi: 'Suomi', no: 'Norsk', hu: 'Magyar',
};

function applyI18n() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-tip]').forEach((el) => { el.dataset.tip = t(el.dataset.i18nTip); });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDur(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}
function hotkeyLabel() { return (settings.hotkey && settings.hotkey.label) || 'F9'; }

// ---------------- navigation ----------------
function showView(name) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  const view = $(`#view-${name}`);
  if (view) view.classList.add('active');
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'settings') populateMics();
}
$$('.nav-btn').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

// ---------------- engine status footer ----------------
function renderEngineStatus() {
  const dot = $('#engine-dot');
  const label = $('#engine-label');
  const st = engineState.server;
  dot.className = 'dot ' + (st === 'ready' ? 'ready' : st === 'starting' ? 'starting' : st === 'error' ? 'error' : '');
  if (!engineState.engineInstalled) label.textContent = t('engine.notInstalled');
  else if (st === 'ready') label.textContent = engineState.currentModel || 'ready';
  else label.textContent = t(`engine.${st}`) || st;
  $('#engine-status-text').textContent = `${st}${engineState.serverDetail ? ` — ${engineState.serverDetail.split('\n')[0].slice(0, 80)}` : ''} (whisper.cpp ${engineState.whisperCppVersion})`;
  $('#storage-path').textContent = engineState.storageDir || '';
  $('#storage-path').title = engineState.storageDir || '';
  renderFlavorRow();
  updateHwApply();
}

// compute-flavor row: show detected hardware names and per-flavor install state
function shortHwName(s) {
  return (s || '').replace(/\((R|TM)\)/gi, '').replace(/\s*CPU\s*@.*$/i, '').replace(/^NVIDIA\s+/i, '').replace(/\s+/g, ' ').trim();
}
function renderFlavorRow() {
  const sel = $('#set-engineFlavor');
  const flavors = engineState.flavors || {};
  const labels = { cpu: t('settings.flavorCpu'), cuda: t('settings.flavorCuda') };
  if (hwInfo) {
    labels.cpu = t('settings.flavorCpuNamed', { name: shortHwName(hwInfo.cpuName) });
    labels.cuda = hwInfo.gpu
      ? t('settings.flavorCudaNamed', { name: shortHwName(hwInfo.gpu.name) })
      : `${t('settings.flavorCuda')} — ${t('settings.noNvidia')}`;
  }
  for (const opt of sel.options) {
    opt.textContent = labels[opt.value];
    // no NVIDIA GPU -> CUDA engine cannot run; block selecting it (unless already selected)
    if (opt.value === 'cuda') opt.disabled = !!(hwInfo && !hwInfo.gpu && settings.engineFlavor !== 'cuda');
  }
  const selected = sel.value || settings.engineFlavor;
  const installed = !!flavors[selected];
  const installing = (engineState.activeDownloads || []).some((k) => k.startsWith('engine:'));
  const status = $('#flavor-status');
  status.textContent = installing ? t('models.downloading')
    : installed ? `✓ ${t('settings.installed')}`
      : t('settings.notInstalledSize', { mb: selected === 'cuda' ? 440 : 16 });
  status.style.color = installed && !installing ? 'var(--ok)' : 'var(--muted)';
  const btn = $('#btn-install-engine');
  btn.textContent = installed ? t('settings.reinstall') : t('settings.installNow');
  btn.classList.toggle('primary', !installed);
  btn.disabled = installing;
  $('#hotkey-hint').innerHTML = t('footer.hint').replace('{key}', `<kbd>${hotkeyLabel()}</kbd>`);
  $('#ph-line1').innerHTML = t('notes.placeholder1').replace('{key}', `<kbd>${hotkeyLabel()}</kbd>`);
}

// ---------------- notes ----------------
async function refreshNotes() {
  notesList = await wp.listNotes();
  renderNoteList();
  if (currentNoteId) {
    const exists = notesList.some((n) => n.id === currentNoteId);
    if (!exists) { currentNoteId = null; renderNoteDetail(null); }
  }
}

function renderNoteList() {
  const q = $('#search').value.trim().toLowerCase();
  const list = $('#note-list');
  list.innerHTML = '';
  const filtered = notesList.filter((n) => !q || (n.title || '').toLowerCase().includes(q) || (n.snippet || '').toLowerCase().includes(q));
  $('#notes-empty').hidden = filtered.length > 0;
  list.classList.toggle('selecting', selectedNotes.size > 0);
  const srcIcon = { dictation: '🎙', import: '📂', meeting: '🖥' };
  for (const n of filtered) {
    const el = document.createElement('div');
    el.className = 'note-item' + (n.id === currentNoteId ? ' active' : '') + (selectedNotes.has(n.id) ? ' checked' : '');
    el.innerHTML = `
      <input type="checkbox" class="ni-check" ${selectedNotes.has(n.id) ? 'checked' : ''} />
      <div class="ni-body">
        <div class="ni-title"></div>
        <div class="ni-snippet"></div>
        <div class="ni-meta"><span>${srcIcon[n.source] || ''} ${fmtDate(n.createdAt)}</span><span>${fmtDur(n.durationMs)}</span>${n.hasSummary ? '<span>✦</span>' : ''}</div>
      </div>`;
    el.querySelector('.ni-title').textContent = n.title || t('notes.untitled');
    el.querySelector('.ni-snippet').textContent = n.snippet || '';
    el.querySelector('.ni-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNoteSelection(n.id);
    });
    el.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) { toggleNoteSelection(n.id); return; }
      openNote(n.id);
    });
    list.appendChild(el);
  }
  updateBulkBar(filtered);
}

function toggleNoteSelection(id) {
  if (selectedNotes.has(id)) selectedNotes.delete(id);
  else selectedNotes.add(id);
  renderNoteList();
}

function updateBulkBar() {
  const bar = $('#bulk-bar');
  bar.hidden = selectedNotes.size === 0;
  if (selectedNotes.size) $('#bulk-count').textContent = t('notes.selected', { n: selectedNotes.size });
}

$('#bulk-cancel').addEventListener('click', () => { selectedNotes.clear(); renderNoteList(); });
$('#bulk-all').addEventListener('click', () => {
  const q = $('#search').value.trim().toLowerCase();
  notesList
    .filter((n) => !q || (n.title || '').toLowerCase().includes(q) || (n.snippet || '').toLowerCase().includes(q))
    .forEach((n) => selectedNotes.add(n.id));
  renderNoteList();
});
$('#bulk-delete').addEventListener('click', async () => {
  if (!selectedNotes.size) return;
  if (!confirm(t('notes.deleteManyConfirm', { n: selectedNotes.size }))) return;
  const ids = [...selectedNotes];
  selectedNotes.clear();
  await wp.deleteNotes(ids);
  if (ids.includes(currentNoteId)) { currentNoteId = null; renderNoteDetail(null); }
  await refreshNotes();
});

async function openNote(id) {
  currentNoteId = id;
  const note = await wp.getNote(id);
  renderNoteList();
  renderNoteDetail(note);
}

function renderNoteDetail(note) {
  $('#note-placeholder').hidden = !!note;
  $('#note-detail').hidden = !note;
  if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = null; }
  $('#note-audio').hidden = true;
  $('#chat-panel').hidden = true;
  if (!note) return;
  $('#note-title').value = note.title || '';
  const meta = [fmtDate(note.createdAt), fmtDur(note.durationMs), note.language, t(`source.${note.source}`)].filter(Boolean);
  $('#note-meta').textContent = meta.join(' · ');
  $('#note-text').value = note.text || '';
  $('#note-summary').hidden = !note.summary;
  $('#summary-text').textContent = note.summary || '';
  $('#btn-summarize').style.display = settings.ai && settings.ai.enabled ? '' : 'none';
  $('#btn-chat').style.display = settings.ai && settings.ai.enabled ? '' : 'none';
  renderChat(note.id);
  if (note.audioFile) {
    wp.noteAudio(note.id).then((ab) => {
      if (!ab || currentNoteId !== note.id) return;
      currentAudioUrl = URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
      const audio = $('#note-audio');
      audio.src = currentAudioUrl;
      audio.hidden = false;
    });
  }
}

function scheduleNoteSave() {
  clearTimeout(saveTimer);
  const id = currentNoteId;
  if (!id) return;
  saveTimer = setTimeout(async () => {
    await wp.updateNote(id, { title: $('#note-title').value, text: $('#note-text').value });
    notesList = await wp.listNotes();
    renderNoteList();
  }, 600);
}
$('#note-title').addEventListener('input', scheduleNoteSave);
$('#note-text').addEventListener('input', scheduleNoteSave);
$('#search').addEventListener('input', renderNoteList);

$('#btn-copy').addEventListener('click', async () => {
  await wp.copy($('#note-text').value);
  flashBtn($('#btn-copy'), t('note.copied'));
});
$('#btn-delete').addEventListener('click', async () => {
  if (!currentNoteId) return;
  if (!confirm(t('note.deleteConfirm'))) return;
  await wp.deleteNote(currentNoteId);
  currentNoteId = null;
  renderNoteDetail(null);
  refreshNotes();
});
$('#btn-export').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#export-menu').hidden = !$('#export-menu').hidden;
});
document.addEventListener('click', () => { $('#export-menu').hidden = true; });
$$('#export-menu button').forEach((b) => b.addEventListener('click', async (e) => {
  e.stopPropagation();
  $('#export-menu').hidden = true;
  if (currentNoteId) await wp.exportNote(currentNoteId, b.dataset.fmt);
}));

function flashBtn(btn, text) {
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

// ---------------- AI: summary + chat ----------------
$('#btn-summarize').addEventListener('click', async () => {
  if (!currentNoteId) return;
  const btn = $('#btn-summarize');
  btn.disabled = true;
  btn.textContent = t('note.summarizing');
  try {
    const updated = await wp.aiSummarize(currentNoteId);
    renderNoteDetail(updated);
    refreshNotes();
  } catch (err) {
    alert(t('ai.error') + '\n' + String(err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = t('note.aiSummary');
    applyI18n();
  }
});

$('#btn-chat').addEventListener('click', () => {
  const panel = $('#chat-panel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) $('#chat-input').focus();
});

function renderChat(noteId) {
  const wrap = $('#chat-messages');
  wrap.innerHTML = '';
  for (const m of chatHistories.get(noteId) || []) {
    const el = document.createElement('div');
    el.className = `chat-msg ${m.role}`;
    el.textContent = m.content;
    wrap.appendChild(el);
  }
  wrap.scrollTop = wrap.scrollHeight;
}

async function sendChat() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text || !currentNoteId || activeChatStream) return;
  input.value = '';
  const noteId = currentNoteId;
  const history = chatHistories.get(noteId) || [];
  history.push({ role: 'user', content: text });
  chatHistories.set(noteId, history);
  renderChat(noteId);
  const wrap = $('#chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg assistant';
  el.textContent = '…';
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
  const reqId = `chat-${Date.now()}`;
  activeChatStream = { reqId, el, content: '', noteId };
  wp.aiChat(noteId, history.filter((m) => m.role !== 'error'), reqId);
}
$('#chat-send').addEventListener('click', sendChat);
$('#chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

wp.on('ai:chunk', ({ reqId, delta, done, error }) => {
  if (!activeChatStream || activeChatStream.reqId !== reqId) return;
  const s = activeChatStream;
  if (delta) {
    s.content += delta;
    s.el.textContent = s.content;
    $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
  }
  if (done) {
    if (error) s.el.textContent = `⚠ ${error}`;
    const history = chatHistories.get(s.noteId) || [];
    history.push({ role: error ? 'error' : 'assistant', content: s.content || error || '' });
    chatHistories.set(s.noteId, history);
    activeChatStream = null;
  }
});

// ---------------- import ----------------
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

async function decodeToWav16k(arrayBuffer) {
  const probe = new AudioContext();
  let audioBuf;
  try {
    audioBuf = await probe.decodeAudioData(arrayBuffer);
  } finally {
    probe.close();
  }
  const len = Math.ceil(audioBuf.duration * 16000);
  const oac = new OfflineAudioContext(1, len, 16000);
  const src = oac.createBufferSource();
  src.buffer = audioBuf;
  src.connect(oac.destination);
  src.start();
  const rendered = await oac.startRendering();
  return { wav: encodeWav(rendered.getChannelData(0)), durationMs: Math.round(audioBuf.duration * 1000) };
}

async function importFiles(files) {
  showView('import');
  for (const f of files) {
    try {
      const { wav, durationMs } = await decodeToWav16k(await f.arrayBuffer());
      await wp.startTranscription({ name: f.name.replace(/\.[^.]+$/, ''), wav, durationMs, source: 'import' });
    } catch (err) {
      const id = `local-${Date.now()}`;
      jobs.set(id, { id, name: f.name, source: 'import', phase: 'error', error: t('import.decodeError'), lines: [] });
      renderJobs();
      console.error('decode failed', err);
    }
  }
}

const dropzone = $('#dropzone');
$('#btn-browse').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', (e) => { importFiles([...e.target.files]); e.target.value = ''; });
document.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dropzone.classList.remove('drag'); });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const files = [...e.dataTransfer.files].filter((f) => /\.(mp3|m4a|wav|ogg|flac|webm|mp4|aac|opus)$/i.test(f.name));
  if (files.length) importFiles(files);
});

// ---------------- jobs ----------------
wp.on('job:update', (u) => {
  let job = jobs.get(u.id);
  if (!job) { job = { id: u.id, name: u.name, source: u.source, lines: [], pct: 0 }; jobs.set(u.id, job); }
  if (u.phase) job.phase = u.phase;
  if (u.pct != null) job.pct = u.pct;
  if (u.noteId) job.noteId = u.noteId;
  if (u.error) job.error = u.error;
  if (u.segment) { job.lines.push(u.segment.text); if (job.lines.length > 60) job.lines.shift(); }
  renderJobs();
  if (u.phase === 'done' || u.segment) refreshNotesThrottled();
});
let notesRefreshTimer = null;
function refreshNotesThrottled() {
  if (notesRefreshTimer) return;
  notesRefreshTimer = setTimeout(() => { notesRefreshTimer = null; refreshNotes(); }, 1500);
}

function renderJobs() {
  for (const target of ['import', 'meeting']) {
    const wrap = $(`#jobs-${target}`);
    wrap.innerHTML = '';
    for (const job of [...jobs.values()].reverse()) {
      if ((job.source === 'meeting') !== (target === 'meeting')) continue;
      const card = document.createElement('div');
      card.className = 'job-card';
      const phaseText = t(`job.${job.phase}`) || job.phase;
      card.innerHTML = `
        <div class="job-head">
          <div class="job-name"></div>
          <div class="job-phase">${phaseText}${job.phase === 'transcribing' && job.pct ? ` ${job.pct}%` : ''}</div>
          ${job.phase === 'transcribing' || job.phase === 'queued' ? `<button class="btn small-btn" data-act="cancel">${t('job.cancel')}</button>` : ''}
          ${job.noteId && job.phase === 'done' ? `<button class="btn small-btn" data-act="open">${t('job.open')}</button>` : ''}
          ${job.phase !== 'transcribing' && job.phase !== 'queued' ? '<button class="btn small-btn" data-act="dismiss">✕</button>' : ''}
        </div>
        ${job.phase === 'transcribing' ? `<div class="progress"><div class="bar" style="width:${job.pct || 0}%"></div></div>` : ''}
        ${job.error ? `<div class="job-live">⚠ ${job.error}</div>` : ''}
        ${job.lines.length && job.phase === 'transcribing' ? '<div class="job-live"></div>' : ''}`;
      card.querySelector('.job-name').textContent = job.name;
      const live = card.querySelector('.job-live:last-child');
      if (live && job.lines.length && !job.error) {
        live.textContent = job.lines.join('\n');
        live.scrollTop = live.scrollHeight;
      }
      card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.act === 'cancel') wp.cancelTranscription(job.id);
        if (b.dataset.act === 'dismiss') { jobs.delete(job.id); renderJobs(); }
        if (b.dataset.act === 'open') { showView('notes'); openNote(job.noteId); }
      }));
      wrap.appendChild(card);
    }
  }
}

// ---------------- meeting ----------------
const meeting = { active: false, ctx: null, streams: [], chunks: [], levels: [], startedAt: 0, raf: 0, timerInt: 0 };

$('#btn-meet-start').addEventListener('click', async () => {
  try {
    const sys = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    meeting.streams.push(sys);
    const ctx = new AudioContext({ sampleRate: 16000 });
    meeting.ctx = ctx;
    await ctx.audioWorklet.addModule('../common/pcm-worklet.js');
    const node = new AudioWorkletNode(ctx, 'pcm-capture');
    meeting.chunks = [];
    meeting.levels = new Array(28).fill(0);
    const acc = { sum: 0, n: 0, last: performance.now() };
    node.port.onmessage = (e) => {
      if (!meeting.active) return;
      meeting.chunks.push(e.data);
      for (let i = 0; i < e.data.length; i++) acc.sum += e.data[i] * e.data[i];
      acc.n += e.data.length;
      const now = performance.now();
      if (now - acc.last >= 70 && acc.n > 0) {
        meeting.levels.push(Math.min(1, Math.sqrt(acc.sum / acc.n) * 4));
        if (meeting.levels.length > 28) meeting.levels.shift();
        acc.sum = 0; acc.n = 0; acc.last = now;
      }
    };
    if (sys.getAudioTracks().length) ctx.createMediaStreamSource(sys).connect(node);
    if ($('#meet-mic').checked) {
      const micCfg = settings.micDeviceId && settings.micDeviceId !== 'default' ? { deviceId: { exact: settings.micDeviceId } } : {};
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, ...micCfg } });
      meeting.streams.push(mic);
      ctx.createMediaStreamSource(mic).connect(node);
    }
    sys.getVideoTracks()[0]?.addEventListener('ended', stopMeeting); // user clicked "stop sharing"
    meeting.active = true;
    meeting.startedAt = Date.now();
    $('#meeting-idle').hidden = true;
    $('#meeting-live').hidden = false;
    const cv = $('#meet-levels');
    const cx = cv.getContext('2d');
    const draw = () => {
      if (!meeting.active) return;
      cx.clearRect(0, 0, cv.width, cv.height);
      const bw = cv.width / 28;
      for (let i = 0; i < meeting.levels.length; i++) {
        const lh = Math.max(3, meeting.levels[i] * cv.height);
        cx.fillStyle = 'rgba(167,139,250,.95)';
        cx.fillRect(i * bw + 2, (cv.height - lh) / 2, bw - 4, lh);
      }
      meeting.raf = requestAnimationFrame(draw);
    };
    draw();
    meeting.timerInt = setInterval(() => {
      const sec = Math.floor((Date.now() - meeting.startedAt) / 1000);
      $('#meet-timer').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec > 4 * 3600) stopMeeting(); // safety cap
    }, 500);
  } catch (err) {
    stopMeeting(true);
    if (String(err.name) !== 'NotAllowedError') alert(t('meeting.error') + '\n' + String(err.message || err));
  }
});

async function stopMeeting(discard = false) {
  if (!meeting.active && !meeting.streams.length) return;
  meeting.active = false;
  clearInterval(meeting.timerInt);
  cancelAnimationFrame(meeting.raf);
  await new Promise((r) => setTimeout(r, 150));
  for (const s of meeting.streams) for (const tr of s.getTracks()) tr.stop();
  meeting.streams = [];
  if (meeting.ctx) { try { await meeting.ctx.close(); } catch { /* ignore */ } meeting.ctx = null; }
  $('#meeting-idle').hidden = false;
  $('#meeting-live').hidden = true;
  $('#meet-timer').textContent = '0:00';
  const total = meeting.chunks.reduce((a, c) => a + c.length, 0);
  if (discard === true || total < 16000) { meeting.chunks = []; return; }
  const pcm = new Float32Array(total);
  let off = 0;
  for (const c of meeting.chunks) { pcm.set(c, off); off += c.length; }
  meeting.chunks = [];
  const durationMs = Math.round((pcm.length / 16000) * 1000);
  const name = `${t('meeting.noteTitle')} ${new Date().toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  await wp.startTranscription({ name, wav: encodeWav(pcm), durationMs, source: 'meeting', keepAudio: true });
}
$('#btn-meet-stop').addEventListener('click', () => stopMeeting());

// ---------------- settings ----------------
function bindSimple(id, key, opts = {}) {
  const el = $(id);
  const isCheck = el.type === 'checkbox';
  const read = () => (isCheck ? el.checked : el.type === 'number' ? Number(el.value) : el.value);
  el.addEventListener('change', async () => {
    settings = await wp.setSettings(opts.ai ? { ai: { [key]: read() } } : { [key]: read() });
    afterSettingsChange(key);
  });
}
function afterSettingsChange(key) {
  renderEngineStatus();
  if (key === 'locale') reloadDict();
  if (key === 'hotkeyMode') $('#row-taplock').style.display = settings.hotkeyMode === 'hold' ? '' : 'none';
  if (key === 'enabled' && currentNoteId) openNote(currentNoteId);
}
function fillSettingsForm() {
  $('#btn-hotkey').textContent = hotkeyLabel();
  $('#set-hotkeyMode').value = settings.hotkeyMode;
  $('#set-tapToLock').checked = settings.tapToLock;
  $('#row-taplock').style.display = settings.hotkeyMode === 'hold' ? '' : 'none';
  $('#set-injectMode').value = settings.injectMode;
  $('#set-restoreClipboard').checked = settings.restoreClipboard;
  $('#set-sounds').checked = settings.sounds;
  $('#set-saveDictationNotes').checked = settings.saveDictationNotes;
  $('#set-saveAudio').checked = settings.saveAudio;
  $('#set-translate').checked = settings.translate;
  $('#set-chineseVariant').value = settings.chineseVariant || 'auto';
  $('#set-initialPrompt').value = settings.initialPrompt;
  $('#set-engineFlavor').value = settings.engineFlavor;
  $('#set-locale').value = settings.locale;
  $('#set-launchAtLogin').checked = settings.launchAtLogin;
  $('#set-closeToTray').checked = settings.closeToTray;
  $('#set-threads').value = settings.threads;
  $('#set-ai-enabled').checked = settings.ai.enabled;
  $('#set-ai-baseUrl').value = settings.ai.baseUrl;
  $('#set-ai-apiKey').value = settings.ai.apiKey;
  $('#set-ai-model').value = settings.ai.model;
  // transcription language select
  const sel = $('#set-language');
  sel.innerHTML = '';
  for (const code of Object.keys(LANG_NAMES)) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = code === 'auto' ? t('settings.langAuto') : `${LANG_NAMES[code]} (${code})`;
    sel.appendChild(o);
  }
  sel.value = settings.language || 'auto';
}

bindSimple('#set-hotkeyMode', 'hotkeyMode');
bindSimple('#set-tapToLock', 'tapToLock');
bindSimple('#set-injectMode', 'injectMode');
bindSimple('#set-restoreClipboard', 'restoreClipboard');
bindSimple('#set-sounds', 'sounds');
bindSimple('#set-saveDictationNotes', 'saveDictationNotes');
bindSimple('#set-saveAudio', 'saveAudio');
bindSimple('#set-language', 'language');
bindSimple('#set-chineseVariant', 'chineseVariant');
bindSimple('#set-translate', 'translate');
bindSimple('#set-initialPrompt', 'initialPrompt');
bindSimple('#set-engineFlavor', 'engineFlavor');
bindSimple('#set-locale', 'locale');
bindSimple('#set-launchAtLogin', 'launchAtLogin');
bindSimple('#set-closeToTray', 'closeToTray');
bindSimple('#set-threads', 'threads');
bindSimple('#set-micDeviceId', 'micDeviceId');
bindSimple('#set-ai-enabled', 'enabled', { ai: true });
bindSimple('#set-ai-baseUrl', 'baseUrl', { ai: true });
bindSimple('#set-ai-apiKey', 'apiKey', { ai: true });
bindSimple('#set-ai-model', 'model', { ai: true });

$('#btn-hotkey').addEventListener('click', async () => {
  const btn = $('#btn-hotkey');
  btn.textContent = t('settings.pressKey');
  const combo = await wp.captureHotkey();
  if (combo) {
    settings = await wp.setSettings({ hotkey: combo });
  }
  btn.textContent = hotkeyLabel();
  renderEngineStatus();
});

async function populateMics() {
  try {
    // labels need a (brief) active stream once
    const sel = $('#set-micDeviceId');
    let devices = await navigator.mediaDevices.enumerateDevices();
    if (!devices.some((d) => d.kind === 'audioinput' && d.label)) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((tr) => tr.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch { /* mic denied */ }
    }
    sel.innerHTML = `<option value="default">${t('settings.micDefault')}</option>`;
    for (const d of devices.filter((x) => x.kind === 'audioinput' && x.deviceId !== 'default' && x.deviceId !== 'communications')) {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || d.deviceId.slice(0, 12);
      sel.appendChild(o);
    }
    sel.value = settings.micDeviceId || 'default';
    if (sel.selectedIndex < 0) sel.value = 'default';
  } catch { /* ignore */ }
}

// ---------------- engine / models ----------------
$('#btn-install-engine').addEventListener('click', async () => {
  $('#btn-install-engine').disabled = true;
  try {
    engineState = await wp.installEngine($('#set-engineFlavor').value);
  } catch (err) {
    alert(t('engine.installError') + '\n' + String(err.message || err));
    engineState = await wp.engineState();
  }
  $('#btn-install-engine').disabled = false;
  renderEngineStatus();
  renderModelCards();
});

$('#btn-storage-change').addEventListener('click', async () => {
  const btn = $('#btn-storage-change');
  btn.disabled = true;
  try {
    const st = await wp.chooseStorage();
    if (st) engineState = st;
  } catch (err) {
    alert(t('settings.storageMoveError') + '\n' + String(err.message || err));
  }
  btn.disabled = false;
  renderEngineStatus();
  renderModelCards();
});
$('#btn-storage-open').addEventListener('click', () => wp.openStorage());

// ---------------- hardware recommendation ----------------
let hwInfo = null;
async function loadHwRecommendation() {
  try { hwInfo = await wp.hwRecommend(); } catch { return; }
  const r = hwInfo.recommend;
  const flavorLabel = r.flavor === 'cuda' ? t('settings.flavorCuda') : t('settings.flavorCpu');
  const gpuPart = hwInfo.gpu ? ` · ${hwInfo.gpu.name}（${Math.round(hwInfo.gpu.vramMB / 1024)} GB）` : '';
  const line = `${hwInfo.cpuName} · ${hwInfo.ramGB} GB RAM${gpuPart}　→　${flavorLabel} ＋ ${r.model}`;
  $('#hw-line').textContent = line;
  $('#hw-line').title = line;
  $('#ob-hw').textContent = `💻 ${line}`;
  updateHwApply();
  renderModelCards(); // show the hardware badge on the recommended card
  renderFlavorRow(); // show detected hardware names in the compute dropdown
}
function updateHwApply() {
  if (!hwInfo) return;
  const r = hwInfo.recommend;
  const btn = $('#btn-hw-apply');
  const matches = settings.engineFlavor === r.flavor && settings.model === r.model;
  btn.hidden = false;
  btn.disabled = matches;
  btn.classList.toggle('primary', !matches);
  btn.textContent = matches ? `✓ ${t('settings.hwApplied')}` : t('settings.hwApply');
}
$('#btn-hw-apply').addEventListener('click', async () => {
  if (!hwInfo) return;
  const r = hwInfo.recommend;
  const btn = $('#btn-hw-apply');
  btn.disabled = true;
  try {
    settings = await wp.setSettings({ engineFlavor: r.flavor });
    let st = await wp.engineState();
    if (!st.flavors[r.flavor]) engineState = await wp.installEngine(r.flavor);
    st = await wp.engineState();
    const m = st.models.find((x) => x.id === r.model);
    if (m && !m.installed) engineState = await wp.downloadModel(r.model);
    settings = await wp.setSettings({ model: r.model });
    engineState = await wp.engineState();
  } catch (err) {
    alert(t('settings.hwError') + '\n' + String(err.message || err));
  }
  btn.disabled = false;
  renderEngineStatus();
  renderModelCards();
});

function renderModelCards() {
  for (const { wrapSel, subset } of [
    { wrapSel: '#model-cards', subset: null },
    { wrapSel: '#ob-models', subset: ['large-v3-turbo-q5_0', 'small', 'tiny'] },
  ]) {
    const wrap = $(wrapSel);
    if (!wrap) continue;
    wrap.innerHTML = '';
    for (const m of engineState.models || []) {
      if (subset && !subset.includes(m.id)) continue;
      const selected = settings.model === m.id;
      const downloading = (engineState.activeDownloads || []).includes(`model:${m.id}`);
      const card = document.createElement('div');
      card.className = 'model-card' + (selected ? ' selected' : '');
      card.innerHTML = `
        <div class="mc-name">${m.id}${m.tier === 'recommended' ? `<span class="mc-badge">${t('models.recommended')}</span>` : ''}${hwInfo && hwInfo.recommend.model === m.id ? `<span class="mc-badge hw-badge">💻 ${t('models.hwRecommended')}</span>` : ''}</div>
        <div class="mc-info">${m.sizeMB} MB · RAM ${m.ram} · ${t(`models.tier.${m.tier}`)}</div>
        <div class="progress" data-prog="model:${m.id}" ${downloading ? '' : 'hidden'}><div class="bar"></div><span class="pct"></span></div>
        <div class="mc-actions">
          ${downloading
    ? `<span class="mc-badge">${t('models.downloading')}</span><button class="btn" data-act="cancel">${t('job.cancel')}</button>`
    : m.installed
      ? `${selected ? `<span class="mc-badge">${t('models.inUse')}</span>` : `<button class="btn" data-act="use">${t('models.use')}</button>`}
             <button class="btn danger" data-act="del">${t('models.delete')}</button>`
      : `<button class="btn" data-act="dl">${t('models.download')}</button>`}
        </div>`;
      card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.act === 'use') {
          settings = await wp.setSettings({ model: m.id });
          renderModelCards();
        } else if (b.dataset.act === 'del') {
          engineState = await wp.deleteModel(m.id);
          renderModelCards();
        } else if (b.dataset.act === 'cancel') {
          await wp.cancelDownload(`model:${m.id}`);
        } else if (b.dataset.act === 'dl') {
          b.disabled = true;
          card.querySelector('.progress').hidden = false;
          try {
            engineState = await wp.downloadModel(m.id);
            // downloading a model means you want to use it
            settings = await wp.setSettings({ model: m.id });
          } catch (err) {
            if (!String(err.message || err).includes('cancelled')) {
              alert(t('models.downloadError') + '\n' + String(err.message || err));
            }
            engineState = await wp.engineState();
          }
          renderModelCards();
          renderObState();
        }
      }));
      wrap.appendChild(card);
    }
  }
}

wp.on('engine:progress', (p) => {
  // engine install progress (settings + onboarding)
  if (p.key && p.key.startsWith('engine:')) {
    for (const sel of ['#engine-install-progress', '#ob-engine-progress']) {
      const el = $(sel);
      if (!el) continue;
      el.hidden = !!p.done || !!p.error;
      if (p.pct >= 0) {
        el.querySelector('.bar').style.width = `${p.pct}%`;
        el.querySelector('.pct').textContent = `${p.pct}%`;
      }
    }
    return;
  }
  const els = $$(`[data-prog="${p.key}"]`);
  for (const el of els) {
    el.hidden = false;
    if (p.error) { el.hidden = true; continue; }
    if (p.pct >= 0) {
      el.querySelector('.bar').style.width = `${p.pct}%`;
      el.querySelector('.pct').textContent = `${p.pct}%`;
    }
    if (p.done) el.hidden = true;
  }
});

wp.on('engine:status', (st) => {
  engineState = st;
  renderEngineStatus();
  renderModelCards();
  renderObState();
});

$('#btn-ai-test').addEventListener('click', async () => {
  const out = $('#ai-test-result');
  out.textContent = '…';
  const r = await wp.aiTest();
  out.textContent = r.ok
    ? `✓ ${t('settings.aiOk')}${r.models && r.models.length ? ` — ${r.models.slice(0, 6).join(', ')}` : ''}`
    : `⚠ ${r.error}`;
});

// ---------------- onboarding ----------------
function renderObState() {
  const obEngine = $('#ob-engine-state');
  if (!obEngine) return;
  obEngine.textContent = engineState.engineInstalled ? `✓ whisper.cpp ${engineState.whisperCppVersion}` : t('ob.engineDownloading');
  const hasModel = (engineState.models || []).some((m) => m.installed);
  $('#ob-next-2').disabled = !(engineState.engineInstalled && hasModel && settings.model);
}

async function startOnboarding() {
  showView('onboarding');
  $('#ob-locale').value = settings.locale;
  $('#ob-locale').addEventListener('change', async () => {
    settings = await wp.setSettings({ locale: $('#ob-locale').value });
    await reloadDict();
  });
  $('#ob-next-1').addEventListener('click', async () => {
    $('#ob-1').hidden = true;
    $('#ob-2').hidden = false;
    renderModelCards();
    renderObState();
    if (!engineState.engineInstalled) {
      try {
        engineState = await wp.installEngine('cpu');
      } catch (err) {
        $('#ob-engine-state').textContent = `⚠ ${String(err.message || err).slice(0, 120)}`;
      }
      renderObState();
    }
  });
  $('#ob-next-2').addEventListener('click', () => {
    $('#ob-2').hidden = true;
    $('#ob-3').hidden = false;
    $('#ob-ready-desc').textContent = t('ob.readyDesc', { key: hotkeyLabel() });
  });
  $('#ob-done').addEventListener('click', async () => {
    // locale-dependent defaults (initial prompt, Chinese variant) are applied in the main process
    settings = await wp.setSettings({ onboarded: true });
    await wp.restartEngine();
    showView('notes');
  });
}

// ---------------- dictation state in footer ----------------
wp.on('dictation:state', () => { /* reserved for future status UI */ });
wp.on('notes:changed', () => refreshNotesThrottled());
wp.on('settings:changed', (s) => { settings = s; renderEngineStatus(); });
wp.on('app:navigate', (view) => showView(view));

// ---------------- boot ----------------
async function reloadDict() {
  const d = await wp.boot();
  dict = d.dict.strings;
  dict.__locale = d.dict.locale;
  applyI18n();
  fillSettingsForm();
  renderEngineStatus();
  renderNoteList();
  renderModelCards();
}

(async function init() {
  const boot = await wp.boot();
  dict = boot.dict.strings;
  dict.__locale = boot.dict.locale;
  settings = boot.settings;
  engineState = boot.engine;
  $('#version').textContent = `v${boot.version} · whisper.cpp ${engineState.whisperCppVersion}`;
  applyI18n();
  fillSettingsForm();
  renderEngineStatus();
  renderModelCards();
  await refreshNotes();
  loadHwRecommendation();
  if (!boot.hotkeysAvailable) {
    setTimeout(() => alert(t('app.hotkeyUnavailable')), 800);
  }
  if (!settings.onboarded) startOnboarding();
  else showView('notes');
})();
