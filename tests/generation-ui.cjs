const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
require('tsx/cjs');
const { generateMap, evaluate } = require('../src/engine/index.ts');

const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke/generation');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('Generation UI timed out'); app.exit(1); }, 30000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 390, height: 844, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const wc = win.webContents, errors = [];
  wc.on('console-message', event => { if (event.level === 'error' && !event.message.includes('ERR_')) errors.push(event.message); });
  const js = code => wc.executeJavaScript(code, true);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await wait(80); };
  const frame = () => js(`Array.from(document.querySelectorAll('.generation-map > span')).map(el=>el.dataset.kind||'')`);
  function checkLayout(cells) {
    assert.equal(cells.length, 25);
    const terrain = [], pieces = [], placements = [], rows = Array(5).fill(0), cols = Array(5).fill(0);
    cells.forEach((kind, i) => {
      const r = Math.floor(i / 5), c = i % 5;
      if (['water', 'forest', 'mountain'].includes(kind)) terrain.push({ r, c, kind });
      if (['camp', 'fire', 'picnic', 'powerTower', 'foodTruck', 'tower', 'pool'].includes(kind)) {
        pieces.push({ id: String(i), kind, shape: kind === 'picnic' ? 'domino' : 'single' });
        placements.push({ id: String(i), r, c, rotation: 0 }); rows[r]++; cols[c]++;
        if (kind === 'picnic') { rows[r]++; cols[c + 1]++; }
      }
    });
    assert.ok(pieces.length >= 2);
    assert.ok(evaluate({ id: 0, name: '', chapter: '', tip: '', size: 5, terrain, pieces, rows, cols }, placements).won, JSON.stringify(cells));
  }
  try {
    await win.loadFile(path.join(root, 'dist/index.html')); await wait(150);
    await js(`localStorage.clear();localStorage.setItem('wildgrid-tutorial-v1','{"version":1,"enabled":false}')`);
    await win.reload(); await wait(250);
    await js(`window.__workers=[];window.Worker=class {
      constructor(){window.__workers.push(this)} postMessage(request){this.request=request} terminate(){this.terminated=true} reply(data){this.onmessage?.({data})}
    };Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));void 0`);
    await click('.menu-adventure'); await click('.mode-survival');
    await js(`window.__generationMessages=[];window.__messageObserver=new MutationObserver(()=>{
      const text=document.querySelector('.survival-generation-page h1')?.textContent;
      if(text && text!==window.__generationMessages.at(-1)?.text)window.__generationMessages.push({text,time:performance.now()});
    });window.__messageObserver.observe(document.body,{subtree:true,childList:true,characterData:true});void 0`);
    await click('.survival-difficulty');
    const seen = new Set(), kinds = new Set();
    for (let i = 0; i < 8; i++) {
      const cells = await frame(); checkLayout(cells); seen.add(JSON.stringify(cells));
      cells.filter(Boolean).forEach(kind => kinds.add(kind));
      await wait(800);
      if (i === 3) writeFileSync(path.join(output, 'loading.png'), (await wc.capturePage()).toPNG());
      await wait(800);
    }
    assert.equal(seen.size, 6);
    const messages = await js(`window.__generationMessages`);
    assert.ok(messages.length >= 6, JSON.stringify(messages));
    assert.ok(messages.every(message => message.text !== '地图生成中'));
    for (let i = 1; i < messages.length; i++) {
      assert.notEqual(messages[i].text, messages[i-1].text);
      assert.ok(Math.abs(messages[i].time-messages[i-1].time-2000)<250, JSON.stringify(messages));
    }
    for (const kind of ['picnic', 'powerTower', 'foodTruck', 'tower', 'pool']) assert.ok(kinds.has(kind), kind);
    const beforeRetries = await js(`window.__workers.length`);
    for (let round = 0; round < 4; round++) {
      await js(`window.__workers.at(-1).reply({status:'search-failed',error:'预算耗尽'})`); await wait(50);
      assert.ok(await js(`!!document.querySelector('.survival-generation-page')`));
      assert.equal(await js(`window.__workers.length`), beforeRetries + round + 1);
      assert.equal(await js(`!!document.querySelector('.survival-notice')`), false);
    }
    const { draft, fingerprint } = generateMap(1, 2, 'fixture', []);
    await js(`window.__workers.at(-1).reply({status:'success',challenge:Object.assign({},window.__workers.at(-1).request,${JSON.stringify({draft,fingerprint})})})`);
    await wait(150);
    assert.ok(await js(`!!document.querySelector('.survival-game')`));
    assert.equal(await js(`!!document.querySelector('.survival-generation-page')`), false);
    assert.deepEqual(errors, []);
    console.log('PASS: random nonrepeating slogans change every two seconds; six legal layouts keep cycling; automatic retries and successful game entry');
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    writeFileSync(path.join(output, 'failure.png'), (await wc.capturePage()).toPNG());
    console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
