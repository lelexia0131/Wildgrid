const { app, BrowserWindow, Menu, clipboard, ipcMain, net, protocol, screen, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.setAppUserModelId('com.wildgrid.game');
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const GAME_URL = 'wildgrid://game/index.html';
const MAX_CLIPBOARD_LENGTH = 32768;

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
