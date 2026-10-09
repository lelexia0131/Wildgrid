const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/data/levels.json'), answers = require('../src/data/solutions.json');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'day31');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration(); app.setPath('userData', path.join(output, `profile-${process.pid}`));
const timer = setTimeout(() => { console.error('Day 31 UI timed out'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width:1280,height:900,show:false,webPreferences:{offscreen:true,backgroundThrottling:false} });
  const contents=win.webContents, errors=[];
  contents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  const js=async code=>{try{return await contents.executeJavaScript(code,true);}catch(error){throw new Error(`${code.slice(0,240)}: ${error.message}; renderer=${JSON.stringify(errors)}`);}};
  const settle=()=>new Promise(resolve=>setTimeout(resolve,60));
  const click=async selector=>{await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await settle();};
  const tile=(r,c)=>`.game-page .tile[aria-label^="第 ${r+1} 行第 ${c+1} 列"]`;
  const file=path.join(root,'dist','index.html');
  async function load(save) {
    await win.loadFile(file);
    await js(`localStorage.setItem('wildgrid-save-v1',${JSON.stringify(JSON.stringify({version:1,progress:{},settings:{muted:true},...save}))})`);
    await win.loadFile(file);await settle();
  }
  try {
    await load({completed:[15],current:31});
    await click('.menu-buttons .secondary');
    const locks=await js(`Array.from(document.querySelectorAll('.level-card')).map(el=>({disabled:el.disabled,text:el.textContent}))`);
    assert.equal(locks.length,45);assert.equal(locks[30].disabled,false);assert.equal(locks[31].disabled,true);
    assert.equal(locks[15].disabled,false);assert.equal(locks[16].disabled,true);assert.ok(locks[30].text.includes('8 × 8'));
    const level=levels[40], newKinds=['foodTruck','powerTower','pool'];
    const remaining=level.pieces.filter(p=>newKinds.includes(p.kind));
    const progress=answers[41].filter(at=>!remaining.some(p=>p.id===at.id));
    for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390}]) {
      win.setSize(viewport.width,viewport.height);
      await load({completed:[15,...Array.from({length:11},(_,i)=>31+i)],current:41,progress:{41:progress}});
      await click('.menu-buttons .primary');await click('.sandbox-choice:first-child');
      for(const piece of remaining) {
        const at=answers[41].find(at=>at.id===piece.id);
        await js(`Array.from(document.querySelectorAll('.facility-card')).find(el=>el.textContent.includes(${JSON.stringify({foodTruck:'餐车',powerTower:'电塔',pool:'泳池'}[piece.kind])})).click()`);await settle();
        await click(tile(at.r,at.c));
      }
      const art=await js(`Array.from(document.querySelectorAll('.tile')).filter(el=>el.classList.contains('placed-foodTruck')||el.classList.contains('placed-powerTower')||el.classList.contains('placed-pool')).map(el=>({kind:el.className,paths:el.querySelectorAll('svg path').length}))`);
      assert.equal(art.length,3);assert.ok(art.every(a=>a.paths>=4));
      assert.equal(await js(`document.documentElement.scrollWidth>innerWidth`),false);
      writeFileSync(path.join(output,`game-${viewport.width}.png`),(await contents.capturePage()).toPNG());
      await js(`Array.from(document.querySelectorAll('.operations button')).find(el=>el.textContent.includes('图纸')).click()`);await settle();
      assert.equal(await js(`document.querySelectorAll('.blueprint-content .placed-foodTruck svg, .blueprint-content .placed-powerTower svg, .blueprint-content .placed-pool svg').length`),3);
      await click('.modal-close');
    }
    win.setSize(1280,900);await load({completed:[15],current:31});
    await js(`Array.from(document.querySelectorAll('.menu-buttons button')).find(el=>el.textContent.includes('野外手册')).click()`);await settle();
    for(const name of ['餐车','电塔','泳池']) assert.equal(await js(`Array.from(document.querySelectorAll('.manual-cards h4')).some(el=>el.textContent===${JSON.stringify(name)})`),true);
    await js(`document.querySelector('.manual-content').scrollTop=document.querySelector('.manual-content').scrollHeight*0.65`);await settle();
    writeFileSync(path.join(output,'manual.png'),(await contents.capturePage()).toPNG());await click('.modal-close');
    await click('.menu-buttons .primary');await click('.sandbox-choice:nth-child(3)');await click('.sandbox-choice:first-child');await click('.sandbox-size-card:nth-child(2)');
    for(const name of ['餐车','电塔','泳池']) assert.ok(await js(`Array.from(document.querySelectorAll('.facility-card')).find(el=>el.textContent.includes(${JSON.stringify(name)}))?.querySelectorAll('svg path').length>=4`));
    await js(`Array.from(document.querySelectorAll('.facility-card')).find(el=>el.textContent.includes('电塔')).click()`);await settle();
    await click(tile(0,0));await click(tile(0,2));
    assert.equal(await js(`document.querySelectorAll('.tile.placed-powerTower').length`),2);
    await js(`Array.from(document.querySelectorAll('.operations button')).find(el=>el.textContent.includes('撤销')).click()`);await settle();
    assert.equal(await js(`document.querySelectorAll('.tile.placed-powerTower').length`),1);
    await click(tile(0,0));await click(tile(1,1));
    assert.equal(await js(`document.querySelectorAll('.tile.placed-powerTower').length`),1);
    await click(tile(1,1));await click('.terrain-tools button:first-child');
    assert.equal(await js(`document.querySelectorAll('.tile.placed-powerTower').length`),0);
    assert.deepEqual(errors,[]);console.log('Day 31 UI: unlocks, new SVGs, blueprint, manual and sandbox operations passed in desktop/portrait/landscape');
    clearTimeout(timer);app.exit(0);
  } catch(error) {console.error(error);clearTimeout(timer);app.exit(1);}
});
