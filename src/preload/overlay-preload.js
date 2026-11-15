'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wp', {
  onCmd: (cb) => ipcRenderer.on('overlay:cmd', (e, payload) => cb(payload)),
  sendAudio: (wav, durationMs) => ipcRenderer.send('overlay:audio', { wav, durationMs }),
  sendError: (message) => ipcRenderer.send('overlay:error', message),
  stopClick: () => ipcRenderer.send('overlay:stopClick'),
  cancelClick: () => ipcRenderer.send('overlay:cancelClick'),
  dragStart: () => ipcRenderer.send('overlay:dragStart'),
  dragEnd: () => ipcRenderer.send('overlay:dragEnd'),
  previewClose: () => ipcRenderer.send('overlay:previewClose'),
  dict: () => ipcRenderer.invoke('i18n:dict'),
});
