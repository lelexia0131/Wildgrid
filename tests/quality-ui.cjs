const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/data/levels.json'), solutions = require('../src/data/solutions.json');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'quality');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => app.exit(1), 60000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const wc = win.webContents, errors = [];
  wc.on('console-message', event => { if (event.level === 'error' && !event.message.includes('ERR_')) errors.push(event.message); });
  const js = code => wc.executeJavaScript(code, true);
  const wait = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));
  let touch = false;
  async function click(selector) {
    if (touch) {
      const point = await js(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await wc.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await wc.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await wait(40);
  }
  async function load(day = 1, progress = [], language = 'zh', extra = {}) {
    await win.loadFile(path.join(root, 'dist/index.html'));
    await js(`localStorage.clear(); Object.entries(${JSON.stringify({
      'wildgrid-save-v1': JSON.stringify({ version: 1, current: day, completed: Array.from({ length: day - 1 }, (_, i) => i + 1), progress: { [day]: progress } }),
      'wildgrid-tutorial-v1': JSON.stringify({ version: 1, enabled: false, language }), ...extra,
    })}).forEach(([key,value])=>localStorage.setItem(key,value))`);
    await win.loadFile(path.join(root, 'dist/index.html')); await wait();
  }
  async function enter() { await click('.menu-adventure'); await click('.mode-adventure'); await wait(); }
  const saved = () => js(`JSON.parse(localStorage.getItem('wildgrid-save-v1'))`);
  const shot = async name => writeFileSync(path.join(output, `${name}.png`), (await wc.capturePage()).toPNG());
  try {
    await win.loadFile(path.join(root, 'dist/index.html')); wc.debugger.attach('1.3');
    for (const [width, height, language] of [[1280,900,'zh'], [390,844,'zh'], [844,390,'en'], [320,568,'en']]) {
      touch = width !== 1280; win.setContentSize(width, height);
      await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
      await wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: touch });
      await load(1, [], language); await enter();
      const at = solutions[1][0];
      await click('.facility-card'); await click(`[data-cell="${at.r},${at.c}"]`);
      assert.equal(await js(`!!document.querySelector('.celebrating') && !document.querySelector('dialog').open`), true);
      assert.deepEqual((await saved()).completed, [1], 'save completes before the animation');
      await shot(`celebration-${width}`);
      await click(`[data-cell="${at.r},${at.c}"]`);
      assert.equal(await js(`document.querySelector('dialog').open`), true, 'board tap skips without picking up');
      assert.equal((await saved()).progress[1].length, 1);
      await click('.win-content .primary'); await wait(800);
      assert.equal(await js(`document.querySelector('dialog').open`), false, 'no stale timer opens next level');
      const level = levels.find(l => l.id === 30), piece = level.pieces.find(p => p.shape === 'el');
      const placed = solutions[30].find(p => p.id === piece.id);
      await load(30, [placed], language); await enter();
      const cell = `[data-piece-id="${piece.id}"]`;
      await click(cell);
      assert.equal(await js(`document.querySelectorAll('[data-art-id]').length`), 0);
      await click('.tool-undo'); await wait();
      assert.deepEqual((await saved()).progress[30], [placed]);
      assert.equal(await js(`document.querySelectorAll('[data-art-id]').length`), 1);
      assert.equal(await js(`document.querySelectorAll('.departing-facility').length`), 0);
      await js(`document.querySelector('.board').scrollIntoView({block:'center'})`);
      const geometry = await js(`(() => {
        const board=document.querySelector('.board'), art=board.querySelector('[data-art-id]'), r=board.getBoundingClientRect();
        const ids=Array.from(board.querySelectorAll('[id]')).map(el=>el.id);
        return {fits:r.width>0 && r.left>=0 && r.right<=innerWidth+1, ids:ids.length===new Set(ids).size,
          upright:getComputedStyle(art).transform==='none', cells:board.querySelectorAll(':scope > .tile').length,
          hits:Array.from(board.querySelectorAll('.tile[data-piece-id]')).every(el=>{const p=el.getBoundingClientRect();return document.elementFromPoint(p.x+p.width/2,p.y+p.height/2)===el;})}; })()`);
      assert.deepEqual(geometry, { fits: true, ids: true, upright: true, cells: 64, hits: true });
      await shot(`board-${width}`);
      console.log(`PASS ${width}x${height} ${language}: celebration, skip, next, multi-cell pickup/undo, hit targets`);
    }
    touch = false;
    await load(17); await enter();
    await click('[data-facility="camp"][data-shape="domino"]');
    await click('[data-facility="camp"][data-shape="domino"]');
    await click('.tile.terrain-water');
    assert.equal((await saved()).progress[17].length, 0, 'blocked placement leaves the save untouched');
    assert.equal(await js(`document.querySelector('.guide-strip').textContent.includes('固定地形')`), true);
    await click('[data-cell="3,3"]'); await click('[data-cell="3,4"]');
    assert.deepEqual((await saved()).progress[17].map(p=>[p.r,p.c,p.rotation]), [[3,3,1],[3,4,1]]);
    await click('.tool-undo'); await wait();
    assert.equal(await js(`document.querySelectorAll('[data-art-id]').length`), 1);
    await load(); await enter(); await click('.facility-card');
    const at = solutions[1][0]; await click(`[data-cell="${at.r},${at.c}"]`);
    await wait(650);
    assert.equal(await js(`document.querySelector('dialog').open`), true, 'celebration automatically opens results');
    await wait(700);
    assert.equal(await js(`!!document.querySelector('.board-celebration')`), false);
    // A fixed authored solution is only a test fixture; production generation is untouched.
    const level = levels.find(l => l.id === 17), answer = solutions[17], last = answer.at(-1);
    const code = `WG1:${Buffer.from(JSON.stringify({v:1,s:8,t:level.terrain.map(t=>[t.kind,t.r,t.c]),
      f:level.pieces.map(p=>{const a=answer.find(a=>a.id===p.id);return [`${p.kind}_${p.shape}`,p.id,a.r,a.c,a.rotation];}),r:level.rows,c:level.cols})).toString('base64url')}`;
    await load(1, [], 'en', {'wildgrid-survival-v1': JSON.stringify({version:1,completed:[],records:[],recent:[],
      challenge:{id:'quality-reward',difficulty:4,seed:123,code,fingerprint:'quality',startedAt:Date.now()},
      progress:{id:'quality-reward',status:'active',placements:answer.slice(0,-1),past:[],future:[],rotations:{},selectedId:null}})});
    await click('.menu-adventure'); await click('.mode-survival'); await click('.survival-continue');
    const piece = level.pieces.find(p=>p.id===last.id), selector=`[data-facility="${piece.kind}"][data-shape="${piece.shape}"]`;
    await click(selector); for(let r=0;r<last.rotation;r++) await click(selector);
    await click(`[data-cell="${last.r},${last.c}"]`); await wait(1100);
    assert.equal(await js(`!!document.querySelector('.survival-upgrade') && document.querySelector('dialog').open`), true);
    assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-survival-v1')).completed.length`), 1);
    await shot('survival-upgrade');
    await click('.modal-close'); await click('.tool-undo');
    await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true}))`); await wait(700);
    assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-survival-v1')).completed.length`), 1);
    assert.equal(await js(`document.querySelector('dialog').open`), false);
    await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await load(); await enter(); await click('.facility-card');
    await click(`[data-cell="${at.r},${at.c}"]`);
    assert.equal(await js(`document.querySelector('dialog').open && !document.querySelector('.board-celebration')`), true);
    await click('.modal-close'); await click('.tool-undo');
    await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true}))`); await wait(800);
    assert.equal(await js(`document.querySelector('dialog').open`), false, 'redo cannot celebrate twice');
    assert.deepEqual((await saved()).completed, [1]);
    await load(1, [], 'en', { 'wildgrid-tutorial-v1': JSON.stringify({version:1,enabled:true,language:'en'}) });
    await enter();
    for (let i=0;i<6;i++) await click('.tutorial-next');
    assert.equal(await js(`document.querySelector('.tutorial-overlay').dataset.step`), 'select');
    await click('.facility-card');
    assert.equal(await js(`document.querySelector('.tutorial-overlay').dataset.step`), 'place');
    assert.equal(await js(`(() => { const r=document.querySelector('[data-cell="2,3"]').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.dataset.cell==='2,3'; })()`), true);
    await click('[data-cell="2,3"]'); await wait();
    assert.equal(await js(`document.querySelector('.tutorial-overlay').dataset.step`), 'complete');
    await shot('tutorial-complete');
    await click('.win-content .primary'); await wait();
    assert.equal((await saved()).current, 2);
    await click('.tutorial-skip');
    assert.equal(await js(`!!document.querySelector('.tutorial-overlay')`), false);
    await load(1, [], 'en', { 'wildgrid-save-v1': '{broken' });
    assert.equal(await js(`localStorage.getItem('wildgrid-save-v1')`), '{broken');
    assert.equal(await js(`!!document.querySelector('.save-error[role="alert"]')`), true);
    assert.deepEqual(errors, []);
    console.log('PASS reduced motion, duplicate completion guard, corrupted save protection');
    clearTimeout(deadline); app.exit(0);
  } catch (error) { await shot('failure'); console.error(error); clearTimeout(deadline); app.exit(1); }
}).catch(error => { console.error(error); app.exit(1); });
