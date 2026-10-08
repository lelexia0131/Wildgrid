const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/data/levels.json');
const solutions = require('../src/data/solutions.json');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.desktop-smoke', 'continuous-placement');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('Continuous placement UI check timed out.'); app.exit(1); }, 60000);
const level = levels.find(item => item.id === 17);
const code = `WG1:${Buffer.from(JSON.stringify({ v: 1, s: level.size,
  t: level.terrain.map(t => [t.kind, t.r, t.c]),
  f: level.pieces.map(piece => { const at = solutions[17].find(at => at.id === piece.id); return [`${piece.kind}_${piece.shape}`, piece.id, at.r, at.c, at.rotation]; }),
  r: level.rows, c: level.cols,
})).toString('base64url')}`;
const camp = '[aria-label^="选择双格营地"]';

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const contents = win.webContents, errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code, true);
  const settle = () => new Promise(resolve => setTimeout(resolve, 60));
  let touch = false;
  async function click(selector, text) {
    const element = text ? `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(el => el.textContent.trim() === ${JSON.stringify(text)})` : `document.querySelector(${JSON.stringify(selector)})`;
    if (touch) {
      const point = await js(`(() => { const el = ${element}; if (!el) throw new Error('Missing click target'); el.scrollIntoView({block:'nearest'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`(${element}).click()`);
    await settle();
  }
  async function load() { await win.loadFile(path.join(root, 'dist', 'index.html')); await settle(); }
  async function prepare(continuousPlacement) {
    const settings = { music: .35, effects: .65, muted: false, facilityTips: true };
    if (continuousPlacement !== undefined) settings.continuousPlacement = continuousPlacement;
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({version:1,completed:Array.from({length:16},(_,i)=>i+1),current:17,progress:{},settings}))}); localStorage.setItem('wildgrid-local-maps-v1', ${JSON.stringify(JSON.stringify({version:1,maps:[{id:1,code,progress:[]}]}))}); void 0;`);
    await load();
  }
  const tile = (r, c, size = 8) => click(`.board > .tile:nth-child(${r * size + c + 1})`);
  const active = () => js(`document.querySelector(${JSON.stringify(camp)}).getAttribute('aria-pressed') === 'true'`);
  const art = () => js(`Array.from(document.querySelectorAll('.board .placed-facility-art')).map(el => ({kind:el.dataset.kind,rotation:Number(el.dataset.rotation)}))`);
  const saved = () => js(`JSON.parse(localStorage.getItem('wildgrid-save-v1'))`);
  async function toggle() {
    await click('.header [aria-label="设置"]');
    await click('[role="switch"]', '连续放置');
    await click('.modal-close');
  }
  async function enter(mode) {
    await click('.menu-buttons .primary');
    if (mode === 'adventure') await click('.sandbox-choice:first-child');
    else if (mode === 'sandbox-play') { await click('.sandbox-choice:nth-child(3)'); await click('.local-map-enter'); }
    else { await click('.sandbox-choice:nth-child(2)'); await click('.sandbox-choice:first-child'); await click('.sandbox-size-card:first-child'); }
  }
  try {
    await load(); contents.debugger.attach('1.3');
    for (const viewport of [{width:1280,height:900,touch:false},{width:390,height:844,touch:true}]) {
      touch = viewport.touch; win.setContentSize(viewport.width, viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:touch});
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {enabled:touch});
      // New installations and existing saves both start with the option enabled.
      await js('localStorage.clear()'); await load();
      assert.equal((await saved()).settings.continuousPlacement, true);
      await prepare(); await click('.header [aria-label="设置"]');
      assert.deepEqual(await js(`(() => { const about=document.querySelector('.settings-about'), option=about.previousElementSibling; return {label:option.textContent.trim(),role:option.getAttribute('role'),checked:option.getAttribute('aria-checked')}; })()`), {label:'连续放置',role:'switch',checked:'true'});
      assert.equal((await saved()).settings.continuousPlacement, true);
      writeFileSync(path.join(output, `settings-${viewport.width}.png`), (await contents.capturePage()).toPNG());
      await click('.modal-close'); await enter('adventure');
      await click(camp); await click('.operations > .wide-operation');
      // A blocked attempt preserves both selection and orientation.
      await tile(7, 3);
      assert.equal(await active(), true); assert.deepEqual((await saved()).progress[17], []);
      await tile(3, 3);
      assert.equal(await active(), true);
      assert.match(await js(`document.querySelector(${JSON.stringify(camp)}).getAttribute('aria-label')`), /剩余 1/);
      await tile(3, 4);
      assert.equal(await active(), false);
      assert.deepEqual((await saved()).progress[17], [{id:'camp-2',r:3,c:3,rotation:1},{id:'camp-4',r:3,c:4,rotation:1}]);
      assert.deepEqual(await art(), [{kind:'camp',rotation:1},{kind:'camp',rotation:1}]);
      assert.equal(await js(`document.querySelectorAll('.facility-card[aria-pressed="true"]').length`), 0);
      assert.equal(await js(`document.querySelector('[aria-label^="选择三格营地"]').disabled`), false, 'exhaustion must not select another shape');

      await click('.operations .wide-operation', '重新游玩'); await toggle();
      assert.equal((await saved()).settings.continuousPlacement, false);
      await load(); await click('.header [aria-label="设置"]');
      assert.equal(await js(`document.querySelector('.settings-about').previousElementSibling.getAttribute('aria-checked')`), 'false');
      await click('.modal-close'); await enter('adventure');
      await click(camp); await tile(3, 3);
      assert.equal(await active(), false); await tile(3, 5);
      assert.equal((await saved()).progress[17].length, 1, 'disabled option requires selecting the next piece');

      // Imported/local maps use their finite inventory with the same behavior.
      await prepare(true); await enter('sandbox-play');
      await click(camp); await click('.operations > .wide-operation');
      await tile(3, 3); assert.equal(await active(), true);
      await tile(3, 4); assert.equal(await active(), false);
      assert.deepEqual(await art(), [{kind:'camp',rotation:1},{kind:'camp',rotation:1}]);
      await click('.operations .wide-operation', '重新游玩'); await toggle();
      await click(camp); await tile(3, 3); assert.equal(await active(), false);
      await tile(3, 5); assert.equal((await art()).length, 1);

      // The editor keeps supplying fresh instances while enabled, then deselects when disabled.
      await prepare(true); await enter('sandbox-editor');
      await click(camp); await click('.operations > .wide-operation');
      await tile(5, 4, 6); assert.equal(await active(), true); assert.deepEqual(await art(), []);
      await tile(0, 1, 6); await tile(2, 1, 6);
      assert.equal(await active(), true);
      assert.deepEqual(await art(), [{kind:'camp',rotation:1},{kind:'camp',rotation:1}]);
      await toggle(); await tile(4, 1, 6);
      assert.equal(await active(), false); assert.equal((await art()).length, 3);
      await tile(4, 3, 6); assert.equal((await art()).length, 3);
      console.log(`Continuous placement ${viewport.width} ${touch ? 'touch' : 'desktop'} PASS.`);
    }
    assert.deepEqual(errors, []);
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    writeFileSync(path.join(output, 'failure.png'), (await contents.capturePage()).toPNG());
    console.error(error); clearTimeout(deadline); app.exit(1);
  }
}).catch(error => { console.error(error); clearTimeout(deadline); app.exit(1); });
