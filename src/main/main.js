'use strict';
const { app, ipcMain, dialog, shell, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  bootstrap();
}

function bootstrap() {
  const config = require('./config');
  const i18n = require('./i18n');
  const windows = require('./windows');
  const tray = require('./tray');
  const engine = require('./engine');
  const hotkeys = require('./hotkeys');
  const injector = require('./injector');
  const dictation = require('./dictation');
  const notes = require('./notes');
  const jobs = require('./jobs');
  const ai = require('./ai');

  app.isQuitting = false;
  const aiChats = new Map(); // reqId -> AbortController

  app.on('second-instance', () => windows.showMain());

  app.whenReady().then(() => {
    windows.setupSession();
    windows.createMainWindow();
    windows.createOverlayWindow();
    tray.create();
    injector.warmup();

    const hotkeysOk = hotkeys.start();
    if (!hotkeysOk) console.error('global hotkeys unavailable');
    hotkeys.on('start', () => dictation.start());
    hotkeys.on('stop', () => dictation.stop());
    hotkeys.on('cancel', () => dictation.cancel());
    hotkeys.on('lock', () => dictation.lock());

    dictation.on('state', (s) => {
      tray.setRecording(s === 'recording');
      windows.broadcast('dictation:state', s);
    });

    engine.on('status', (st) => windows.broadcast('engine:status', st));
    engine.on('progress', (p) => windows.broadcast('engine:progress', p));
    notes.on('changed', () => windows.broadcast('notes:changed'));

    if (config.get().onboarded && config.get().model) engine.start();

    config.on('changed', (data, patch) => {
      if ('launchAtLogin' in patch) {
        app.setLoginItemSettings({ openAtLogin: !!data.launchAtLogin, path: process.execPath, args: [app.getAppPath()] });
      }
      const engineKeys = ['language', 'translate', 'initialPrompt', 'threads', 'model', 'engineFlavor'];
      if (engineKeys.some((k) => k in patch) && data.model) engine.start();
      windows.broadcast('settings:changed', data);
    });
  });

  app.on('window-all-closed', () => { /* stay in tray */ });
  app.on('activate', () => windows.showMain());
  app.on('before-quit', () => {
    app.isQuitting = true;
    engine.stop();
    engine.cancelFileTranscription();
    hotkeys.stop();
    injector.kill();
  });

  // ---------------- helpers ----------------
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function msToStamp(ms, sep = ',') {
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000); const mm = Math.floor(ms % 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(mm, 3)}`;
  }
  function noteToSrt(note) {
    const segs = note.segments && note.segments.length
      ? note.segments
      : [{ t0: 0, t1: note.durationMs || 1000, text: note.text }];
    return segs.map((s, i) => `${i + 1}\n${msToStamp(s.t0)} --> ${msToStamp(s.t1)}\n${s.text}\n`).join('\n');
  }
  function noteToMd(note) {
    const date = new Date(note.createdAt).toLocaleString();
    let md = `# ${note.title || 'Note'}\n\n> ${date}`;
    if (note.durationMs) md += ` · ${Math.round(note.durationMs / 1000)}s`;
    if (note.language) md += ` · ${note.language}`;
    md += '\n\n';
    if (note.summary) md += `## ${i18n.t('note.summary')}\n\n${note.summary}\n\n## ${i18n.t('note.transcript')}\n\n`;
    md += note.text + '\n';
    return md;
  }

  // ---------------- IPC: app/boot ----------------
  ipcMain.handle('app:boot', () => ({
    version: app.getVersion(),
    dict: i18n.dict(),
    settings: config.get(),
    engine: engine.getState(),
    hotkeysAvailable: hotkeys.available,
    dictationState: dictation.state,
  }));
  ipcMain.handle('i18n:dict', () => i18n.dict());
  ipcMain.handle('app:openExternal', (e, url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });

  // ---------------- IPC: settings ----------------
  ipcMain.handle('settings:get', () => config.get());
  ipcMain.handle('settings:set', (e, patch) => config.set(patch));
  ipcMain.handle('settings:captureHotkey', async () => {
    dictation.cancel();
    return hotkeys.captureNext();
  });

  // ---------------- IPC: engine ----------------
  ipcMain.handle('engine:state', () => engine.getState());
  ipcMain.handle('engine:installEngine', async (e, flavor) => { await engine.installEngine(flavor); return engine.getState(); });
  ipcMain.handle('engine:downloadModel', async (e, id) => { await engine.downloadModel(id); return engine.getState(); });
  ipcMain.handle('engine:deleteModel', (e, id) => { engine.deleteModel(id); return engine.getState(); });
  ipcMain.handle('engine:cancelDownload', (e, key) => engine.cancelDownload(key));
  ipcMain.handle('engine:restart', () => engine.start());
  ipcMain.handle('storage:choose', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(windows.main, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: engine.getState().storageDir,
    });
    if (canceled || !filePaths[0]) return null;
    return engine.setStorageDir(filePaths[0]);
  });
  ipcMain.handle('storage:set', (e, dir) => engine.setStorageDir(dir));
  ipcMain.handle('storage:open', () => shell.openPath(engine.getState().storageDir));

  // ---------------- IPC: notes ----------------
  ipcMain.handle('notes:list', () => notes.list().map((n) => ({
    id: n.id, createdAt: n.createdAt, title: n.title, source: n.source,
    durationMs: n.durationMs, language: n.language,
    snippet: (n.text || '').slice(0, 120), hasAudio: !!n.audioFile, hasSummary: !!n.summary,
  })));
  ipcMain.handle('notes:get', (e, id) => notes.get(id));
  ipcMain.handle('notes:update', (e, { id, patch }) => notes.update(id, patch));
  ipcMain.handle('notes:delete', (e, id) => notes.remove(id));
  ipcMain.handle('notes:audio', (e, id) => {
    const p = notes.audioPath(notes.get(id));
    if (!p || !fs.existsSync(p)) return null;
    return fs.readFileSync(p).buffer;
  });
  ipcMain.handle('notes:export', async (e, { id, format }) => {
    const note = notes.get(id);
    if (!note) return { ok: false };
    const baseName = (note.title || 'note').replace(/[\\/:*?"<>|\n]+/g, ' ').trim().slice(0, 60) || 'note';
    const filters = { txt: [{ name: 'Text', extensions: ['txt'] }], md: [{ name: 'Markdown', extensions: ['md'] }], srt: [{ name: 'SubRip', extensions: ['srt'] }] };
    const { canceled, filePath } = await dialog.showSaveDialog(windows.main, {
      defaultPath: `${baseName}.${format}`,
      filters: filters[format] || filters.txt,
    });
    if (canceled || !filePath) return { ok: false };
    const content = format === 'srt' ? noteToSrt(note) : format === 'md' ? noteToMd(note) : note.text;
    fs.writeFileSync(filePath, '﻿' + content, 'utf8');
    return { ok: true, filePath };
  });

  // ---------------- IPC: dictation / overlay ----------------
  ipcMain.handle('dictation:toggle', () => dictation.toggle());
  ipcMain.on('overlay:audio', (e, { wav, durationMs }) => dictation.onAudio(Buffer.from(wav), durationMs));
  ipcMain.on('overlay:error', (e, message) => dictation.onRecorderError(message));
  ipcMain.on('overlay:stopClick', () => { hotkeys.externalStop(); dictation.stop(); });
  ipcMain.on('overlay:cancelClick', () => { hotkeys.externalStop(); dictation.cancel(); });

  // ---------------- IPC: file/meeting transcription ----------------
  ipcMain.handle('transcribe:start', (e, { name, wav, durationMs, source, keepAudio, language }) => jobs.submit({
    name, wavBuffer: Buffer.from(wav), durationMs, source, keepAudio, language,
  }));
  ipcMain.handle('transcribe:cancel', (e, id) => jobs.cancel(id));

  // ---------------- IPC: AI ----------------
  ipcMain.handle('ai:test', async () => {
    try { return await ai.test(); } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('ai:summarize', async (e, noteId) => {
    const note = notes.get(noteId);
    if (!note || !note.text) throw new Error('empty note');
    const { title, summary } = await ai.summarize(note.text, i18n.resolveLocale());
    const patch = { summary };
    if (title && (note.source !== 'dictation')) patch.title = title;
    const updated = notes.update(noteId, patch);
    windows.broadcast('notes:changed');
    return updated;
  });
  ipcMain.handle('ai:chat', async (e, { noteId, messages, reqId }) => {
    const note = notes.get(noteId);
    if (!note) throw new Error('note not found');
    const ac = new AbortController();
    aiChats.set(reqId, ac);
    const sys = {
      role: 'system',
      content: 'You answer questions about the following voice transcript. Be concise. Answer in the language the user writes in.\n\n--- TRANSCRIPT ---\n' + note.text.slice(0, 24000),
    };
    try {
      await ai.chat([sys, ...messages], {
        signal: ac.signal,
        onChunk: (delta) => windows.broadcast('ai:chunk', { reqId, delta }),
      });
      windows.broadcast('ai:chunk', { reqId, done: true });
    } catch (err) {
      windows.broadcast('ai:chunk', { reqId, error: String(err.message || err), done: true });
    } finally {
      aiChats.delete(reqId);
    }
  });
  ipcMain.handle('ai:cancelChat', (e, reqId) => {
    const ac = aiChats.get(reqId);
    if (ac) ac.abort();
  });

  // copy helper (clipboard lives in main)
  ipcMain.handle('app:copy', (e, text) => clipboard.writeText(text || ''));
}
