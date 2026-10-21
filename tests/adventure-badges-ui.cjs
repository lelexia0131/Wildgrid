const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.desktop-smoke', 'adventure-badges');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('Badge UI timed out'); app.exit(1); }, 45000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const contents = win.webContents;
  const js = async code => {
    try { return await contents.executeJavaScript(code, true); }
    catch (error) { throw new Error(`${code}: ${error.message}`); }
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 100));
  const load = () => win.loadFile(path.join(root, 'dist', 'index.html'));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); };
  try {
    for (const { width, height } of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 390, height: 780 }, { width: 360, height: 640 }]) {
      win.setContentSize(width, height);
      for (const replay of [false, true]) {
        await load();
        const save = { version: 1, completed: replay ? [1] : [], current: 1, progress: {}, badges: replay ? { 1: 'silver' } : {}, settings: { muted: true } };
        await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', '{"version":1,"enabled":false}'); localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify(save))}); void 0;`);
        await load(); await settle();
        if (replay) {
          await click('.menu-journal'); await click('.chapter-card'); await click('.level-card');
        } else {
          await click('.menu-adventure'); await click('.mode-adventure');
        }
        await click('.facility-card');
        await click('.board > .tile:nth-child(16)');
        await new Promise(resolve => setTimeout(resolve, 1500));
        assert.equal(await js(`!!document.querySelector('.win-modal[open]')`), true);
        assert.equal(await js(`!!document.querySelector('.win-modal .adventure-badge-award')`), !replay);
        assert.equal(await js(`!!document.querySelector('.adventure-badge-award small')`), false);
        assert.equal(await js(`document.querySelector('.win-modal').textContent.includes('永久保留')`), false);
        assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).badges[1]`), replay ? 'silver' : 'gold');
        writeFileSync(path.join(output, `${replay ? 'replay' : 'first'}-${width}.png`), (await contents.capturePage()).toPNG());
        await click('.modal-close');
        await click('.game-title button');
        if (!await js(`!!document.querySelector('.adventure-badge-stats')`)) await click('.back-link');
        assert.equal(await js(`document.querySelector('.adventure-badge-stats').textContent`), replay ? '0100' : '1000');
        assert.equal(await js(`document.querySelectorAll('.adventure-badge-stats svg').length`), 4);
        const layout = await js(`(() => {
          const grid = document.querySelector('.chapter-grid'), badges = document.querySelector('.adventure-badge-stats');
          grid.scrollTop = 0;
          const first = grid.firstElementChild.getBoundingClientRect(), area = grid.getBoundingClientRect();
          const result = { firstTop: first.top, gridTop: area.top, badgesBottom: badges.getBoundingClientRect().bottom };
          grid.scrollTop = grid.scrollHeight;
          result.lastBottom = grid.lastElementChild.getBoundingClientRect().bottom; result.gridBottom = area.bottom;
          grid.scrollTop = 0;
          return result;
        })()`);
        assert.ok(layout.firstTop >= layout.gridTop && layout.firstTop >= layout.badgesBottom, JSON.stringify({ width, height, ...layout }));
        assert.ok(layout.lastBottom <= layout.gridBottom + 1, JSON.stringify({ width, height, ...layout }));
        writeFileSync(path.join(output, `stats-${width}x${height}.png`), (await contents.capturePage()).toPNG());
      }
    }
    console.log('Badge UI passed: first clear shown, replay hidden, no small print, original badge preserved, stats show only icons and counts on desktop and mobile.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(deadline); app.exit(1); }
});
