const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const levels = require('../src/data/levels.json');
const solutions = require('../src/data/solutions.json');

const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'interface');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const deadline = setTimeout(() => { console.error('Interface checks timed out'); app.exit(1); }, 180000);
const level = levels.find(entry => entry.id === 6);
const code = `WG1:${Buffer.from(JSON.stringify({ v: 1, s: 8, t: level.terrain.map(t => [t.kind,t.r,t.c]), f: level.pieces.map(piece => {
  const at = solutions[6].find(at => at.id === piece.id);
  return [`${piece.kind}_${piece.shape}`,piece.id,at.r,at.c,at.rotation];
}), r: Array.from({length:8},(_,i)=>level.rows[i] || 0), c: Array.from({length:8},(_,i)=>level.cols[i] || 0) })).toString('base64url')}`;
const startedAt = Date.UTC(2026,9,12,1), finishedAt = startedAt + 60000;
const challenge = { id:'active',difficulty:1,seed:123,startedAt,code,fingerprint:'active' };
const survival = { version:1, completed:[{id:'completed',difficulty:1,seed:123,at:finishedAt}], records:[
  {id:'completed',difficulty:1,seed:123,startedAt:startedAt+1,finishedAt,code,placements:solutions[6]},
  {id:'abandoned',difficulty:1,seed:123,startedAt,code,placements:solutions[6].slice(0,1)},
], recent:[], challenge, progress:{id:'active',status:'active',placements:solutions[6].slice(0,1),past:[[]],future:[],rotations:{},selectedId:null} };

