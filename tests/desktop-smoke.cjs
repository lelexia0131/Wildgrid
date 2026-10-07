const { app, BrowserWindow, shell } = require('electron');
const assert = require('node:assert/strict');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

// Load the packaged main process and resources without showing a window or
// modifying the player's real save. This is a one-shot desktop startup check.
const root = path.resolve(__dirname, '..');
const packaged = path.join(root, 'release/win-unpacked/resources/app.asar');
const userData = path.join(root, '.desktop-smoke', `startup-${process.pid}`);
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
app.getAppPath = () => packaged;
BrowserWindow.prototype.show = () => {};
const failures = [];
const externalURLs = [];
shell.openExternal = async url => { externalURLs.push(url); };
const deadline = setTimeout(() => { console.error('Desktop startup timed out.'); app.exit(1); }, 20000);

app.on('web-contents-created', (_event, contents) => {
  contents.on('did-fail-load', (_e, code, description) => failures.push(`${code}: ${description}`));
  contents.on('console-message', event => { if (event.level === 'error') failures.push(event.message); });
  contents.once('did-finish-load', async () => {
    try {
      assert.equal(existsSync(path.join(packaged, 'node_modules')), false, 'Desktop package must not include bundled web dependencies or Android build files');
      assert.equal(JSON.parse(readFileSync(path.join(packaged, 'package.json'), 'utf8')).version, '0.3.0');
      const state = await contents.executeJavaScript(`new Promise(resolve => requestAnimationFrame(() => {
        const art = document.querySelector('.menu-art')?.getBoundingClientRect();
        const buttons = document.querySelector('.menu-buttons')?.getBoundingClientRect();
        resolve({ menu: Boolean(buttons), heading: Boolean(document.querySelector('.menu-page h1')), buttonsBelowArt: Boolean(art && buttons && buttons.top >= art.bottom), protocol: location.protocol });
      }))`);
      if (!state.menu || state.heading || !state.buttonsBelowArt || state.protocol !== 'wildgrid:' || failures.length) throw new Error(JSON.stringify({ state, failures }));
      const click = selector => contents.executeJavaScript(`new Promise(resolve => {
        document.querySelector(${JSON.stringify(selector)}).click();
        requestAnimationFrame(() => resolve());
      })`, true);
      await click('.header [aria-label="设置"]');
      await click('.settings-about');
      const projectURL = 'https://github.com/lelexia0131/Wildgrid';
      assert.equal(await contents.executeJavaScript(`document.querySelector('.game-about a').href`), projectURL);
      await click('.game-about a');
      for (let attempt = 0; attempt < 50 && !externalURLs.length; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.deepEqual(externalURLs, [projectURL]);
      await click('.modal-close');
      await click('.modal-close');
      assert.equal(await contents.executeJavaScript(`document.querySelector('dialog').open`), false);
      assert.equal(failures.length, 0, JSON.stringify(failures));
      const screenshot = await contents.capturePage();
      writeFileSync(path.join(root, 'release/menu-preview.png'), screenshot.toPNG());
      console.log('Packaged desktop startup passed:', JSON.stringify(state));
      clearTimeout(deadline); app.exit(0);
    } catch (error) { console.error(error); clearTimeout(deadline); app.exit(1); }
  });
});
require(path.join(packaged, 'electron/main.cjs'));
