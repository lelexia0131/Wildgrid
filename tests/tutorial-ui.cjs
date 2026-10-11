const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/data/levels.json');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.desktop-smoke', 'tutorial');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('Tutorial UI timed out'); app.exit(1); }, 90000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const contents = win.webContents;
  const errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  await win.loadFile(path.join(root, 'dist', 'index.html'));
  contents.debugger.attach('1.3');
  const js = async code => { try { return await contents.executeJavaScript(code, true); } catch (error) { throw new Error(`${code.slice(0,240)}: ${error.message}; ${errors.join('; ')}`); } };
  const settle = () => new Promise(resolve => setTimeout(resolve, 100));
  let touch = false;
  async function click(selector) {
    const point = await js(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing '+${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await settle();
    if (touch) {
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await contents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await contents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    }
    await settle();
  }
  const step = () => js(`document.querySelector('.tutorial-overlay')?.dataset.step || null`);
  const state = () => js(`JSON.parse(localStorage.getItem('wildgrid-tutorial-v1'))`);
  async function load(current = 1, completed = [], tutorial = null) {
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({version:1,current,completed,progress:{},settings:{music:0,effects:0,muted:true,facilityTips:true}}))}); ${tutorial ? `localStorage.setItem('wildgrid-tutorial-v1', ${JSON.stringify(JSON.stringify(tutorial))});` : ''}`);
    await win.loadFile(path.join(root, 'dist', 'index.html')); await js('document.fonts.ready.then(()=>true)'); await settle();
  }
  async function enter() { await click('.menu-buttons .primary'); await click('.sandbox-choice:first-child'); }
  async function settings() { await click('[data-tutorial="settings"]'); }
  async function close() { await click('.modal-close'); }
  async function tools() {
    const geometry = await js(`(() => { const board=document.querySelector('.board-section').getBoundingClientRect(), panel=document.querySelector('.tools-panel').getBoundingClientRect(), operations=document.querySelector('.operations'); return {board:board.height,panel:panel.height,operations:operations.getBoundingClientRect().height,clipped:operations.scrollWidth>operations.clientWidth+1}; })()`);
    assert.ok(Math.abs(geometry.board-geometry.panel)<1 && geometry.operations>50 && !geometry.clipped, JSON.stringify(geometry));
  }
  async function english(label) {
    const remaining = await js(`(() => { const result=[], walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); while(walker.nextNode()){const node=walker.currentNode, parent=node.parentElement;if(parent && !parent.closest('select,script,style') && parent.getClientRects().length && /\\p{Script=Han}/u.test(node.textContent)) result.push(node.textContent.trim());}return result; })()`);
    assert.deepEqual(remaining, [], label);
    assert.equal(await js(`document.documentElement.scrollWidth>innerWidth`), false, label);
  }
  async function layout(label) {
    const geometry = await js(`(() => {
      const r=document.querySelector('.tutorial-narration').getBoundingClientRect();
      const targets=Array.from(document.querySelectorAll('.tutorial-ring')).map(el=>el.getBoundingClientRect());
      return {card:{x:r.x,y:r.y,width:r.width,height:r.height},fits:r.x>=0 && r.y>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1,clear:targets.every(t=>r.right<=t.left || r.left>=t.right || r.bottom<=t.top || r.top>=t.bottom),arrow:!!document.querySelector('.tutorial-arrow'),overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    assert.ok(geometry.fits && geometry.clear && geometry.arrow && !geometry.overflow, label + JSON.stringify(geometry));
    writeFileSync(path.join(output, `${label}.png`), (await contents.capturePage()).toPNG());
  }
  try {
    for (const viewport of [{width:1280,height:900,touch:false},{width:390,height:844,touch:true},{width:844,height:390,touch:true}]) {
      touch = viewport.touch;
      win.setContentSize(viewport.width, viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:touch});
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {enabled:touch});
      await load(); await enter();
      assert.equal(await step(), 'board'); await layout(`board-${viewport.width}`);
      assert.equal(await js(`document.querySelector('.tutorial-narration h2')`), null);
      assert.ok(await js(`document.querySelector('.tutorial-progress').textContent.startsWith('指导员 ')`));
      // A blocked description cannot alter the board; the focus can advance it.
      await js(`document.querySelector('[data-facility="camp"]').click()`); await settle();
      assert.equal(await js(`document.querySelector('[data-facility="camp"]').getAttribute('aria-pressed')`), 'false');
      await click('.board .tile'); assert.equal(await step(), 'clues'); await layout(`clues-${viewport.width}`);
      await click('.tutorial-controls button:nth-last-child(2)'); assert.equal(await step(), 'board');
      await click('.tutorial-next'); await click('.tutorial-next'); assert.equal(await step(), 'camp');
      await click('[data-facility="camp"] .facility-art'); assert.equal(await step(), 'feedback');
      await click('.tutorial-next'); await click('.tutorial-next'); assert.equal(await step(), 'select'); await layout(`select-${viewport.width}`);
      await click('[data-facility="camp"]'); assert.equal(await step(), 'place'); await layout(`place-${viewport.width}`);
      await click('[data-cell="0,0"]'); assert.equal(await step(), null);
      await click('[data-cell="0,0"]'); await click('[data-cell="2,3"]');
      assert.equal(await step(), 'complete'); await layout(`complete-${viewport.width}`);
      if (viewport.width === 1280) await click('.win-content .primary');
      else if (viewport.width === 390) await close();
      else await click('.win-content .text-button');
      assert.ok((await state()).basicSeen.includes('completion'));
      await tools();
      assert.ok((await state()).facilitiesSeen.includes('camp'));
      if (viewport.width !== 1280) { await click('.game-title .icon-button'); await click('.level-grid .level-card:nth-child(2)'); }
      await click('[data-facility="camp"]'); await click('[data-cell="0,0"]');
      assert.equal(await step(), 'pickup'); await layout(`pickup-${viewport.width}`);
      await click('[data-cell="0,0"]'); assert.equal(await step(), 'replace');
      await click('[data-cell="0,1"]'); assert.equal(await step(), 'undo'); await layout(`undo-${viewport.width}`);
      await click('[data-tutorial="undo"]'); assert.equal(await step(), null);
      assert.ok((await state()).basicSeen.includes('adjusting'));
      const seen = ['camp','fire','tower','picnic','cabin','foodTruck','powerTower','pool'];
      // Replaying a completed day has no win dialog; tapping its focus must not pick up the camp.
      await load(1, [1], {version:1,enabled:true,language:'zh',basicComplete:false,basicSeen:['orientation','placing','adjusting','rotation'],facilitiesSeen:seen,skipped:[]}); await enter();
      await click('[data-facility="camp"]'); await click('[data-cell="2,3"]');
      assert.equal(await step(), 'complete'); await click('[data-cell="2,3"]');
      assert.equal(await step(), null);
      assert.equal(await js(`document.querySelectorAll('.tile.placed').length`), 1);
      const multiLevel = levels.find(l => l.pieces.some(p => p.shape !== 'single'));
      await load(multiLevel.id, levels.map(l=>l.id), {version:1,enabled:true,language:'zh',basicComplete:false,basicSeen:['orientation','placing','adjusting','completion'],facilitiesSeen:seen,skipped:[]});
      await enter();
      const multi = multiLevel.pieces.find(p=>p.shape!=='single');
      await click(`[data-facility="${multi.kind}"]`); assert.equal(await step(), 'rotate'); await layout(`rotate-${viewport.width}`);
      assert.equal(await js(`document.querySelector('[data-tutorial="rotate"]')`), null);
      await click('.facility-card[aria-pressed="true"]'); assert.equal(await step(), null); assert.equal((await state()).basicComplete, true);
      // An old player gets only unseen facility intros, in level order.
      const advanced = levels.find(l=>['foodTruck','powerTower','pool'].every(kind=>l.pieces.some(p=>p.kind===kind)));
      await load(advanced.id, levels.map(l=>l.id), {version:1,enabled:true,language:'zh',basicComplete:true,basicSeen:['orientation','placing','adjusting','rotation','completion'],facilitiesSeen:[],skipped:[]}); await enter();
      assert.equal(await js(`document.querySelector('.tutorial-overlay').dataset.lesson.startsWith('facility:')`), true);
      await settings();
      assert.equal(await js(`document.querySelectorAll('.tutorial-setting-action').length`), 1);
      await js(`const select=document.querySelector('.tutorial-language select'); select.value='en'; select.dispatchEvent(new Event('change',{bubbles:true}));`); await settle(); await close();
      assert.equal(await js(`document.querySelector('.tutorial-narration').lang`), 'en'); await layout(`english-${viewport.width}`);
      const introductions = [];
      while (await step()) { introductions.push(await step()); await click('.tutorial-next'); }
      assert.deepEqual(introductions, seen.filter(kind=>advanced.pieces.some(p=>p.kind===kind)));
      await win.loadFile(path.join(root, 'dist', 'index.html')); await settle(); await enter(); assert.equal(await step(), null);
      await settings(); await click('.tutorial-setting-action');
      assert.equal(await js(`document.querySelector('.tutorial-settings [role="status"]').textContent`), 'Tutorials reset.');
      await new Promise(resolve=>setTimeout(resolve,2100));
      assert.equal(await js(`document.querySelector('.tutorial-settings [role="status"]')`), null);
      await close(); assert.equal(await step(), 'board');
      await click('.tutorial-skip'); assert.ok((await state()).basicComplete);
      await settings(); await click('.tutorial-settings [role="switch"]'); await close(); assert.equal(await step(), null);
      await win.loadFile(path.join(root, 'dist', 'index.html')); await settle(); await enter(); assert.equal(await step(), null);
      await settings(); await click('.tutorial-setting-action'); await close(); assert.equal(await step(), 'board');
      assert.equal((await state()).enabled, true);
      // Resize the same live lesson: its focus and narration must follow.
      const resized = viewport.width === 390 ? {width:844,height:390} : {width:390,height:844};
      win.setContentSize(resized.width,resized.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{...resized,deviceScaleFactor:1,mobile:touch}); await settle();
      await layout(`resize-${viewport.width}`);
      win.setContentSize(viewport.width,viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:touch});
      await load(41, levels.map(l=>l.id), {version:1,enabled:false,language:'en',basicComplete:true,basicSeen:[],facilitiesSeen:seen,skipped:[]});
      await english('home'); await settings(); await english('settings'); await click('.settings-about'); await english('about'); await close(); await close();
      await click('.menu-buttons button:last-child'); await english('manual');
      assert.equal(await js(`getComputedStyle(document.querySelector('.manual-content p')).fontFamily.includes('Wildgrid')`), false);
      await close(); await click('.menu-buttons button:nth-child(2)'); await english('levels');
      await click('.level-grid .level-card:nth-child(41)'); await english('game'); await tools();
      await click('.blueprint-button'); await english('blueprint');
      assert.equal(await js(`document.querySelector('.blueprint-content h2').textContent`), 'Blueprint');
      await close(); await click('[data-facility="foodTruck"]'); await english('facility rule feedback');
      await tools();
      writeFileSync(path.join(output, `english-tools-${viewport.width}.png`), (await contents.capturePage()).toPNG());
      await click('.game-title .icon-button'); await click('.levels-page .back-link');
      await click('.menu-buttons .primary'); await english('modes'); await click('.survival-entry'); await english('survival');
      await click('.survival-bottom .secondary'); await english('records'); await click('.survival-records .modal-close'); await click('.survival-heading .back-link');
      await click('.sandbox-choice:nth-child(4)'); await english('local maps'); await click('.sandbox-back');
      await click('.sandbox-choice:nth-child(3)'); await click('.sandbox-choice:nth-child(2)'); await english('import'); await click('.sandbox-back');
      await click('.sandbox-choice:first-child'); await click('.sandbox-size-card:first-child'); await english('editor'); await tools();
      console.log(`Tutorial UI PASS ${viewport.width}x${viewport.height}`);
    }
    assert.deepEqual(errors, []);
    clearTimeout(deadline); app.exit(0);
  } catch (error) { writeFileSync(path.join(output,'failure.png'), (await contents.capturePage()).toPNG()); console.error(error); clearTimeout(deadline); app.exit(1); }
});
