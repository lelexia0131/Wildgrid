const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require("../../src/game-data/levels.json"), solutions = require("../../src/game-data/solutions.json");
const root = path.resolve(__dirname, '../..'), output = path.join(root, '.desktop-smoke', 'diary-rules');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const timeout = setTimeout(() => { console.error('Diary/rules UI timed out'); app.exit(1); }, 60000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, useContentSize: true, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const contents = win.webContents, errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code, true);
  const settle = () => new Promise(resolve => setTimeout(resolve, 80));
  let touch = false;
  async function click(selector) {
    if (touch) {
      const point = await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await settle();
  }
  async function load(save = {}, language = 'zh') {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', ${JSON.stringify(JSON.stringify({ version: 1, enabled: false, language }))}); localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({ version: 1, completed: [15], current: 31, progress: {}, settings: { muted: true }, ...save }))}); void 0;`);
    await win.loadFile(path.join(root, 'dist', 'index.html')); await settle();
  }
  const snapshot = name => contents.capturePage().then(image => writeFileSync(path.join(output, `${name}.png`), image.toPNG()));
  try {
    contents.debugger.attach('1.3');
    for (const viewport of [{ width: 1280, height: 900, language: 'zh' }, { width: 390, height: 844, language: 'zh', touch: true }, { width: 360, height: 640, language: 'en', touch: true }, { width: 844, height: 390, language: 'en', touch: true }]) {
      touch = !!viewport.touch;
      win.setContentSize(viewport.width, viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: touch });
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: touch });
      await load({}, viewport.language);
      assert.equal(await js(`document.querySelector('.rules-toggle')`), null);
      await click('.menu-journal');
      assert.equal(await js(`document.querySelectorAll('.chapter-card').length`), 3);
      assert.equal(await js(`document.querySelector('.chapter-card[data-chapter="2"]').disabled`), false);
      assert.equal(await js(`document.querySelectorAll('.chapter-2 .chapter-art > img').length`), 3);
      assert.equal(await js(`[...document.querySelectorAll('.chapter-2 .chapter-art > img')].every(img => img.complete && img.naturalWidth > 0)`), true);
      assert.equal(await js(`document.querySelectorAll('.level-card').length`), 0);
      assert.equal(await js(`document.documentElement.scrollWidth > innerWidth`), false);
      if (viewport.height > 800) assert.equal(await js(`document.querySelector('.chapter-grid').scrollHeight > document.querySelector('.chapter-grid').clientHeight + 1`), false);
      await snapshot(`chapters-${viewport.width}`);
      await click('[data-chapter="2"]');
      const cards = await js(`Array.from(document.querySelectorAll('.level-card')).map(el => ({id:Number(el.dataset.level),locked:el.disabled,text:el.textContent.trim(),width:el.clientWidth,height:el.clientHeight}))`);
      assert.deepEqual(cards.map(card => card.id), Array.from({ length: 15 }, (_, i) => 31 + i));
      assert.equal(cards[0].locked, false); assert.equal(cards[1].locked, true);
      assert.ok(cards.every(card => card.width >= 44 && card.height >= 44 && /^\d+$/.test(card.text)));
      assert.equal(await js(`getComputedStyle(document.querySelector('.level-grid')).gridTemplateColumns.split(' ').length`), 5);
      await snapshot(`levels-${viewport.width}`);
      await click('[data-level="32"]');
      assert.equal(await js(`!!document.querySelector('.chapter-levels')`), true);
      await click('[data-level="31"]');
      assert.equal(await js(`document.querySelectorAll('.header-actions button').length`), 3);
      assert.equal(await js(`document.querySelector('.header-actions button:nth-child(2)').classList.contains('rules-toggle')`), true);
      assert.equal(await js(`document.querySelector('.rules-toggle').getAttribute('aria-pressed')`), 'true');
      assert.equal(await js(`document.querySelectorAll('[data-rule-hint]').length`), 0);
      const selected = levels.find(l => l.id === 31).pieces[0];
      const select = `.facility-card[data-facility="${selected.kind}"][data-shape="${selected.shape}"]`;
      await click(select);
      assert.ok(await js(`document.querySelectorAll('[data-rule-hint]').length > 0`));
      assert.equal(await js(`document.querySelectorAll('.terrain-water[data-rule-hint], .terrain-forest[data-rule-hint], .terrain-mountain[data-rule-hint], .placed[data-rule-hint]').length`), 0);
      await snapshot(`rules-${viewport.width}`);
      await click('.rules-toggle');
      assert.equal(await js(`document.querySelectorAll('[data-rule-hint], .rule-tint').length`), 0);
      assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).settings.ruleDisplay`), false);
      await click('.rules-toggle');
      await click('.game-title .icon-button');
      assert.equal(await js(`!!document.querySelector('.chapter-levels') && !document.querySelector('.rules-toggle')`), true);
      await click('.camp-diary .back-link'); await click('[data-chapter="1"]');
      assert.equal(await js(`document.querySelector('[data-level="16"]').disabled`), false);
      assert.equal(await js(`document.querySelector('[data-level="17"]').disabled`), true);
    }
    touch = false;
    win.setContentSize(1280, 900);
    await contents.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');
    await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
    const progress = solutions[31].slice(0, 1);
    await load({ progress: { 31: progress }, settings: { muted: true, ruleDisplay: false } });
    await click('.menu-adventure'); await click('.sandbox-choice:first-child');
    assert.deepEqual(await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).progress[31]`), progress);
    assert.equal(await js(`document.querySelector('.rules-toggle').getAttribute('aria-pressed')`), 'false');
    await load({ completed: [15, 16], current: 17 });
    await click('.menu-adventure'); await click('.sandbox-choice:first-child');
    const camp = '.facility-card[data-facility="camp"][data-shape="domino"]';
    await click(camp);
    const before = await js(`Array.from(document.querySelectorAll('[data-rule-hint]')).map(el=>el.dataset.ruleHint)`);
    await click(camp);
    const after = await js(`Array.from(document.querySelectorAll('[data-rule-hint]')).map(el=>el.dataset.ruleHint)`);
    assert.notDeepEqual(before, after);
    await click('.tool-restart');
    assert.equal(await js(`document.querySelectorAll('[data-rule-hint]').length`), 0);
    await click(camp);
    const green = await js(`document.querySelector('[data-rule-hint="valid"]').dataset.cell`);
    await click(`[data-cell="${green}"]`);
    assert.ok(await js(`document.querySelectorAll('.placed').length > 0`));
    assert.equal(await js(`document.querySelectorAll('.placed[data-rule-hint]').length`), 0);
    await click('.tool-undo');
    assert.equal(await js(`document.querySelectorAll('.placed, [data-rule-hint]').length`), 0);
    await load(); await click('.menu-journal');
    await snapshot('chapters-final');
    assert.deepEqual(errors, []);
    console.log('Diary/rules UI passed: 3 chapters, independent unlocks, 15-level grids, translations, touch, rotation, undo/restart and old saves.');
    clearTimeout(timeout); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(timeout); app.exit(1); }
});