app.whenReady().then(async () => {
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url), dist = path.join(root,'dist'), file = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`), relative = path.relative(dist,file);
    if (url.hostname !== 'game' || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found',{status:404});
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({width:1280,height:900,show:false,webPreferences:{contextIsolation:true,backgroundThrottling:false,offscreen:true}});
  const contents = win.webContents, errors = [], measurements = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code, true);
  const settle = () => new Promise(resolve => setTimeout(resolve,80));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); };
  const screenshot = async name => { await js('document.fonts.ready'); await settle(); writeFileSync(path.join(output,`${name}.png`),(await contents.capturePage()).toPNG()); };
  const load = async () => { await win.loadURL('wildgrid://game/index.html'); await settle(); };
  async function prepare(language) {
    await load();
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1',${JSON.stringify(JSON.stringify({version:1,enabled:false,language}))}); localStorage.setItem('wildgrid-save-v1',${JSON.stringify(JSON.stringify({version:1,current:30,completed:Array.from({length:30},(_,i)=>i+1),progress:{30:solutions[30].slice(0,-1)},settings:{music:0,effects:0,muted:true,facilityTips:true}}))}); localStorage.setItem('wildgrid-survival-v1',${JSON.stringify(JSON.stringify(survival))}); localStorage.setItem('wildgrid-local-maps-v1',${JSON.stringify(JSON.stringify({version:1,maps:[{id:1,code,progress:[],source:'survival',survival:{challengeId:'active',difficulty:10,seed:123,completed:false,blueprintUnlocked:false}}]}))}); void 0;`);
    await load();
  }
  async function assertTools(count = 4) {
    const state = await js(`(() => {
      const panel=document.querySelector('.operations').getBoundingClientRect(), tools=document.querySelector('.tools-panel').getBoundingClientRect();
      const buttons=[...document.querySelectorAll('.camp-tool')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,fits:r.left>=panel.left && r.right<=panel.right && r.top>=panel.top && r.bottom<=panel.bottom && r.bottom<=tools.bottom+1};});
      return {buttons,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    assert.equal(state.buttons.length,count); assert.equal(state.overflow,false);
    assert.ok(state.buttons.every(b=>b.fits),JSON.stringify(state));
    assert.equal(state.buttons[0].y,state.buttons[1].y); if (count === 4) assert.equal(state.buttons[2].y,state.buttons[3].y);
    assert.equal(state.buttons[0].x,state.buttons[2].x); assert.ok(state.buttons[2].y>state.buttons[0].y);
    return state;
  }
  try {
    contents.debugger.attach('1.3');
    for (const viewport of [{width:1280,height:900,touch:false},{width:390,height:844,touch:true},{width:844,height:390,touch:true}]) {
      win.setContentSize(viewport.width,viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:viewport.touch});
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:viewport.touch});
      for (const language of ['zh','en']) {
        await prepare(language);
        assert.deepEqual(await js(`({width:innerWidth,height:innerHeight})`),{width:viewport.width,height:viewport.height});
        await click('.menu-adventure'); await screenshot(`modes-${language}-${viewport.width}`);
        await click('.sandbox-choice:first-child');
        const tools = await assertTools();
        assert.equal(await js(`document.querySelectorAll('.tile.placed .terrain-label').length`),0);
        assert.ok(await js(`document.querySelectorAll('.tile[class*="terrain-"] .terrain-label').length>0`));
        assert.equal(await js(`getComputedStyle(document.querySelector('.tile.placed-tower')).backgroundColor`),'rgb(231, 218, 176)');
        await click('.header-actions button:last-child');
        const namesLabel = language==='zh'?'设施名称显示':'Facility names';
        assert.equal(await js(`(() => {const el=[...document.querySelectorAll('[role="switch"]')].find(el=>el.textContent.includes(${JSON.stringify(namesLabel)})); return el.getAttribute('aria-checked');})()`),'false');
        await js(`[...document.querySelectorAll('[role="switch"]')].find(el=>el.textContent.includes(${JSON.stringify(namesLabel)})).click()`); await settle();
        await screenshot(`settings-${language}-${viewport.width}`); await click('.modal-close');
        assert.ok(await js(`document.querySelectorAll('.tile.placed .terrain-label').length>0`));
        await screenshot(`game-${language}-${viewport.width}`);
        await click('.blueprint-button');
        assert.equal(await js(`document.querySelector('.blueprint-content h2')`),null);
        assert.equal(await js(`document.querySelectorAll('.blueprint-board > .tile').length`),64);
        await screenshot(`blueprint-${language}-${viewport.width}`); await click('.modal-close');
        await load(); await click('.menu-adventure'); await click('.sandbox-choice:first-child');
        assert.ok(await js(`document.querySelectorAll('.tile.placed .terrain-label').length>0`));
        await load(); await click('.menu-guide');
        const pageCount = await js(`document.querySelector('.notebook-heading select').options.length`), icons = [];
        for (let i=0;i<pageCount;i++) {
          await js(`(() => {const s=document.querySelector('.notebook-heading select');s.value=${i};s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle();
          const state=await js(`(() => { const p=document.querySelector('.manual-page'),svg=p.querySelector('.manual-page-heading svg'),r=p.getBoundingClientRect();return {id:p.dataset.page,icon:svg.innerHTML,width:p.scrollWidth,client:p.clientWidth,fits:r.left>=0 && r.right<=innerWidth};})()`);
          assert.ok(state.fits && state.width<=state.client+1,JSON.stringify(state)); icons.push(state.icon);
          if (['local','resume','review','settings','create','sample','cabin','difficulty','clues'].includes(state.id)) await screenshot(`manual-${state.id}-${language}-${viewport.width}`);
        }
        assert.equal(new Set(icons).size,icons.length,'Notebook chapter icons must be unique');
        await click('.notebook-footer button:first-child');
        assert.equal(await js(`document.querySelector('.notebook-heading select').value`),String(pageCount-2));
        await screenshot(`manual-${language}-${viewport.width}`); await click('.modal-close');
        await click('.menu-adventure'); await click('.mode-maps');
        const summary=await js(`(() => {const el=document.querySelector('.survival-card-state');return {width:el.scrollWidth,client:el.clientWidth,nowrap:getComputedStyle(el).whiteSpace};})()`);
        assert.ok(summary.width<=summary.client+1,JSON.stringify(summary)); assert.equal(summary.nowrap,'nowrap');
        assert.notEqual(await js(`getComputedStyle(document.querySelector('.local-map-icon-edit')).backgroundImage`),'none');
        await screenshot(`maps-${language}-${viewport.width}`);
        await click('.sandbox-back'); await click('.survival-entry');
        assert.equal(await js(`document.querySelector('.survival-continue').disabled`),false);
        assert.ok(await js(`(() => {const a=document.querySelector('.survival-continue').getBoundingClientRect(),b=document.querySelector('.survival-records-button').getBoundingClientRect();return Math.abs(a.y-b.y)<1 && b.x>a.x && b.right<=innerWidth;})()`));
        await screenshot(`survival-${language}-${viewport.width}`);
        await click('.survival-records-button');
        assert.equal(await js(`document.querySelectorAll('.survival-record-row').length`),2);
        assert.ok(await js(`document.querySelector('.survival-record-table').textContent.includes(${JSON.stringify(language==='zh'?'已放弃':'Abandoned')})`));
        await screenshot(`records-${language}-${viewport.width}`);
        for (let row=1;row<=2;row++) {
          const before=await js(`localStorage.getItem('wildgrid-survival-v1')`);
          await click(`.survival-record-row:nth-child(${row})`); await assertTools(3);
          assert.equal(await js(`document.querySelector('.blueprint-button').disabled`),false);
          await click('.blueprint-button'); assert.equal(await js(`document.querySelectorAll('.blueprint-board .placed').length`),level.pieces.length);
          assert.equal(await js(`document.querySelector('.blueprint-content h2')`),null);
          await screenshot(`review-${row}-${language}-${viewport.width}`); await click('.modal-close');
          await click('.tool-restart'); assert.equal(await js(`document.querySelector('.blueprint-button').disabled`),false);
          await click('.game-title .icon-button'); assert.equal(await js(`localStorage.getItem('wildgrid-survival-v1')`),before);
          await click('.survival-records-button');
        }
        await click('.survival-records .modal-close');
        await click('.survival-continue'); await assertTools();
        assert.equal(await js(`document.querySelectorAll('.blueprint-button').length`),0);
        await click('.tool-abandon'); await click('.sandbox-modal-actions .primary');
        assert.equal(await js(`document.querySelector('.survival-continue').disabled`),true);
        await click('.survival-records-button'); assert.equal(await js(`document.querySelectorAll('.survival-record-row').length`),3);
        assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-survival-v1')).completed.length`),1);
        measurements.push({viewport,language,tools,summary,pageCount});
        console.log(`PASS ${language} ${viewport.width}×${viewport.height}`);
      }
    }
    assert.deepEqual(errors,[]);
    writeFileSync(path.join(output,'results.json'),JSON.stringify(measurements,null,2));
    console.log('Notebook, unique icons, 2×2 toolbar bounds, names persistence, map labels, resume, terminal records and review blueprints PASS.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) { await screenshot('failure'); console.error(error); clearTimeout(deadline); app.exit(1); }
});
