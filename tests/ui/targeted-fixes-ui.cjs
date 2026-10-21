const { app, BrowserWindow, net, protocol } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, readFileSync, writeFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
require('tsx/cjs');
const { createElement: h } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Art, FacilityArt, FootprintSurface } = require('../../src/ui/components/Art.tsx');
const { facilityLibrary, offsets, getLevelById, getSolution, encodeMap, withEditorPlacements, solveLevel } = require('../../src/engine/index.ts');

const root = path.resolve(__dirname, '../..'), output = path.join(root, '.desktop-smoke/targeted-fixes');
mkdirSync(output, { recursive: true });
app.disableHardwareAcceleration();
app.setPath('userData', path.join(output, `profile-${process.pid}`));
protocol.registerSchemesAsPrivileged([{ scheme: 'wildgrid', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const deadline = setTimeout(() => { console.error('Targeted UI checks timed out'); app.exit(1); }, 90000);
const placements = getSolution(6), draft = withEditorPlacements({ level: { ...getLevelById(6), size: 8 }, placements }, placements);
const old = { version: 1, completed: [], records: [], recent: [], challenge: { id: 'old', difficulty: 1, seed: 1, code: encodeMap(draft), fingerprint: 'old' }, progress: { id: 'old', status: 'active', placements: [], past: [], future: [], rotations: {}, selectedId: null } };

app.whenReady().then(async () => {
  protocol.handle('wildgrid', request => {
    const url = new URL(request.url), dist = path.join(root, 'dist'), file = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`), relative = path.relative(dist, file);
    if (url.hostname !== 'game' || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  const wc = win.webContents, errors = [];
  wc.on('console-message', event => { if (event.level === 'error' && !event.message.includes('ERR_')) errors.push(event.message); });
  const js = code => wc.executeJavaScript(code, true);
  const settle = () => new Promise(resolve => setTimeout(resolve, 80));
  const click = async selector => { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle(); };
  const load = async () => { await win.loadURL('wildgrid://game/index.html'); await settle(); };
  const stored = () => js(`localStorage.getItem('wildgrid-survival-v1')`);
  const installWorkers = () => js(`window.__workers=[]; window.Worker=class {
    constructor() { window.__workers.push(this); }
    postMessage(request) { this.request=request; }
    terminate() { this.terminated=true; }
    reply(data) { this.onmessage?.({data}); }
  }; Object.defineProperty(document,'hidden',{configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange')); void 0;`);
  async function prepare() {
    await load();
    await js(`localStorage.clear(); localStorage.setItem('wildgrid-tutorial-v1','{"version":1,"enabled":false}'); localStorage.setItem('wildgrid-survival-v1',${JSON.stringify(JSON.stringify(old))}); localStorage.setItem('wildgrid-local-maps-v1',${JSON.stringify(JSON.stringify({ version: 1, maps: [{ id: 1, code: encodeMap(draft), progress: [] }] }))});`);
    await load(); await installWorkers(); await click('.menu-adventure');
  }
  async function generate() { await click('.survival-difficulty'); await click('.sandbox-modal-actions .primary'); }
  try {
    await prepare(); await click('.mode-maps');
    wc.debugger.attach('1.3');
    await wc.debugger.sendCommand('DOM.enable'); await wc.debugger.sendCommand('CSS.enable');
    const styles = () => js(`Array.from(document.querySelectorAll('.local-map-actions button')).map(el=>{const s=getComputedStyle(el);return {background:s.background,border:s.borderColor,width:s.borderWidth,shadow:s.boxShadow,radius:s.borderRadius};})`);
    const normal = await styles();
    assert.equal(normal[0].border, 'rgb(41, 78, 62)'); assert.equal(normal[1].border, 'rgb(169, 185, 155)');
    assert.equal(normal[2].border, 'rgb(133, 71, 61)'); assert.equal(normal[3].border, 'rgb(120, 97, 136)');
    assert.ok(normal.every(s => s.width === '2px' && s.radius === '14px'));
    for (const [index, color] of [[2, 'rgb(118, 62, 53)'], [3, 'rgb(110, 86, 126)']]) {
      assert.ok(normal[index].shadow.includes(color));
      const { root: dom } = await wc.debugger.sendCommand('DOM.getDocument');
      const { nodeId } = await wc.debugger.sendCommand('DOM.querySelector', { nodeId: dom.nodeId, selector: `.local-map-actions button:nth-child(${index + 1})` });
      for (const pseudo of ['hover', 'active', 'focus-visible']) {
        await wc.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [pseudo] });
        await new Promise(resolve => setTimeout(resolve, 220));
        const state = await styles(); assert.equal(state[index].border, normal[index].border); assert.ok(state[index].shadow.includes(color));
      }
      await wc.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
    await settle(); writeFileSync(path.join(output, 'map-buttons.png'), (await wc.capturePage()).toPNG());
    await click('.local-map-edit');
    const beforeMap = await js(`localStorage.getItem('wildgrid-local-maps-v1')`);
    const board = await js(`document.querySelector('.board').innerHTML`);
    await click('.sandbox-save');
    assert.equal(await js(`document.querySelector('.sandbox-save').disabled`), false);
    assert.equal(await js(`document.querySelector('.sandbox-save').getAttribute('aria-label')`), '取消');
    await click('.sandbox-save');
    await js(`window.__workers[0].reply({status:'unique',message:'late'});`); await settle();
    assert.equal(await js(`window.__workers[0].terminated`), true);
    assert.equal(await js(`localStorage.getItem('wildgrid-local-maps-v1')`), beforeMap);
    assert.equal(await js(`document.querySelector('.board').innerHTML`), board);
    await click('.sandbox-export'); await click('.sandbox-export');
    await js(`window.__workers.at(-1).reply({status:'unique',message:'late export'});`); await settle();
    assert.equal(await js(`!!document.querySelector('.map-code')`), false);
    await click('.sandbox-save'); await js(`window.__workers.at(-1).reply({status:'unique',message:'ok'});`); await settle();
    assert.equal(await js(`document.querySelector('.sandbox-save').getAttribute('aria-label')`), '保存');
    assert.ok(await js(`document.querySelector('.guide-strip').textContent.includes('已保存')`));
    // A failed replacement leaves the exact old save intact; success commits before entering play.
    await prepare(); await click('.mode-survival'); const original = await stored(); await generate();
    await js(`window.__workers[0].reply({status:'search-failed',error:'normal'});`); await settle();
    assert.equal(await js(`window.__workers.length`), 1); assert.equal(await stored(), original);
    assert.equal(await js(`!!document.querySelector('.survival-generation-page')`), false);
    assert.equal(await js(`window.__workers[0].terminated`), true);
    await generate();
    await js(`Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));`); await settle();
    assert.equal(await js(`window.__workers[1].terminated`), true);
    await js(`Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));`); await settle();
    assert.equal(await js(`window.__workers.length`), 3);
    await click('.survival-generation-page button');
    await js(`window.__workers.at(-1).reply({status:'search-failed',error:'late'});`); await settle();
    assert.equal(await stored(), original); assert.equal(await js(`window.__workers.length`), 3);
    await generate(); await js(`window.__workers.at(-1).reply({status:'error',error:'bug'});`); await settle();
    assert.equal(await stored(), original); assert.equal(await js(`!!document.querySelector('.survival-generation-page')`), false);
    await generate();
    await js(`window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='wildgrid-survival-v1')throw Error('quota');return window.__storageSet.call(this,key,value);};window.__workers.at(-1).reply({status:'success',challenge:{...window.__workers.at(-1).request,draft:${JSON.stringify(draft)},fingerprint:'new'}});`); await settle();
    assert.equal(await stored(), original); assert.equal(await js(`!!document.querySelector('.survival-game')`), false);
    await js(`Storage.prototype.setItem=window.__storageSet;void 0`); await generate();
    await js(`window.__workers.at(-1).reply({status:'success',challenge:{...window.__workers.at(-1).request,draft:${JSON.stringify(draft)},fingerprint:'new'}});`); await settle();
    assert.equal(await js(`!!document.querySelector('.survival-game')`), true);
    assert.notEqual(JSON.parse(await stored()).challenge.id, 'old');
    assert.equal(JSON.parse(await stored()).records[0].id, 'old');
    // Incompatible tutorial storage is protected on mount and on preference updates.
    for (const raw of ['{"version":2}', '{broken']) {
      await js(`localStorage.setItem('wildgrid-tutorial-v1',${JSON.stringify(raw)})`); await load();
      await click('.header-actions button:last-child');
      assert.equal(await js(`localStorage.getItem('wildgrid-tutorial-v1')`), raw);
      assert.ok(await js(`document.querySelector('.tutorial-settings [role="status"]').textContent.includes('暂未保存')`));
      await click('.tutorial-setting-action'); assert.equal(await js(`localStorage.getItem('wildgrid-tutorial-v1')`), raw);
    }
    // Exercise the bundled worker protocol as well as the task mocks above.
    const workerAsset = readdirSync(path.join(root, 'dist/assets')).find(file => file.startsWith('survival.worker-'));
    const realWorker = (difficulty, forceSearchFailure = false) => {
      const source = `import 'wildgrid://game/assets/${workerAsset}';${forceSearchFailure ? 'const now=Date.now();let calls=0;Date.now=()=>now+(calls++ ? 30000 : 0);' : ''}self.postMessage({ready:true});`;
      return js(`new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([${JSON.stringify(source)}],{type:'text/javascript'})),worker=new Worker(url,{type:'module'});worker.onmessage=event=>{if(event.data.ready){worker.postMessage({difficulty:${difficulty},seed:20261019,id:'real-worker',recent:[]});return;}worker.terminate();URL.revokeObjectURL(url);resolve(event.data);};worker.onerror=()=>{worker.terminate();URL.revokeObjectURL(url);reject(Error('Real worker failed'));};})`);
    };
    assert.equal((await realWorker(0)).status, 'error');
    assert.equal((await realWorker(1, true)).status, 'search-failed');
    const generated = await realWorker(10);
    assert.equal(generated.status, 'success'); assert.ok(generated.challenge.draft.level.pieces.length >= 18 && generated.challenge.draft.level.pieces.length <= 20);
    const proof = solveLevel(generated.challenge.draft.level, 2);
    assert.equal(proof.aborted, false); assert.equal(proof.count, 1);
    // Render every actual facility/shape and rotation with the production CSS and SVGs.
    const cases = facilityLibrary.flatMap(piece => Array.from({ length: piece.shape === 'single' ? 1 : 4 }, (_, rotation) => {
      const cells = offsets(piece.shape, rotation), width = (Math.max(...cells.map(p => p.c)) + 1) * 48, height = (Math.max(...cells.map(p => p.r)) + 1) * 48;
      const first = cells.filter(p => p.r === 0).sort((a, b) => a.c - b.c)[0];
      const surface = h('div', { className: piece.shape === 'single' ? `tile placed placed-${piece.kind} pending` : 'placed-facility-art incomplete', style: { width, height, position: 'relative' } }, piece.shape === 'single' ? h(Art, { kind: piece.kind }) : [h(FootprintSurface, { key: 'surface', shape: piece.shape, rotation }), h(FacilityArt, { key: 'art', ...piece, rotation })]);
      return h('section', { key: `${piece.kind}-${piece.shape}-${rotation}`, 'data-sample': first.c * 48 + 24 }, h('small', null, `${piece.kind} ${piece.shape} ${rotation}`), surface);
    }));
    const css = readdirSync(path.join(root, 'dist/assets')).find(file => file.endsWith('.css'));
    const gallery = path.join(output, 'facility-gallery.html');
    writeFileSync(gallery, `<link rel="stylesheet" href="${pathToFileURL(path.join(root, 'dist/assets', css))}"><style>html,body{overflow:auto;height:auto}.gallery{display:grid;grid-template-columns:repeat(6,160px);gap:16px;padding:16px;background:#d5dfb4}section{padding:8px;background:#d5dfb4}small{display:block;font:12px sans-serif;height:20px}</style><div class="gallery">${renderToStaticMarkup(h('div', { style: { display: 'contents' } }, cases))}</div>`);
    for (const android of [false, true]) {
      win.setContentSize(1280, 1800);
      await win.loadFile(gallery); await js(`if(${android})document.body.setAttribute('data-android','')`); await settle();
      const samples = await js(`Array.from(document.querySelectorAll('section')).map(el=>{const surface=el.lastElementChild,r=surface.getBoundingClientRect();return {name:el.firstElementChild.textContent,x:Math.floor(r.x+Number(el.dataset.sample)),y:Math.floor(r.y),svg:!!surface.querySelector('.footprint-outline')};})`);
      const capture = await wc.capturePage(), sharp = require('sharp'), pixels = await sharp(capture.toPNG()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const sample of samples) {
        const color = dy => Array.from(pixels.data.subarray(((sample.y + dy) * pixels.info.width + sample.x) * 3, ((sample.y + dy) * pixels.info.width + sample.x) * 3 + 3));
        assert.deepEqual(color(0), [197, 173, 101], sample.name); assert.deepEqual(color(1), [197, 173, 101], sample.name);
        assert.notDeepEqual(color(2), [197, 173, 101], sample.name);
      }
      writeFileSync(path.join(output, `facility-borders-${android ? 'android' : 'web'}.png`), capture.toPNG());
    }
    assert.deepEqual(errors, []);
    writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, facilityCases: cases.length, buttons: normal }, null, 2));
    console.log(`PASS: sandbox cancellation/restart, survival bounded failure/manual retry/pause/cancel/atomic replacement, tutorial protection, button states, ${cases.length} facility borders at 2 visible pixels.`);
    clearTimeout(deadline); app.exit(0);
  } catch (error) {
    writeFileSync(path.join(output, 'failure.png'), (await wc.capturePage()).toPNG());
    console.error(error); clearTimeout(deadline); app.exit(1);
  }
});
