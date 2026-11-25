const { app, BrowserWindow, ipcMain, screen } = require('electron');
const { readFileSync, writeFileSync, mkdirSync, renameSync } = require('node:fs');
const path = require('node:path');

const file = () => path.join(app.getPath('userData'), 'steam-display.json');
let saved = {};
let saveError = false;

function windowOptions() {
  try { saved = JSON.parse(readFileSync(file(), 'utf8')); } catch { saved = {}; }
  const bounds = saved?.bounds;
  const valid = bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key]));
  const display = valid ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = Math.min(area.width, Math.max(640, valid ? bounds.width : 1080));
  const height = Math.min(area.height, Math.max(480, valid ? bounds.height : 760));
  return {
    frame: false, fullscreen: saved?.fullscreen !== false, fullscreenable: true, kiosk: false,
    width, height, minWidth: Math.min(640, area.width), minHeight: Math.min(480, area.height),
    x: valid ? Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)) : area.x + Math.round((area.width - width) / 2),
    y: valid ? Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) : area.y + Math.round((area.height - height) / 2),
  };
}

function attachWindow(window, gameURL) {
  let preferredFullscreen = saved?.fullscreen !== false;
  const state = () => ({ fullscreen: window.isFullScreen(), saved: !saveError });
  const persist = () => {
    try {
      mkdirSync(app.getPath('userData'), { recursive: true });
      writeFileSync(file() + '.tmp', JSON.stringify({ fullscreen: preferredFullscreen, bounds: window.getNormalBounds() }));
      renameSync(file() + '.tmp', file());
      saveError = false;
    } catch { saveError = true; }
  };
  const changed = fullscreen => {
    preferredFullscreen = fullscreen;
    persist();
    window.webContents.send('wildgrid:window-changed', state());
  };
  window.on('enter-full-screen', () => changed(true));
  window.on('leave-full-screen', () => changed(false));
  const setFullscreen = value => {
    preferredFullscreen = value;
    window.setFullScreen(value);
    persist();
  };
  window.on('close', persist);
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault();
      setFullscreen(!window.isFullScreen());
    }
  });
  function handle(channel, callback) {
    ipcMain.handle(channel, (event, ...args) => {
      if (BrowserWindow.fromWebContents(event.sender) !== window || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== gameURL) throw new Error('Window access denied');
      return callback(...args);
    });
    window.once('closed', () => ipcMain.removeHandler(channel));
  }
  handle('wildgrid:window-state', state);
  handle('wildgrid:window-fullscreen', value => {
    if (typeof value !== 'boolean') throw new Error('Invalid display mode');
    setFullscreen(value);
    return state();
  });
  handle('wildgrid:window-close', () => { window.close(); });
}

module.exports = { windowOptions, attachWindow };
