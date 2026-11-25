const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../../src/game-data/levels.json');
const solutions = require('../../src/game-data/solutions.json');

const root = path.resolve(__dirname, '../..'), output = path.join(root, '.desktop-smoke', 'sandbox-sky');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('Sandbox sky UI timed out'); app.exit(1); }, 120000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const wc = win.webContents, errors = [];
  wc.on('console-message', event => { if (event.level === 'error' && !event.message.includes('ERR_')) errors.push(event.message); });
  const js = code => wc.executeJavaScript(code, true);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let touch = false;
  async function click(selector) {
    if (touch) {
      const point = await js(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)throw new Error('Missing target: '+${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await wc.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await wc.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    if (['.sandbox-size-card:first-child','[data-theme="grass"]','[data-theme="sky"]','.local-map-enter','.local-map-edit','.sandbox-import-start','.mode-adventure'].includes(selector))
      await js(`document.querySelector('[data-renderer="3d"] .board-mode')?.click()`);
    await wait(90);
  }
  async function until(expression) {
    for (let i = 0; i < 100; i++) { if (await js(expression)) return; await wait(80); }
    assert.fail(`Timed out: ${expression}`);
  }
  const tile = (r, c) => click(`.board > [data-cell="${r},${c}"]`);
  const layer = value => click(`[data-layer-button="${value}"]`);
  const choose = kind => click(`[data-facility="${kind}"]`);
  const brush = kind => click(`[data-terrain="${kind}"]`);
  const redo = async () => { await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true}))`); await wait(90); };
  const shot = async name => writeFileSync(path.join(output, name + '.png'), (await wc.capturePage()).toPNG());
  async function start() { await click('.menu-adventure'); await click('.mode-sandbox'); await click('.sandbox-choice'); }
  async function projection() {
    const badges = await js(`[...document.querySelectorAll('.cell-projection')].map(el => {
      const r=el.getBoundingClientRect(), tile=el.parentElement.getBoundingClientRect();
      return {width:r.width,height:r.height,foreground:el.parentElement.matches('.placed, :has(> .art)'),coversCenter:r.left<tile.x+tile.width/2&&r.right>tile.x+tile.width/2&&r.top<tile.y+tile.height/2&&r.bottom>tile.y+tile.height/2};
    })`);
    assert.ok(badges.length > 0);
    for (const badge of badges) {
      assert.ok(badge.width >= 11 && badge.width <= 24 && Math.abs(badge.width - badge.height) < 1, JSON.stringify(badge));
      if (badge.foreground) assert.equal(badge.coversCenter, false, 'projection badges must leave the facility center clear');
    }
  }
  try {
    await win.loadFile(path.join(root, 'dist/index.html'));
    wc.debugger.attach('1.3');
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      touch = viewport.width !== 1280;
      win.setContentSize(viewport.width, viewport.height);
      await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: touch });
      await wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: touch });
      await js(`localStorage.clear(); localStorage.setItem('wildgrid-display-v1','{"mode":"2d","quality":"medium"}'); localStorage.setItem('wildgrid-tutorial-v1','{"version":1,"enabled":false}'); localStorage.setItem('wildgrid-save-v1','{"version":1,"settings":{"muted":true}}')`);
      await win.loadFile(path.join(root, 'dist/index.html')); await wait(150);
      await js(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__exported=value}}});void 0`);
      await start();
      await click('.sandbox-size-card:first-child');
      assert.equal(await js(`document.querySelectorAll('.board > .tile').length`), 36);
      assert.equal(await js(`!!document.querySelector('.board-view-controls')`), false);
      assert.equal(await js(`document.querySelectorAll('.terrain-tools button').length`), 3);
      await click('.game-title > button'); await click('.sandbox-choice'); await click('.sandbox-size-card:nth-child(2)');
      assert.equal(await js(`document.querySelectorAll('[data-theme]').length`), 2);
      await click('.sandbox-back');
      assert.ok(await js(`!!document.querySelector('.screen-sandbox-size')`));
      await click('.sandbox-size-card:nth-child(2)');
      await shot(`themes-${viewport.width}`);
      await click('[data-theme="grass"]');
      assert.equal(await js(`document.querySelectorAll('.board > .tile').length`), 64);
      assert.equal(await js(`!!document.querySelector('.board-view-controls')`), false);
      await click('.game-title > button'); await click('.sandbox-choice'); await click('.sandbox-size-card:nth-child(2)');
      await click('[data-theme="sky"]');
      assert.equal(await js(`document.querySelector('.board-section').dataset.layer`), 'ground');
      assert.equal(await js(`document.querySelectorAll('.terrain-tools button').length`), 4);
      await brush('anchor'); await tile(1, 0);
      await brush('water'); await tile(0, 1);
      await choose('camp'); await tile(1, 1);
      await layer('sky');
      assert.deepEqual(await js(`[...document.querySelectorAll('[data-facility]')].map(el=>el.dataset.facility)`), ['balloon', 'airship', 'kite']);
      assert.deepEqual(await js(`[...document.querySelectorAll('[data-terrain]')].map(el=>el.dataset.terrain)`), ['cloud']);
      await brush('cloud'); await tile(7, 7);
      await layer('ground'); await click('.tool-undo');
      assert.equal(await js(`document.querySelector('.board-section').dataset.layer`), 'sky');
      assert.equal(await js(`!!document.querySelector('.terrain-cloud')`), false);
      await redo(); assert.ok(await js(`!!document.querySelector('.terrain-cloud')`));
      await choose('balloon'); await tile(1, 1);
      await click('.tool-undo'); assert.equal(await js(`!!document.querySelector('.placed-balloon')`), false);
      await redo(); assert.ok(await js(`!!document.querySelector('.placed-balloon')`));
      await projection(); await shot(`sky-${viewport.width}`);
      await layer('ground');
      assert.ok(await js(`!!document.querySelector('.placed-camp .cell-projection[data-projection="balloon"]')`));
      await projection(); await shot(`ground-${viewport.width}`);
      assert.equal(await js(`document.documentElement.scrollWidth > innerWidth`), false);
      await click('.projection-toggle'); assert.equal(await js(`document.querySelectorAll('.cell-projection').length`), 0);
      await click('.projection-toggle');
      await click('.sandbox-save');
      await until(`JSON.parse(localStorage.getItem('wildgrid-local-maps-v1')||'null')?.maps.length===1`);
      await click('.sandbox-export'); await until(`!!document.querySelector('.map-code textarea')`);
      const code = await js(`document.querySelector('.map-code textarea').value`);
      assert.equal(await js(`window.__exported`), code);
      const payload = JSON.parse(Buffer.from(code.slice(4), 'base64url').toString('utf8'));
      assert.deepEqual(payload.sky.anchors, [{ r: 1, c: 0 }]);
      assert.deepEqual(payload.sky.clouds, [{ r: 7, c: 7 }]);
      assert.equal(payload.sky.rows[1], 1); assert.equal(payload.r[1], 1);
      await click('.modal-close'); await click('.game-title > button');
      assert.ok(await js(`!!document.querySelector('.local-map-preview .terrain-anchor')`));
      await click('.local-map-enter'); await choose('camp'); await tile(1, 1);
      await layer('sky'); await click('.sandbox-save');
      await until(`JSON.parse(localStorage.getItem('wildgrid-local-maps-v1')).maps[0].progress.length===1`);
      await click('.game-title > button'); await click('.local-map-enter');
      assert.ok(await js(`!!document.querySelector('.placed-camp')`));
      await layer('sky'); await choose('balloon'); await tile(1, 1);
      await until(`!!document.querySelector('.status-pill.finished')`);
      await until(`!!document.querySelector('.win-content')`); await click('.modal-close');
      await click('.game-title > button'); await click('.local-map-edit');
      await layer('sky'); assert.ok(await js(`!!document.querySelector('.placed-balloon')`));
      await click('.game-title > button'); await click('.sandbox-back'); await click('.mode-sandbox'); await click('.sandbox-choice:nth-child(2)');
      await js(`(() => { const el=document.querySelector('#sandbox-map-code'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(code)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await wait(90); await click('.sandbox-import-start');
      assert.equal(await js(`document.querySelectorAll('.board .placed').length`), 0);
      await layer('sky');
      assert.ok(await js(`!!document.querySelector('.terrain-cloud')`));
      assert.equal(await js(`document.querySelectorAll('.board .placed').length`), 0);
      console.log(`PASS sandbox flow, layered edits/history, save/export/import/play and projection sizing at ${viewport.width}×${viewport.height}`);

      const adventure = levels.find(level => level.id === 60);
      const airship = adventure.pieces.find(piece => piece.kind === 'airship');
      const balloon = adventure.pieces.find(piece => piece.kind === 'balloon');
      const partial = solutions[60].filter(at => at.id !== airship.id && at.id !== balloon.id);
      const save = { version: 1, completed: levels.filter(level => level.id < 60).map(level => level.id), current: 60, progress: { 60: partial }, layers: { 60: 'sky' }, settings: { muted: true } };
      await js(`localStorage.setItem('wildgrid-save-v1',${JSON.stringify(JSON.stringify(save))})`);
      await win.loadFile(path.join(root, 'dist/index.html')); await wait(150);
      await click('.menu-adventure'); await click('.mode-adventure');
      assert.equal(await js(`document.querySelector('.board-section').dataset.layer`), 'sky');
      await projection(); await choose('airship');
      const target = solutions[60].find(at => at.id === airship.id);
      for (let i = 0; i < target.rotation; i++) await choose('airship');
      await tile(target.r, target.c);
      await layer('ground'); await projection(); await click('.tool-undo');
      assert.equal(await js(`document.querySelector('.board-section').dataset.layer`), 'sky');
      assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).progress[60].length`), partial.length);
      await shot(`adventure-sky-${viewport.width}`);
      console.log(`PASS original sky adventure projection, placement and undo at ${viewport.width}×${viewport.height}`);
    }
    assert.deepEqual(errors, []);
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    await shot('failure'); console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
