const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
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
      const idle = await js(`(() => { const a=document.querySelector('.title-float').getAnimations()[0]; a.pause(); a.currentTime=2000; return {duration:a.effect.getTiming().duration,y:new DOMMatrix(getComputedStyle(document.querySelector('.title-float')).transform).m42}; })()`);
      assert.equal(idle.duration, 4000);
      assert.equal(idle.y, -2.5);
      await js(`document.querySelector('.title-float').getAnimations()[0].play()`);
      await screenshot(`${language}-idle`);
      await move(.7, .65);
      await wait(700);
      const hovered = await snapshot();
      assert.equal(hovered.hovered, true);
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
      await wait(1100);
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
    await move(.5, .5);
    assert.equal((await snapshot()).hovered, false);
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
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
    assert.equal(await js(`document.documentElement.scrollWidth > innerWidth`), false);
    await screenshot('touch');
    assert.deepEqual(errors, []);
    console.log('Title motion PASS: bilingual PNG hit testing, entrance order, idle float, smooth follow/return, rapid re-entry, touch, reduced motion and header controls.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    await screenshot('failure');
    console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
