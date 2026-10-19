const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.desktop-smoke', 'title-motion');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('Title motion check timed out.'); app.exit(1); }, 45000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const contents = win.webContents, errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  await win.loadURL('about:blank');
  contents.debugger.attach('1.3');
  const js = code => contents.executeJavaScript(code, true);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(code) {
    for (let i = 0; i < 100; i++) { if (await js(code)) return; await wait(20); }
    throw new Error(`Condition timed out: ${code}`);
  }
  const snapshot = () => js(`(() => {
    const sign = document.querySelector('.title-sign'), motion = document.querySelector('.title-interaction');
    const m = new DOMMatrix(getComputedStyle(motion).transform);
    return {hovered:sign.dataset.hovered === 'true', scale:Math.hypot(m.m11,m.m12,m.m13), x:m.m41, y:m.m42, transform:motion.style.transform};
  })()`);
  async function move(x, y) {
    const point = await js(`(() => { const r = document.querySelector('.title-sign').getBoundingClientRect(); return {x:Math.round(r.x+r.width*${x}),y:Math.round(r.y+r.height*${y})}; })()`);
    contents.sendInputEvent({ type: 'mouseMove', ...point });
    await wait(30);
  }
  async function click(selector) {
    const point = await js(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
    contents.sendInputEvent({ type: 'mouseMove', ...point });
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    await wait(80);
  }
  const screenshot = async name => writeFileSync(path.join(output, `${name}.png`), (await contents.capturePage()).toPNG());
  try {
    await contents.debugger.sendCommand('Animation.enable');
    await contents.debugger.sendCommand('Animation.setPlaybackRate', { playbackRate: 0 });
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await until(`document.querySelector('.title-lettering')?.complete`);
    assert.equal(await js(`document.querySelector('.title-sign').dataset.ready`), 'false');
    await move(.7, .65);
    assert.equal((await snapshot()).transform, '', 'interaction must wait for title entrance');
    assert.deepEqual(await js(`['.camp-title','.hero-art','.menu-buttons'].map(s => { const t = document.querySelector(s).getAnimations()[0].effect.getTiming(); return [t.delay,t.duration]; })`), [[0,450],[450,750],[1200,450]]);
    await contents.debugger.sendCommand('Animation.setPlaybackRate', { playbackRate: 1 });
    await until(`document.querySelector('.title-sign').dataset.ready === 'true'`);
    await until(`!document.querySelector('.home-entering')`);

    for (const language of ['zh', 'en']) {
      if (language === 'en') {
        await click('[data-tutorial="settings"]');
        await js(`const select = document.querySelector('.tutorial-language select'); select.value = 'en'; select.dispatchEvent(new Event('change', {bubbles:true})); void 0;`);
        await click('.modal-close');
        await until(`document.querySelector('.title-lettering')?.complete && document.querySelector('.camp-title-en')`);
      }
      await move(.02, .02);
      await wait(1100);
      assert.equal((await snapshot()).hovered, false, `${language}: transparent padding must not hover`);
      const local = await js(`(() => {
        const svg = document.querySelector('.title-artwork');
        const parts = [...svg.querySelectorAll('.title-leaf,.title-lantern')];
        const sample = part => {
          const animation = part.getAnimations()[0];
          const {duration,delay} = animation.effect.getTiming();
          animation.pause(); animation.currentTime = duration + delay;
          const first = getComputedStyle(part).transform;
          animation.currentTime = duration * 1.47 + delay;
          const second = getComputedStyle(part).transform;
          let maxAcceleration = 0;
          if(part.classList.contains('title-lantern')) {
            let previousAngle, previousVelocity;
            for(let frame=0;frame<=78;frame++) {
              animation.currentTime=duration+delay+frame*duration/78;
              const m=new DOMMatrix(getComputedStyle(part).transform);
              const angle=Math.atan2(m.m12,m.m11)*180/Math.PI;
              if(previousAngle!==undefined) {
                const velocity=angle-previousAngle;
                if(previousVelocity!==undefined) maxAcceleration=Math.max(maxAcceleration,Math.abs(velocity-previousVelocity));
                previousVelocity=velocity;
              }
              previousAngle=angle;
            }
          }
          animation.play();
          return {duration,delay,changed:first !== second,maxAcceleration};
        };
        const time = svg.getCurrentTime(); svg.pauseAnimations();
        const warps = [...svg.querySelectorAll('feDisplacementMap')];
        svg.setCurrentTime(.5 * 1.8); const peak = warps.map(warp => warp.scale.animVal);
        svg.setCurrentTime(0); const trough = warps.map(warp => warp.scale.animVal);
        let previous, previousStep, maxStep = 0, maxAcceleration = 0;
        for(let frame=0;frame<=108;frame++) {
          svg.setCurrentTime(frame/60);
          const values = warps.map(warp=>warp.scale.animVal);
          if(previous) {
            const step=values.map((value,index)=>value-previous[index]);
            step.forEach((value,index)=>{
              maxStep=Math.max(maxStep,Math.abs(value));
              if(previousStep) maxAcceleration=Math.max(maxAcceleration,Math.abs(value-previousStep[index]));
            });
            previousStep=step;
          }
          previous=values;
        }
        svg.setCurrentTime(time); svg.unpauseAnimations();
        return {parts:parts.map(sample),peak,trough,maxStep,maxAcceleration,base:getComputedStyle(svg.querySelector(':scope > use')).transform};
      })()`);
      assert.equal(local.parts.length, 4);
      assert.ok(local.parts.every(part => part.changed), `${language}: each decoration must move independently`);
      assert.equal(new Set(local.parts.slice(0, 3).map(part => part.duration)).size, 3, 'leaves must use different rhythms');
      assert.equal(new Set(local.parts.slice(0, 3).map(part => part.delay)).size, 3, 'leaves must start out of phase');
      assert.ok(local.peak.every((value,index) => value > local.trough[index]), 'the flame must deform continuously');
      assert.ok(local.peak[1] > local.peak[0], 'hover must gently strengthen the flame deformation');
      assert.ok(local.maxStep < 2, 'flame deformation must remain smooth at 60 Hz sampling');
      assert.ok(local.maxAcceleration < .1, 'flame velocity must remain continuous between keyframes');
      assert.ok(local.parts[3].maxAcceleration < .04, 'lantern movement must remain smooth at 30 Hz sampling');
      assert.equal(local.base, 'none', 'wood and lettering must stay still within the logo');
      const residue = await js(`(async () => {
        const source = document.querySelector('.title-hit-image');
        const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(source,0,0);
        const png = canvas.toDataURL();
        const region = ${language === 'en' ? '[193,405,212,219]' : '[311,348,251,226]'};
        const original = ctx.getImageData(...region).data;
        let minAlpha = 255; for(let i=3;i<original.length;i+=4) minAlpha=Math.min(minAlpha,original[i]);
        const svg = document.querySelector('.title-artwork').cloneNode(true);
        svg.setAttribute('width',canvas.width); svg.setAttribute('height',canvas.height); svg.removeAttribute('class');
        svg.querySelector('image').setAttribute('href',png);
        svg.querySelectorAll('feImage').forEach(image=>image.setAttribute('href',${JSON.stringify(`data:image/svg+xml;base64,${readFileSync(path.join(root, 'src/assets/branding/flame-displacement.svg')).toString('base64')}`)}));
        svg.querySelectorAll('animate').forEach(animation=>animation.remove());
        svg.querySelectorAll('feDisplacementMap').forEach(warp=>warp.setAttribute('scale','24'));
        const render = async clone => {
          const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone)); await image.decode();
          ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0);
        };
        const base = svg.cloneNode(true);
        base.querySelectorAll('.title-flame,.title-firelight,.title-leaf,.title-lantern').forEach(part=>part.remove());
        await render(base);
        const lantern = ${language === 'en' ? '[1645,470,72,109]' : '[1898,420,78,115]'};
        const pixels = ctx.getImageData(...lantern).data;
        let remaining = 0; for(let i=3;i<pixels.length;i+=4) if(pixels[i]>8) remaining++;
        const oldFire = ctx.getImageData(...region).data;
        let remainingFire = 0; for(let i=3;i<oldFire.length;i+=4) if(oldFire[i]>8) remainingFire++;
        const flame = svg.cloneNode(true);
        flame.querySelectorAll(':scope > use,.title-firelight,.title-leaf,.title-lantern,.title-flame-idle').forEach(part=>part.remove());
        await render(flame);
        const fire = ctx.getImageData(...region).data;
        let exposed = 0; for(let i=3;i<fire.length;i+=4) if(fire[i]<minAlpha-2) exposed++;
        // Compare rasterized frames at the actual on-screen size, not just SVG attribute values.
        const display = document.createElement('canvas');
        display.width = Math.round(document.querySelector('.title-artwork').getBoundingClientRect().width);
        display.height = Math.round(display.width * canvas.height / canvas.width);
        const displayCtx = display.getContext('2d');
        const frame = async scale => {
          flame.querySelectorAll('feDisplacementMap').forEach(warp=>warp.setAttribute('scale',String(scale)));
          await render(flame); displayCtx.clearRect(0,0,display.width,display.height); displayCtx.drawImage(canvas,0,0,display.width,display.height);
          return {pixels:displayCtx.getImageData(0,0,display.width,display.height).data,png:display.toDataURL()};
        };
        const first = await frame(${local.trough[0]});
        const second = await frame(${local.peak[0]});
        let visibleChanges = 0;
        for(let i=0;i<first.pixels.length;i+=4) if(Math.abs(first.pixels[i]-second.pixels[i])+Math.abs(first.pixels[i+1]-second.pixels[i+1])+Math.abs(first.pixels[i+2]-second.pixels[i+2])>30) visibleChanges++;
        return {remaining,remainingFire,exposed,visibleChanges,frames:[first.png,second.png]};
      })()`);
      residue.frames.forEach((png,index)=>writeFileSync(path.join(output,`${language}-flame-frame-${index}.png`),Buffer.from(png.split(',')[1],'base64')));
      assert.ok(residue.visibleChanges >= 30, `${language}: flame movement must visibly change at least 30 pixels at the displayed size (actual ${residue.visibleChanges})`);
      assert.equal(residue.remaining, 0, `${language}: the static base must contain no lantern pixels`);
      assert.equal(residue.remainingFire, 0, `${language}: the static base must contain no flame pixels`);
      assert.equal(residue.exposed, 0, `${language}: the warped flame must cover the original contour completely`);
      const fireBounds = await js(`(() => {
        const svg=document.querySelector('.title-artwork'), rect=svg.getBoundingClientRect(), filter=svg.querySelector('filter');
        const scale=rect.width/svg.viewBox.baseVal.width;
        svg.pauseAnimations(); document.querySelector('.title-float').getAnimations().forEach(animation=>animation.pause());
        return {x:Math.ceil(rect.x+Number(filter.getAttribute('x'))*scale),y:Math.ceil(rect.y+Number(filter.getAttribute('y'))*scale),width:Math.floor(Number(filter.getAttribute('width'))*scale)-1,height:Math.floor(Number(filter.getAttribute('height'))*scale)-1};
      })()`);
      const liveFrames = [];
      for(const time of [0,.5*1.8]) {
        await js(`document.querySelector('.title-artwork').setCurrentTime(${time}); void 0;`);
        await wait(80);
        const frame=await contents.capturePage(fireBounds); liveFrames.push(frame.toBitmap());
        writeFileSync(path.join(output,`${language}-live-flame-${liveFrames.length}.png`),frame.toPNG());
      }
      let liveChanges=0;
      for(let i=0;i<liveFrames[0].length;i+=4) if(Math.abs(liveFrames[0][i]-liveFrames[1][i])+Math.abs(liveFrames[0][i+1]-liveFrames[1][i+1])+Math.abs(liveFrames[0][i+2]-liveFrames[1][i+2])>30) liveChanges++;
      assert.ok(liveChanges>=30,`${language}: the live renderer must visibly animate the flame (actual ${liveChanges} pixels)`);
      await js(`document.querySelector('.title-artwork').unpauseAnimations(); document.querySelector('.title-float').getAnimations().forEach(animation=>animation.play()); void 0;`);
      const paints=[];
      const recordPaint=()=>paints.push(performance.now());
      contents.on('paint',recordPaint);
      await wait(1800);
      contents.off('paint',recordPaint);
      const intervals=paints.slice(1).map((time,index)=>time-paints[index]).sort((a,b)=>a-b);
      const fps=(paints.length-1)*1000/(paints.at(-1)-paints[0]);
      const p95=intervals[Math.floor(intervals.length*.95)];
      console.log(`${language} title rendering: ${fps.toFixed(1)} FPS, p95 ${p95.toFixed(1)} ms`);
      assert.ok(fps>=30,`${language}: live title rendering should sustain at least 30 FPS`);
      const idle = await js(`(() => { const a=document.querySelector('.title-float').getAnimations()[0]; a.pause(); a.currentTime=2000; return {duration:a.effect.getTiming().duration,y:new DOMMatrix(getComputedStyle(document.querySelector('.title-float')).transform).m42}; })()`);
      assert.equal(idle.duration, 4000);
      assert.equal(idle.y, -2.5);
      await js(`document.querySelector('.title-float').getAnimations()[0].play()`);
      await screenshot(`${language}-idle`);
      await move(.7, .65);
      await wait(700);
      const hovered = await snapshot();
      assert.equal(hovered.hovered, true);
      assert.equal(await js(`getComputedStyle(document.querySelector('.title-flame-idle')).display`), 'none');
      assert.notEqual(await js(`getComputedStyle(document.querySelector('.title-flame-hover')).display`), 'none');
      assert.ok(Math.abs(hovered.scale - 1.03) < .001);
      assert.ok(hovered.x > 1 && hovered.x < 5.1);
      assert.ok(hovered.y > -5.1 && hovered.y < 5.1);
      const layout = await js(`document.querySelector('.title-sign').getBoundingClientRect().toJSON()`);
      await screenshot(`${language}-hover`);
      for (let i = 0; i < 6; i++) { await move(.02, .02); await move(.7, .65); }
      await wait(700);
      assert.ok(Math.abs((await snapshot()).scale - 1.03) < .001, 'rapid re-entry must not accumulate scale');
      assert.deepEqual(await js(`document.querySelector('.title-sign').getBoundingClientRect().toJSON()`), layout, 'visual movement must not move layout bounds');
      await move(.02, .02);
      const returning = await snapshot();
      assert.ok(returning.scale > 1 && returning.scale < 1.031, 'exit must interpolate');
      await until(`(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('.title-interaction')).transform); return Math.abs(m.m41)<.001 && Math.abs(m.m42)<.001 && Math.abs(Math.hypot(m.m11,m.m12,m.m13)-1)<.0001; })()`);
      const rest = await snapshot();
      assert.ok(Math.abs(rest.scale - 1) < .0001 && Math.abs(rest.x) < .001 && Math.abs(rest.y) < .001);
      // A touch pointer on a desktop/hybrid device must not start mouse follow.
      await js(`document.querySelector('.title-sign').dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',clientX:${layout.x + layout.width * .7},clientY:${layout.y + layout.height * .65}})); void 0;`);
      assert.equal((await snapshot()).hovered, false);
    }

    await move(.7, .65);
    await wait(100);
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await until(`document.querySelector('.title-interaction').style.transform === ''`);
    assert.equal(await js(`document.querySelector('.title-float').getAnimations().length`), 0);
    assert.equal(await js(`document.querySelector('.title-artwork').getAnimations({subtree:true}).length`), 0);
    assert.equal(await js(`getComputedStyle(document.querySelector('.title-hit-image')).visibility`), 'visible');
    assert.equal(await js(`document.querySelector('.title-artwork').animationsPaused()`), true);
    await move(.5, .5);
    assert.equal((await snapshot()).hovered, false);
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    await until(`document.querySelector('.title-sign').dataset.motion === 'running'`);
    await js(`Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); void 0;`);
    await until(`document.querySelector('.title-sign').dataset.motion === 'paused'`);
    assert.ok(await js(`document.querySelector('.title-artwork').getAnimations({subtree:true}).every(animation=>animation.playState==='paused')`));
    assert.equal(await js(`document.querySelector('.title-artwork').animationsPaused()`), true);
    await js(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); void 0;`);
    await until(`document.querySelector('.title-sign').dataset.motion === 'running'`);
    await wait(60);
    await move(.7, .65);
    await until(`document.querySelector('.title-sign').dataset.hovered === 'true'`);
    await click('.sound-toggle');
    assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).settings.muted`), true);
    await click('[data-tutorial="settings"]');
    assert.equal(await js(`!!document.querySelector('.modal-close')`), true);
    await click('.modal-close');

    await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true });
    await move(.7, .65);
    await wait(100);
    assert.equal((await snapshot()).hovered, false);
    assert.ok(await js(`document.querySelector('.title-artwork').getAnimations({subtree:true}).some(animation=>animation.playState==='running')`), 'touch devices keep local animation');
    assert.equal(await js(`document.documentElement.scrollWidth > innerWidth`), false);
    await screenshot('touch');
    assert.deepEqual(errors, []);
    console.log('Title motion PASS: no static lantern residue or exposed flame contour, bilingual local animation, staggered leaves, restrained hover, visibility pause, PNG hit testing, entrance order, smooth follow/return, touch, reduced motion and header controls.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    await screenshot('failure');
    console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
