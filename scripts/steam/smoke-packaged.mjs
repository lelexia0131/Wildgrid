import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync, existsSync, cpSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

import { content, work, logs } from './paths.mjs';
const output = path.join(logs, 'smoke');
const profile = path.join(work, `smoke-profile-${process.pid}`);
mkdirSync(output, { recursive: true }); mkdirSync(profile, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const results = [], requests = [], errors = [];
let active, currentChild;

async function launch(directory, name, offline) {
  const log = path.join(output, `${name}-netlog.json`);
  const env = { ...process.env, PATH: `${process.env.SystemRoot};${process.env.SystemRoot}\\System32` };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS; delete env.NODE_PATH;
  const child = spawn(path.join(directory, 'Wildgrid.exe'), [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--enable-automation',
    `--log-net-log=${log}`, ...(offline ? ['--proxy-server=127.0.0.1:9', '--proxy-bypass-list=<-loopback>'] : []),
  ], { cwd: directory, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  currentChild = child;
  const exited = once(child, 'exit');
  let stderr = '', stdout = '';
  child.stderr.on('data', bytes => { stderr += bytes; }); child.stdout.on('data', bytes => { stdout += bytes; });
  const deadline = Date.now() + 30000;
  let port;
  while (Date.now() < deadline) {
    port = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(stderr)?.[1];
    if (port) break;
    if (child.exitCode !== null) throw new Error(`Game exited early: ${stderr}`);
    await delay(100);
  }
  assert.ok(port, `No debugging endpoint: ${stderr}`);
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = targets.find(item => item.type === 'page' && item.url.startsWith('wildgrid://game'));
    if (!target) await delay(100);
  }
  assert.ok(target, 'Game page did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await once(ws, 'open');
  let sequence = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return;
      pending.delete(message.id); clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error))); else entry.resolve(message.result);
    } else if (message.method === 'Network.requestWillBeSent') requests.push({ run: name, url: message.params.request.url });
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  const js = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(`${expression.slice(0, 150)}: ${JSON.stringify(result.exceptionDetails)}`);
    return result.result.value;
  };
  const until = async (expression, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await js(expression)) return; await delay(100); }
    throw new Error(`Timed out: ${expression}; page=${await js('document.body.innerText.slice(0, 1500)')}`);
  };
  const click = async selector => {
    await until(`!!document.querySelector(${JSON.stringify(selector)})`);
    await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(150);
  };
  const text = async value => {
    await js(`(() => { const el = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(value)}); if (!el) throw new Error('Missing button: ' + ${JSON.stringify(value)}); el.click(); })()`); await delay(150);
  };
  const shot = async file => writeFileSync(path.join(output, `${name}-${file}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const home = async () => { await send('Page.reload'); await until(`!!document.querySelector('.menu-adventure')`); };
  await send('Runtime.enable'); await send('Network.enable');
  if (offline) await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await until(`!!document.querySelector('.menu-adventure')`);
  assert.equal(await js(`typeof window.wildgridPlayerId`), 'undefined');
  assert.equal(await js(`typeof window.wildgridClipboard?.readText`), 'function');
  assert.equal(await js(`location.origin`), 'wildgrid://game');
  assert.ok(existsSync(path.join(profile, 'Local Storage')), 'The executable must use the isolated test profile');
  if (offline) assert.equal(await js('navigator.onLine'), false);
  active = {
    child, js, until, click, text, shot, home, send,
    async close(viaSettings = false) {
      if (viaSettings) {
        await click('.header button[data-tutorial="settings"]');
        await js(`document.querySelector('.steam-exit').click()`).catch(() => {});
      } else await send('Page.close').catch(() => {});
      const code = await Promise.race([exited, delay(15000).then(() => { throw new Error('Game failed to exit'); })]);
      ws.close();
      writeFileSync(path.join(output, `${name}-process.log`), stdout + stderr);
      assert.equal(code[0], 0, 'Game must exit cleanly');
      assert.doesNotMatch(readFileSync(log, 'utf8'), /179\.255\.156\.84|\/api\/player-id|wildgrid-player-id/i, 'No original ID requests from startup through exit');
      results.push({ run: name, executable: path.join(directory, 'Wildgrid.exe'), offline, exited: 0, networkLog: log });
      active = null;
      currentChild = null;
    },
  };
  return active;
}

async function settings(game, language) {
  await game.click('.header button[aria-label="设置"], .header button[aria-label="Settings"]');
  assert.equal(await game.js(`!!document.querySelector('[class*="player-id"]')`), false);
  assert.doesNotMatch(await game.js(`document.querySelector('dialog[open]').innerText`), /玩家\s*ID|Player\s*ID|获取中|暂未获取/i);
  await game.js(`(() => { const el = document.querySelector('.tutorial-language select'); el.value = ${JSON.stringify(language)}; el.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await game.until(`document.querySelector('.app').lang === ${JSON.stringify(language === 'zh' ? 'zh-CN' : 'en')}`);
  const before = (await game.js('window.wildgridWindow.getState()')).fullscreen;
  for (const fullscreen of [!before, before]) {
    await game.js(`(() => { const el=document.querySelector('.steam-display-settings select');el.value=${JSON.stringify(fullscreen ? 'fullscreen' : 'windowed')};el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await game.until(`window.wildgridWindow.getState().then(s => s.fullscreen === ${fullscreen})`);
  }
  await game.shot(`settings-${language}`);
  await game.click('.modal-close');
}

try {
  let game = await launch(content, 'candidate', false);
  await game.until(`!!window.wildgridWindow`);
  assert.equal((await game.js('window.wildgridWindow.getState()')).fullscreen, true, 'First launch must be fullscreen');
  assert.equal(await game.js('outerWidth === innerWidth && outerHeight === innerHeight'), true, 'No system title bar or borders');
  // CDP dispatchKeyEvent bypasses Electron before-input-event. Native shortcuts
  // have separate adapter tests and an actual keyboard acceptance record.
  assert.deepEqual(await game.js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).completed`), [], 'Smoke tests require a fresh dedicated profile');
  await game.shot('first-launch');
  // Only tutorial prompts are disabled in the isolated profile; gameplay stays real.
  await game.js(`localStorage.setItem('wildgrid-tutorial-v1', '{"version":1,"enabled":false,"language":"zh"}')`);
  await game.home();
  await settings(game, 'en'); await settings(game, 'zh');
  await game.click('.menu-adventure'); await game.click('.mode-adventure');
  await game.until(`!!document.querySelector('.board')`);
  await game.click('.facility-card'); await game.click('[data-cell="2,3"]');
  await game.until(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).completed.includes(1)`);
  await game.until(`!!document.querySelector('dialog[open] .win-content')`);
  await game.shot('adventure-completed');
  await game.text('下一关'); await game.until(`!!document.querySelector('[data-cell="1,2"]')`);
  await game.click('.facility-card'); await game.click('[data-cell="1,2"]');
  await game.until(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).progress['2']?.length === 1`);
  await game.home(); await game.click('.menu-adventure'); await game.click('.mode-sandbox');
  await game.click('.sandbox-choice'); await game.click('.sandbox-size-card');
  await game.until(`document.querySelectorAll('.board > .tile').length === 36`);
  await game.shot('sandbox-editor');
  // Import a known valid map through the public UI, then save and play it.
  await game.home(); await game.click('.menu-adventure'); await game.click('.mode-sandbox'); await game.text('导入地图');
  const code = 'WG1:' + Buffer.from(JSON.stringify({ v: 1, s: 6, t: [['water', 2, 2]], f: [['camp_single', 'camp-1', 2, 3, 0]], r: [0, 0, 1, 0, 0, 0], c: [0, 0, 0, 1, 0, 0] })).toString('base64url');
  await game.js(`(() => { const el = document.querySelector('#sandbox-map-code'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(code)}); el.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await game.click('.sandbox-import-start'); await game.until(`!!document.querySelector('.board')`);
  await game.text('保存'); await game.until(`JSON.parse(localStorage.getItem('wildgrid-local-maps-v1'))?.maps.length === 1`);
  await game.js('window.wildgridWindow.setFullscreen(false)');
  await game.until('window.wildgridWindow.getState().then(s => !s.fullscreen)');
  await game.close();
  assert.equal(JSON.parse(readFileSync(path.join(profile, 'steam-display.json'), 'utf8')).fullscreen, false, 'Windowed preference must be saved on close');

  // Copy the full distributable to a Chinese/space path with Steam's installation layout.
  const relocated = path.join(work, `中文 空格/${process.pid}/SteamLibrary/steamapps/common/Wildgrid`);
  cpSync(content, relocated, { recursive: true });
  game = await launch(relocated, 'relocated-offline', true);
  assert.equal((await game.js('window.wildgridWindow.getState()')).fullscreen, false, 'Saved windowed mode must restore');
  await game.js('window.wildgridWindow.setFullscreen(true)');
  await game.until('window.wildgridWindow.getState().then(s => s.fullscreen)');
  assert.equal(await game.js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).completed.includes(1)`), true);
  assert.equal(await game.js(`JSON.parse(localStorage.getItem('wildgrid-save-v1')).progress['2'].length`), 1);
  await game.click('.menu-adventure'); await game.click('.mode-adventure');
  await game.until(`!!document.querySelector('.board .placed')`);
  await game.shot('restored-adventure');
  await game.home(); await game.click('.menu-adventure'); await game.click('.mode-maps');
  await game.click('.local-map-enter'); await game.until(`!!document.querySelector('.board')`);
  await game.click('.facility-card'); await game.click('[data-cell="2,3"]');
  await game.until(`!!document.querySelector('dialog[open] .win-content')`);
  await game.shot('local-map-completed-offline');
  await game.home(); await game.click('.menu-adventure'); await game.click('.mode-survival');
  await game.click('.survival-difficulty');
  await game.until(`!!document.querySelector('.survival-game .board')`, 60000);
  await game.shot('survival-offline');
  const challenge = await game.js(`JSON.parse(localStorage.getItem('wildgrid-survival-v1')).challenge.id`);
  assert.ok(challenge);
  await settings(game, 'en');
  await game.close();

  game = await launch(relocated, 'restart-offline', true);
  assert.equal((await game.js('window.wildgridWindow.getState()')).fullscreen, true, 'Saved fullscreen mode must restore');
  assert.equal(await game.js(`document.querySelector('.app').lang`), 'en');
  assert.equal(await game.js(`JSON.parse(localStorage.getItem('wildgrid-survival-v1')).challenge.id`), challenge);
  await game.click('.menu-adventure'); await game.click('.mode-survival'); await game.click('.survival-continue');
  await game.until(`!!document.querySelector('.survival-game .board')`);
  await game.shot('survival-restored');
  await settings(game, 'zh');
  await game.close(true);
  assert.equal(existsSync(path.join(profile, 'player-id.json')), false);
  assert.deepEqual(requests.filter(item => /^https?:/i.test(item.url)), [], 'Gameplay must not request remote URLs');
  assert.deepEqual(errors, [], 'Renderer errors during packaged gameplay');
  const report = { passed: true, testedAt: new Date().toISOString(), asarSha256: digest(path.join(content, 'resources/app.asar')), results, checks: ['default borderless fullscreen', 'display mode selector', 'settings exit button', 'display mode persisted across restarts', 'fresh startup', 'clean exit', 'restart', 'adventure completion and partial progress', 'sandbox editor', 'map import/save/play', 'local maps after restart', 'real survival worker generation offline', 'survival challenge restored', 'Chinese and English settings', 'language persisted', 'no ID UI or preload bridge', 'no ID cache', 'no remote renderer requests', 'Chinese and space installation path', 'SteamLibrary layout (local copy, not a Steam download)', 'runtime with Node removed from PATH'], requests, rendererErrors: errors };
  writeFileSync(path.join(logs, 'packaged-smoke.json'), JSON.stringify(report, null, 2));
  console.log('PASS: packaged Wildgrid.exe startup/exit/restart, all modes, saves, languages, offline play and relocated installation.');
} catch (error) {
  if (active) {
    await active.shot('failure').catch(() => {});
    console.error(await active.js('document.body.innerText').catch(() => 'Renderer unavailable'));
  }
  currentChild?.kill();
  writeFileSync(path.join(logs, 'packaged-smoke.json'), JSON.stringify({ passed: false, error: error.stack, results, requests, errors }, null, 2));
  throw error;
}
