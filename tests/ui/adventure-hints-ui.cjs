const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const levels = require('../../src/game-data/levels.json'), solutions = require('../../src/game-data/solutions.json');
const root = path.resolve(__dirname, '../..'), output = path.join(root, '.desktop-smoke', 'adventure-hints');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const timeout = setTimeout(() => { console.error('Adventure hints UI timed out'); app.exit(1); }, 90000);

app.whenReady().then(async () => {
  protocol.handle('wildgrid', request => {
    const file = path.resolve(root, 'dist', `.${decodeURIComponent(new URL(request.url).pathname)}`);
    const relative = path.relative(path.join(root, 'dist'), file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({ width: 1280, height: 900, useContentSize: true, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const contents = win.webContents, errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code, true);
  const settle = () => new Promise(resolve => setTimeout(resolve, 90));
  let touch = false;
  async function click(selector) {
    if (touch) {
      const point = await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await settle();
  }
  async function waitHint() {
    const until = Date.now() + 7000;
    while (Date.now() < until) {
      if (await js(`!!document.querySelector('.hint-badge-confirmation')`)) { await click('.hint-badge-confirmation .primary'); continue; }
      if (await js(`!!document.querySelector('.hint-copy:not([aria-busy="true"]) p') && !document.querySelector('.hint-loading')`)) return;
      await settle();
    }
    throw new Error('Hint worker did not complete');
  }
  const snapshot = async name => writeFileSync(path.join(output, `${name}.png`), (await contents.capturePage()).toPNG());
  async function load(language) {
    const level = levels[27], cabin = level.pieces.find(p => p.kind === 'cabin');
    const save = { version: 1, completed: Array.from({ length: 27 }, (_, i) => i + 1), current: 28, progress: { 28: solutions[28].filter(at => at.id !== cabin.id) }, settings: { muted: true } };
    await win.loadURL('wildgrid://game/index.html');
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', ${JSON.stringify(JSON.stringify({ version: 1, enabled: false, language }))}); localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify(save))}); void 0;`);
    await win.loadURL('wildgrid://game/index.html'); await settle();
    await click('.menu-adventure'); await click('.mode-adventure');
  }
  try {
    contents.debugger.attach('1.3');
    for (const viewport of [{ width: 1280, height: 900, language: 'zh' }, { width: 390, height: 844, language: 'zh', touch: true }, { width: 360, height: 640, language: 'en', touch: true }, { width: 844, height: 390, language: 'en', touch: true }]) {
      touch = !!viewport.touch;
      win.setContentSize(viewport.width, viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: touch });
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: touch });
      await load(viewport.language);
      const before = await js(`localStorage.getItem('wildgrid-save-v1')`);
      assert.deepEqual(await js(`[...document.querySelectorAll('.camp-tool')].map(el => el.className.split(' ')[1])`), ['tool-undo', 'tool-blueprint', 'tool-restart', 'tool-hint']);
      assert.equal(await js(`!!document.querySelector('.tool-journal')`), false);
      assert.equal(await js(`document.querySelector('.tool-hint img').naturalWidth > 0`), true);
      await snapshot(`tools-${viewport.width}`);
      await click('.tool-hint'); await waitHint();
      assert.equal(await js(`document.querySelector('.tool-hint').dataset.hintStage`), '1');
      assert.equal(await js(`document.querySelectorAll('.hint-cell.visible').length`), 0);
      assert.equal(await js(`document.querySelector('.hint-facility')`), null);
      await click('.hint-panel footer button');
      if (await js(`!!document.querySelector('.hint-badge-confirmation')`)) await click('.hint-badge-confirmation .primary');
      assert.equal(await js(`document.querySelectorAll('.hint-cell.visible').length`), 8);
      await click('.hint-panel footer button');
      if (await js(`!!document.querySelector('.hint-badge-confirmation')`)) await click('.hint-badge-confirmation .primary');
      assert.equal(await js(`document.querySelector('.tool-hint').dataset.hintStage`), '3');
      await click('.hint-panel footer button');
      assert.equal(await js(`document.querySelector('.hint-facility').dataset.kind`), 'cabin');
      assert.equal(await js(`document.querySelector('.hint-facility .facility-footprint').dataset.shape`), 'el');
      const after = await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1'))`);
      assert.deepEqual(after.progress, JSON.parse(before).progress, 'hints never place facilities');
      assert.deepEqual(after.completed, JSON.parse(before).completed);
      assert.equal(Object.values(after.attempts[28].seen).reduce((sum, mask) => sum + (mask & 1 ? 1 : 0) + (mask & 2 ? 2 : 0) + (mask & 4 ? 3 : 0) + (mask & 8 ? 4 : 0), 0), 10);
      const layout = await js(`(() => { const panel=document.querySelector('.hint-panel'),board=document.querySelector('.board-with-clues'),p=panel.getBoundingClientRect(),b=board.getBoundingClientRect(),copy=document.querySelector('.hint-copy'),footer=document.querySelector('.hint-panel footer').getBoundingClientRect(); return {overlap:p.left<b.right&&p.right>b.left&&p.top<b.bottom&&p.bottom>b.top,overflow:document.documentElement.scrollWidth>innerWidth,copyHeight:copy.clientHeight,footerFits:footer.bottom<=p.bottom+1,text:panel.textContent}; })()`);
      assert.equal(layout.overlap, false); assert.equal(layout.overflow, false); assert.ok(layout.copyHeight > 20); assert.equal(layout.footerFits, true);
      if (viewport.language === 'en') assert.doesNotMatch(layout.text, /[\u3400-\u9fff]/u);
      await snapshot(`placement-${viewport.width}`);
      await click('.hint-panel header button'); await click('.tool-hint');
      assert.equal(await js(`document.querySelector('.tool-hint').dataset.hintStage`), '3');
      assert.equal(await js(`document.querySelector('.hint-preview-layer.visible')`), null);
      await click('.board .tile:not(.placed):not([class*="terrain-"])');
      assert.equal(await js(`document.querySelector('.hint-panel')`), null);
      await click('.tool-hint');
      assert.equal(await js(`document.querySelector('.tool-hint').dataset.hintStage`), '3', 'an empty click does not reset the hint');
      await click('.board [data-piece-id]');
      assert.equal(await js(`document.querySelector('.hint-panel')`), null);
      assert.equal(await js(`document.querySelector('.tool-hint').dataset.hintStage`), '1', 'a board change resets the hint');
      await click('.tool-hint'); await waitHint();
      await click('.hint-panel header button');
      await click('.game-title button');
      assert.equal(await js(`!!document.querySelector('.journal-page')`), true);
      await click('.journal-page .back-link');
      await new Promise(resolve => setTimeout(resolve, 400));
      await click('.journal-page .back-link');
      await click('.menu-guide');
      assert.equal(await js(`!!document.querySelector('.manual-notebook')`), true);
      for (const page of ['adventure-hints', 'camp-tools']) {
        await js(`(() => { const select=document.querySelector('.notebook-heading select'); const option=[...select.options].find(o=>o.textContent.includes(${JSON.stringify(page === 'camp-tools' ? viewport.language === 'en' ? 'Camp Tools' : '营地工具' : viewport.language === 'en' ? 'Adventure and smart hints' : '闯关模式与智能提示')})); select.value=option.value; select.dispatchEvent(new Event('change',{bubbles:true})); })()`); await settle();
        assert.equal(await js(`document.querySelector('.manual-page').dataset.page`), page);
        if (page === 'camp-tools') assert.equal(await js(`document.querySelectorAll('.manual-tool-grid img').length`), 4);
      }
    }
    assert.deepEqual(errors, []);
    console.log('Adventure hints UI passed: Chinese/English, desktop/touch portrait/landscape, progression, preview, persistence, reset, navigation and manual.');
  } catch (error) { console.error(error); await snapshot('failure'); app.exit(1); return; }
  finally { clearTimeout(timeout); }
  app.exit(0);
});
