const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(saved, writeFails = false) {
  const handlers = {}, events = {}, inputs = {};
  let fullscreen = true, written;
  const window = {
    isFullScreen: () => fullscreen, setFullScreen: value => { fullscreen = value; },
    getNormalBounds: () => ({ x: 100, y: 100, width: 1080, height: 760 }),
    on: (name, fn) => { events[name] = fn; }, once() {}, close() { events.close(); },
    webContents: { on: (name, fn) => { inputs[name] = fn; }, send() {} },
  };
  const area = { x: -1920, y: 0, width: 1920, height: 1040 };
  const electron = { app: { getPath: () => 'test-profile' }, BrowserWindow: { fromWebContents: () => window },
    screen: { getPrimaryDisplay: () => ({ workArea: area }), getDisplayMatching: () => ({ workArea: area }) },
    ipcMain: { handle: (name, fn) => { handlers[name] = fn; }, removeHandler() {} } };
  const context = { module: { exports: {} }, require: name => name === 'electron' ? electron : name === 'node:fs' ? {
    readFileSync: () => { if (saved === undefined) throw new Error('ENOENT'); return saved; },
    mkdirSync() {}, renameSync() {}, writeFileSync: (_file, value) => { if (writeFails) throw new Error('read only'); written = JSON.parse(value); },
  } : require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../runtime/steam-window.cjs'), 'utf8'), context);
  return { adapter: context.module.exports, window, handlers, events, inputs, written: () => written };
}
test('fresh or corrupt preferences default to borderless fullscreen without kiosk', () => {
  for (const saved of [undefined, '{', 'null']) {
    const options = load(saved).adapter.windowOptions();
    assert.equal(options.fullscreen, true); assert.equal(options.frame, false); assert.equal(options.kiosk, false);
  }
});
test('saved windowed mode and disconnected display bounds fit a remaining monitor', () => {
  const options = load(JSON.stringify({ fullscreen: false, bounds: { x: 7000, y: 4000, width: 4000, height: 3000 } })).adapter.windowOptions();
  assert.equal(options.fullscreen, false); assert.equal(options.x, -1920); assert.equal(options.y, 0);
  assert.equal(options.width, 1920); assert.equal(options.height, 1040);
});
test('local shortcuts toggle without repeats and normal close persists display state', () => {
  const fixture = load(); fixture.adapter.windowOptions(); fixture.adapter.attachWindow(fixture.window, 'wildgrid://game/index.html');
  const press = (key, extra = {}) => fixture.inputs['before-input-event']({ preventDefault() {} }, { type: 'keyDown', key, ...extra });
  press('F11'); assert.equal(fixture.window.isFullScreen(), false);
  press('F11', { isAutoRepeat: true }); assert.equal(fixture.window.isFullScreen(), false);
  press('Enter', { alt: true }); assert.equal(fixture.window.isFullScreen(), true);
  fixture.window.close(); assert.equal(fixture.written().fullscreen, true);
});
test('window IPC validates frame and boolean input; saving failure is visible', () => {
  const fixture = load(undefined, true); fixture.adapter.windowOptions(); fixture.adapter.attachWindow(fixture.window, 'wildgrid://game/index.html');
  const frame = { url: 'wildgrid://game/index.html' }, sender = { mainFrame: frame }, event = { sender, senderFrame: frame };
  assert.throws(() => fixture.handlers['wildgrid:window-state']({ sender, senderFrame: { url: frame.url } }), /denied/);
  assert.throws(() => fixture.handlers['wildgrid:window-fullscreen'](event, 'false'), /Invalid/);
  fixture.events['enter-full-screen']();
  assert.equal(fixture.handlers['wildgrid:window-state'](event).saved, false);
});
test('closing during a native transition preserves the requested windowed preference', () => {
  const fixture = load(); fixture.adapter.windowOptions(); fixture.adapter.attachWindow(fixture.window, 'wildgrid://game/index.html');
  const frame = { url: 'wildgrid://game/index.html' }, sender = { mainFrame: frame };
  fixture.handlers['wildgrid:window-fullscreen']({ sender, senderFrame: frame }, false);
  fixture.window.isFullScreen = () => true; // Native teardown/transition may report the old state.
  fixture.window.close(); assert.equal(fixture.written().fullscreen, false);
});
