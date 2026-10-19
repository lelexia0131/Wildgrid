const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.desktop-smoke', 'hero-current');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
const deadline = setTimeout(() => { console.error('River current check timed out.'); app.exit(1); }, 30000);
const svgData = file => `data:image/svg+xml;base64,${readFileSync(path.join(root, file)).toString('base64')}`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const contents = win.webContents;
  try {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    const result = await contents.executeJavaScript(`(async () => {
      const hero = document.querySelector('.hero-art');
      const current = hero.querySelector('.hero-current');
      const stage = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      stage.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      stage.setAttribute('fill', 'none');
      stage.setAttribute('width', '800'); stage.setAttribute('height', '620');
      stage.append(...[...hero.children].filter(child => child.tagName === 'defs').map(child => child.cloneNode(true)));
      const line = current.cloneNode(true); stage.append(line);
      stage.querySelectorAll('image').forEach(image => image.setAttribute('href', ${JSON.stringify(svgData('src/assets/objects/camp.svg'))}));
      const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 620;
      const ctx = canvas.getContext('2d');
      const base = new Image(); base.src = ${JSON.stringify(svgData('src/assets/illustrations/hero-island.svg'))}; await base.decode();
      ctx.drawImage(base, 0, 0);
      const background = ctx.getImageData(0, 0, 800, 620).data;
      let checked = 0, outside = 0;
      const examples = [], frames = [];
      // Sample a complete dash cycle, checking rendered pixels against the visible water.
      for (let frame = 0; frame < 24; frame++) {
        line.setAttribute('stroke-dashoffset', String(-47 * frame / 24));
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(stage));
        await image.decode(); ctx.clearRect(0, 0, 800, 620); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, 800, 620).data;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 250) continue;
          checked++;
          const [r, g, b] = background.slice(i, i + 3);
          if (!(g > r + 15 && b > r + 10 && g - b < 26)) {
            outside++;
            if (examples.length < 5) examples.push({frame, x: i / 4 % 800, y: Math.floor(i / 4 / 800), color: [r, g, b]});
          }
        }
        if (frame % 6 === 0) {
          ctx.clearRect(0, 0, 800, 620); ctx.drawImage(base, 0, 0); ctx.drawImage(image, 0, 0);
          frames.push(canvas.toDataURL());
        }
      }
      const animation = current.getAnimations()[0];
      const animated = animation?.effect.getKeyframes().map(frame => frame.strokeDashoffset);
      return {checked, outside, examples, frames, animated};
    })()`);
    result.frames.forEach((png, index) => writeFileSync(path.join(output, `river-${index}.png`), Buffer.from(png.split(',')[1], 'base64')));
    assert.ok(result.checked > 3000, 'the current must remain visibly present throughout the cycle');
    assert.equal(result.outside, 0, `current pixels must stay on visible water: ${JSON.stringify(result.examples)}`);
    assert.ok(result.animated?.length >= 2 && new Set(result.animated).size > 1, 'the current must keep flowing');
    console.log(`River current PASS: ${result.checked} rendered pixels across 24 animation phases stay on visible water, clear of tents and land.`);
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
