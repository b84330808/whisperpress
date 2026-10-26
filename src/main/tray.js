'use strict';
const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const config = require('./config');
const { t } = require('./i18n');
const windows = require('./windows');

const ROOT = path.join(__dirname, '..', '..');
let tray = null;

function iconPath(recording) {
  return path.join(ROOT, 'assets', recording ? 'tray-rec.png' : 'tray.png');
}

function buildMenu() {
  const hk = config.get().hotkey;
  const codingMode = config.get().codingMode || 'off';
  const codingItem = (value, key) => ({
    label: t(key), type: 'radio', checked: codingMode === value,
    click: () => config.set({ codingMode: value }),
  });
  return Menu.buildFromTemplate([
    { label: t('tray.open'), click: () => windows.showMain() },
    { label: t('tray.hint', { key: (hk && hk.label) || 'F9' }), enabled: false },
    { type: 'separator' },
    {
      label: t('tray.codingMode'),
      submenu: [
        codingItem('off', 'settings.codingOff'),
        codingItem('auto', 'settings.codingAuto'),
        codingItem('on', 'settings.codingOn'),
      ],
    },
    { label: t('tray.settings'), click: () => windows.showMain('settings') },
    { type: 'separator' },
    { label: t('tray.quit'), click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}

function create() {
  if (tray) return tray;
  tray = new Tray(nativeImage.createFromPath(iconPath(false)));
  tray.setToolTip('WhisperPress');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => windows.showMain());
  config.on('changed', () => { if (tray) tray.setContextMenu(buildMenu()); });
  return tray;
}

function setRecording(rec) {
  if (!tray) return;
  tray.setImage(nativeImage.createFromPath(iconPath(rec)));
  tray.setToolTip(rec ? `WhisperPress — ${t('tray.recording')}` : 'WhisperPress');
}

module.exports = { create, setRecording };
