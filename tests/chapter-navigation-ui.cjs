const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require('../src/game-data/levels.json');
const solutions = require('../src/game-data/solutions.json');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'chapter-navigation');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const timeout = setTimeout(() => { console.error('Chapter navigation UI timed out'); app.exit(1); }, 60000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, useContentSize: true, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const contents = win.webContents, errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code, true);
  const settle = () => new Promise(resolve => setTimeout(resolve, 280));
  let touch = false;
  async function click(selector) {
    if (touch) {
      const point = await js(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await settle();
  }
  async function load(completed, language = 'zh') {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', ${JSON.stringify(JSON.stringify({ version: 1, enabled: false, language }))}); localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({ version: 1, completed, current: 1, progress: { 1: solutions[1].slice(0, 1) }, settings: { muted: true } }))}); void 0;`);
    await win.loadFile(path.join(root, 'dist', 'index.html')); await settle();
    await click('.menu-journal');
    return js(`document.querySelectorAll('.chapter-card').length`);
  }
  async function swipe(next, dx = 120, dy = 0) {
    const point = await js(`(() => { const r = document.querySelector('.journal-level-stage').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+Math.min(100,r.height/2)}; })()`);
    await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let step = 1; step <= 6; step++) {
      await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + (next ? -dx : dx) * step / 6, y: point.y + dy * step / 6 }] });
    }
    await contents.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle();
  }
  async function checkChapter(chapter, count, language, viewport) {
    assert.equal(await js(`!!document.querySelector('.journal-chapter-previous')`), chapter > 0);
    assert.equal(await js(`!!document.querySelector('.journal-chapter-next')`), chapter < count - 1);
    assert.deepEqual(await js(`[...document.querySelectorAll('.level-card')].map(el => Number(el.dataset.level))`), levels.slice(chapter * 15, chapter * 15 + 15).map(level => level.id));
    const layout = await js(`(() => {
      const grid = document.querySelector('.level-grid'), stage = document.querySelector('.journal-level-stage');
      const g = grid.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const arrows = [...document.querySelectorAll('.journal-chapter-arrow')].map(el => {
        const r = el.getBoundingClientRect(), img = el.querySelector('img');
        return { visible:getComputedStyle(el).display !== 'none', left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, center: r.y+r.height/2, label: el.getAttribute('aria-label'), text: el.textContent, loaded: img.complete && img.naturalWidth > 0, previous: el.classList.contains('journal-chapter-previous') };
      });
      return { arrows, grid: { left:g.left, right:g.right, center:g.y+g.height/2, height:g.height }, stageHeight:s.height, columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length, overflow:document.documentElement.scrollWidth > innerWidth, cards:[...grid.children].every(el => el.clientWidth >= 44 && el.clientHeight >= 44) };
    })()`);
    assert.equal(layout.overflow, false);
    assert.equal(layout.cards, true);
    assert.equal(layout.columns, viewport.width < 360 ? 2 : viewport.width <= 760 ? 3 : 5);
    for (const arrow of layout.arrows) {
      assert.ok(arrow.loaded && !arrow.text);
      assert.equal(arrow.visible, !viewport.touch);
      if (!arrow.visible) continue;
      assert.ok(arrow.width >= 44 && arrow.height >= 44);
      assert.ok(arrow.left >= 0 && arrow.right <= viewport.width && arrow.top >= 0 && arrow.bottom <= viewport.height);
      assert.ok(arrow.previous ? arrow.right < layout.grid.left : arrow.left > layout.grid.right, JSON.stringify(layout));
      if (layout.grid.height <= layout.stageHeight - 24) assert.ok(Math.abs(arrow.center - layout.grid.center) < 2, JSON.stringify(layout));
      assert.equal(arrow.label, language === 'en' ? arrow.previous ? 'Previous chapter' : 'Next chapter' : arrow.previous ? '上一篇章' : '下一篇章');
    }
    writeFileSync(path.join(output, `chapter-${chapter}-${viewport.width}x${viewport.height}.png`), (await contents.capturePage()).toPNG());
  }
  try {
    contents.debugger.attach('1.3');
    for (const viewport of [{ width: 1280, height: 900, language: 'zh' }, { width: 390, height: 844, language: 'zh', touch: true }, { width: 360, height: 640, language: 'en', touch: true }, { width: 320, height: 568, language: 'zh', touch: true }, { width: 844, height: 390, language: 'en', touch: true }]) {
      touch = !!viewport.touch;
      win.setContentSize(viewport.width, viewport.height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: touch });
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: touch });
      const count = await load(levels.map(level => level.id), viewport.language);
      const save = await js(`localStorage.getItem('wildgrid-save-v1')`);
      const timeOrigin = await js('performance.timeOrigin');
      await click('[data-chapter="0"]');
      for (let chapter = 0; chapter < count; chapter++) {
        await checkChapter(chapter, count, viewport.language, viewport);
        assert.equal(await js(`document.querySelectorAll('.level-card.completed').length`), 15);
        if (chapter < count - 1) { if (touch) await swipe(true); else await click('.journal-chapter-next'); }
      }
      if (touch) { await swipe(true); await checkChapter(count - 1, count, viewport.language, viewport); }
      for (let chapter = count - 2; chapter >= 0; chapter--) {
        if (touch) await swipe(false); else await click('.journal-chapter-previous');
        await checkChapter(chapter, count, viewport.language, viewport);
        assert.equal(await js(`document.querySelector('.journal-level-navigation').dataset.direction`), 'previous');
      }
      assert.equal(await js(`localStorage.getItem('wildgrid-save-v1')`), save);
      assert.equal(await js('performance.timeOrigin'), timeOrigin, 'Chapter changes must not reload the page');
      if (touch) {
        await swipe(false); await checkChapter(0, count, viewport.language, viewport);
        await swipe(true, 20); await checkChapter(0, count, viewport.language, viewport);
        await swipe(true, 20, 100); await checkChapter(0, count, viewport.language, viewport);
        await js(`document.querySelector('.journal-level-stage').scrollTop = 0`);
      }
      await js(`document.querySelector('.journal-level-stage').scrollTop = 10000`);
      await settle();
      const centerBefore = await js(`document.querySelector('.journal-chapter-next').getBoundingClientRect().top`);
      await js(`document.querySelector('.journal-level-stage').scrollTop = 0`);
      assert.equal(await js(`document.querySelector('.journal-chapter-next').getBoundingClientRect().top`), centerBefore);
      await click('[data-level="1"]');
      assert.equal(await js(`!!document.querySelector('.game-page')`), true);
      await click('.game-title .icon-button');
      assert.equal(await js(`!!document.querySelector('.journal-chapter-next')`), true);
    }
    touch = false;
    await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
    win.setContentSize(1280, 900);
    await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await load([]); await click('[data-chapter="0"]');
    assert.equal(await js(`document.querySelector('.journal-chapter-next').disabled`), true);
    await click('.journal-chapter-next');
    assert.equal(await js(`!!document.querySelector('[data-level="1"]')`), true);
    await load([15]); await click('[data-chapter="0"]'); await click('.journal-chapter-next');
    assert.equal(await js(`document.querySelector('[data-level="16"]').disabled`), false);
    assert.equal(await js(`document.querySelector('[data-level="17"]').disabled`), true);
    await click('.journal-chapter-next');
    assert.equal(await js(`document.querySelector('[data-level="31"]').disabled`), false);
    assert.equal(await js(`document.querySelector('[data-level="32"]').disabled`), true);
    await click('[data-level="32"]');
    assert.equal(await js(`!!document.querySelector('.chapter-levels')`), true);
    await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await click('.journal-chapter-previous');
    assert.equal(await js(`getComputedStyle(document.querySelector('.level-grid')).animationName`), 'none');
    assert.deepEqual(errors, []);
    console.log('Chapter navigation UI passed: first/middle/last, desktop arrows, mobile swipes, unlocks, saves, level entry, SVGs, centering, Chinese/English, portrait/landscape, reduced motion and no page reload.');
    clearTimeout(timeout); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(timeout); app.exit(1); }
});
