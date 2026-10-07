const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/data/levels.json');
const solutions = require('../src/data/solutions.json');

const root = path.resolve(__dirname, '..');
app.disableHardwareAcceleration();
const output = path.join(root, '.desktop-smoke', 'ui');
mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const failures = [];
const deadline = setTimeout(() => { console.error('UI check timed out.'); app.exit(1); }, 60000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const contents = win.webContents;
  contents.on('console-message', event => { if (event.level === 'error') failures.push(event.message); });
  await win.loadFile(path.join(root, 'dist', 'index.html'));
  contents.debugger.attach('1.3');
  const audioProbe = `
    const NativeAudioContext = window.AudioContext;
    window.__audioNodes = 0; window.__audioGains = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor() { super(); window.__audioContext = this; }
      createGain() { const node = super.createGain(); window.__audioGains.push(node); return node; }
      createOscillator() { const node = super.createOscillator(); window.__audioNodes++; return node; }
    };
    void 0;
  `;
  const js = async (code, userGesture = false) => {
    try { return await contents.executeJavaScript(code, userGesture); }
    catch (error) { throw new Error(`Renderer check failed: ${code.slice(0,240)} (${error.message})`); }
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 60));
  async function click(selector, touch = false) {
    if (touch) {
      const point = await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`document.querySelector(${JSON.stringify(selector)}).click()`, true);
    await settle();
    if (selector === '.menu-buttons .primary') await click('.sandbox-choice:first-child', touch);
  }
  const geometry = () => js(`(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {width:r.width,height:r.height}; };
    return {board:rect('.board-section'),tools:rect('.tools-panel'),list:rect('.facility-list'),operations:rect('.operations'),dock:!!document.querySelector('.rule-dock'),overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  async function load(progress = [], tips = true, current = 30, completed = Array.from({length:29},(_,i)=>i+1)) {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await js(`localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({ version: 1, completed, current, progress:{[current]:progress}, settings:{music:.35,effects:.65,muted:false,facilityTips:tips} }))})`);
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await settle();
    await js(audioProbe);
  }
  async function toggleTips(touch) {
    await click('.header [aria-label="设置"]', touch);
    await js(`Array.from(document.querySelectorAll('[role="switch"]')).find(el=>el.textContent.includes('设施提示')).click()`);
    await settle();
    await click('.modal-close', touch);
  }
  const measurements = [];
  try {
    for (const viewport of [{width:1280,height:900,touch:false},{width:390,height:844,touch:true},{width:844,height:390,touch:true}]) {
      win.setContentSize(viewport.width, viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.touch});
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {enabled:viewport.touch});
      await load();
      console.log('UI viewport:', JSON.stringify(viewport));
      assert.equal(await js(`document.querySelector('.menu-buttons .primary').textContent`), '开始冒险');
      assert.equal(await js(`document.querySelector('.menu-buttons button:last-child').textContent.trim()`), '野外手册');
      assert.equal(await js(`Boolean(window.__audioContext)`), false);
      await click('.menu-buttons .primary', viewport.touch);
      const before = await geometry();
      assert.equal(before.overflow, false);
      assert.ok(Math.abs(before.board.height-before.tools.height)<1, JSON.stringify(before));
      assert.ok(before.operations.height<before.tools.height*.3, JSON.stringify(before));
      assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), true);
      assert.equal(await js(`document.querySelector('.operations').textContent.includes('重做')`), false);
      await click('.blueprint-button');
      assert.equal(await js(`document.querySelector('dialog').open`), false);
      assert.ok(await js(`document.querySelectorAll('.board > .tile').length === 64`));
      await click('[aria-label^="选择L 形林间木屋"]', viewport.touch);
      const beforeRotation = await js(`document.querySelector('[aria-label^="选择L 形林间木屋"] .roof-plane').getAttribute('d')`);
      await click('.operations > .wide-operation', viewport.touch);
      assert.notEqual(await js(`document.querySelector('[aria-label^="选择L 形林间木屋"] .roof-plane').getAttribute('d')`), beforeRotation);
      await toggleTips(viewport.touch);
      const after = await geometry();
      assert.equal(after.dock, false);
      assert.equal(await js(`document.body.textContent.includes('设施提示已关闭')`), false);
      assert.deepEqual(after.board, before.board);
      assert.deepEqual(after.tools, before.tools);
      assert.deepEqual(after.operations, before.operations);
      assert.ok(after.list.height>before.list.height || after.list.width>before.list.width);
      await toggleTips(viewport.touch);
      assert.equal(await js(`document.querySelector('.rule-dock strong').textContent`), '林间木屋');
      const scrolling = await js(`(() => { const list=document.querySelector('.facility-list'); list.scrollTop=999; return {scroll:list.scrollTop,height:list.clientHeight,content:list.scrollHeight}; })()`);
      assert.ok(scrolling.scroll>0, JSON.stringify(scrolling));
      measurements.push({viewport,before,after});
      writeFileSync(path.join(output, `viewport-${viewport.width}.png`), (await contents.capturePage()).toPNG());
      if (viewport.touch) {
        assert.equal(await js(`window.__audioContext.state`), 'running');
        assert.ok(await js(`window.__audioNodes>0`));
        await click('.header [aria-label="设置"]', true);
        await click('#music-volume', true);
        await click('#effects-volume', true);
        const volumes = await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).settings`);
        assert.ok(volumes.music>.4 && volumes.music<.6);
        assert.ok(volumes.effects>.4 && volumes.effects<.6);
        await click('.mute-setting', true);
        await new Promise(resolve=>setTimeout(resolve,300));
        assert.ok(await js(`window.__audioGains[0].gain.value<.01 && window.__audioGains[1].gain.value<.01`));
        await click('.modal-close', true);
      }
      // Game information opens from settings and returns without closing the dialog.
      await click('.header [aria-label="设置"]', viewport.touch);
      assert.equal(await js(`document.querySelector('.settings-note').textContent`), 'v0.3.0');
      assert.equal(await js(`document.querySelector('.settings-about').nextElementSibling === document.querySelector('.settings-note')`), true);
      await click('.settings-about', viewport.touch);
      const about = await js(`(() => {
        const content=document.querySelector('.game-about'), dialog=document.querySelector('dialog'), r=dialog.getBoundingClientRect();
        const details=Array.from(content.querySelectorAll('dd')).map(el=>el.textContent);
        return {open:dialog.open,heading:content.querySelector('h2').textContent,author:details[0],date:details[1],project:content.querySelector('a').href,copyright:content.textContent.includes('© 2026 lelexia') && content.textContent.includes('原创插画'),thanks:content.textContent.includes('感谢'),fits:r.left>=0 && r.right<=innerWidth && dialog.scrollWidth<=dialog.clientWidth+1 && document.documentElement.scrollWidth<=innerWidth};
      })()`);
      assert.equal(about.open, true);
      assert.equal(about.heading, '游戏说明');
      assert.equal(about.author, 'lelexia');
      assert.equal(about.date, '2026-10-07');
      assert.equal(about.project, 'https://github.com/lelexia0131/Wildgrid');
      assert.ok(about.copyright && about.thanks);
      assert.ok(about.fits, JSON.stringify(about));
      writeFileSync(path.join(output, `about-${viewport.width}.png`), (await contents.capturePage()).toPNG());
      await click('.game-about .secondary', viewport.touch);
      assert.equal(await js(`document.querySelector('dialog').open && document.querySelector('dialog h2').textContent === '设置'`), true);
      await click('.settings-about', viewport.touch);
      await js(`document.querySelector('.modal-close').focus()`);
      contents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
      contents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
      await settle();
      const afterEscape = await js(`({open:document.querySelector('dialog').open,heading:document.querySelector('dialog h2').textContent})`);
      assert.ok(afterEscape.open && afterEscape.heading==='设置', JSON.stringify(afterEscape));
      await click('.modal-close', viewport.touch);
      assert.equal(await js(`document.querySelector('dialog').open`), false);
      // Loaded partial placements remain after a page reload; take up and re-place using taps.
      const picnic = solutions[30].find(at=>at.id.startsWith('picnic'));
      await load([picnic], false);
      await click('.menu-buttons .primary', viewport.touch);
      assert.equal(await js(`document.querySelectorAll('.placed-facility-art[data-kind="picnic"]').length`), 1);
      const shape = levels[29].pieces.find(p=>p.id===picnic.id).shape;
      const cells = shape === 'domino' && picnic.rotation%2 ? [{r:0,c:0},{r:1,c:0}] : [{r:0,c:0},{r:0,c:1}];
      const pickup = (picnic.r+cells[1].r)*8+picnic.c+cells[1].c+1;
      await click(`.board > .tile:nth-child(${pickup})`, viewport.touch);
      assert.equal(await js(`document.querySelectorAll('.placed-facility-art[data-kind="picnic"]').length`), 0);
      await click(`.board > .tile:nth-child(${picnic.r*8+picnic.c+1})`, viewport.touch);
      assert.equal(await js(`document.querySelectorAll('.placed-facility-art[data-kind="picnic"]').length`), 1);
      assert.equal(await js(`document.querySelector('.rule-dock')`), null);
      await click('.game-title [aria-label="返回营地日记"]', viewport.touch);
      await js(`document.querySelector('.level-grid').scrollTop=9999`);
      assert.ok(await js(`document.querySelector('.level-grid').scrollTop>0`));
      await click('.levels-page .back-link', viewport.touch);
      await click('.menu-buttons button:last-child', viewport.touch);
      assert.ok(await js(`document.querySelector('.manual-content').textContent.includes('黄色短杠') && document.querySelector('.manual-content').textContent.includes('林间木屋') && document.querySelector('.manual-content').textContent.includes('点击旋转')`));
      const manual = await js(`document.querySelector('.manual-content').textContent`);
      assert.ok(manual.includes('图纸') && manual.includes('通关后解锁') && manual.includes('首次通关'));
      assert.equal(manual.includes('重做'), false);
      await js(`document.querySelector('.manual-content').scrollTop=9999`);
      assert.ok(await js(`document.querySelector('.manual-content').scrollTop>0`));
      await click('.modal-close', viewport.touch);
      // First completion unlocks the blueprint; replaying never repeats the win dialog.
      await load([], true, 1, []);
      await click('.menu-buttons .primary', viewport.touch);
      await click('.facility-card', viewport.touch);
      await click('.board > .tile:nth-child(16)', viewport.touch);
      assert.equal(await js(`document.querySelector('dialog').open && !!document.querySelector('.win-content')`), true);
      assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), false);
      await click('.modal-close', viewport.touch);
      const solvedSave = await js(`localStorage.getItem('wildgrid-save-v1')`);
      await click('.blueprint-button', viewport.touch);
      assert.equal(await js(`document.querySelector('dialog').open && !!document.querySelector('.blueprint-board')`), true);
      assert.equal(await js(`document.querySelectorAll('.blueprint-board > .tile').length`), 36);
      assert.equal(await js(`document.querySelectorAll('.blueprint-board .placed-camp').length`), 1);
      assert.equal(await js(`document.querySelectorAll('.blueprint-board button').length`), 0);
      await js(`window.dispatchEvent(new KeyboardEvent('keydown', {key:'z',ctrlKey:true}))`);
      await settle();
      assert.equal(await js(`localStorage.getItem('wildgrid-save-v1')`), solvedSave);
      await click('.modal-close', viewport.touch);
      await js(`Array.from(document.querySelectorAll('.operations button')).find(el=>el.textContent.includes('重新游玩')).click()`);
      await settle();
      assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), false);
      await click('.facility-card', viewport.touch);
      await click('.board > .tile:nth-child(16)', viewport.touch);
      assert.equal(await js(`document.querySelector('dialog').open`), false);
      await win.loadFile(path.join(root, 'dist', 'index.html'));
      await settle();
      await click('.menu-buttons .primary', viewport.touch);
      assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), false);
      await click('.blueprint-button', viewport.touch);
      assert.equal(await js(`document.querySelectorAll('.blueprint-board .placed-camp').length`), 1);
      await js(`document.querySelector('dialog').dispatchEvent(new Event('cancel', {cancelable:true}))`);
      await settle();
      assert.equal(await js(`document.querySelector('dialog').open`), false);
      await click('.facility-card', viewport.touch);
      await click('.board > .tile:nth-child(16)', viewport.touch);
      assert.equal(await js(`document.querySelector('dialog').open`), false);
      assert.deepEqual(await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).completed`), [1]);
      // The largest blueprint includes every multi-cell facility and fits each viewport.
      await load([], true, 30, Array.from({length:30},(_,i)=>i+1));
      await click('.menu-buttons .primary', viewport.touch);
      await click('.blueprint-button', viewport.touch);
      const blueprint = await js(`(() => {
        const board=document.querySelector('.blueprint-board'), dialog=document.querySelector('dialog');
        const r=board.getBoundingClientRect();
        return {tiles:board.querySelectorAll(':scope > .tile').length,multi:Array.from(board.querySelectorAll('.placed-facility-art')).map(el=>({id:el.dataset.pieceId,rotation:Number(el.dataset.rotation)})),single:board.querySelectorAll('.tile.placed:not(.placed-multi)').length,fits:r.width>0 && r.left>=0 && r.right<=innerWidth && dialog.scrollWidth<=dialog.clientWidth+1};
      })()`);
      assert.equal(blueprint.tiles, 64);
      const multiAnswer = solutions[30].filter(at=>levels[29].pieces.find(p=>p.id===at.id).shape!=='single');
      assert.deepEqual(blueprint.multi, multiAnswer.map(at=>({id:at.id,rotation:at.rotation})));
      assert.equal(blueprint.single, levels[29].pieces.length-multiAnswer.length);
      assert.ok(blueprint.fits, JSON.stringify(blueprint));
      writeFileSync(path.join(output, `blueprint-${viewport.width}.png`), (await contents.capturePage()).toPNG());
      await click('.modal-close', viewport.touch);
    }
    // Every rotated footprint keeps doors, entrances and table legs upright.
    win.setContentSize(1280,900);
    await contents.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');
    await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {enabled:false});
    const rotations = [];
    const multi = levels[29].pieces.filter((p,i,all)=>p.shape!=='single' && all.findIndex(q=>q.kind===p.kind && q.shape===p.shape)===i);
    for (const {kind,shape,id} of multi) {
      for (let rotation=0;rotation<4;rotation++) {
        await load([{id,r:2,c:4,rotation}]);
        await click('.menu-buttons .primary');
        const state = await js(`(() => { const layer=document.querySelector('.placed-facility-art[data-kind="${kind}"]'); const svg=layer.querySelector('.footprint-art'); const tiles=Array.from(document.querySelectorAll('.tile.placed-${kind}')); const part=svg.querySelector('.building-door, .picnic-legs'); const matrix=part.getScreenCTM(); return {viewBox:svg.getAttribute('viewBox'),upright:matrix.a>0 && matrix.d>0 && matrix.b===0 && matrix.c===0,clip:svg.querySelector('clipPath').children.length,noGrid:tiles.every(el=>{const s=getComputedStyle(el);return s.backgroundColor==='rgba(0, 0, 0, 0)' && s.borderColor==='rgba(0, 0, 0, 0)' && s.boxShadow==='none';}),hits:tiles.every(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})}; })()`);
        assert.equal(state.clip, shape==='domino'?2:3);
        assert.ok(state.hits);
        assert.ok(state.noGrid);
        assert.ok(state.upright);
        const length = shape==='long'?300:200;
        assert.equal(state.viewBox, shape==='el'?'0 0 200 200':rotation%2?`0 0 100 ${length}`:`0 0 ${length} 100`);
        rotations.push({kind,shape,rotation,...state});
        // The illustration gallery excludes rule markers; assertions above use the full UI.
        await js(`document.querySelector('.placed-facility-art').classList.remove('invalid','incomplete'); document.querySelectorAll('.error-mark,.pending-mark').forEach(el=>el.style.visibility='hidden'); void 0;`);
        await settle();
        const rect = await js(`(() => {const r=document.querySelector('.placed-facility-art[data-kind="${kind}"]').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
        writeFileSync(path.join(output, `${kind}-${shape}-${rotation}.png`), (await contents.capturePage(rect)).toPNG());
      }
    }
    assert.deepEqual(failures, []);
    writeFileSync(path.join(output,'results.json'), JSON.stringify({measurements,rotations},null,2));
    console.log('UI PASS:', JSON.stringify(measurements));
    console.log('Blueprint unlock and complete answers, first-completion dialog, field manual, compact tools, four orientations, touch, audio and scrolling PASS.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) { writeFileSync(path.join(output,'failure.png'), (await contents.capturePage()).toPNG()); console.error(error); clearTimeout(deadline); app.exit(1); }
});
