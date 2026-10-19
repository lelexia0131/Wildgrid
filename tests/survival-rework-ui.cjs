const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'survival-rework');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const deadline = setTimeout(() => app.exit(1), 90000);
app.whenReady().then(async () => {
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url), file = path.resolve(root, 'dist', `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(path.join(root, 'dist'), file);
    if (url.hostname !== 'game' || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, offscreen: true, backgroundThrottling: false } });
  win.webContents.debugger.attach('1.3');
  async function resize(width,height) {
    win.setContentSize(width,height);
    if(width<=844) { await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true}); await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:true}); }
    else { await win.webContents.debugger.sendCommand('Emulation.clearDeviceMetricsOverride'); await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:false}); }
  }
  const js = code => win.webContents.executeJavaScript(code);
  const wait = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));
  async function click(selector) { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await wait(); }
  async function load() { await win.loadURL(process.env.WILDGRID_TEST_URL || 'wildgrid://game/index.html'); await wait(); }
  async function modes() { await click('.menu-buttons .primary'); }
  async function local() { await load(); await modes(); await js(`[...document.querySelectorAll('.sandbox-choice')].at(-1).click()`); await wait(); }
  async function survival() { await load(); await modes(); await click('.survival-entry'); await wait(220); }
  async function capture(name) { await wait(180); writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG()); }
  async function measureMap() {
    return js(`(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
      const preview = document.querySelector('.local-map-preview'), items = document.querySelector('.local-map-items'), actions = document.querySelector('.local-map-actions');
      const buttons = [...actions.children];
      return { preview: rect(preview), items: rect(items), actions: rect(actions), buttons: buttons.map(rect), overflow: document.documentElement.scrollWidth > innerWidth,
        buttonOverflow: buttons.some(b => b.scrollWidth > b.clientWidth + 1), heading: document.querySelector('.local-map-heading h2').textContent };
    })()`);
  }
  try {
    const levels = JSON.parse(readFileSync(path.join(root, 'src/game-data/levels.json'), 'utf8'));
    const solutions = JSON.parse(readFileSync(path.join(root, 'src/game-data/solutions.json'), 'utf8'));
    const level = levels.find(l => l.id === 45);
    const payload = { v: 1, s: level.size, t: level.terrain.map(t => [t.kind,t.r,t.c]), f: level.pieces.map(p => { const at = solutions[45].find(a => a.id === p.id); return [`${p.kind}_${p.shape}`,p.id,at.r,at.c,at.rotation]; }), r:level.rows,c:level.cols };
    const code = 'WG1:' + Buffer.from(JSON.stringify(payload)).toString('base64url');
    await load();
    await js(`localStorage.clear();localStorage.setItem('wildgrid-local-maps-v1',${JSON.stringify(JSON.stringify({version:1,maps:[{id:1,code,progress:[]}]}))});localStorage.setItem('wildgrid-tutorial-v1',JSON.stringify({version:1,enabled:false,language:'zh',basicComplete:true,basicSeen:[],facilitiesSeen:[],skipped:[],daysSeen:[]}));`);
    const states = [];
    for (const [width,height] of [[1280,900],[900,600],[640,480],[390,844],[844,390],[320,640]]) {
      await resize(width,height); await local();
      const state = await measureMap(); states.push({width,height,...state});
      assert.equal(state.overflow,false,JSON.stringify(state)); assert.equal(state.buttonOverflow,false,JSON.stringify(state));
      assert.ok(Math.abs(state.preview.width-state.preview.height)<1,JSON.stringify(state));
      assert.ok(state.actions.y >= Math.max(state.preview.bottom,state.items.bottom),JSON.stringify(state));
      const [a,b,c,d] = state.buttons;
      assert.ok(Math.abs(a.width-b.width)<1 && Math.abs(a.height-b.height)<1 && Math.abs(c.height-d.height)<1 && Math.abs(a.y-b.y)<1 && Math.abs(c.y-d.y)<1 && c.y>=a.bottom,JSON.stringify(state));
      for (const selector of ['.local-map-enter','.local-map-edit','.local-map-delete','.local-map-icon-edit']) {
        assert.ok(await js(`(() => { const el=document.querySelector('${selector}');el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight+1 && !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('${selector}'); })()`),`${width}x${height} unreachable ${selector}`);
      }
      await capture(`local-${width}x${height}`);
    }
    // Existing entry/edit/delete/icon actions still reach their original screens/dialogs.
    await resize(1280,900); await local();
    await click('.local-map-icon-edit'); assert.equal(await js(`document.querySelectorAll('.map-icon-picker button').length > 0`),true); await click('.modal-close');
    await click('.local-map-delete'); assert.equal(await js(`!!document.querySelector('.local-map-modal[open] form p')`),true); await click('.modal-close');
    await click('.local-map-enter'); assert.equal(await js(`!!document.querySelector('.game-page')`),true);
    await local(); await click('.local-map-edit'); assert.equal(await js(`!!document.querySelector('.sandbox-editor-tools')`),true);
    for (const language of ['zh','en']) {
      await js(`const raw=JSON.parse(localStorage.getItem('wildgrid-tutorial-v1'));raw.language='${language}';localStorage.setItem('wildgrid-tutorial-v1',JSON.stringify(raw));`);
      for (const [width,height] of [[1280,900],[390,844],[844,390],[320,640]]) {
        await resize(width,height); await survival();
        const sizes = await js(`[...document.querySelectorAll('.survival-bottom button')].map(b=>{const r=b.getBoundingClientRect();return [r.width,r.height]})`);
        assert.ok(sizes.every(s=>Math.abs(s[0]-sizes[0][0])<1 && Math.abs(s[1]-sizes[0][1])<1),JSON.stringify(sizes));
        await click('.survival-disabled-button');
        const frame = await js(`(async () => { const image=document.querySelector('.survival-facility-frame');await image.decode();const panel=image.parentElement.getBoundingClientRect(),r=image.getBoundingClientRect();return {loaded:image.naturalWidth>0,width:r.width,height:r.height,panelWidth:panel.width,panelHeight:panel.height,visible:r.top>=0 && r.left>=0 && r.bottom<=innerHeight+1 && r.right<=innerWidth+1}; })()`);
        assert.equal(frame.loaded,true); assert.equal(frame.visible,true,JSON.stringify(frame));
        assert.ok(frame.width>0 && Math.abs(frame.width/frame.height-4/3)<0.01 && Math.abs(frame.width-frame.panelWidth)<1 && Math.abs(frame.height-frame.panelHeight)<1,JSON.stringify(frame));
        assert.equal(await js(`document.querySelectorAll('.survival-facility-grid button[aria-pressed]').length`),11);
        const grid = await js(`(() => {const b=[...document.querySelectorAll('.survival-facility-grid button')];return {tops:b.slice(0,7).map(x=>x.getBoundingClientRect().top),overflow:b.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent),scroll:document.querySelector('.survival-facilities').scrollHeight>document.querySelector('.survival-facilities').clientHeight+1};})()`);
        assert.ok(grid.tops.slice(0,6).every(t=>t===grid.tops[0]) && grid.tops[6]>grid.tops[0],JSON.stringify(grid));
        assert.deepEqual(grid.overflow,[],`${width} ${language}: ${JSON.stringify(grid)}`);
        if (height>600) assert.equal(grid.scroll,false);
        await click('.survival-facility-grid button:first-child');
        assert.equal(await js(`document.querySelector('.survival-facility-grid button').getAttribute('aria-pressed')`),'true');
        assert.ok(await js(`getComputedStyle(document.querySelector('.is-disabled .disabled-facility-art'),'::after').backgroundColor.includes('196')`));
        assert.ok(await js(`(() => { const art=document.querySelector('.is-disabled .disabled-facility-art > *'),style=getComputedStyle(art);return style.opacity==='0.4' && style.filter==='brightness(0.55)'; })()`));
        assert.ok(await js(`(() => { const close=document.querySelector('.survival-facilities .modal-close'),r=close.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.modal-close')===close; })()`));
        await capture(`toolbox-${language}-${width}x${height}`);
        await click('.survival-facility-reset');
        assert.equal(await js(`document.querySelectorAll('.survival-facility-grid .is-disabled').length`),0);
        await click('.survival-facilities .modal-close');
        assert.equal(await js(`!!document.querySelector('.survival-facilities')`),false);
      }
    }
    for (const language of ['zh','en']) {
      await js(`const raw=JSON.parse(localStorage.getItem('wildgrid-tutorial-v1'));raw.language='${language}';localStorage.setItem('wildgrid-tutorial-v1',JSON.stringify(raw));`);
      for (const [width,height] of [[1280,900],[390,844],[844,390],[320,640]]) {
        await resize(width,height); await load(); await click('.menu-guide');
        for (const [page,title] of [['disabled-facilities',language==='zh'?'禁用设施':'Disable facilities'],['difficulty',language==='zh'?'难度':'Difficulty']]) {
          await js(`(() => { const select=document.querySelector('.notebook-heading select');select.value=[...select.options].find(option=>option.textContent.endsWith(${JSON.stringify(title)})).value;select.dispatchEvent(new Event('change',{bubbles:true})); })()`); await wait(300);
          const state = await js(`(() => { const content=document.querySelector('.manual-content');return {page:content.dataset.page,text:content.textContent,overflow:content.scrollWidth>content.clientWidth+1,minimums:[...content.querySelectorAll('tbody tr')].map(row=>Number(row.children[2].textContent))}; })()`);
          assert.equal(state.page,page); assert.equal(state.overflow,false,`${language} ${width}: ${JSON.stringify(state)}`);
          if(page==='difficulty') assert.deepEqual(state.minimums,[3,3,4,4,5,5,6,7,8,9]);
          else assert.ok(state.text.includes(language==='zh'?'右上角叉号':'upper-right cross'));
          await capture(`manual-${page}-${language}-${width}x${height}`);
        }
      }
    }
    // Notice is automatic, has no close icon, does not move or cover buttons.
    for(const [width,height] of [[1280,900],[390,844],[320,640]]) {
      await resize(width,height); await survival();
      await js(`localStorage.setItem('wildgrid-survival-disabled-v1',JSON.stringify(['camp_el','cabin_el','pool_single']));document.querySelector('.survival-difficulty:last-child').scrollIntoView({block:'end'});`);
      const before = await js(`[...document.querySelectorAll('.survival-difficulty')].map(b=>b.getBoundingClientRect().y)`);
      await click('.survival-difficulty:last-child');
      assert.equal(await js(`document.querySelectorAll('.survival-notice button').length`),0);
      assert.deepEqual(await js(`[...document.querySelectorAll('.survival-difficulty')].map(b=>b.getBoundingClientRect().y)`),before);
      assert.ok(await js(`document.querySelector('.survival-notice').getBoundingClientRect().top>=Math.max(...[...document.querySelectorAll('.survival-difficulty')].map(b=>b.getBoundingClientRect().bottom))`));
      assert.ok(await js(`(() => { const el=document.querySelector('.survival-notice'),r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.survival-notice'); })()`), `notice invisible at ${width}x${height}`);
      await capture(`notice-${width}x${height}`);
    }
    await wait(4300); assert.equal(await js(`!!document.querySelector('.survival-notice')`),false);
    writeFileSync(path.join(output,'geometry.json'),JSON.stringify(states,null,2));
    console.log('Local map layout/actions, facility panel effects/reset/close, bilingual manual and difficulty limits, equal buttons and automatic notice passed.');
    clearTimeout(deadline);win.destroy();app.quit();
  } catch(error) { console.error(error); await capture('failure');clearTimeout(deadline);app.exit(1); }
});
