const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const { appendFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const levels = require('../src/data/levels.json');
const solutions = require('../src/data/solutions.json');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.desktop-smoke', 'local-maps');
const storageKey = 'wildgrid-local-maps-v1';
const gameURL = 'wildgrid://game/index.html';
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'run.log'), '');
const log = message => { appendFileSync(path.join(output, 'run.log'), `${message}\n`); console.log(message); };
log('Starting local map UI checks.');
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const deadline = setTimeout(() => { log('Local map UI checks timed out.'); app.exit(1); }, 60000);

const pack = payload => `WG1:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const rotated8 = pack({ v: 1, s: 8, t: [['water', 3, 1]], f: [['camp_domino', 'rotated-camp', 3, 2, 1]], r: [0, 0, 0, 1, 1, 0, 0, 0], c: [0, 0, 2, 0, 0, 0, 0, 0] });
const camps = pack({ v: 1, s: 6, t: [1, 2].flatMap(c => [0, 3].map(r => ['water', r, c])), f: [['camp_single', 'a', 1, 1, 0], ['camp_single', 'b', 1, 2, 0]], r: [0, 2, 0, 0, 0, 0], c: [0, 1, 1, 0, 0, 0] });
const level30 = levels.find(level => level.id === 30);
const fullMap = pack({ v: 1, s: level30.size, t: level30.terrain.map(t => [t.kind, t.r, t.c]), f: level30.pieces.map(piece => {
  const at = solutions[30].find(at => at.id === piece.id);
  return [`${piece.kind}_${piece.shape}`, piece.id, at.r, at.c, at.rotation];
}), r: level30.rows, c: level30.cols });
const crowdedMaps = JSON.stringify({ version: 1, maps: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, code: i === 23 ? fullMap : rotated8, progress: [] })) });

app.whenReady().then(async () => {
  log('Electron ready.');
  const dist = path.join(root, 'dist');
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'game') return new Response('Not found', { status: 404 });
    const file = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(dist, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const contents = win.webContents;
  const errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code);
  const settle = () => new Promise(resolve => setTimeout(resolve, 60));
  async function waitFor(expression, label) {
    const until = Date.now() + 8000;
    while (Date.now() < until) {
      if (await js(expression)) return;
      await settle();
    }
    throw new Error(`Timed out: ${label}`);
  }
  async function click(selector) {
    await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing ${selector}'); el.click(); })()`);
    await settle();
  }
  async function clickText(text, scope = 'button') {
    await js(`(() => { const el = Array.from(document.querySelectorAll(${JSON.stringify(scope)})).find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw new Error('Missing button: ${text}'); el.click(); })()`);
    await settle();
  }
  const stored = () => js(`localStorage.getItem(${JSON.stringify(storageKey)})`);
  const entries = () => js(`JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})).maps`);
  const tile = (r, c) => click(`.board > .tile:nth-child(${r * 6 + c + 1})`);
  async function load() {
    await win.loadURL(gameURL);
    // Stub the native clipboard bridge on every load. The real clipboard is untouched.
    await js(`window.__clipboardWrites = []; window.wildgridClipboard = { writeText: async text => { window.__clipboardWrites.push(text); }, readText: async () => '' }; void 0;`);
    await settle();
  }
  async function modes() { await click('.menu-buttons .primary'); }
  async function editor() {
    await load(); await modes(); await clickText('沙盒模式'); await clickText('创造地图'); await click('.sandbox-size-card');
  }
  async function localPage() { await load(); await modes(); await clickText('本地地图'); }
  async function importMap(code) {
    await load(); await modes(); await clickText('沙盒模式'); await clickText('导入地图');
    await js(`(() => { const el = document.querySelector('#sandbox-map-code'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(code)}); el.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    await settle(); await click('.sandbox-import-start');
    assert.equal(await js(`Boolean(document.querySelector('.game-page'))`), true);
  }
  async function checkAction(selector, status) {
    await click(selector);
    await waitFor(`!document.querySelector('.sandbox-save').disabled && document.querySelector('.guide-strip').textContent.includes(${JSON.stringify(status)})`, status);
  }
  const geometry = () => js(`(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const preview = document.querySelector('.local-map-preview'), board = rect(preview);
    const regions = ['.local-maps-page', '.local-map-detail', '.local-map-content', '.local-map-items'].map(selector => {
      const el = document.querySelector(selector); return {selector,height:el.clientHeight,content:el.scrollHeight,scroll:el.scrollTop};
    });
    return {width:innerWidth,height:innerHeight,overflowX:document.documentElement.scrollWidth>innerWidth,documentHeight:document.documentElement.scrollHeight,
      list:rect(document.querySelector('.local-map-list')),detail:rect(document.querySelector('.local-map-detail')),preview:board,enter:rect(document.querySelector('.local-map-enter')),regions,
      artFits:Array.from(preview.querySelectorAll('.placed-facility-art')).every(el => { const r=rect(el); return r.left>=board.left-1 && r.top>=board.top-1 && r.right<=board.right+1 && r.bottom<=board.bottom+1; })};
  })()`);
  function assertFits(state) {
    assert.equal(state.overflowX, false, JSON.stringify(state));
    assert.ok(state.documentHeight <= state.height + 1, JSON.stringify(state));
    for (const region of state.regions) assert.ok(region.content <= region.height + 1 && region.scroll === 0, JSON.stringify(state));
    for (const rect of [state.preview, state.enter]) assert.ok(rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.top >= -1 && rect.right <= state.width + 1 && rect.bottom <= state.height + 1, JSON.stringify(state));
    assert.ok(Math.abs(state.preview.width - state.preview.height) < 1, JSON.stringify(state));
    assert.equal(state.artFits, true, JSON.stringify(state));
  }
  try {
    await load();
    contents.debugger.attach('1.3');
    log('Game loaded.');
    await js('localStorage.clear()'); await load(); await modes();
    assert.equal(await js(`document.querySelector('.sandbox-menu-copy h1').textContent`), '模式选择');
    assert.deepEqual(await js(`Array.from(document.querySelectorAll('.sandbox-choice strong')).map(el => el.textContent)`), ['继续冒险', '沙盒模式', '本地地图']);
    await clickText('本地地图');
    assert.equal(await js(`document.querySelector('.local-map-empty h2').textContent`), '还没有本地地图');
    assert.equal(await stored(), null);

    // The editor saves only after the actual worker finds a unique solution.
    await editor(); await click('.terrain-tools button:first-child'); await tile(0, 0);
    await click('[aria-label="选择单格营地，不限数量"]'); await tile(0, 1);
    assert.equal(await js(`document.querySelector('.operations').textContent.includes('营地自检')`), false);
    await checkAction('.sandbox-save', '已保存到本地地图1');
    assert.equal((await entries()).length, 1);
    assert.deepEqual((await entries())[0].progress, []);
    await click('.sandbox-export');
    await waitFor(`Boolean(document.querySelector('.map-code'))`, 'unique map export');
    assert.equal(await js('window.__clipboardWrites.length'), 1);
    assert.match(await js('window.__clipboardWrites[0]'), /^WG1:/);
    await click('.modal-close'); await click('.game-title .icon-button');
    assert.equal(await js(`document.querySelector('dialog').open`), false, 'saved editor should leave without a loss prompt');
    await localPage();
    assert.deepEqual(await js(`Array.from(document.querySelectorAll('.local-map-card strong')).map(el => el.textContent)`), ['本地地图1']);
    assert.equal(await js(`document.querySelector('.local-map-detail h2').textContent`), '本地地图1');
    assert.equal(await js(`document.querySelectorAll('.local-map-preview > .tile').length`), 36);
    assert.equal(await js(`document.querySelectorAll('.local-map-preview .terrain-water').length`), 1);
    assert.equal(await js(`document.querySelectorAll('.local-map-preview .placed').length`), 0);
    assert.ok(await js(`document.querySelector('.local-map-items').textContent.includes('营地')`));
    await click('.local-map-enter');
    assert.equal(await js(`document.querySelector('.game-title h1').textContent`), '本地地图1');
    assert.equal(await js(`document.querySelectorAll('.board > .tile.placed').length`), 0);
    const beforeBlueprint = await stored();
    assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), false);
    await click('.blueprint-button');
    assert.equal(await js(`document.querySelector('.blueprint-content h2').textContent`), '本地地图1 · 图纸');
    assert.equal(await js(`document.querySelectorAll('.blueprint-board > .tile.placed-camp').length`), 1);
    await click('.modal-close');
    assert.equal(await js(`document.querySelectorAll('.board > .tile.placed').length`), 0);
    assert.equal(await stored(), beforeBlueprint);
    await click('[aria-label="选择单格营地，剩余 1"]'); await tile(0, 1);
    assert.equal(await js(`Boolean(document.querySelector('.win-content'))`), true);

    // Imported maps retain partial progress across a reload and update the same save.
    await importMap(camps);
    assert.equal(await js(`document.querySelector('.operations').textContent.includes('沙盒模式')`), false);
    assert.equal(await js(`document.querySelector('.sandbox-save').textContent.trim()`), '保存');
    await click('[aria-label="选择单格营地，剩余 2"]'); await tile(1, 1);
    await checkAction('.sandbox-save', '已保存到本地地图2');
    assert.equal((await entries()).length, 2);
    assert.deepEqual((await entries()).find(map => map.id === 2).progress, [{ id: 'a', r: 1, c: 1, rotation: 0 }]);
    await checkAction('.sandbox-save', '已保存到本地地图2');
    assert.equal((await entries()).length, 2);
    await localPage(); await click('.local-map-card:nth-child(2)'); await click('.local-map-enter');
    assert.equal(await js(`document.querySelector('.game-title h1').textContent`), '本地地图2');
    assert.equal(await js(`document.querySelectorAll('.board > .tile.placed-camp').length`), 1);
    await tile(1, 1); await checkAction('.sandbox-save', '已保存到本地地图2');
    assert.deepEqual((await entries()).find(map => map.id === 2).progress, []);
    assert.equal((await entries()).length, 2);
    await importMap(rotated8); await checkAction('.sandbox-save', '已保存到本地地图3');
    assert.deepEqual((await entries()).map(map => map.id), [1, 2, 3]);
    log('Local map create, play, import, reload and update PASS.');

    // Rejected saves/exports have no storage or clipboard effects.
    await editor();
    const baseline = await stored();
    for (const selector of ['.sandbox-save', '.sandbox-export']) {
      await checkAction(selector, '请至少放置');
      assert.equal(await stored(), baseline); assert.equal(await js('window.__clipboardWrites.length'), 0);
    }
    await click('.terrain-tools button:first-child');
    for (const [r, c] of [[0, 1], [0, 2], [3, 1], [3, 2]]) await tile(r, c);
    await click('[aria-label="选择单格营地，不限数量"]'); await tile(1, 1); await tile(2, 2);
    for (const selector of ['.sandbox-save', '.sandbox-export']) {
      await checkAction(selector, '存在多个解');
      assert.equal(await stored(), baseline); assert.equal(await js('window.__clipboardWrites.length'), 0);
    }

    // Hold an actual worker result, edit the map to cancel it, then deliver the stale result.
    await editor(); await click('.terrain-tools button:first-child'); await tile(0, 0);
    await click('[aria-label="选择单格营地，不限数量"]'); await tile(0, 1);
    await js(`
      window.__NativeWorker = Worker; window.__workerTerminations = 0;
      window.Worker = class extends window.__NativeWorker {
        set onmessage(callback) { super.onmessage = event => { window.__heldWorkerResult = () => callback(event); }; }
        terminate() { window.__workerTerminations++; super.terminate(); }
      };
      void 0;
    `);
    await click('.sandbox-save');
    await waitFor(`Boolean(window.__heldWorkerResult)`, 'held worker result');
    assert.equal(await js(`document.querySelector('.sandbox-save').disabled`), true);
    await click('.terrain-tools button:first-child'); await tile(5, 5);
    assert.equal(await js(`document.querySelector('.sandbox-save').disabled`), false);
    assert.ok(await js('window.__workerTerminations > 0'));
    await js('window.__heldWorkerResult(); window.Worker = window.__NativeWorker; void 0;'); await settle();
    assert.equal(await stored(), baseline); assert.equal(await js('window.__clipboardWrites.length'), 0);
    log('Empty/multiple map rejection and stale worker cancellation PASS.');

    // A clipboard promise that resolves after leaving cannot reopen the old export dialog.
    await js(`window.wildgridClipboard.writeText = text => new Promise(resolve => { window.__resolveClipboard = () => { window.__clipboardWrites.push(text); resolve(); }; }); void 0;`);
    await click('.sandbox-export');
    await waitFor(`Boolean(window.__resolveClipboard)`, 'pending clipboard export');
    assert.equal(await js(`document.querySelector('.sandbox-save').disabled`), true);
    await click('.game-title .icon-button'); await clickText('确定返回');
    await js('window.__resolveClipboard(); void 0;'); await settle();
    assert.equal(await js(`Boolean(document.querySelector('.map-code')) || document.querySelector('dialog').open`), false);
    assert.equal(await js(`document.querySelector('.sandbox-menu-copy h1').textContent`), '沙盒模式');
    assert.equal(await stored(), baseline);
    log('Stale async export cancellation PASS.');

    const measurements = [], layoutFailures = [];
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 2434, height: 594 }]) {
      win.setContentSize(viewport.width, viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width < 1000 });
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: viewport.width < 1000 });
      await js(`localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(baseline)}); void 0;`);
      await localPage(); await click('.local-map-card:nth-child(3)');
      assert.equal(await js(`document.querySelectorAll('.local-map-preview > .tile').length`), 64);
      assert.equal(await js(`document.querySelectorAll('.local-map-preview .placed, .local-map-preview .placed-facility-art').length`), 0);
      assert.ok(await js(`document.querySelector('.local-map-items').textContent.includes('双格')`));
      const normal = await geometry();
      try { assertFits(normal); } catch (error) { layoutFailures.push({ viewport, scenario: 'three saves', message: error.message }); }
      if (viewport.width === 1280) assert.ok(normal.detail.left >= normal.list.right, JSON.stringify(normal));
      writeFileSync(path.join(output, `local-maps-${viewport.width}.png`), (await contents.capturePage()).toPNG());
      const beforeAnswer = await stored();
      await click('.local-map-enter');
      assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), false);
      await click('.blueprint-button');
      assert.equal(await js(`document.querySelectorAll('.blueprint-board > .tile').length`), 64);
      assert.equal(await js(`document.querySelectorAll('.blueprint-board > .tile.placed-camp').length`), 2);
      assert.deepEqual(await js(`(() => { const art = document.querySelector('.blueprint-board .placed-facility-art'); return {row:art.style.gridRow,column:art.style.gridColumn,viewBox:art.querySelector('.footprint-art').getAttribute('viewBox')}; })()`), { row: '4 / span 2', column: '3 / span 1', viewBox: '0 0 100 200' });
      assert.ok(await js(`(() => { const board=document.querySelector('.blueprint-board'), r=board.getBoundingClientRect(); return r.left>=0 && r.top>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1 && Array.from(board.querySelectorAll('.placed-facility-art')).every(el=>{const art=el.getBoundingClientRect();return art.left>=r.left && art.top>=r.top && art.right<=r.right && art.bottom<=r.bottom;}); })()`));
      writeFileSync(path.join(output, `local-map-blueprint-${viewport.width}.png`), (await contents.capturePage()).toPNG());
      await click('.modal-close');
      assert.equal(await js(`document.querySelectorAll('.board > .tile.placed').length`), 0);
      assert.equal(await stored(), beforeAnswer);
      await js(`localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(crowdedMaps)}); void 0;`);
      await localPage();
      assert.equal(await js(`document.querySelectorAll('.local-map-card').length`), 24);
      const beforeScroll = await geometry();
      const scrolling = await js(`(() => { const list = document.querySelector('.local-map-list'); list.scrollTop = 99999; return {scroll:list.scrollTop,height:list.clientHeight,content:list.scrollHeight}; })()`);
      if (!(scrolling.content > scrolling.height && scrolling.scroll > 0)) layoutFailures.push({ viewport, scenario: 'left save list scrolling', message: JSON.stringify(scrolling) });
      assert.deepEqual((await geometry()).detail, beforeScroll.detail, 'left list scrolling must leave map details fixed');
      await click('.local-map-card:last-child');
      assert.equal(await js(`document.querySelector('.local-map-detail h2').textContent`), '本地地图24');
      const crowded = await geometry();
      try { assertFits(crowded); } catch (error) { layoutFailures.push({ viewport, scenario: '24 saves and eight facility types', message: error.message }); }
      assert.ok(await js(`document.querySelectorAll('.local-map-items li').length >= 5`));
      writeFileSync(path.join(output, `local-maps-${viewport.width}-crowded.png`), (await contents.capturePage()).toPNG());
      measurements.push({ viewport, normal, crowded, scrolling });
    }
    assert.deepEqual(errors, []);
    writeFileSync(path.join(output, 'results.json'), JSON.stringify({ measurements, layoutFailures }, null, 2));
    assert.equal(layoutFailures.length, 0, 'Layout errors are recorded in results.json');
    log(`Local map viewport and preview PASS: ${JSON.stringify(measurements)}`);
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    writeFileSync(path.join(output, 'failure.png'), (await contents.capturePage()).toPNG());
    log(error.stack || String(error)); clearTimeout(deadline); app.exit(1);
  }
}).catch(error => { log(error.stack || String(error)); clearTimeout(deadline); app.exit(1); });
