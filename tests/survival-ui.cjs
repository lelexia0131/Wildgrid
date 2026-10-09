const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..'), output = path.join(root, '.desktop-smoke', 'survival');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const deadline = setTimeout(() => { console.error('Survival UI check timed out'); app.exit(1); }, 90000);

app.whenReady().then(async () => {
  const dist = path.join(root, 'dist');
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url), file = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    const relative = path.relative(dist, file);
    if (url.hostname !== 'game' || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({ width: 390, height: 844, show: false, webPreferences: { contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  const js = code => win.webContents.executeJavaScript(code);
  const settle = () => new Promise(resolve => setTimeout(resolve, 70));
  async function click(selector) { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); }
  async function text(value) { await js(`(() => { const el = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(value)}); if (!el) throw new Error('Missing button'); el.click(); })()`); await settle(); }
  async function load() { await win.loadURL('wildgrid://game/index.html'); await settle(); }
  async function modes() { await click('.menu-buttons .primary'); }
  async function menu() { await modes(); await click('.survival-entry'); }
  async function waitGame() {
    const until = Date.now() + 27000;
    while (Date.now() < until) { if (await js(`!!document.querySelector('.survival-game')`)) return; await settle(); }
    throw new Error(await js(`document.querySelector('.survival-error')?.textContent || 'Generation failed'`));
  }
  async function waitFor(expression) {
    const until = Date.now() + 8000;
    while (Date.now() < until) { if (await js(expression)) return; await settle(); }
    throw new Error('Timed out: ' + expression);
  }
  const stored = () => js(`JSON.parse(localStorage.getItem('wildgrid-survival-v1'))`);
  async function screenshot(name) { writeFileSync(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG()); }
  const boardSize = () => js(`document.querySelector('.board-section').getBoundingClientRect().width`);
  async function assertGameFits(desktop = false) {
    const state = await js(`(() => {
      const buttons = [...document.querySelectorAll('.facility-card,.operations button')];
      const list = document.querySelector('.facility-list').getBoundingClientRect();
      const app = document.querySelector('.app');
      const scrollbars = [...app.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect(), css = getComputedStyle(el);
        return r.width && r.height && css.display !== 'none' && css.scrollbarWidth !== 'none' && ((['auto','scroll'].includes(css.overflowY) && el.scrollHeight > el.clientHeight + 1) || (['auto','scroll'].includes(css.overflowX) && el.scrollWidth > el.clientWidth + 1));
      }).map(el => el.className);
      return { overflow: document.documentElement.scrollWidth > innerWidth,
        toolsOverflow: document.querySelector('.operations').scrollWidth > document.querySelector('.operations').clientWidth + 1,
        clipped: buttons.filter(el => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2).map(el => el.textContent),
        hiddenCards: [...document.querySelectorAll('.facility-card')].filter(el => { const r = el.getBoundingClientRect(); return r.bottom > list.bottom + 1; }).map(el => el.textContent),
        scrollbars,
        rows: [...document.querySelectorAll('.survival-tool-row')].map(row => [...row.querySelectorAll('button')].map(el => el.textContent)) };
    })()`);
    assert.equal(state.overflow, false); assert.equal(state.toolsOverflow, false);
    assert.deepEqual(state.clipped, []);
    if (desktop) assert.deepEqual(state.scrollbars, []);
    assert.deepEqual(state.rows, [['旋转', '撤销'], ['重新游玩', '保存', '放弃']]);
  }
  const fonts = () => js(`['.facility-info strong','.operations .wide-operation','.rule-dock','.guide-strip p'].map(selector => getComputedStyle(document.querySelector(selector)).fontSize)`);
  const names = { camp: '营地', fire: '篝火', tower: '瞭望塔', picnic: '野餐桌', cabin: '林间木屋' };
  async function place(at, piece) {
    const selector = `.facility-card[aria-label^="选择单格${names[piece.kind]}"]`;
    if (!await js(`document.querySelector(${JSON.stringify(selector)}).classList.contains('active')`)) await click(selector);
    await click(`.board > .tile:nth-child(${at.r * 8 + at.c + 1})`);
  }
  try {
    if (process.env.WILDGRID_REPLAY_ONLY) {
      const fixture = JSON.parse(readFileSync(path.join(output, 'fixtures.json'), 'utf8'))[0];
      const save = { version: 1, completed: [{ id: fixture.id, difficulty: 1, seed: fixture.seed, at: Date.now() }], recent: [], challenge: { id: fixture.id, difficulty: 1, seed: fixture.seed, code: fixture.code, fingerprint: fixture.fingerprint }, progress: { id: fixture.id, status: 'active', placements: fixture.draft.placements.slice(0, 1), past: [[]], future: [], rotations: {}, selectedId: null } };
      await load(); await js(`localStorage.setItem('wildgrid-survival-v1', ${JSON.stringify(JSON.stringify(save))})`);
      await load(); await menu(); await text('继续挑战 · 1难');
      assert.equal((await stored()).progress.placements.length, 1);
      assert.equal(await js(`!!document.querySelector('.blueprint-button')`), false);
      await text('重新游玩'); await load(); await menu(); await text('继续挑战 · 1难');
      assert.equal((await stored()).progress.placements.length, 0);
      for (const at of fixture.draft.placements) await place(at, fixture.draft.level.pieces.find(piece => piece.id === at.id));
      assert.equal(await js(`document.querySelector('.survival-reward').textContent.includes('本次不重复奖励')`), true);
      assert.equal((await stored()).completed.length, 1); assert.equal((await stored()).challenge, null);
      console.log('Completed-map replay: resume, restart, unlocked blueprint and zero repeat reward passed.');
      clearTimeout(deadline); app.exit(0); return;
    }
    if (!process.env.WILDGRID_LAYOUT_ONLY) {
    await load(); await menu();
    assert.equal(await js(`document.querySelectorAll('.survival-difficulty').length`), 10);
    assert.equal(await js(`document.querySelectorAll('.survival-page').length`), 1);
    await screenshot('difficulty-mobile');
    await click('.survival-difficulty'); await waitGame();
    const original = await stored(), payload = JSON.parse(Buffer.from(original.challenge.code.slice(4), 'base64url').toString('utf8'));
    const placements = payload.f.map(f => ({ id: f[1], r: f[2], c: f[3], rotation: f[4] }));
    const pieces = payload.f.map(f => ({ id: f[1], kind: f[0].split('_')[0] }));
    await assertGameFits(); await screenshot('game-mobile');
    const width = await boardSize();
    await text('保存');
    const collection = await js(`JSON.parse(localStorage.getItem('wildgrid-local-maps-v1')).maps[0]`);
    assert.equal(collection.code, original.challenge.code); assert.deepEqual(collection.progress, []);
    assert.equal(await js(`!!document.querySelector('.blueprint-button')`), false);
    await place(placements[0], pieces[0]); await text('撤销');
    assert.equal((await stored()).progress.placements.length, 0);
    await place(placements[0], pieces[0]);
    assert.equal((await stored()).progress.placements.length, 1);
    assert.equal(await boardSize(), width);
    await load(); await menu(); await text('继续挑战 · 1难');
    assert.equal((await stored()).progress.placements.length, 1);
    assert.equal(await js(`document.querySelector('.operations button:has(svg)').disabled`), true);
    await load(); await modes(); await text('本地地图');
    assert.equal(await js(`document.querySelector('.local-map-edit').disabled`), true);
    assert.equal(await js(`document.querySelector('.local-map-preview').querySelectorAll('.placed').length`), 0);
    await screenshot('locked-collection-mobile');
    const beforeLocal = await stored();
    await text('进入地图');
    assert.equal(await js(`!!document.querySelector('.survival-game')`), false);
    assert.equal(await js(`document.querySelector('.operations').textContent.includes('放弃')`), false);
    assert.equal(await js(`document.querySelector('.game-title button').getAttribute('aria-label')`), '返回本地地图');
    assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), true);
    assert.equal(await js(`document.querySelectorAll('.board > .tile.placed').length`), 0);
    await place(placements[0], pieces[0]); await text('保存');
    await waitFor(`JSON.parse(localStorage.getItem('wildgrid-local-maps-v1')).maps[0].progress.length === 1`);
    assert.deepEqual(await stored(), beforeLocal, 'local progress must not overwrite the active challenge');
    await text('重新游玩');
    assert.deepEqual(await stored(), beforeLocal, 'local restart must not restart the active challenge');
    for (let i = 0; i < placements.length; i++) await place(placements[i], pieces[i]);
    assert.equal(await js(`!!document.querySelector('.survival-win')`), false);
    assert.deepEqual(await stored(), beforeLocal, 'solving a local map must not award survival XP');
    await text('返回本地地图');
    assert.equal(await js(`document.querySelector('.sandbox-menu-page h1').textContent`), '本地地图');
    await load(); await menu(); await text('继续挑战 · 1难'); await text('重新游玩');
    for (let i = 0; i < placements.length; i++) await place(placements[i], pieces[i]);
    assert.equal(await js(`!!document.querySelector('.survival-win')`), true);
    assert.equal((await stored()).completed.length, 1); assert.equal((await stored()).challenge, null);
    await screenshot('win-mobile');
    await text('返回难度选择');
    assert.equal(await js(`document.querySelector('.survival-identity').textContent.includes('累计经验 1')`), true);
    await load(); await modes(); await text('本地地图');
    assert.equal(await js(`!!document.querySelector('.local-map-edit')`), true);
    await text('进入地图'); await text('图纸');
    assert.equal(await js(`!!document.querySelector('.blueprint-content')`), true);
    await click('.modal-close'); await text('重新游玩');
    assert.equal((await stored()).challenge, null, 'local restart must not reactivate a completed challenge');
    await load(); await menu(); await click('.survival-difficulty:nth-child(2)'); await waitGame();
    const unfinished = (await stored()).challenge.id;
    await text('保存');
    await click('.game-title .icon-button'); await click('.survival-difficulty:nth-child(3)');
    assert.equal(await js(`document.querySelector('dialog').textContent.includes('保留旧挑战')`), true);
    await text('保留旧挑战'); assert.equal((await stored()).challenge.id, unfinished);
    await text('继续挑战 · 2难'); await text('放弃'); await text('确定放弃');
    assert.equal((await stored()).challenge, null); assert.equal((await stored()).completed.length, 1);
    assert.equal(await js(`JSON.parse(localStorage.getItem('wildgrid-local-maps-v1')).maps.length`), 2);
    assert.equal(await js(`[...document.querySelectorAll('button')].some(el => el.textContent.includes('继续挑战 ·'))`), false);
    await click('.survival-heading .back-link'); await text('本地地图'); await click('.local-map-card:nth-child(2)');
    assert.equal(await js(`document.querySelector('.local-map-edit').disabled`), false);
    const abandoned = await stored();
    await text('进入地图'); await text('图纸');
    assert.equal(await js(`!!document.querySelector('.blueprint-content')`), true);
    await screenshot('abandoned-local-blueprint');
    await click('.modal-close'); await text('重新游玩'); await click('.game-title .icon-button');
    assert.equal(await js(`document.querySelector('.sandbox-menu-page h1').textContent`), '本地地图');
    assert.deepEqual(await stored(), abandoned, 'opening and restarting an abandoned map must not restore its challenge');
    await click('.local-map-card:nth-child(2)'); await text('编辑地图');
    assert.equal(await js(`document.querySelector('.game-title button').getAttribute('aria-label')`), '返回本地地图');
    await click('.game-title .icon-button');
    assert.equal(await js(`document.querySelector('.sandbox-menu-page h1').textContent`), '本地地图');
    await load(); await menu(); await click('.survival-difficulty:nth-child(3)'); await waitGame();
    const otherChallenge = await stored();
    await load(); await modes(); await text('本地地图'); await click('.local-map-card:nth-child(2)'); await text('进入地图');
    assert.equal(await js(`document.querySelector('dialog').open`), false, 'local maps must not ask to replace another challenge');
    assert.equal(await js(`!!document.querySelector('.survival-game')`), false);
    assert.deepEqual(await stored(), otherChallenge);
    await click('.game-title .icon-button'); await click('.sandbox-back'); await click('.survival-entry');
    await text('继续挑战 · 3难'); await text('保存'); await click('.game-title .icon-button');
    await click('.survival-difficulty'); await text('开始新挑战'); await waitGame();
    const replacement = await stored();
    assert.notEqual(replacement.challenge.id, otherChallenge.challenge.id);
    await click('.game-title .icon-button'); await click('.survival-heading .back-link'); await text('本地地图');
    await click('.local-map-card:nth-child(3)');
    assert.equal(await js(`document.querySelector('.local-map-edit').disabled`), false, 'replacing a challenge must refresh local edit availability immediately');
    await text('进入地图'); await text('图纸');
    assert.equal(await js(`!!document.querySelector('.blueprint-content')`), true);
    assert.deepEqual(await stored(), replacement, 'replaced challenges remain local maps and cannot take over the new challenge');
    }
    // Reuse the already verified high-tier fixture to inspect crowded layouts.
    const fixture = JSON.parse(readFileSync(path.join(output, 'fixtures.json'), 'utf8'))[9];
    const active = { version: 1, completed: [], recent: [], challenge: { id: fixture.id, difficulty: 10, seed: fixture.seed, code: fixture.code, fingerprint: fixture.fingerprint }, progress: { id: fixture.id, status: 'active', placements: [], past: [], future: [], rotations: {}, selectedId: null } };
    await load();
    await js(`localStorage.setItem('wildgrid-survival-v1', ${JSON.stringify(JSON.stringify(active))})`);
    win.webContents.debugger.attach('1.3');
    for (const [w, h, name, mobile] of [[1280, 900, 'hard-desktop', false], [1024, 600, 'hard-small-desktop', false], [844, 390, 'hard-short-desktop', false], [390, 844, 'hard-mobile', true]]) {
      win.setContentSize(w, h);
      await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
      await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: mobile });
      await load();
      await js(`localStorage.setItem('wildgrid-save-v1', ${JSON.stringify(JSON.stringify({version:1,current:30,completed:Array.from({length:29},(_,i)=>i+1),progress:{},settings:{}}))})`);
      await load(); await modes();
      assert.equal(await js(`new Set([...document.querySelectorAll('.sandbox-choice-copy')].map(el => Math.round(el.getBoundingClientRect().left))).size`), 1);
      await click('.sandbox-choice:first-child');
      const sharedFonts = await fonts(), sharedBoardSize = await boardSize();
      await load(); await menu();
      if (!mobile) {
        assert.equal(await js(`document.querySelector('.survival-page').scrollHeight > document.querySelector('.survival-page').clientHeight + 1`), false);
        assert.equal(await js(`[...document.querySelectorAll('.survival-difficulty,.survival-bottom button')].every(el => el.getBoundingClientRect().bottom <= innerHeight)`), true);
        await screenshot('difficulty-' + name);
        await js(`document.querySelector('.survival-bottom .secondary').click()`); await settle();
        assert.equal(await js(`document.querySelector('.survival-records').scrollHeight > document.querySelector('.survival-records').clientHeight + 1`), false);
        await click('[aria-label="关闭通关记录"]');
      }
      await text('继续挑战 · 10难');
      assert.deepEqual(await fonts(), sharedFonts);
      assert.equal(await boardSize(), sharedBoardSize);
      assert.equal(await js(`new Set([...document.querySelectorAll('.facility-card')].map(el => Math.round(el.getBoundingClientRect().left))).size`), mobile ? 2 : 1);
      assert.equal(await js(`!!document.querySelector('.blueprint-button')`), false);
      await assertGameFits(!mobile); await screenshot(name);
    }
    await text('保存');
    assert.equal(await js(`!!document.querySelector('.blueprint-button')`), false);
    const completed = { ...active, completed: [{ id: fixture.id, difficulty: 10, seed: fixture.seed, at: Date.now() }], challenge: null, progress: null };
    await js(`localStorage.setItem('wildgrid-survival-v1', ${JSON.stringify(JSON.stringify(completed))})`);
    await load(); await modes(); await text('本地地图'); await text('进入地图');
    assert.equal(await js(`document.querySelector('.blueprint-button').disabled`), false);
    await text('图纸'); assert.equal(await js(`!!document.querySelector('.blueprint-content')`), true);
    console.log(process.env.WILDGRID_LAYOUT_ONLY ? 'Survival layouts: phone portrait, landscape and desktop passed.' : 'Survival UI: isolated local play, blueprint locks, abandonment, navigation, rewards, resume and layouts passed.');
    clearTimeout(deadline); app.exit(0);
  } catch (cause) { console.error(cause); await screenshot('failure'); clearTimeout(deadline); app.exit(1); }
});
