const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/data/levels.json');
const solutions = require('./solutions.json');

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
  const js = async code => {
    try { return await contents.executeJavaScript(code); }
    catch (error) { throw new Error(`Renderer check failed: ${code.slice(0,240)} (${error.message})`); }
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 60));
  async function click(selector, touch = false) {
    if (touch) {
      const point = await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await settle();
  }
  const geometry = () => js(`(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {width:r.width,height:r.height}; };
    return {board:rect('.board-section'),tools:rect('.tools-panel'),list:rect('.facility-list'),operations:rect('.operations'),dock:!!document.querySelector('.rule-dock'),overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  async function load(progress = [], tips = true) {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await js(`localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({ version: 1, completed: Array.from({length:29},(_,i)=>i+1), current:30, progress:{30:progress}, settings:{music:.35,effects:.65,muted:false,facilityTips:tips} }))})`);
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
      assert.equal(await js(`Boolean(window.__audioContext)`), false);
      await click('.menu-buttons .primary', viewport.touch);
      const before = await geometry();
      assert.equal(before.overflow, false);
      assert.ok(Math.abs(before.board.height-before.tools.height)<1, JSON.stringify(before));
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
      await click('.game-title [aria-label="返回关卡选择"]', viewport.touch);
      await js(`document.querySelector('.level-grid').scrollTop=9999`);
      assert.ok(await js(`document.querySelector('.level-grid').scrollTop>0`));
      await click('.levels-page .back-link', viewport.touch);
      await click('.menu-buttons button:last-child', viewport.touch);
      assert.ok(await js(`document.querySelector('.manual-content').textContent.includes('黄色短杠') && document.querySelector('.manual-content').textContent.includes('林间木屋') && document.querySelector('.manual-content').textContent.includes('点击旋转')`));
      await js(`document.querySelector('.manual-content').scrollTop=9999`);
      assert.ok(await js(`document.querySelector('.manual-content').scrollTop>0`));
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
    console.log('Four orientations, footprint hit targets, touch pickup/placement/rotation/sliders, audio activation/volume/mute, live tips, independent manual and scrolling PASS.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) { writeFileSync(path.join(output,'failure.png'), (await contents.capturePage()).toPNG()); console.error(error); clearTimeout(deadline); app.exit(1); }
});
