const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const levels = require('../src/data/levels.json');
const solutions = require('../src/data/solutions.json');

// Run after npm run build: npx electron tests/local-map-preview-ui.cjs
const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'local-map-preview');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const deadline = setTimeout(() => { console.error('Local map preview checks timed out'); app.exit(1); }, 60000);
const pack = payload => `WG1:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
const sparse = pack({ v: 1, s: 8, t: [['water', 3, 1]], f: [['camp_domino', 'camp', 3, 2, 1]], r: [0, 0, 0, 1, 1, 0, 0, 0], c: [0, 0, 2, 0, 0, 0, 0, 0] });
function levelCode(id) {
  const level = levels.find(entry => entry.id === id);
  return pack({ v: 1, s: level.size, t: level.terrain.map(t => [t.kind, t.r, t.c]), f: level.pieces.map(piece => {
    const at = solutions[id].find(at => at.id === piece.id);
    return [`${piece.kind}_${piece.shape}`, piece.id, at.r, at.c, at.rotation];
  }), r: level.rows, c: level.cols });
}
const maps = [sparse, levelCode(15), levelCode(30), levelCode(30)].map((code, index) => ({ id: index + 1, code, progress: [], ...(index === 3 ? {
  source: 'survival', survival: { challengeId: 'preview', difficulty: 10, seed: 1, completed: true, blueprintUnlocked: true },
} : {}) }));
maps.push(...Array.from({ length: 20 }, (_, index) => ({ id: index + 5, code: sparse, progress: [] })));

app.whenReady().then(async () => {
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url), dist = path.join(root, 'dist'), file = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`), relative = path.relative(dist, file);
    if (url.hostname !== 'game' || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const contents = win.webContents, measurements = [], failures = [], errors = [];
  contents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => contents.executeJavaScript(code);
  const settle = () => new Promise(resolve => setTimeout(resolve, 80));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); };
  const load = async () => { await win.loadURL('wildgrid://game/index.html'); await settle(); };
  try {
    await load();
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', '{"version":1,"enabled":false}'); localStorage.setItem('wildgrid-local-maps-v1', ${JSON.stringify(JSON.stringify({ version: 1, maps }))}); void 0;`);
    await load();
    await click('.menu-adventure'); await click('.mode-maps');
    await js('document.fonts.ready');
    contents.debugger.attach('1.3');
    for (const viewport of [
      { width: 320, height: 480 }, { width: 320, height: 568 }, { width: 360, height: 640, safe: 24 }, { width: 390, height: 844 }, { width: 412, height: 915 },
      { width: 540, height: 720 }, { width: 600, height: 960 }, { width: 768, height: 1024 },
      { width: 568, height: 320 }, { width: 667, height: 375 }, { width: 844, height: 390 }, { width: 1280, height: 665 }, { width: 1280, height: 900 },
    ]) {
      const { width, height } = viewport;
      win.setContentSize(width, height);
      await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 1000 });
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: width < 1000 });
      await js(`document.querySelector('.app').style.setProperty('--safe-area-inset-top', '${viewport.safe || 0}px'); document.querySelector('.app').style.setProperty('--safe-area-inset-bottom', '${viewport.safe || 0}px'); void 0;`);
      await settle();
      for (let map = 1; map <= 4; map++) {
        await click(`.local-map-card:nth-child(${map})`);
        const state = await js(`(() => {
          const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          const preview = document.querySelector('.local-map-preview'), board = rect(preview), tiles = [...preview.querySelectorAll('.tile')].map(rect);
          const page = document.querySelector('.local-maps-page'), detail = document.querySelector('.local-map-detail');
          return { board, tiles, size: Number(preview.style.getPropertyValue('--size')), view: rect(document.querySelector('.local-map-view')), items: rect(document.querySelector('.local-map-items')), actions: rect(document.querySelector('.local-map-actions')),
            overflowX: document.documentElement.scrollWidth > innerWidth, page: { height: page.clientHeight, content: page.scrollHeight }, detail: { height: detail.clientHeight, content: detail.scrollHeight } };
        })()`);
        measurements.push({ viewport, map, ...state });
        try {
          assert.equal(state.overflowX, false);
          assert.ok(state.board.width >= 140 && Math.abs(state.board.width - state.board.height) < 1, 'Preview must remain a readable square');
          assert.equal(state.tiles.length, state.size ** 2);
          assert.ok(state.tiles.every(tile => tile.width >= 14 && Math.abs(tile.width - tile.height) < 1 && tile.left >= state.board.left && tile.right <= state.board.right && tile.top >= state.board.top && tile.bottom <= state.board.bottom), 'Tiles must stay square and inside the preview');
          assert.ok(state.board.left >= 0 && state.board.right <= width, 'Preview must fit the screen width');
          assert.ok(state.board.top >= state.view.top && state.board.bottom <= state.view.bottom + 1, 'Preview must fit its layout region');
          assert.ok(state.board.right <= state.items.left || state.board.bottom <= state.items.top, 'Facilities must not overlap the preview');
          assert.ok(state.actions.top >= state.board.bottom && state.actions.top >= state.items.bottom, 'Actions must follow the content');
          if (width >= 1000) {
            assert.ok(state.page.content <= state.page.height + 1 && state.detail.content <= state.detail.height + 1, 'Desktop details must fit without scrolling');
            assert.ok(state.actions.bottom <= height);
          }
        } catch (error) { failures.push({ viewport, map, message: error.message, board: state.board }); }
        await js(`document.querySelector('.local-map-preview').scrollIntoView({ block: 'center' }); void 0;`); await settle();
        assert.ok(await js(`(() => { const r = document.querySelector('.local-map-preview').getBoundingClientRect(); return r.top >= ${48 + (viewport.safe || 0)} && r.bottom <= ${height - (viewport.safe || 0)}; })()`), 'The complete preview must be visible after scrolling');
        if (map === 3) {
          writeFileSync(path.join(output, `${width}x${height}.png`), (await contents.capturePage()).toPNG());
        }
        await js(`document.querySelector('.local-map-actions').scrollIntoView({ block: 'end' }); void 0;`); await settle();
        assert.ok(await js(`(() => { const r = document.querySelector('.local-map-actions').getBoundingClientRect(); return r.top >= ${48 + (viewport.safe || 0)} && r.bottom <= ${height - (viewport.safe || 0)}; })()`), 'All map actions must remain reachable after scrolling');
      }
      await js(`document.querySelector('.local-map-list').scrollTop = 99999; void 0;`);
      assert.ok(await js(`document.querySelector('.local-map-list').scrollTop > 0`), 'The map list must remain scrollable');
      await js(`document.querySelector('.local-map-list').scrollTop = 0; void 0;`);
    }
    writeFileSync(path.join(output, 'results.json'), JSON.stringify({ measurements, failures }, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    assert.equal(await js(`localStorage.getItem('wildgrid-local-maps-v1')`), JSON.stringify({ version: 1, maps }));
    console.log(`Local map previews PASS: ${measurements.length} checks across ${measurements.length / 4} viewports, including safe areas, 6×6/8×8 maps and survival collections.`);
    clearTimeout(deadline); app.exit(0);
  } catch (error) { console.error(error.stack || String(error)); clearTimeout(deadline); app.exit(1); }
}).catch(error => { console.error(error.stack || String(error)); clearTimeout(deadline); app.exit(1); });
