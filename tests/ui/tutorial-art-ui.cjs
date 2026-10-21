const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

// Focused coverage for Art moving from inline SVG to external image files.
const root = path.resolve(__dirname, '../..'), output = path.join(root, '.desktop-smoke/tutorial-art');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => app.exit(1), 30000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const wc = win.webContents, errors = [];
  wc.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => wc.executeJavaScript(code, true);
  const wait = () => new Promise(resolve => setTimeout(resolve, 220));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await wait(); };
  try {
    for (const [width, height, language] of [[1280, 900, 'zh'], [390, 844, 'en']]) {
      win.setContentSize(width, height);
      await win.loadFile(path.join(root, 'dist/index.html'));
      await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', ${JSON.stringify(JSON.stringify({ version: 1, enabled: true, language }))})`);
      await win.loadFile(path.join(root, 'dist/index.html')); await wait();
      await click('.menu-adventure'); await click('.sandbox-choice:first-child');
      for (const step of ['welcome', 'board', 'clues', 'camp', 'wrong', 'right']) {
        assert.equal(await js(`document.querySelector('.tutorial-overlay').dataset.step`), step);
        if (step === 'wrong' || step === 'right') {
          assert.deepEqual(await js(`(() => { const svg = document.querySelector('.tutorial-example'); return { images: svg.querySelectorAll('image').length, htmlImages: svg.querySelectorAll('img').length, hrefs: [...svg.querySelectorAll('image')].every(img => img.getAttribute('href').endsWith('.svg')) }; })()`), { images: 2, htmlImages: 0, hrefs: true });
          writeFileSync(path.join(output, `${step}-${language}.png`), (await wc.capturePage()).toPNG());
        }
        await click('.tutorial-next');
      }
      assert.equal(await js(`document.querySelector('.tutorial-overlay').dataset.step`), 'select');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: bilingual tutorial wrong/right examples use SVG images and advance to selection.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(deadline); app.exit(1); }
});
