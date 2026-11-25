const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { fileURLToPath } = require('node:url');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const profile = path.join(root, '.desktop-smoke', 'hero-current', 'profile-' + process.pid);
mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.disableHardwareAcceleration();
const deadline = setTimeout(() => app.exit(1), 30000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({show:false, webPreferences:{offscreen:true,backgroundThrottling:false}});
  const contents=win.webContents;
  try {
    await win.loadFile(path.join(root,'dist/index.html'));
    contents.debugger.attach('1.3');
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    const url=await contents.executeJavaScript(`new Promise(resolve=>{
      function ready(){const hero=document.querySelector('img.hero-art');
        if(hero?.complete && hero.currentSrc.includes('home-motion-'))resolve(hero.currentSrc);
        else requestAnimationFrame(ready);
      }ready();
    })`);
    const file=fileURLToPath(url),meta=await sharp(file,{animated:true}).metadata();
    assert.equal(meta.pages,48);assert.equal(meta.loop,0);assert.ok(meta.delay.every(ms=>ms>0));
    const samples=[];
    for(let page=0;page<meta.pages;page++){
      samples.push(await sharp(file,{page,pages:1}).resize(180).flatten({background:'#f8f3df'}).raw().toBuffer());
    }
    const difference=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;
    const steps=samples.map((pixels,i)=>difference(pixels,samples[(i+1)%samples.length]));
    assert.ok(steps.every(delta=>delta>0),'the cover changes between every two frames');
    const maxStep=Math.max(...steps.slice(0,-1));
    assert.ok(steps.at(-1)<maxStep*1.2,'the last frame joins the first without a jump');
    assert.ok(difference(samples[12],samples[36])>maxStep*2,'the orbit has visible depth');
    console.log('PASS: all 48 packaged cover frames animate and the orbit loops continuously.');
    clearTimeout(deadline);app.exit(0);
  } catch(error){console.error(error);clearTimeout(deadline);app.exit(1);}
});
