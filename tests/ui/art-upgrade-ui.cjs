const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../../src/game-data/levels.json'), solutions = require('../../src/game-data/solutions.json');
const root = path.resolve(__dirname, '../..'), output = path.join(root, '.desktop-smoke/art-upgrade');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => app.exit(1), 180000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const wc = win.webContents, errors = [];
  wc.on('console-message', event => { if (event.level === 'error' && !event.message.includes('ERR_')) errors.push(event.message); });
  const js = code => wc.executeJavaScript(code, true);
  const wait = (ms = 70) => new Promise(resolve => setTimeout(resolve, ms));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await wait(); };
  const shot = async name => writeFileSync(path.join(output, `${name}.png`), (await wc.capturePage()).toPNG());
  const load = () => win.loadFile(path.join(root, 'dist/index.html'));
  const stored = () => js(`localStorage.getItem('wildgrid-survival-v1')`);
  async function viewport(width, height) {
    win.setContentSize(width, height);
    wc.setUserAgent(width < 600 ? 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36' : 'Mozilla/5.0 Chrome/130.0.0.0');
    await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  }
  async function prepare(language, before = 0, difficulty = 4, day = 17) {
    const level = levels.find(l => l.id === day), answer = solutions[day];
    const code = `WG1:${Buffer.from(JSON.stringify({ v: 1, s: 8, t: level.terrain.map(t => [t.kind, t.r, t.c]), f: level.pieces.map(p => { const a = answer.find(a => a.id === p.id); return [`${p.kind}_${p.shape}`, p.id, a.r, a.c, a.rotation]; }), r: level.rows, c: level.cols })).toString('base64url')}`;
    const completed = Array.from({ length: before }, (_, i) => ({ id: `old-${i}`, difficulty: 1, seed: i, at: 1 }));
    const survival = { version: 1, completed, records: [], recent: [], challenge: { id: 'art-reward', difficulty, seed: 123, code, fingerprint: 'art' }, progress: { id: 'art-reward', status: 'active', placements: answer.slice(0, -1), past: [], future: [], rotations: {}, selectedId: null } };
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', ${JSON.stringify(JSON.stringify({ version: 1, enabled: false, language }))}); localStorage.setItem('wildgrid-survival-v1', ${JSON.stringify(JSON.stringify(survival))})`);
    await load(); await wait();
    return { level, answer };
  }
  async function solve(fixture) {
    await click('.menu-adventure'); await click('.mode-survival'); await click('.survival-continue');
    const at = fixture.answer.at(-1), p = fixture.level.pieces.find(p => p.id === at.id);
    const selector = `[data-facility="${p.kind}"][data-shape="${p.shape}"]`;
    await click(selector);
    for (let i = 0; i < at.rotation; i++) await click(selector);
    await click(`[data-cell="${at.r},${at.c}"]`);
    for (let i = 0; i < 30; i++) { if (await js(`!!document.querySelector('dialog[open] .reward-xp-track')`)) return; await wait(); }
    throw new Error('Reward did not open');
  }
  async function fits() {
    const state = await js(`(() => { const d = document.querySelector('dialog'), r = d.getBoundingClientRect(); return { scroll: d.scrollHeight-d.clientHeight, horizontal: d.scrollWidth-d.clientWidth, inside: r.top>=0 && r.bottom<=innerHeight+1, buttons: [...d.querySelectorAll('.win-content button')].map(b=>{const v=b.getBoundingClientRect();return {text:b.textContent,fit:v.top>=r.top && v.bottom<=r.bottom && v.height>=40 && b.scrollWidth<=b.clientWidth+1 && b.scrollHeight<=b.clientHeight+1}}) }; })()`);
    assert.ok(state.scroll <= 1 && state.horizontal <= 1 && state.inside && state.buttons.length === 3 && state.buttons.every(b => b.fit), JSON.stringify(state));
  }
  try {
    await load(); wc.debugger.attach('1.3');
    for (const [w, h] of (process.argv.includes('--compact') ? [[320, 568]] : [[1280, 720], [1024, 600], [390, 844], [360, 640], [320, 568], [844, 390]])) {
      await viewport(w, h);
      for (const language of ['zh', 'en']) {
        const fixture = await prepare(language, 490);
        await js(`window.dispatchEvent(new Event('pointerdown'))`); await wait();
        await js('document.fonts.ready');
        assert.ok(await js(`(() => {const title=document.querySelector('.camp-title'), img=title.querySelector('img'), b=document.querySelector('.menu-buttons').getBoundingClientRect();return img.complete && img.naturalWidth>0 && title.getBoundingClientRect().top>=0 && b.bottom<=innerHeight && b.left>=0 && b.right<=innerWidth && !!document.querySelector('.home-landscape picture img')})()`));
        await shot(`home-${language}-${w}`);
        await solve(fixture); await wait(1650); await fits();
        assert.equal(await js(`document.querySelector('.reward-xp-caption').textContent`), '+10500 / 1000');
        assert.equal(await js(`/EXP|XP|本次获得/.test(document.querySelector('.survival-reward').textContent)`), false);
        assert.equal(await js(`parseFloat(getComputedStyle(document.querySelector('.reward-earned')).fontSize)<=14`), true);
        await click('.survival-win > .secondary'); await fits();
        if (w === 320) {
          await js(`document.querySelector('.app').style.setProperty('--safe-top','24px');document.querySelector('.app').style.setProperty('--safe-bottom','24px')`);
          await wait(); await fits();
        }
        await shot(`reward-${language}-${w}`);
        assert.ok(await js(`[...document.querySelectorAll('.reward-mark')].every(el=>el.scrollWidth<=el.clientWidth+1)`));
        console.log(`PASS layouts ${language} ${w}x${h}`);
      }
    }
    if (process.argv.includes('--compact')) { clearTimeout(deadline); app.exit(0); return; }
    await viewport(390, 844);
    // Sample actual animation and confirm that it never writes to persistence.
    let fixture = await prepare('en', 0, 10, 30);
    await solve(fixture);
    const settled = await stored();
    const frames = await js(`new Promise(resolve=>{const frames=[];const sample=()=>{const el=document.querySelector('.reward-xp-track');frames.push([Number(el.getAttribute('aria-valuenow')),Number(el.getAttribute('aria-valuemin')),Number(el.getAttribute('aria-valuemax'))]);if(document.querySelector('.reward-xp.is-complete'))resolve(frames);else requestAnimationFrame(sample)};sample()})`);
    assert.ok(frames.length > 3);
    assert.ok(frames.some(f => f[0] === 10 && f[1] === 0));
    assert.ok(frames.some(f => f[0] === 100 && f[1] === 10));
    assert.deepEqual(frames.at(-1), [100, 100, 500]);
    assert.ok(frames.every((f, i) => !i || f[0] >= frames[i - 1][0]));
    assert.equal(await stored(), settled);
    await click('.survival-win > .text-button');
    await click('.tool-undo'); await wait(1700);
    assert.equal(await js(`document.querySelector('.reward-earned').textContent`), '+0');
    assert.equal(JSON.parse(await stored()).completed.length, 1);
    await fits();
    // Close while growing, then reopen by re-entering the real completed challenge.
    fixture = await prepare('zh', 550, 4);
    await solve(fixture); await wait(430); await click('.survival-win > .secondary'); await click('.modal-close');
    const closed = await stored(); await wait(1300);
    assert.equal(await js(`document.querySelector('dialog').open`), false);
    assert.equal(await stored(), closed);
    fixture = await prepare('en', 1000, 10, 30);
    await solve(fixture); await wait(1700);
    assert.equal(await js(`document.querySelector('.reward-xp-caption').textContent`), '+1001100 · Max rank');
    await fits();
    await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    fixture = await prepare('zh', 0, 4); await solve(fixture);
    assert.equal(await js(`document.querySelector('.reward-xp-track').getAttribute('aria-valuenow')`), '10');
    assert.equal(await js(`document.querySelector('.survival-win').getAnimations({subtree:true}).length`), 0);
    assert.deepEqual(errors, []);
    writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, frames, errors }, null, 2));
    console.log('PASS: layouts, cross-rank animation, max rank, save/replay deduplication, close cleanup and reduced motion.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    console.error(error); writeFileSync(path.join(output, 'failure.txt'), String(error.stack)); await shot('failure'); clearTimeout(deadline); app.exit(1);
  }
});
