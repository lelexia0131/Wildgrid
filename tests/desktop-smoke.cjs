const { app, BrowserWindow } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

// Load the packaged main process and resources without showing a window or
// modifying the player's real save. This is a one-shot desktop startup check.
const root = path.resolve(__dirname, '..');
const packaged = path.join(root, 'release/win-unpacked/resources/app.asar');
const userData = path.join(root, '.desktop-smoke');
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
app.getAppPath = () => packaged;
BrowserWindow.prototype.show = () => {};
const failures = [];
const deadline = setTimeout(() => { console.error('Desktop startup timed out.'); app.exit(1); }, 20000);

app.on('web-contents-created', (_event, contents) => {
  contents.on('did-fail-load', (_e, code, description) => failures.push(`${code}: ${description}`));
  contents.on('console-message', event => { if (event.level === 'error') failures.push(event.message); });
  contents.once('did-finish-load', async () => {
    try {
      const state = await contents.executeJavaScript(`new Promise(resolve => requestAnimationFrame(() => {
        const art = document.querySelector('.menu-art')?.getBoundingClientRect();
        const buttons = document.querySelector('.menu-buttons')?.getBoundingClientRect();
        resolve({ menu: Boolean(buttons), heading: Boolean(document.querySelector('.menu-page h1')), buttonsBelowArt: Boolean(art && buttons && buttons.top >= art.bottom), protocol: location.protocol });
      }))`);
      if (!state.menu || state.heading || !state.buttonsBelowArt || state.protocol !== 'wildgrid:' || failures.length) throw new Error(JSON.stringify({ state, failures }));
      const screenshot = await contents.capturePage();
      writeFileSync(path.join(root, 'release/menu-preview.png'), screenshot.toPNG());
      console.log('Packaged desktop startup passed:', JSON.stringify(state));
      clearTimeout(deadline); app.exit(0);
    } catch (error) { console.error(error); clearTimeout(deadline); app.exit(1); }
  });
});
require(path.join(packaged, 'electron/main.cjs'));
