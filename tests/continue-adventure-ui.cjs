const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdirSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const levels = require('../src/game-data/levels.json');
const solutions = require('../src/game-data/solutions.json');

const root = path.resolve(__dirname, '..');
mkdirSync(path.join(root, '.desktop-smoke', 'continue-adventure'), { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(root, '.desktop-smoke', 'continue-adventure', `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const deadline = setTimeout(() => { console.error('Continue Adventure UI check timed out'); app.exit(1); }, 90000);

// A valid legacy challenge, independent of random map generation.
const level = levels.find(level => level.id === 6), placements = solutions[6];
const code = `WG1:${Buffer.from(JSON.stringify({ v: 1, s: 8,
  t: level.terrain.map(t => [t.kind, t.r, t.c]),
  f: level.pieces.map(piece => { const at = placements.find(at => at.id === piece.id); return [`${piece.kind}_${piece.shape}`, piece.id, at.r, at.c, at.rotation]; }),
  r: [...level.rows, 0, 0].slice(0, 8), c: [...level.cols, 0, 0].slice(0, 8),
})).toString('base64url')}`;
const challenge = { id: 'legacy-active', difficulty: 1, seed: 6, code, fingerprint: 'legacy-active', startedAt: 100 };
const empty = { version: 1, completed: [], records: [], recent: [], challenge: null, progress: null };
const active = { ...empty, challenge, progress: { id: challenge.id, status: 'active', placements: placements.slice(0, 1), past: [[]], future: [placements.slice(0, 2)], rotations: { single: 1 }, selectedId: null } };
const completed = { ...empty, completed: [{ id: challenge.id, difficulty: 1, seed: 6, at: 200 }] };
const diary = { version: 1, completed: [1, 2, 3, 4, 5], current: 2, progress: { 6: placements.slice(0, 1) }, settings: { muted: true } };

app.whenReady().then(async () => {
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url), file = path.resolve(root, 'dist', `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(path.join(root, 'dist'), file);
    if (url.hostname !== 'game' || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const js = code => win.webContents.executeJavaScript(code);
  const wait = () => new Promise(resolve => setTimeout(resolve, 70));
  const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  async function click(selector) { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await wait(); }
  async function load() { await win.loadURL('wildgrid://game/index.html'); await wait(); }
  async function prepare(survival, adventure) {
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1', '{"version":1,"enabled":false}');
      ${survival ? `localStorage.setItem('wildgrid-survival-v1', ${JSON.stringify(JSON.stringify(survival))});` : ''}
      ${adventure ? `localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify(adventure))});` : ''} void 0;`);
    await load();
  }
  async function modes() {
    await click('.menu-adventure');
    assert.equal(await js(`document.querySelectorAll('.sandbox-choice').length`), 4, 'home still opens mode selection');
  }
  async function resume() {
    await modes();
    await js(`window.__continueWorkerCount = 0; window.Worker = class extends window.Worker { constructor(...args) { super(...args); window.__continueWorkerCount++; } }; void 0;`);
    await click('.mode-adventure');
    assert.equal(await js('window.__continueWorkerCount'), 0, 'Continue Adventure must never generate a new challenge');
    assert.equal(await js(`!!document.querySelector('.survival-generation-page')`), false);
  }
  async function waitGame() {
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      assert.equal(await js(`!!document.querySelector('.survival-page,.journal-page')`), false, 'no intermediate selection page');
      if (await js(`!!document.querySelector('.game-page .board')`)) return;
      await wait();
    }
    throw new Error(await js(`document.querySelector('[role="alert"]')?.textContent || 'No game board'`));
  }
  const stored = () => js(`JSON.parse(localStorage.getItem('wildgrid-survival-v1'))`);
  const title = () => js(`document.querySelector('.game-title h1').textContent`);
  try {
    await load(); await prepare(); await resume(); await waitGame();
    assert.equal(await title(), 'day 1');
    await click('.game-title button');
    assert.equal(await js(`!!document.querySelector('.game-page')`), false);

    // Merely browsing survival, even across a restart, must still continue the diary.
    await prepare(); await modes(); await click('.survival-entry');
    assert.equal(await js(`localStorage.getItem('wildgrid-survival-v1')`), null);
    await load(); await resume(); await waitGame(); assert.equal(await title(), 'day 1');

    await prepare(undefined, diary); await resume(); await waitGame();
    assert.equal(await title(), 'day 6');
    assert.deepEqual(await js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).progress[6]`), diary.progress[6]);
    await load(); await resume(); await waitGame(); assert.equal(await title(), 'day 6');
    await prepare(undefined, { ...diary, current: 5, progress: {} }); await resume(); await waitGame(); assert.equal(await title(), 'day 6');
    const last = levels[levels.length - 1].id;
    await prepare(undefined, { ...diary, completed: levels.map(level => level.id), current: last, progress: {} });
    await resume(); await waitGame(); assert.equal(await title(), `day ${last}`);

    await prepare(active, diary); await resume(); await waitGame();
    assert.match(await title(), /荒野求生/);
    const resumed = await stored();
    assert.deepEqual(resumed.challenge, challenge); assert.deepEqual(resumed.progress, active.progress);
    await click('.game-title button');
    assert.equal(await js(`!!document.querySelector('.survival-page')`), true, 'survival back navigation is unchanged');
    await load(); await resume(); await waitGame(); assert.deepEqual((await stored()).progress, active.progress);
    await click('.tool-undo');
    assert.deepEqual((await stored()).progress.placements, []);

    // The ordinary survival entry still generates a board through the original difficulty buttons.
    await prepare(); await modes(); await click('.survival-entry'); await click('.survival-difficulty'); await waitGame();
    assert.match(await title(), /荒野求生/);

    const final = placements.find(at => level.pieces.find(piece => piece.id === at.id).shape === 'single');
    const piece = level.pieces.find(piece => piece.id === final.id);
    await prepare({ ...active, progress: { ...active.progress, placements: placements.filter(at => at.id !== final.id), past: [], future: [], rotations: {} } });
    await resume(); await waitGame();
    await click(`.facility-card[data-facility="${piece.kind}"][data-shape="single"]`);
    await click(`.board > .tile:nth-child(${final.r * 8 + final.c + 1})`);
    assert.equal((await stored()).challenge, null);
    const ledger = (await stored()).completed;
    assert.equal(ledger.length, 1);
    await load(); await resume(); await waitGame();
    assert.equal(await title(), 'day 1');
    assert.equal((await stored()).challenge, null);
    assert.deepEqual((await stored()).completed, ledger, 'continuing after a real completion does not settle twice');

    // History alone must never start survival; continue the latest unfinished diary level instead.
    const abandoned = { ...empty, records: [{ id: 'abandoned', difficulty: 1, seed: 7, startedAt: 300, placements: [] }] };
    const stale = { ...completed, challenge, progress: { ...active.progress, placements } };
    for (const history of [completed, abandoned, { ...empty, recent: ['legacy-abandoned'] }, stale]) {
      await prepare(history, diary);
      const before = await js(`localStorage.getItem('wildgrid-survival-v1')`);
      await resume(); await waitGame();
      assert.equal(await title(), 'day 6');
      assert.equal(await js(`localStorage.getItem('wildgrid-survival-v1')`), before, 'diary continuation must leave survival history untouched');
      await load(); await resume(); await waitGame();
      assert.equal(await title(), 'day 6');
      assert.equal(await js(`localStorage.getItem('wildgrid-survival-v1')`), before);
    }
    assert.deepEqual(errors, []);
    console.log('Continue Adventure UI passed: no automatic generation, active challenge restore, completed/abandoned/legacy history falls back to latest diary level, restart, all-clear and original survival entry.');
    clearTimeout(deadline); win.destroy(); app.quit();
  } catch (error) { console.error(error); clearTimeout(deadline); app.exit(1); }
});
