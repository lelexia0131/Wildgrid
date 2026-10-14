const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/data/levels.json'), solutions = require('../src/data/solutions.json');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'p0');
mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('P0 UI check timed out'); app.exit(1); }, 240000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const wc = win.webContents, errors = [], results = [];
  wc.on('console-message', event => { if (event.level === 'error' && !event.message.includes('ERR_')) errors.push(event.message); });
  const js = code => wc.executeJavaScript(code, true);
  const wait = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await wait(); };
  const shot = async name => writeFileSync(path.join(output, `${name}.png`), (await wc.capturePage()).toPNG());
  const load = () => win.loadFile(path.join(root, 'dist/index.html'));
  async function prepare(day, placements = [], language = 'zh', extra = {}) {
    await load();
    const save = { version: 1, current: day, completed: Array.from({length:day-1},(_,i)=>i+1), progress: {[day]:placements}, settings:{muted:true} };
    await js(`localStorage.clear();Object.entries(${JSON.stringify({
      'wildgrid-save-v1':JSON.stringify(save), 'wildgrid-tutorial-v1':JSON.stringify({version:1,enabled:false,language}), ...extra,
    })}).forEach(([key,value])=>localStorage.setItem(key,value))`);
    await load(); await wait(220);
    await click('.menu-adventure');
  }
  async function viewport(width, height, android = false) {
    win.setContentSize(width,height);
    wc.setUserAgent(android ? 'Mozilla/5.0 (Linux; Android 15; Test) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36' : 'Mozilla/5.0 Chrome/130.0.0.0');
    await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:android});
    await wc.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:android});
    await wait(150);
  }
  async function place(at, level) {
    const p = level.pieces.find(p=>p.id===at.id), selector = `[data-facility="${p.kind}"][data-shape="${p.shape}"]`;
    await click(selector);
    for(let i=0;i<at.rotation;i++) await click(selector);
    await click(`[data-cell="${at.r},${at.c}"]`);
  }
  async function modal(extra = false, scrollAllowed = false) {
    if (extra) await js(`(()=>{const c=document.querySelector('.win-content');for(const [className,text] of [['','已收藏到本地地图 / Saved to local maps'],['survival-error','收藏记录写入失败，请重试。 / Could not save the map. Please try again.']]){const p=document.createElement('p');p.className=className;p.textContent=text;c.append(p);}})()`);
    await wait(220);
    const state = await js(`(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {open:d.open,scroll:d.scrollHeight-d.clientHeight,horizontal:d.scrollWidth-d.clientWidth,bounds:[r.left,r.top,r.right,r.bottom],size:[innerWidth,innerHeight],emblem:document.querySelector('.completion-emblem').getBoundingClientRect().height,buttons:[...d.querySelectorAll('.win-content button')].map(b=>({text:b.textContent,rect:[b.getBoundingClientRect().top,b.getBoundingClientRect().bottom],clipped:b.scrollHeight>b.clientHeight+1}))};})()`);
    assert.ok(state.open); assert.ok(state.bounds[0]>=0 && state.bounds[1]>=0 && state.bounds[2]<=state.size[0]+1 && state.bounds[3]<=state.size[1]+1,JSON.stringify(state));
    assert.ok(state.horizontal<=1,JSON.stringify(state)); assert.ok(state.buttons.every(b=>!b.clipped),JSON.stringify(state));
    if (!scrollAllowed) { assert.ok(state.scroll<=1,JSON.stringify(state)); assert.ok(state.buttons.every(b=>b.rect[0]>=state.bounds[1] && b.rect[1]<=state.bounds[3]),JSON.stringify(state)); }
    else {
      await js(`document.querySelector('dialog').scrollTop=10000`);
      assert.ok(await js(`(()=>{const d=document.querySelector('dialog'),b=d.querySelector('.win-content button:last-of-type');return b.getBoundingClientRect().bottom<=d.getBoundingClientRect().bottom})()`));
    }
    results.push({type:'modal',extra,...state});
  }
  async function board() {
    const state = await js(`(()=>{const b=document.querySelector('.board'),ids=[...b.querySelectorAll('[id]')].map(el=>el.id);return {tiles:b.querySelectorAll(':scope>.tile').length,ids:ids.length===new Set(ids).size,clips:[...b.querySelectorAll('[clip-path]')].every(el=>el.closest('svg').querySelector('clipPath')?.id===el.getAttribute('clip-path').slice(5,-1)),aligned:[...b.querySelectorAll('.placed-facility-art')].every(el=>{const cells=[...b.querySelectorAll('[data-piece-id]')].filter(t=>t.dataset.pieceId===el.dataset.artId).map(t=>t.getBoundingClientRect()),r=el.getBoundingClientRect();return Math.abs(r.left-Math.min(...cells.map(c=>c.left)))<1 && Math.abs(r.right-Math.max(...cells.map(c=>c.right)))<1 && Math.abs(r.top-Math.min(...cells.map(c=>c.top)))<1 && Math.abs(r.bottom-Math.max(...cells.map(c=>c.bottom)))<1}),strokes:[...b.querySelectorAll('.footprint-outline')].every(el=>getComputedStyle(el).strokeWidth==='2px'),previews:[...document.querySelectorAll('.facility-card .art')].every(el=>{const m=el.getScreenCTM();return Math.abs(m.a-m.d)<.001}),android:document.querySelector('.app').hasAttribute('data-android'),filters:[...b.querySelectorAll('.art')].every(el=>getComputedStyle(el).filter==='none')};})()`);
    assert.ok(state.ids && state.clips && state.aligned && state.strokes && state.previews,JSON.stringify(state));
    if(state.android) assert.ok(state.filters,JSON.stringify(state));
    results.push({type:'board',...state});
  }
  try {
    await load(); wc.debugger.attach('1.3');
    const rewardLevel=levels.find(l=>l.id===17), answer=solutions[17];
    const code=`WG1:${Buffer.from(JSON.stringify({v:1,s:8,t:rewardLevel.terrain.map(t=>[t.kind,t.r,t.c]),f:rewardLevel.pieces.map(p=>{const a=answer.find(a=>a.id===p.id);return [`${p.kind}_${p.shape}`,p.id,a.r,a.c,a.rotation]}),r:rewardLevel.rows,c:rewardLevel.cols})).toString('base64url')}`;
    for(const [width,height] of (process.env.WILDGRID_P0_SMALL ? [[320,568],[844,390]] : [[1280,720],[1366,768],[390,844],[360,640],[320,568],[844,390]])) {
      await viewport(width,height,width<1000);
      for(const language of ['zh','en']) {
        await prepare(1,[],language); await click('.mode-adventure'); await place(solutions[1][0],levels[0]); await wait(1100); await modal();
        await shot(`win-${language}-${width}`);
        for(const difficulty of [3,4]) {
          const survival={version:1,completed:[],records:[],recent:[],challenge:{id:'p0-reward',difficulty,seed:123,code,fingerprint:'p0',startedAt:Date.now()},progress:{id:'p0-reward',status:'active',placements:answer.slice(0,-1),past:[],future:[],rotations:{},selectedId:null}};
          await prepare(17,[],language,{'wildgrid-survival-v1':JSON.stringify(survival)}); await click('.mode-survival'); await click('.survival-continue');
          await place(answer.at(-1),rewardLevel); await wait(1100);
          assert.equal(await js(`!!document.querySelector('.survival-upgrade')`),difficulty===4);
          await modal(); await modal(true); await shot(`reward-${difficulty}-${language}-${width}`);
          if(width===320 && difficulty===4) {
            await js(`document.querySelector('.app').style.setProperty('--safe-top','24px');document.querySelector('.app').style.setProperty('--safe-bottom','24px')`); await modal();
            await viewport(280,300,true); await modal(false,true); await shot(`fallback-${language}`); await viewport(width,height,true); await modal();
          }
        }
        console.log(`PASS completion ${language} ${width}x${height}`);
      }
    }
    for(const [width,height,day] of [[1280,720,15],[390,844,16],[390,844,30],[844,390,30]]) {
      await viewport(width,height,width<1000);
      const answer=solutions[day].slice(0,-1); await prepare(day,answer); await click('.mode-adventure'); await wait(250); await board();
      await js(`document.querySelector('.board').scrollIntoView({block:'center'})`);
      assert.ok(await js(`[...document.querySelectorAll('.board>.tile')].every(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.tile')===el})`),'Tile hit targets');
      const region=await js(`(()=>{const r=document.querySelector('.board').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})()`);
      const baselineImage=await wc.capturePage(region), baseline=baselineImage.toBitmap();
      for(let i=0;i<12;i++) {
        const at=answer[i%answer.length]; await click(`[data-piece-id="${at.id}"]`);
        await js(`document.querySelector('.tool-undo').click()`); await wait(200); await board();
        const restoredImage=await wc.capturePage(region), restored=restoredImage.toBitmap();
        let maxDelta=0, changed=0;
        for(let p=0;p<baseline.length;p+=4) {
          let delta=0;for(let c=0;c<4;c++)delta=Math.max(delta,Math.abs(baseline[p+c]-restored[p+c]));
          maxDelta=Math.max(maxDelta,delta);if(delta)changed++;
        }
        if(maxDelta>4 || changed/(baseline.length/4)>.002) {
          writeFileSync(path.join(output,'pixels-before.png'),baselineImage.toPNG());writeFileSync(path.join(output,'pixels-after.png'),restoredImage.toPNG());
          console.log({day,cycle:i,changed,total:baseline.length/4});
        }
        // Allow minor compositor rounding on at most 0.2% of pixels, not missing/moved art.
        assert.ok(maxDelta<=4 && changed/(baseline.length/4)<=.002,`Board pixels changed after pickup/undo ${day}/${i}: ${maxDelta}`);
      }
      await shot(`board-${day}-${width}`);
      if(width<1000) {
        const at=answer[0], point=await js(`(()=>{const r=document.querySelector('[data-cell="${at.r},${at.c}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        await wc.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        await wc.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait();
        assert.equal(await js(`document.querySelectorAll('[data-piece-id="${at.id}"]').length`),0);
        await click('.tool-undo');await wait(200);await board();
      }
      console.log(`PASS board day ${day} ${width}x${height}: 12 pickup/undo cycles`);
    }
    await viewport(390,844,true); await prepare(1); await click('.mode-sandbox'); await click('.sandbox-choice'); await click('.sandbox-size-card:nth-child(2)');
    for(const [kind,shape] of [['camp','long'],['camp','domino'],['camp','el'],['picnic','domino'],['cabin','el']]) {
      const card=`[data-facility="${kind}"][data-shape="${shape}"]`;
      await click(card);
      for(let direction=0;direction<4;direction++) {
        await click(card);await wait(160);await board();
        assert.ok(await js(`(()=>{const svg=document.querySelector('${card} .art'),m=svg.getScreenCTM();return Math.abs(m.a-m.d)<.001})()`));
      }
      await click('[data-cell="3,3"]');
      for(let i=0;i<4;i++) {
        await js(`document.querySelector('[data-cell="3,3"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`); await wait(200); await board();
        await click('.tool-undo'); await wait(200); await board();
        await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true}))`); await wait(200); await board();
      }
      await shot(`rotation-${kind}-${shape}`); await click('[data-cell="3,3"]'); await wait(200);
    }
    console.log('PASS 8x8: all multi-cell shapes, 20 rotations with undo/redo; proportional previews');
    await viewport(390,844,true); await prepare(1); await click('.mode-survival');
    await js(`window.Worker=class {postMessage(){} terminate(){}};void 0`); await click('.survival-difficulty');
    assert.equal(await js(`document.querySelector('.survival-generation-page h1').textContent`),'地图生成中');
    assert.equal(await js(`!!document.querySelector('.survival-identity') || !!document.querySelector('.survival-generating')`),false);
    assert.ok(await js(`!!document.querySelector('.generation-progress[role="progressbar"]:not([aria-valuenow])')`));
    const scenes=[];
    for(let i=0;i<3;i++) {
      scenes.push(await js(`document.querySelector('.survival-generation-page').dataset.scene`));
      assert.ok(await js(`!!document.querySelector('.generation-background svg')`));
      await wait(1600); await shot(`generation-${i}`); await click('.survival-generation-page button'); assert.ok(await js(`!!document.querySelector('.survival-identity')`));
      if(i<2) await click('.survival-difficulty');
    }
    assert.equal(new Set(scenes).size,3);
    assert.deepEqual(errors,[]);
    writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
    console.log('PASS generation page/cancel; no renderer errors');
    clearTimeout(deadline); app.exit(0);
  } catch(e) { await shot('failure'); console.error(e); clearTimeout(deadline); app.exit(1); }
}).catch(e=>{console.error(e);app.exit(1)});
