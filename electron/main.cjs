const { app, BrowserWindow, Menu, clipboard, ipcMain, net, protocol, screen, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdir, readFile, writeFile, unlink } = require('node:fs/promises');
const https = require('node:https');

app.setAppUserModelId('com.wildgrid.game');
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const GAME_URL = 'wildgrid://game/index.html';
const MAX_CLIPBOARD_LENGTH = 32768;
const PLAYER_ID_CACHE_VERSION = 2;
let playerIdRequest;

function validPlayerId(value) {
  return typeof value === 'string' && /^\d{6,}$/.test(value) && /[1-9]/.test(value) && (value.length === 6 || value[0] !== '0');
}

function getDeviceHash() {
  return new Promise((resolve, reject) => {
    execFile(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/reg.exe'), ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { timeout: 4000, maxBuffer: 8192, windowsHide: true }, (error, stdout) => {
      const rawGuid = !error && /^\s*MachineGuid\s+REG_SZ\s+(.+)$/im.exec(stdout)?.[1].trim();
      if (!rawGuid) return reject(new Error('Player ID unavailable'));
      resolve(createHash('sha256').update(`wildgrid-player-id-v1:${rawGuid}`).digest('hex'));
    });
  });
}

function requestPlayerId(apiUrl, deviceHash) {
  return new Promise((resolve, reject) => {
    const request = https.request(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 1024) request.destroy(new Error('Player ID unavailable'));
      });
      response.on('error', fail);
      response.on('end', () => {
        clearTimeout(timeout);
        try {
          const playerId = JSON.parse(body).id;
          if (response.statusCode !== 200 || !validPlayerId(playerId)) throw new Error();
          resolve(playerId);
        } catch { fail(); }
      });
    });
    const timeout = setTimeout(() => request.destroy(new Error('Player ID unavailable')), 8000);
    function fail() {
      clearTimeout(timeout);
      reject(new Error('Player ID unavailable'));
    }
    request.on('error', fail);
    request.end(JSON.stringify({ deviceHash }));
  });
}

async function resolvePlayerId(apiUrl) {
  const url = new URL(apiUrl);
  if (url.protocol !== 'https:' || url.hostname !== '179.255.156.84' || url.pathname !== '/api/player-id' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Player ID unavailable');
  if (!playerIdRequest) {
    playerIdRequest = (async () => {
      const file = path.join(app.getPath('userData'), 'player-id.json');
      try {
        const saved = JSON.parse(await readFile(file, 'utf8'));
        if (saved.playerIdCacheVersion === PLAYER_ID_CACHE_VERSION && validPlayerId(saved.playerId)) return { playerId: saved.playerId };
      } catch {}
      await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
      const playerId = await requestPlayerId(url, await getDeviceHash());
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ playerIdCacheVersion: PLAYER_ID_CACHE_VERSION, playerId }), 'utf8');
      return { playerId };
    })().catch(() => { throw new Error('Player ID unavailable'); }).finally(() => { playerIdRequest = undefined; });
  }
  return playerIdRequest;
}

function validateClipboardSender(event) {
  if (!BrowserWindow.fromWebContents(event.sender) || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== GAME_URL) {
    throw new Error('Clipboard access denied');
  }
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    title: '野格', width: Math.min(1080, area.width), height: Math.min(760, area.height), minWidth: Math.min(640, area.width), minHeight: Math.min(480, area.height),
    backgroundColor: '#f4f3e9', icon: path.join(app.getAppPath(), 'build/icon.ico'),
    show: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(app.getAppPath(), 'electron/preload.cjs') },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://github.com/lelexia0131/Wildgrid') void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('page-title-updated', event => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.loadURL(GAME_URL);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle('wildgrid:player-id-resolve', (event, apiUrl) => {
    if (!BrowserWindow.fromWebContents(event.sender) || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== GAME_URL) throw new Error('Player ID access denied');
    return resolvePlayerId(apiUrl);
  });
  ipcMain.handle('wildgrid:clipboard-write', (event, text) => {
    validateClipboardSender(event);
    if (typeof text !== 'string' || text.length > MAX_CLIPBOARD_LENGTH) throw new Error('Invalid map code');
    clipboard.writeText(text);
  });
  ipcMain.handle('wildgrid:clipboard-read', event => {
    validateClipboardSender(event);
    const text = clipboard.readText();
    if (text.length > MAX_CLIPBOARD_LENGTH) throw new Error('地图代码过长，请检查复制的内容');
    return text;
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({
    responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'"] },
  }));
  const root = path.join(app.getAppPath(), 'dist');
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'game') return new Response('Not found', { status: 404 });
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
