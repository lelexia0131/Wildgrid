const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const levels = require("../../src/game-data/levels.json"), solutions = require("../../src/game-data/solutions.json");
const root = path.resolve(__dirname, '../..'), output = path.join(root, '.desktop-smoke', 'journal-art');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const timeout = setTimeout(() => { console.error('Journal artwork UI timed out'); app.exit(1); }, 60000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, useContentSize: true, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const contents = win.webContents, errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code, true);
  const settle = () => new Promise(resolve => setTimeout(resolve, 150));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); };
  async function load(completed, language = 'zh', progress = {}) {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', ${JSON.stringify(JSON.stringify({ version: 1, enabled: false, language }))}); localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({ version: 1, completed, current: 13, progress, settings: { muted: true } }))}); void 0;`);
    await win.loadFile(path.join(root, 'dist', 'index.html')); await settle();
  }
  const snapshot = async name => { await settle(); writeFileSync(path.join(output, `${name}.png`), (await contents.capturePage()).toPNG()); };
  try {
    const all = Array.from({ length: 45 }, (_, i) => i + 1);
    for (const viewport of [{ width: 1280, height: 900, language: 'zh' }, { width: 390, height: 844, language: 'zh' }, { width: 360, height: 640, language: 'en' }, { width: 844, height: 390, language: 'en' }]) {
      win.setContentSize(viewport.width, viewport.height);
      await load(all, viewport.language);
      const save = await js(`localStorage.getItem('wildgrid-save-v1')`);
      await click('.menu-journal');
      assert.equal(await js(`document.querySelectorAll('.chapter-card').length`), 3);
      assert.equal(await js(`document.documentElement.scrollWidth > innerWidth`), false);
      await snapshot(`chapters-${viewport.width}`);
      for (let chapter = 0; chapter < 3; chapter++) {
        await click(`[data-chapter="${chapter}"]`);
        assert.equal(await js(`document.querySelectorAll('.camp-diary .level-cover-art').length`), 15);
        assert.equal(await js(`document.querySelectorAll('.level-card.completed').length`), 15);
        assert.equal(await js(`getComputedStyle(document.querySelector('.level-grid')).gridTemplateColumns.split(' ').length`), viewport.width <= 760 ? 3 : 5);
        assert.ok(await js(`new Set(Array.from(document.querySelectorAll('.level-card')).map(el => getComputedStyle(el).backgroundColor)).size >= 3`));
        const cards = await js(`Array.from(document.querySelectorAll('.level-card')).map(el => ({text:el.textContent.trim(), width:el.clientWidth, art:el.querySelector('.level-cover-art').getBoundingClientRect().width}))`);
        assert.ok(cards.every(c => /^\d+$/.test(c.text) && c.width >= 44 && c.art >= 50));
        assert.equal(await js(`document.documentElement.scrollWidth > innerWidth`), false);
        await snapshot(`chapter-${chapter + 1}-${viewport.width}`);
        await click('.camp-diary .back-link');
      }
      assert.equal(await js(`localStorage.getItem('wildgrid-save-v1')`), save);
    }
    win.setContentSize(390, 844);
    await load([15]); await click('.menu-journal');
    assert.equal(await js(`document.querySelector('[data-chapter="2"]').disabled`), false);
    await click('[data-chapter="2"]');
    assert.equal(await js(`document.querySelector('[data-level="31"]').disabled`), false);
    assert.equal(await js(`document.querySelector('[data-level="32"]').disabled`), true);
    await snapshot('locked-390');
    await click('[data-level="32"]');
    assert.equal(await js(`!!document.querySelector('.chapter-levels')`), true);
    const solution = solutions[13], last = solution.at(-1), piece = levels[12].pieces.find(p => p.id === last.id);
    await load(all.filter(id => id !== 13), 'en', { 13: solution.slice(0, -1) });
    await click('.menu-journal'); await click('[data-chapter="0"]'); await click('[data-level="13"]');
    const selector = `.facility-card[data-facility="${piece.kind}"][data-shape="${piece.shape}"]`;
    await click(selector);
    for (let turn = 0; turn < last.rotation; turn++) await click(selector);
    await click(`[data-cell="${last.r},${last.c}"]`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(await js(`!!document.querySelector('.win-modal[open] .level-cover-art')`), true);
    await snapshot('completion-390');
    assert.deepEqual(errors, []);
    console.log('Journal artwork UI passed: 3 chapters, 45 covers, desktop/portrait/landscape, Chinese/English, unchanged saves, locked/current/completed states and shared completion artwork.');
    clearTimeout(timeout); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(timeout); app.exit(1); }
});
