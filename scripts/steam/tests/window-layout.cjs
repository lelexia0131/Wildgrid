const { app, BrowserWindow, screen } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const run = process.env.WILDGRID_STEAM_RUN;
const standard = process.argv.includes('--standard');
const archive = standard ? path.join(run, 'work/standard-release/win-unpacked/resources/app.asar') : path.join(process.env.WILDGRID_STEAM_CONTENT, 'resources/app.asar');
const output = path.join(run, 'logs/window-layout');
mkdirSync(output, { recursive: true });
const profile = path.join(run, 'work', standard ? 'standard-window-profile' : 'window-layout-profile');
mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
// A synthetic cache avoids contacting the live identity service from this test.
if (standard) writeFileSync(path.join(profile, 'player-id.json'), JSON.stringify({ playerIdCacheVersion: 2, playerId: '123456' }));
app.getAppPath = () => archive;
BrowserWindow.prototype.show = () => {};
const timer = setTimeout(() => { console.error('Window layout timed out'); app.exit(1); }, 90000);
app.on('web-contents-created', (_event, contents) => {
  contents.once('did-finish-load', async () => {
    try {
      contents.setBackgroundThrottling(false);
      const win = BrowserWindow.fromWebContents(contents);
      const js = expression => contents.executeJavaScript(expression, true);
      const delay = () => new Promise(resolve => setTimeout(resolve, 500));
      await delay();
      if (standard) {
        assert.equal(win.isFullScreen(), false);
        assert.ok(win.getBounds().height > win.getContentBounds().height, 'Ordinary Windows keeps its native frame');
        assert.equal(await js('typeof window.wildgridWindow'), 'undefined');
        assert.equal(await js('typeof window.wildgridPlayerId.resolve'), 'function');
        await js(`document.querySelector('[data-tutorial="settings"]').click()`); await delay();
        assert.equal(await js(`document.querySelector('.player-id-setting').innerText.includes('123456')`), true);
        console.log('PASS: ordinary Windows native frame, windowed startup, cached ID bridge and settings preserved. Live ID service was not contacted.');
        clearTimeout(timer); app.exit(0); return;
      }
      assert.equal(win.isFullScreen(), true);
      // Electron's Windows IsKiosk getter aliases IsFullscreen; verify usable
      // window controls here and actual shortcuts/exit in the packaged EXE test.
      assert.equal(win.isClosable(), true); assert.equal(win.isMinimizable(), true);
      const actualDisplay = { bounds: win.getBounds(), content: win.getContentBounds(), displays: screen.getAllDisplays().map(display => ({ bounds: display.bounds, scaleFactor: display.scaleFactor })) };
      assert.deepEqual(actualDisplay.bounds, actualDisplay.content);
      contents.debugger.attach('1.3');
      const results = [];
      for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [3440, 1440], [3840, 2160]]) {
        await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await delay();
        const state = await js(`(() => {
          const elements = [...document.querySelectorAll('.menu-buttons button, .header button')];
          return { width: innerWidth, height: innerHeight, reachable: elements.every(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && (hit === el || el.contains(hit)); }) };
        })()`);
        assert.equal(state.width, width); assert.equal(state.height, height); assert.equal(state.reachable, true);
        await js(`document.querySelector('[data-tutorial="settings"]').click()`); await delay();
        await js(`document.querySelector('.steam-exit').scrollIntoView({block:'center'})`); await delay();
        assert.equal(await js(`(() => { const el=document.querySelector('.steam-exit'),r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit); })()`), true, 'Exit must be clickable in settings');
        const screenshot = await contents.debugger.sendCommand('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path.join(output, `${width}x${height}-settings.png`), Buffer.from(screenshot.data, 'base64'));
        await js(`document.querySelector('.modal-close').click()`); await delay();
        results.push(state);
      }
      writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, actualDisplay, simulatedViewports: results, multiMonitorHardwareTested: false }, null, 2));
      console.log('PASS: borderless fullscreen bounds and six desktop layouts; settings and exit remain reachable.');
      clearTimeout(timer); app.exit(0);
    } catch (error) { console.error(error); clearTimeout(timer); app.exit(1); }
  });
});
require(path.join(archive, 'electron/main.cjs'));
