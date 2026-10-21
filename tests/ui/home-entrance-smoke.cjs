const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

// Run after npm run build: npx electron tests/ui/home-entrance-smoke.cjs
const root = path.resolve(__dirname, '../..');
app.disableHardwareAcceleration();
const userData = path.join(root, '.desktop-smoke', `home-entrance-${process.pid}`);
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
const deadline = setTimeout(() => app.exit(1), 30000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false } });
  const contents = win.webContents;
  const js = code => contents.executeJavaScript(code);
  const media = value => contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
  try {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    contents.debugger.attach('1.3');
    console.log('Checking initial render and animation phases.');
    await contents.debugger.sendCommand('Page.enable');
    // Observe the initial React commit before the first paint or any interaction.
    await contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
      localStorage.setItem('wildgrid-tutorial-v1', JSON.stringify({ version: 1, enabled: false, language: localStorage.getItem('entrance-language') || 'zh' }));
      const observer = new MutationObserver(() => {
        const elements = ['.camp-title', '.hero-art', '.menu-buttons', '.header-actions'].map(selector => document.querySelector(selector));
        if (elements.some(element => !element)) return;
        observer.disconnect();
        window.entranceElements = elements;
        window.initialOpacities = elements.map(element => Number(getComputedStyle(element).opacity));
        window.entranceAnimations = elements.map(element => element.getAnimations().find(animation => animation.animationName.startsWith('home-')));
        for (const animation of window.entranceAnimations) if (animation) { animation.pause(); animation.currentTime = 0; }
      });
      observer.observe(document, { childList: true, subtree: true });
    ` });
    for (const language of ['zh', 'en']) {
      await media('no-preference');
      await win.loadFile(path.join(root, 'dist', 'index.html'));
      await js(`localStorage.setItem('entrance-language', '${language}')`);
      await win.loadFile(path.join(root, 'dist', 'index.html'));
      await js(`new Promise(resolve => requestAnimationFrame(resolve))`);
      assert.equal(await js(`document.querySelector('.camp-title').getAttribute('aria-label')`), language === 'zh' ? '野格' : 'WILDGRID');
      assert.deepEqual(await js('window.initialOpacities'), [0, 0, 0, 0], `${language}: no first-frame flash`);
      const frames = await js(`(() => {
        return [0, 225, 450, 825, 1200, 1425, 1650].map(time => {
          for (const animation of window.entranceAnimations) animation.currentTime = time;
          return window.entranceElements.map(element => Number(getComputedStyle(element).opacity));
        });
      })()`);
      assert.deepEqual(frames[0], [0, 0, 0, 0]);
      assert.ok(frames[1][0] > 0 && frames[1][0] < 1);
      assert.deepEqual(frames[1].slice(1), [0, 0, 0]);
      assert.deepEqual(frames[2], [1, 0, 0, 0], 'island stays hidden until title finishes');
      assert.equal(frames[3][0], 1);
      assert.ok(frames[3][1] > 0 && frames[3][1] < 1);
      assert.deepEqual(frames[3].slice(2), [0, 0]);
      assert.deepEqual(frames[4], [1, 1, 0, 0], 'buttons stay hidden until the whole island finishes');
      assert.deepEqual(frames[5].slice(0, 2), [1, 1]);
      assert.ok(frames[5][2] > 0 && frames[5][2] < 1);
      assert.deepEqual(frames[6], [1, 1, 1, 1]);
      assert.equal(await js(`window.entranceAnimations[1].effect.target === document.querySelector('.hero-art')`), true);
      // Re-render the title via its real image-error fallback; animation identity must survive.
      await js(`document.querySelector('.title-lettering').dispatchEvent(new Event('error')); new Promise(resolve => requestAnimationFrame(resolve))`);
      assert.equal(await js(`document.querySelector('.camp-title').getAnimations()[0] === window.entranceAnimations[0]`), true);
      await js(`new Promise(resolve => setTimeout(resolve, 1750))`);
      assert.equal(await js(`document.querySelector('.app').classList.contains('home-entering')`), false);
      await js(`document.querySelector('[data-tutorial="settings"]').click(); new Promise(resolve => requestAnimationFrame(resolve))`);
      await js(`document.querySelector('.tutorial-language select').value = '${language === 'zh' ? 'en' : 'zh'}'; document.querySelector('.tutorial-language select').dispatchEvent(new Event('change', { bubbles: true })); new Promise(resolve => requestAnimationFrame(resolve))`);
      assert.equal(await js(`window.entranceElements.flatMap(element => element.getAnimations()).some(animation => animation.animationName.startsWith('home-'))`), false);
      await js(`document.querySelector('.modal-close').click(); new Promise(resolve => requestAnimationFrame(resolve))`);
      await js(`document.querySelector('.menu-adventure').click(); new Promise(resolve => requestAnimationFrame(resolve))`);
      await js(`document.querySelector('.sandbox-back').click(); new Promise(resolve => requestAnimationFrame(resolve))`);
      assert.equal(await js(`!!document.querySelector('.hero-art') && !document.querySelector('.home-entering')`), true, 'returning home does not replay');
    }
    await media('reduce');
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    assert.deepEqual(await js('window.initialOpacities'), [1, 1, 1, 1]);
    assert.equal(await js('document.getAnimations().length'), 0);
    await media('no-preference');
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await media('reduce');
    await js(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.deepEqual(await js('window.entranceElements.map(element => Number(getComputedStyle(element).opacity))'), [1, 1, 1, 1]);
    assert.equal(await js('document.getAnimations().length'), 0);
    console.log('PASS: bilingual first paint, strict title/island/button sequence, whole-island animation, rerenders, return navigation and reduced motion.');
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
