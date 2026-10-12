const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

// Run after npm run build: npx electron tests/home-visual-smoke.cjs
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.desktop-smoke', 'home-visual');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => app.exit(1), 60000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, contextIsolation: true } });
  const contents = win.webContents;
  const js = code => contents.executeJavaScript(code);
  const settle = () => new Promise(resolve => setTimeout(resolve, 100));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); };
  const shot = async name => writeFileSync(path.join(output, `${name}.png`), (await contents.capturePage()).toPNG());
  const layout = async () => {
    assert.equal(await js('document.documentElement.scrollWidth > innerWidth'), false);
    // Board cells intentionally contain floating terrain tooltips beyond their width.
    assert.deepEqual(await js(`Array.from(document.querySelectorAll('button:not(.tile), h1, h2, .sandbox-choice-copy, .status-pill')).filter(el => el.getClientRects().length && el.clientWidth && el.scrollWidth > el.clientWidth + 2).map(el => el.textContent)`), []);
  };
  try {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    contents.debugger.attach('1.3');
    await js(`localStorage.setItem('wildgrid-tutorial-v1', '{"version":1,"enabled":false,"language":"zh"}')`);
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    for (const [width, height] of [[1280, 900], [390, 844], [844, 390], [320, 568]]) {
      win.setContentSize(width, height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
      for (const language of ['zh', 'en']) {
        // Exercise the real language selector, without reloading the home screen.
        await click('[data-tutorial="settings"]');
        await js(`document.querySelector('.tutorial-language select').value = '${language}'; document.querySelector('.tutorial-language select').dispatchEvent(new Event('change', { bubbles: true }))`);
        await settle();
        await layout();
        await shot(`settings-${language}-${width}`);
        await click('.modal-close');
        await js('document.fonts.ready');
        await layout();
        assert.equal(await js(`document.querySelector('.camp-title').getAttribute('aria-label')`), language === 'zh' ? '野格' : 'WILDGRID');
        assert.equal(await js(`document.querySelectorAll('.camp-title svg text').length`), 0);
        assert.equal(await js(`document.querySelectorAll('.camp-title svg defs > g > path').length`), language === 'zh' ? 0 : 8);
        assert.equal(await js(`(() => { const title = document.querySelector('.camp-title').getBoundingClientRect(); const buttons = document.querySelector('.menu-buttons').getBoundingClientRect(); return title.top >= 0 && buttons.bottom <= innerHeight && buttons.left >= 0 && buttons.right <= innerWidth; })()`), true);
        await shot(`home-${language}-${width}`);
        await click('.menu-buttons button:last-child'); await layout(); await shot(`manual-${language}-${width}`); await click('.modal-close');
        await click('.menu-buttons button:nth-child(2)'); await layout(); await click('.levels-page .back-link');
        await click('.menu-buttons .primary'); await layout(); await shot(`modes-${language}-${width}`);
        await click('.survival-entry'); await layout(); await shot(`survival-${language}-${width}`); await click('.survival-heading .back-link');
        await click('.sandbox-choice:nth-child(3)'); await layout(); await click('.sandbox-back');
        await click('.sandbox-choice:nth-child(4)'); await layout(); await click('.sandbox-back'); await click('.sandbox-back');
      }
    }
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await settle();
    const offset = () => js(`getComputedStyle(document.querySelector('.hero-current')).strokeDashoffset`);
    const before = await offset(); await new Promise(resolve => setTimeout(resolve, 250));
    assert.notEqual(await offset(), before);
    // One full dash period must produce the same geometry, without a reset jump.
    assert.equal(await js(`(() => { const a = document.querySelector('.hero-current').getAnimations()[0]; a.pause(); a.currentTime = 0; const first = getComputedStyle(a.effect.target).strokeDashoffset; a.currentTime = 3800; return first === getComputedStyle(a.effect.target).strokeDashoffset; })()`), true);
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await settle();
    assert.equal(await js(`document.querySelector('.hero-art').dataset.motion`), 'paused');
    assert.equal(await js(`document.querySelector('.hero-art').getAnimations({ subtree: true }).length`), 0);
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    // Simulate a visibility event because the smoke-test window stays offscreen.
    await js(`Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'))`);
    await settle();
    assert.equal(await js(`getComputedStyle(document.querySelector('.hero-cloud')).animationPlayState`), 'paused');
    await js(`Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange'))`);
    await settle();
    assert.equal(await js(`getComputedStyle(document.querySelector('.hero-cloud')).animationPlayState`), 'running');
    for (const language of ['zh', 'en']) {
      await js(`localStorage.removeItem('wildgrid-save-v1'); localStorage.setItem('wildgrid-tutorial-v1', '{"version":1,"enabled":false,"language":"${language}"}')`);
      await win.loadFile(path.join(root, 'dist', 'index.html'));
      await click('.menu-buttons .primary'); await click('.sandbox-choice:first-child');
      await layout(); await shot(`game-${language}-320`);
      await click('.facility-card');
      const answer = require('../src/data/solutions.json')['1'][0];
      await click(`[data-cell="${answer.r},${answer.c}"]`);
      assert.equal(await js(`!!document.querySelector('dialog[open] .win-content')`), true);
      await layout(); await shot(`win-${language}-320`);
    }
    console.log('PASS: live bilingual titles, four viewports, menu/settings/manual/win typography, seamless stream loop, reduced motion and visibility pause/resume.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    await shot('failure'); console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
