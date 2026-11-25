import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {getLevelById,getSolution} from '../../src/engine/index.ts';
import {openBrowser} from '../../scripts/art-3d/browser.mjs';

const session=await openBrowser(),errors=[];
const out=new URL(process.env.WILDGRID_3D_PREVIEWS || '../../docs/3d/previews/',import.meta.url);
await mkdir(out,{recursive:true});
const board=p=>p.locator('.board-section .board');
const cell=(p,r,c)=>board(p).locator(`[data-cell="${r},${c}"]`);
const ready=p=>p.locator('.camp-canvas[data-ready="true"]').waitFor();
async function frame(p){
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function photo(p,name){
  await p.evaluate(()=>document.fonts.ready);await frame(p);
  await writeFile(new URL(name+'.webp',out),await sharp(await p.screenshot({animations:'disabled'})).webp({quality:93}).toBuffer());
}
async function enter(day,{mode='3d',savedMode=mode,tutorial=false,activeStep,progress=[],viewport={width:1450,height:880},names=false}={}){
  const p=await session.browser.newPage({viewport,reducedMotion:'reduce'});p.setDefaultTimeout(12000);
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&/webglprogram|shader error/i.test(m.text()))errors.push(m.text());});
  await p.addInitScript(({day,mode,tutorial,activeStep,progress,names})=>{
    if(sessionStorage.getItem('world-test'))return;sessionStorage.setItem('world-test','1');
    localStorage.setItem('wildgrid-display-v1',JSON.stringify({mode,quality:'high'}));
    localStorage.setItem('wildgrid-tutorial-v1',JSON.stringify({version:1,enabled:tutorial,language:'zh',activeStep}));
    localStorage.setItem('wildgrid-save-v1',JSON.stringify({version:1,current:day,completed:Array.from({length:day-1},(_,i)=>i+1),
      progress:{[day]:progress},settings:{muted:true,facilityNames:names,facilityTips:true}}));
  },{day,mode:savedMode,tutorial,activeStep,progress,names});
  await p.goto(session.url);await p.locator('.menu-art .hero-art').waitFor();
  assert.equal(await p.locator('.screen-menu .board-mode').count(),0,'the cover has no view switch');
  assert.equal(await p.locator('.menu-landscape-background canvas').count(),0);
  assert.ok((await p.locator('.menu-art .hero-art').boundingBox()).height<viewport.height*.8,'the camp cover stays within the menu');
  await p.locator('.menu-adventure').click();await p.locator('.mode-adventure').click();
  await ready(p);
  if(mode==='2d'){await p.locator('.board-mode').click();await p.locator('[data-renderer="2d"]').waitFor();}
  return p;
}
async function toggleNames(p){
  await p.locator('[data-tutorial="settings"]').click();
  await p.getByRole('switch',{name:'设施名称显示'}).click();await p.locator('.modal-close').click();
}
async function inspectName(p,target,expected,on){
  await target.hover();await target.focus();await frame(p);
  const labels=p.locator('.board-section [role="tooltip"]:visible');
  if(on)assert.ok((await labels.allTextContents()).some(s=>s.includes(expected)),expected+' should appear');
  else assert.equal(await p.locator('.board-section [role="tooltip"]').count(),0,expected+' should be hidden');
}
async function drag(p,x,y,dx,dy){
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:12});await p.mouse.up();await frame(p);
}
async function trayGeometry(p){
  return p.locator('.facility-list').evaluate(el=>{
    const css=getComputedStyle(el);
    return {bar:css.scrollbarWidth,thumb:getComputedStyle(el,'::-webkit-scrollbar').display,width:el.clientWidth,height:el.clientHeight,
      scrollHeight:el.scrollHeight,scrollWidth:el.scrollWidth,top:el.scrollTop,left:el.scrollLeft};
  });
}
async function checkTray(p){
  const matrix=()=>board(p).evaluate(el=>el.style.transform);
  const initial=await matrix(),handle=p.locator('.tray-handle');
  await handle.click();await frame(p);
  assert.equal(await handle.getAttribute('aria-expanded'),'false');
  assert.equal(await p.locator('#camp-inventory').isVisible(),false);
  assert.equal(await p.locator('.operations').isVisible(),false);
  assert.equal(await matrix(),initial,'folding must preserve the camera projection');
  await handle.click();await frame(p);
  assert.ok(await p.locator('.operations').isVisible());assert.equal(await matrix(),initial);
}
try{
  const answer=getSolution(39),p=await enter(39,{progress:answer.filter(at=>at.id!=='fire-3')});
  assert.equal(await p.locator('.camera-instructions').count(),0);
  assert.equal(await p.locator('.camera-tools button').count(),4);
  const clueSwitch=p.getByRole('button',{name:'行列提示',exact:true});
  const signs=p.locator('.board-with-clues .clue:visible'),signCount=await signs.count();
  assert.equal(signCount,getLevelById(39).size*2);
  const rules=p.locator('.rules-toggle'),ruleState=await rules.getAttribute('aria-pressed');
  const color=()=>rules.evaluate(el=>getComputedStyle(el).backgroundColor),offColor=await color();
  await rules.click();await frame(p);assert.notEqual(await color(),offColor);
  assert.equal(await signs.count(),signCount);await rules.click();
  await clueSwitch.click();assert.equal(await signs.count(),0);
  assert.equal(await rules.getAttribute('aria-pressed'),ruleState);
  await p.locator('.board-mode').click();assert.equal(await signs.count(),signCount);
  await p.locator('.board-mode').click();await ready(p);assert.equal(await signs.count(),0);
  await clueSwitch.click();assert.equal(await signs.count(),signCount);
  await p.locator('[data-camera="top"]').click();await frame(p);
  const centerCell=cell(p,3,3),homeWidth=(await centerCell.boundingBox()).width;
  await centerCell.hover();
  for(let i=0;i<4;i++){await p.mouse.wheel(0,480);await frame(p);}
  const farWidth=(await centerCell.boundingBox()).width;
  assert.ok(Math.abs((.68*homeWidth/farWidth)**2-.80)<.02,'maximum overhead ground area');
  await p.mouse.wheel(0,480);await frame(p);
  assert.ok(Math.abs((await centerCell.boundingBox()).width-farWidth)<.01,'wheel stops at the limit');
  await checkTray(p);
  await p.locator('[data-camera="home"]').click();await frame(p);
  const guide=p.locator('.guide-strip');
  await guide.waitFor({state:'hidden'});
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.locator('.board .tile:has(> .grass)').first().click();
  await guide.waitFor({state:'visible'});
  await p.waitForFunction(()=>{const opacity=Number(getComputedStyle(document.querySelector('.guide-strip')).opacity);return opacity>0 && opacity<1;});
  await guide.waitFor({state:'hidden'});
  await p.waitForFunction(()=>!document.querySelector('.guide-strip').textContent.includes('先从右侧选择'));
  assert.equal(await guide.isVisible(),false,'expired feedback does not replay the level tip');
  await p.emulateMedia({reducedMotion:'reduce'});
  assert.ok(!(await p.locator('.app').innerText()).match(/\b[23]D\b/i));
  assert.equal(await p.locator('.board-with-clues').evaluate(e=>getComputedStyle(e).backgroundImage.includes('url(')),false);
  await inspectName(p,cell(p,2,2),'水源',false);await toggleNames(p);
  for(const [r,c,name] of [[2,2,'水源'],[4,2,'森林'],[2,3,'营地'],[3,2,'泳池']])await inspectName(p,cell(p,r,c),name,true);
  await toggleNames(p);await inspectName(p,cell(p,2,2),'水源',false);
  await p.locator('.board-mode').click();await inspectName(p,cell(p,2,2),'水源',false);
  await toggleNames(p);await inspectName(p,cell(p,2,2),'水源',true);await toggleNames(p);
  await p.locator('.board-mode').click();await ready(p);
  await p.mouse.move(5,5);await frame(p);
  const tent=cell(p,3,3),r=await tent.boundingBox(),clip={x:Math.floor(r.x),y:Math.floor(r.y-r.height*.42),width:Math.floor(r.width),height:Math.floor(r.height)};
  const before=await sharp(await p.screenshot({clip})).removeAlpha().raw().toBuffer();
  await tent.hover();await frame(p);
  const after=await sharp(await p.screenshot({clip})).removeAlpha().raw().toBuffer();
  let amber=0,changed=0;
  for(let i=0;i<before.length;i+=3)if(before[i]>137 && before[i]>before[i+1]*1.18 && before[i+1]>before[i+2]*1.45){
    amber++;if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>35)changed++;
  }
  assert.ok(amber>40 && changed/amber<.025,`hover cut into the tent: ${changed}/${amber}`);
  await p.locator('[data-facility="fire"]').click();
  await checkTray(p);
  assert.equal(await p.locator('[data-facility="fire"]').getAttribute('aria-pressed'),'true');
  await p.keyboard.press('Escape');await p.mouse.move(5,5);await photo(p,'day39-world');
  await drag(p,590,501,0,-218);await p.locator('[data-camera-view="level"]').waitFor();
  await photo(p,'day39-horizon');await drag(p,590,285,36,176);
  await p.locator('[data-camera="home"]').click();await frame(p);
  assert.equal(await p.locator('.tile[data-piece-id]').count(),3);
  await p.locator('[data-facility="fire"]').click();
  const oldCanvas=await p.locator('.camp-canvas').elementHandle();
  await cell(p,2,4).click();await p.locator('.win-modal[open]').waitFor();await frame(p);
  assert.ok(await oldCanvas.evaluate(el=>el===document.querySelector('.camp-canvas')&&el.dataset.ready==='true'));
  assert.equal(await p.locator('.win-modal .journal-scene-art, .win-modal .completion-landscape').count(),0);
  assert.equal(await p.locator('.tile[data-piece-id]').count(),4);await photo(p,'day39-completed');
  const fireBox=await cell(p,2,4).boundingBox();
  const clipFire={x:Math.floor(fireBox.x),y:Math.floor(fireBox.y-fireBox.height*.53),width:Math.floor(fireBox.width),height:Math.floor(fireBox.height*1.5)};
  await p.emulateMedia({reducedMotion:'no-preference'});
  const film=[];
  for(let i=0;i<16;i++){
    film.push(await sharp(await p.screenshot({clip:clipFire})).resize(240,240,{fit:'contain',background:'#e5eabf'}).removeAlpha().raw().toBuffer());
    await p.waitForTimeout(74);
  }
  assert.ok(!film[0].equals(film[8]));
  await writeFile(new URL('day39-fire.webp',out),await sharp(Buffer.concat(film),{raw:{width:240,height:240*film.length,pageHeight:240,channels:3}})
    .webp({loop:0,delay:Array(film.length).fill(120),quality:90}).toBuffer());
  await p.locator('.modal-close').click();await p.locator('.tool-blueprint').click();
  assert.equal(await p.locator('.blueprint-board .model-icon').count(),0);
  assert.ok(await p.locator('.blueprint-board svg.footprint-art').count()>0);await photo(p,'day39-blueprint');await p.close();

  const lake=await enter(1,{mode:'3d',viewport:{width:1030,height:760}});
  await lake.reload();await lake.locator('.menu-adventure').click();await lake.locator('.mode-sandbox').click();
  await lake.locator('.sandbox-choice').first().click();await lake.locator('.sandbox-size-card').first().click();await ready(lake);
  const firstCard=lake.locator('.facility-card').first();await firstCard.hover();
  const beforeHold=await trayGeometry(lake);assert.ok(beforeHold.scrollHeight>beforeHold.height);
  await lake.mouse.down();await lake.waitForTimeout(800);
  const held=await trayGeometry(lake);
  await writeFile(new URL('tray-long-press.webp',out),await sharp(await lake.locator('#camp-inventory').screenshot()).webp({quality:92}).toBuffer());
  await lake.mouse.up();
  assert.equal(held.bar,'none','desktop long press exposes the native scrollbar');
  assert.equal(held.thumb,'none');assert.equal(held.width,beforeHold.width);assert.equal(held.top,beforeHold.top);
  await lake.mouse.wheel(0,320);await lake.waitForFunction(()=>document.querySelector('.facility-list').scrollTop>0);
  await firstCard.focus();await lake.keyboard.press('Tab');assert.ok(await lake.locator('.facility-list :focus').count()>0);
  await lake.locator('[data-terrain="water"]').click();
  for(const [r,c] of [[2,2],[2,3],[3,2],[3,3],[3,4]])await cell(lake,r,c).click();
  await lake.locator('[data-camera="top"]').click();await frame(lake);await lake.mouse.move(4,4);
  assert.equal(await lake.locator('.board .terrain-water').count(),5);await photo(lake,'connected-water');
  await cell(lake,3,3).click();assert.equal(await lake.locator('.board .terrain-water').count(),4);
  await cell(lake,3,3).click();assert.equal(await lake.locator('.board .terrain-water').count(),5);
  await lake.setViewportSize({width:390,height:844});await frame(lake);await checkTray(lake);await lake.locator('.tray-handle').click();
  assert.equal(await lake.locator('#camp-inventory').isVisible(),false);await photo(lake,'tray-folded-portrait');
  await lake.locator('.tray-handle').click();assert.ok(await lake.locator('[data-terrain="water"]').isVisible());
  const touch=await lake.context().newCDPSession(lake);
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});
  const shelf=lake.locator('.facility-list');await shelf.evaluate(el=>{el.scrollLeft=0;});
  const shelfRect=await shelf.boundingBox(),tx=shelfRect.x+shelfRect.width*.78,ty=shelfRect.y+shelfRect.height*.5;
  const touchAt=(type,x)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:x===undefined?[]:[{x,y:ty,id:1}]});
  const beforeTouch=await trayGeometry(lake);assert.ok(beforeTouch.scrollWidth>beforeTouch.width);
  await touchAt('touchStart',tx);await lake.waitForTimeout(850);
  const heldTouch=await trayGeometry(lake);await touchAt('touchEnd');
  assert.equal(heldTouch.bar,'none');assert.equal(heldTouch.thumb,'none');assert.equal(heldTouch.height,beforeTouch.height);
  await touchAt('touchStart',tx);
  for(let i=1;i<=7;i++){await touchAt('touchMove',tx-i*20);await lake.waitForTimeout(22);}
  await touchAt('touchEnd');await lake.waitForFunction(()=>document.querySelector('.facility-list').scrollLeft>40);
  await lake.close();

  const flat=await enter(39,{mode:'2d',progress:answer.filter(at=>at.id!=='fire-3'),viewport:{width:844,height:390}});
  await flat.locator('[data-facility="fire"]').click();await cell(flat,2,4).click();await flat.locator('.win-modal[open]').waitFor();
  const actions=await flat.locator('.win-content button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
  assert.ok(actions.every(Boolean),'the completed plan keeps its actions inside a short window');
  await flat.setViewportSize({width:320,height:568});await frame(flat);
  assert.ok(await flat.locator('.win-modal').evaluate(d=>d.scrollHeight<=d.clientHeight+1),'portrait result buttons fit without scrolling');
  assert.equal(await flat.locator('.board .tile[data-piece-id]').count(),4);await flat.close();

  const sky=await enter(60,{names:true});
  const anchor=sky.locator('.board .terrain-anchor').first(),rock=sky.locator('.board .terrain-rock').first();
  await inspectName(sky,anchor,'系留桩',true);await inspectName(sky,rock,'岩石',true);
  const skyClues=sky.getByRole('button',{name:'行列提示',exact:true});await skyClues.click();
  await sky.locator('[data-layer-button="sky"]').click();const cloud=sky.locator('.board .terrain-cloud').first();
  assert.equal(await sky.locator('.clue:visible').count(),0);await skyClues.click();
  assert.equal(await sky.locator('.clue:visible').count(),getLevelById(60).size*2);
  await inspectName(sky,cloud,'低云',true);await toggleNames(sky);await inspectName(sky,cloud,'低云',false);
  await sky.locator('.board-mode').click();await inspectName(sky,cloud,'低云',false);await toggleNames(sky);await inspectName(sky,cloud,'低云',true);await sky.close();

  const lesson=await enter(1,{tutorial:true});
  await lesson.locator('.tutorial-next').click();await lesson.locator('.tutorial-next').click();
  await lesson.locator('[data-step="viewsDemo"]').waitFor();
  await lesson.locator('[data-renderer="2d"]').waitFor();await ready(lesson);await photo(lesson,'day1-view-demo');
  assert.equal(await lesson.evaluate(()=>JSON.parse(localStorage.getItem('wildgrid-display-v1')).mode),'3d');
  await lesson.locator('.tutorial-next').click();await lesson.locator('[data-step="viewsTry"]').waitFor();
  await lesson.locator('[data-tutorial="board-view"]').click();await lesson.locator('[data-step="cameraHelp"]').waitFor();
  assert.equal(await lesson.evaluate(()=>JSON.parse(localStorage.getItem('wildgrid-display-v1')).mode),'2d');
  await ready(lesson);await lesson.locator('.tutorial-next').click();await lesson.locator('[data-renderer="2d"]').waitFor();
  await lesson.locator('.tutorial-skip').click();assert.equal(await lesson.locator('.tile[data-piece-id]').count(),0);await lesson.close();
  const resumed=await enter(1,{savedMode:'2d',tutorial:true,activeStep:{day:1,index:2}});
  await resumed.locator('[data-step="clues"]').waitFor();
  assert.equal(await resumed.evaluate(()=>JSON.parse(localStorage.getItem('wildgrid-tutorial-v1')).activeStep.stepId),'clues');
  await resumed.close();

  const powerDay=35,definition=getLevelById(powerDay);
  const power=await enter(powerDay,{progress:getSolution(powerDay).filter(at=>definition.pieces.find(p=>p.id===at.id)?.kind==='powerTower')});
  assert.ok(await power.locator('.board .placed-powerTower').count()>0);await photo(power,'pylon-camp');
  await power.locator('[data-camera="turn"]').click();await frame(power);await photo(power,'pylon-quarter-turn');await power.close();
  assert.deepEqual(errors,[]);
  console.log('Camp world checks passed: zoom limit, stable folding, independent clue and rule toggles, fading guide, animated cover, both board views, mouse/touch input, Day 39 completion and Day 1 tutorial.');
}finally{await session.close();}
