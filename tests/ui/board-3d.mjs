import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { openBrowser } from '../../scripts/art-3d/browser.mjs';
import { encodeMap, getLevelById } from '../../src/engine/index.ts';

const solutions=JSON.parse(await readFile(new URL('../../src/game-data/solutions.json',import.meta.url),'utf8'));
const out=new URL(process.env.WILDGRID_3D_PREVIEWS || '../../docs/3d/previews/',import.meta.url);
await mkdir(out,{recursive:true});
const session=await openBrowser(),errors=[],measurements=[];
const ready=page=>page.locator('.camp-canvas[data-ready="true"]').waitFor();
const cell=(page,r,c)=>page.locator(`.board [data-cell="${r},${c}"]`);
async function photo(page,name){
  await page.evaluate(()=>document.fonts.ready);
  const image=await page.screenshot({animations:'disabled'});
  await writeFile(new URL(name+'.webp',out),await sharp(image).webp({quality:93}).toBuffer());
}
async function createPage(day,options={},quality='medium'){
  const page=await session.browser.newPage({viewport:{width:1365,height:860},...options});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|webglprogram/i.test(m.text()))errors.push(m.text());});
  await page.addInitScript(({day,progress,quality})=>{
    if(sessionStorage.getItem('qa-init'))return;
    sessionStorage.setItem('qa-init','1');
    localStorage.setItem('wildgrid-display-v1',JSON.stringify({mode:'3d',quality}));
    localStorage.setItem('wildgrid-tutorial-v1',JSON.stringify({version:1,enabled:false,language:day===60?'en':'zh'}));
    localStorage.setItem('wildgrid-save-v1',JSON.stringify({version:1,current:day,completed:Array.from({length:day-1},(_,i)=>i+1),progress:{[day]:progress},settings:{muted:true,facilityTips:true}}));
  },{day,progress:solutions[day].slice(0,-1),quality});
  await page.goto(session.url);return page;
}
async function adventure(page){
  await page.locator('.menu-adventure').click();await page.locator('.mode-adventure').click();await ready(page);
}
async function checkPicking(page,all=true){
  const hits=await page.locator('.board .tile').evaluateAll(tiles=>tiles.map(tile=>{
    const r=tile.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const target=document.elementFromPoint(x,y);
    return {id:tile.dataset.cell,ok:target?.closest('[data-cell]')===tile,hit:target?.className?.toString(),x:Math.round(x),y:Math.round(y)};
  }));
  assert.ok(hits.length>=16);
  if(all)assert.deepEqual(hits.filter(h=>!h.ok),[]);
}
async function snapshot(page){return page.locator('.board .tile[data-piece-id]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.cell,n.dataset.pieceId]));}
async function cameraSettled(page){
  await page.evaluate(()=>delete window.qaCamera);
  await page.waitForFunction(()=>{
    const transform=document.querySelector('.board').style.transform, now=performance.now();
    if(window.qaCamera?.transform!==transform)window.qaCamera={transform,time:now};
    return now-window.qaCamera.time>150;
  });
}
async function measure(page,scene){
  const record=await page.evaluate(async()=>{
    const canvas=document.querySelector('.camp-canvas'),gl=canvas.getContext('webgl2');
    const gpu=gl.getExtension('WEBGL_debug_renderer_info');
    const frames=[],begin=performance.now();
    // Continuous zoom produces actual frames, including rendering, compositing and pacing.
    const board=document.querySelector('.board-with-clues');
    const event=(type,x,y)=>board.dispatchEvent(new WheelEvent(type,{deltaY:y,clientX:x,bubbles:true,cancelable:true}));
    await new Promise(resolve=>{let last=0;function step(now){
      if(last)frames.push(now-last);last=now;event('wheel',250,Math.sin((now-begin)/200)*5);
      if(now-begin<2200)requestAnimationFrame(step);else resolve();
    }requestAnimationFrame(step);});
    frames.sort((a,b)=>a-b);
    return {gpu:gpu?gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],calls:Number(canvas.dataset.draws),triangles:Number(canvas.dataset.triangles),samples:frames.length,p50ms:+frames[Math.floor(frames.length*.50)].toFixed(1),p95ms:+frames[Math.floor(frames.length*.95)].toFixed(1)};
  });
  measurements.push({scene,...record});
  await page.locator('[data-camera="home"]').click();await cameraSettled(page);
}
try{
  const page=await createPage(30,{},'high');
  await photo(page,'home');await adventure(page);await checkPicking(page);
  const occupied=await snapshot(page);assert.ok(occupied.length>15);
  await page.mouse.move(2,2);await photo(page,'day30-world');await measure(page,'day30-high');
  async function hintReady(selector){
    await page.waitForFunction(sel=>!!document.querySelector(sel)||!!document.querySelector('.hint-badge-confirmation'),selector);
    const confirmation=page.locator('.hint-badge-confirmation .primary');
    if(await confirmation.isVisible())await confirmation.click();
    await page.locator(selector).waitFor({state:'attached'});
  }
  await page.locator('.tool-hint').click();await hintReady('.hint-panel footer button');
  for(const stage of [2,3]){
    await page.locator('.hint-panel footer button').click();
    await hintReady('.tool-hint[data-hint-stage="'+stage+'"]');
    if(stage===2)assert.ok(await page.locator('.hint-cell.visible').count()>0);
  }
  await page.locator('.hint-panel footer button').click();await hintReady('.hint-facility');
  assert.deepEqual(await snapshot(page),occupied);await page.locator('.hint-panel header button').click();
  const matrix=()=>page.locator('.board').evaluate(el=>el.style.transform);
  const initial=await matrix(),tile=await cell(page,3,3).boundingBox(),x=tile.x+tile.width/2,y=tile.y+tile.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+90,y+20,{steps:8});await page.mouse.up();await cameraSettled(page);
  assert.notEqual(await matrix(),initial);assert.deepEqual(await snapshot(page),occupied);
  await page.locator('[data-camera="top"]').click();await cameraSettled(page);await checkPicking(page);await photo(page,'day30-overhead');
  await page.locator('.board-mode').click();assert.deepEqual(await snapshot(page),occupied);
  await page.locator('.board-mode').click();await ready(page);assert.deepEqual(await snapshot(page),occupied);
  await page.locator('[data-tutorial="settings"]').click();
  await page.locator('.display-settings select').last().selectOption('medium');
  await page.locator('.modal-close').click();await ready(page);assert.deepEqual(await snapshot(page),occupied);
  await page.reload();await adventure(page);assert.deepEqual(await snapshot(page),occupied);
  await page.locator('.camp-canvas').evaluate(el=>el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.locator('[data-renderer="2d"]').waitFor();assert.deepEqual(await snapshot(page),occupied);
  await page.close();

  const sky=await createPage(60);await adventure(sky);await sky.locator('[data-layer-button="sky"]').click();
  assert.ok(await sky.locator('[data-projection]').count()>0);
  await sky.locator('.projection-toggle').click();assert.equal(await sky.locator('[data-projection]').count(),0);
  await sky.locator('.projection-toggle').click();await sky.locator('[data-camera="turn"]').click();await cameraSettled(sky);
  await checkPicking(sky);await photo(sky,'day60-sky');await sky.close();

  const savedMaps=await createPage(30);
  const code=encodeMap({level:getLevelById(30),placements:solutions[30]});
  await savedMaps.evaluate(({code,progress})=>{
    localStorage.setItem('wildgrid-local-maps-v1',JSON.stringify({version:1,maps:[{id:1,code,progress}]}));
    const id='3d-check';
    localStorage.setItem('wildgrid-survival-v1',JSON.stringify({version:1,completed:[],records:[],recent:[],challenge:{id,difficulty:5,seed:30,code,fingerprint:id},
      progress:{id,status:'active',placements:progress,past:[],future:[],rotations:{},selectedId:null}}));
  },{code,progress:solutions[30].slice(0,2)});
  await savedMaps.reload();await savedMaps.locator('.menu-adventure').click();await savedMaps.locator('.mode-maps').click();
  await savedMaps.locator('.local-map-enter').click();await ready(savedMaps);const restored=await snapshot(savedMaps);assert.ok(restored.length>=2);
  await savedMaps.reload();await savedMaps.locator('.menu-adventure').click();await savedMaps.locator('.mode-survival').click();
  await savedMaps.locator('.survival-continue').click();await ready(savedMaps);assert.deepEqual(await snapshot(savedMaps),restored);
  await savedMaps.reload();await savedMaps.locator('.menu-guide').click();
  const manual=savedMaps.locator('.notebook-heading select');
  const rockPage=await manual.locator('option').filter({hasText:'岩石'}).first().getAttribute('value');
  await manual.selectOption(rockPage);await savedMaps.locator('.manual-page[data-page="rock"]').waitFor();
  assert.ok(await savedMaps.locator('.manual-page img.model-icon').count()>0);await photo(savedMaps,'manual-rocks');await savedMaps.close();

  const unsupported=await createPage(1);
  await unsupported.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...options){
      return type==='webgl2'?null:original.call(this,type,...options);
    };
  });
  await unsupported.reload();await unsupported.locator('.menu-adventure').click();await unsupported.locator('.mode-adventure').click();
  await unsupported.locator('.render-status').waitFor();assert.ok(await unsupported.locator('[data-renderer="2d"] .tile').count()>0);await unsupported.close();

  const editor=await createPage(1,{viewport:{width:412,height:850},hasTouch:true,isMobile:true,deviceScaleFactor:1.5},'low');
  await editor.locator('.menu-adventure').tap();await editor.locator('.mode-sandbox').tap();
  await editor.locator('.sandbox-choice').first().tap();await editor.locator('.sandbox-size-card').first().tap();await ready(editor);
  await editor.locator('[data-terrain="water"]').tap();await cell(editor,2,0).tap();await cell(editor,2,1).tap();
  await editor.locator('[data-terrain="rock"]').tap();await cell(editor,1,3).tap();await cell(editor,1,4).tap();
  await editor.locator('[data-terrain="forest"]').tap();await cell(editor,4,0).tap();await cell(editor,4,1).tap();
  const camp=editor.locator('[data-facility="camp"][data-shape="domino"]');
  await camp.tap();await cell(editor,3,1).tap();
  assert.equal((await snapshot(editor)).length,2);
  // First pivot would enter the forest at (4,1). The other end can turn freely.
  await cell(editor,3,1).click({button:'right'});assert.ok(await cell(editor,3,2).getAttribute('data-piece-id'));
  await cell(editor,3,2).click({button:'right'});assert.equal(await cell(editor,3,1).getAttribute('data-piece-id'),null);
  await editor.keyboard.press('Control+z');assert.ok(await cell(editor,3,1).getAttribute('data-piece-id'));
  await editor.keyboard.press('Control+y');assert.equal(await cell(editor,3,1).getAttribute('data-piece-id'),null);
  await checkPicking(editor);await photo(editor,'sandbox-touch');
  const before=await snapshot(editor),beforeCamera=await editor.locator('.board').evaluate(el=>el.style.transform);
  const client=await editor.context().newCDPSession(editor);
  const fingers=(a,b)=>[{x:a[0],y:a[1],id:1},{x:b[0],y:b[1],id:2}];
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:fingers([140,290],[220,290])});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:fingers([127,273],[236,315])});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cameraSettled(editor);
  assert.notEqual(await editor.locator('.board').evaluate(el=>el.style.transform),beforeCamera);
  assert.deepEqual(await snapshot(editor),before);
  await editor.setViewportSize({width:850,height:412});await editor.locator('[data-camera="home"]').tap();await cameraSettled(editor);await checkPicking(editor);
  await measure(editor,'sandbox-low-touch-emulation');await editor.close();

  const campView=await createPage(1,{viewport:{width:1480,height:920}},'high');
  await campView.locator('.menu-adventure').click();await campView.locator('.mode-sandbox').click();
  await campView.locator('.sandbox-choice').first().click();await campView.locator('.sandbox-size-card').first().click();await ready(campView);
  for(const [kind,points] of Object.entries({forest:[[0,0],[0,3],[3,0],[4,5]],rock:[[0,4],[1,5],[4,1]],water:[[2,3],[2,4],[3,4],[5,2]]})){
    await campView.locator('[data-terrain="'+kind+'"]').click();
    for(const [r,c] of points)await cell(campView,r,c).click();
  }
  for(const [kind,shape,r,c] of [['cabin','el',1,0],['camp','single',2,2],['fire','single',3,2],['tower','single',1,4],['picnic','domino',1,2]]){
    await campView.locator(`[data-facility="${kind}"][data-shape="${shape}"]`).click();await cell(campView,r,c).click();
  }
  await campView.keyboard.press('Escape');await campView.locator('[data-camera="home"]').click();await campView.mouse.move(2,2);await checkPicking(campView);await photo(campView,'camp-clearing');
  const frames=[],delays=[],width=888,height=552;
  let lastTime=Date.now();
  for(let i=0;i<18;i++){
    const pixels=await sharp(await campView.screenshot()).resize(width,height).removeAlpha().raw().toBuffer();
    frames.push(pixels);delays.push(Math.max(70,Math.min(250,Date.now()-lastTime)));lastTime=Date.now();
    await campView.waitForTimeout(85);
  }
  assert.ok(!frames[0].equals(frames[8]),'the camp animates while the camera and placements are stationary');
  const animated=await sharp(Buffer.concat(frames),{raw:{width,height:height*frames.length,pageHeight:height,channels:3}})
    .webp({quality:85,loop:0,delay:delays}).toBuffer();
  assert.equal((await sharp(animated,{animated:true}).metadata()).pages,frames.length);
  await writeFile(new URL('camp-motion.webp',out),animated);
  await campView.emulateMedia({reducedMotion:'reduce'});await campView.waitForTimeout(250);
  const quiet=await cell(campView,3,2).screenshot();await campView.waitForTimeout(260);
  assert.ok(quiet.equals(await cell(campView,3,2).screenshot()),'reduced motion keeps the campfire still');
  await campView.emulateMedia({reducedMotion:'no-preference'});
  await campView.locator('[data-facility="camp"][data-shape="single"]').click();await cell(campView,3,3).hover();await photo(campView,'placement-preview');
  await campView.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify(measurements,null,2));
}finally{await session.close();}
