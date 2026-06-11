'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set([
  'app:navigate', 'engine:status', 'engine:progress', 'notes:changed',
  'dictation:state', 'job:update', 'ai:chunk', 'settings:changed',
]);

contextBridge.exposeInMainWorld('wp', {
  boot: () => ipcRenderer.invoke('app:boot'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  copy: (text) => ipcRenderer.invoke('app:copy', text),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  captureHotkey: () => ipcRenderer.invoke('settings:captureHotkey'),

  engineState: () => ipcRenderer.invoke('engine:state'),
  installEngine: (flavor) => ipcRenderer.invoke('engine:installEngine', flavor),
  downloadModel: (id) => ipcRenderer.invoke('engine:downloadModel', id),
  deleteModel: (id) => ipcRenderer.invoke('engine:deleteModel', id),
  cancelDownload: (key) => ipcRenderer.invoke('engine:cancelDownload', key),
  restartEngine: () => ipcRenderer.invoke('engine:restart'),
  chooseStorage: () => ipcRenderer.invoke('storage:choose'),
  setStorage: (dir) => ipcRenderer.invoke('storage:set', dir),
  openStorage: () => ipcRenderer.invoke('storage:open'),

  listNotes: () => ipcRenderer.invoke('notes:list'),
  getNote: (id) => ipcRenderer.invoke('notes:get', id),
  updateNote: (id, patch) => ipcRenderer.invoke('notes:update', { id, patch }),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', id),
  exportNote: (id, format) => ipcRenderer.invoke('notes:export', { id, format }),
  noteAudio: (id) => ipcRenderer.invoke('notes:audio', id),

  toggleDictation: () => ipcRenderer.invoke('dictation:toggle'),

  startTranscription: (payload) => ipcRenderer.invoke('transcribe:start', payload),
  cancelTranscription: (id) => ipcRenderer.invoke('transcribe:cancel', id),

  aiTest: () => ipcRenderer.invoke('ai:test'),
  aiSummarize: (noteId) => ipcRenderer.invoke('ai:summarize', noteId),
  aiChat: (noteId, messages, reqId) => ipcRenderer.invoke('ai:chat', { noteId, messages, reqId }),
  aiCancelChat: (reqId) => ipcRenderer.invoke('ai:cancelChat', reqId),

  on: (channel, cb) => {
    if (!EVENTS.has(channel)) throw new Error(`unknown event ${channel}`);
    const listener = (e, payload) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
