import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import asar from '@electron/asar';

import { steam, content, root, work, logs } from './paths.mjs';
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => {
  assert.ok(!item.isSymbolicLink(), `Unexpected link: ${item.name}`);
  const full = path.join(dir, item.name);
  return item.isDirectory() ? files(full) : [full];
});
const relative = file => path.relative(content, file).replaceAll('\\', '/');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const required = ['Wildgrid.exe', 'resources/app.asar', 'chrome_100_percent.pak', 'chrome_200_percent.pak', 'd3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'ffmpeg.dll', 'icudtl.dat', 'resources.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin', 'vulkan-1.dll', 'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'locales/zh-CN.pak', 'locales/en-US.pak', 'LICENSES.chromium.html', 'LICENSE.electron.txt'];
for (const file of required) assert.ok(existsSync(path.join(content, file)) && statSync(path.join(content, file)).size > 0, `Missing runtime dependency: ${file}`);
const executable = readFileSync(path.join(content, 'Wildgrid.exe'));
assert.equal(executable.toString('ascii', 0, 2), 'MZ');
const pe = executable.readUInt32LE(0x3c);
assert.equal(executable.toString('ascii', pe, pe + 4), 'PE\0\0');
assert.equal(executable.readUInt16LE(pe + 4), 0x8664, 'Executable must be Windows x64');
const all = files(content);
const dependencies = {};
for (const file of all.filter(file => /\.(exe|dll)$/i.test(file))) {
  const data = readFileSync(file), header = data.readUInt32LE(0x3c), optional = header + 24;
  assert.equal(data.readUInt16LE(header + 4), 0x8664, `Non-x64 native binary: ${file}`);
  const sectionCount = data.readUInt16LE(header + 6), sections = optional + data.readUInt16LE(header + 20);
  const offset = rva => {
    for (let i = 0; i < sectionCount; i++) {
      const section = sections + i * 40, address = data.readUInt32LE(section + 12);
      if (rva >= address && rva < address + Math.max(data.readUInt32LE(section + 8), data.readUInt32LE(section + 16))) return rva - address + data.readUInt32LE(section + 20);
    }
    throw new Error(`Invalid PE RVA in ${file}`);
  };
  const imports = [], importRva = data.readUInt32LE(optional + 112 + 8);
  if (importRva) {
    for (let cursor = offset(importRva); data.readUInt32LE(cursor + 12); cursor += 20) {
      const nameOffset = offset(data.readUInt32LE(cursor + 12));
      const name = data.toString('ascii', nameOffset, data.indexOf(0, nameOffset));
      // API set names are contracts supplied by supported Windows 10/11 versions.
      assert.ok(/^(api|ext)-ms-win-/i.test(name) || existsSync(path.join(content, name)) || existsSync(path.join(process.env.SystemRoot, 'System32', name)), `Missing native dependency ${name} for ${file}`);
      imports.push(name);
    }
  }
  dependencies[relative(file)] = imports;
}
const allowedRoot = new Set(required.filter(f => !f.includes('/')));
for (const file of all) {
  const name = relative(file);
  assert.ok(allowedRoot.has(name) || /^locales\/[\w@-]+\.pak$/.test(name) || name === 'resources/app.asar', `Unexpected shipped file: ${name}`);
  if (name !== 'Wildgrid.exe' && name !== 'resources/app.asar' && name !== 'LICENSE.electron.txt') {
    assert.equal(hash(file), hash(path.join(root, 'node_modules/electron/dist', name)), `Electron dependency differs from installed official runtime: ${name}`);
  }
}
const archive = path.join(content, 'resources/app.asar');
const archiveFiles = asar.listPackage(archive).filter(name => !asar.statFile(archive, name.replace(/^[/\\]+/, '')).files);
for (const name of archiveFiles) {
  assert.ok(/^[/\\](dist[/\\]|electron[/\\](main|preload|steam-window)\.cjs$|build[/\\]icon\.ico$|package\.json$)/.test(name), `Unexpected app.asar entry: ${name}`);
  assert.doesNotMatch(name, /\.map$|\.tsx?$|\.env|node_modules|steamcmd|sdk[/\\]|tests[/\\]/i);
}
const audit = path.join(work, 'asar-audit');
mkdirSync(audit, { recursive: true });
asar.extractAll(archive, audit);
const pkg = JSON.parse(asar.extractFile(archive, 'package.json').toString());
assert.equal(pkg.main, 'electron/main.cjs');
assert.equal(pkg.name, 'wildgrid');
for (const field of ['scripts', 'dependencies', 'devDependencies']) assert.equal(Object.keys(pkg[field] || {}).length, 0, `Private package metadata included: ${field}`);
const main = asar.extractFile(archive, 'electron/main.cjs').toString();
const preload = asar.extractFile(archive, 'electron/preload.cjs').toString();
assert.match(main, /wildgrid:clipboard-write/);
assert.match(main, /wildgrid:clipboard-read/);
assert.match(preload, /wildgridClipboard/);
assert.deepEqual([...main.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)].map(match => match[1]), ['wildgrid:clipboard-write', 'wildgrid:clipboard-read']);
assert.deepEqual([...preload.matchAll(/exposeInMainWorld\(['"]([^'"]+)['"]/g)].map(match => match[1]), ['wildgridClipboard', 'wildgridWindow']);
const windowAdapter = asar.extractFile(archive, 'electron/steam-window.cjs').toString();
assert.deepEqual([...windowAdapter.matchAll(/handle\('([^']+)'/g)].map(match => match[1]), ['wildgrid:window-state', 'wildgrid:window-fullscreen', 'wildgrid:window-close']);
assert.match(windowAdapter, /frame: false/);
assert.match(windowAdapter, /fullscreen: saved\?\.fullscreen !== false/);
assert.match(windowAdapter, /kiosk: false/);
assert.match(main, /wildgrid:\/\/game\/index.html/);
assert.doesNotMatch(main, /node:(https?|crypto|child_process)|execFile|reg\.exe|createHash/);
const forbidden = ['179.255.156.84', '/api/player-id', 'MachineGuid', 'deviceHash', 'wildgrid-player-id', 'player-id.json', 'wildgrid:player-id-resolve', 'wildgridPlayerId', 'resolvePlayerId', 'requestPlayerId', 'getDeviceHash', 'playerIdRequest', 'PLAYER_ID_CACHE_VERSION', 'PLAYER_ID_API', 'playerIdLoading', 'playerIdStarted', 'player-id-setting', 'player-id-status', '玩家 ID', '获取中…', '暂未获取'];
const needles = forbidden.flatMap(value => [Buffer.from(value.toLowerCase(), 'utf8'), Buffer.from(value.toLowerCase(), 'utf16le')]);
function scan(file) {
  const fd = openSync(file, 'r');
  const block = Buffer.alloc(1024 * 1024);
  let tail = Buffer.alloc(0);
  try {
    for (;;) {
      const size = readSync(fd, block, 0, block.length, null);
      if (!size) break;
      const data = Buffer.concat([tail, block.subarray(0, size)]);
      // ASCII case folding retains non-ASCII bytes, including Chinese and UTF-16 tokens.
      for (let i = 0; i < data.length; i++) if (data[i] >= 65 && data[i] <= 90) data[i] += 32;
      for (const needle of needles) assert.equal(data.indexOf(needle), -1, `Forbidden ID token in ${file}: ${needle.toString('utf8')}`);
      tail = data.subarray(Math.max(0, data.length - 256));
    }
  } finally { closeSync(fd); }
}
for (const file of [...all, ...files(audit)]) scan(file);
// Stock Chromium contains "last_backup_android_id". Reject ANDROID_ID in
// application code without confusing that unmodified runtime string with our plugin.
for (const file of files(audit)) {
  const data = readFileSync(file);
  assert.doesNotMatch(data.toString('utf8'), /android_id/i);
  assert.doesNotMatch(data.toString('utf16le'), /android_id/i);
}

function vdf(filename) {
  const text = readFileSync(path.join(steam, 'vdf', filename), 'utf8');
  const tokens = text.match(/"[^"\r\n]*"|[{}]/g) || [];
  let cursor = 0;
  const atom = () => { const token = tokens[cursor++]; assert.match(token || '', /^".*"$/); return token.slice(1, -1); };
  function object() {
    assert.equal(tokens[cursor++], '{'); const out = {};
    while (tokens[cursor] !== '}') {
      const key = atom(); assert.ok(!(key in out));
      out[key] = tokens[cursor] === '{' ? object() : atom();
    }
    cursor++; return out;
  }
  const key = atom(), out = object(); assert.equal(cursor, tokens.length);
  assert.doesNotMatch(text, /SetLive|InstallScript|Local"|password|REQUIRED_/i);
  return { [key]: out };
}
for (const preview of [false, true]) {
  const app = vdf(preview ? 'app_build_5595750_preview.vdf' : 'app_build_5595750.vdf').AppBuild;
  assert.equal(app.AppID, '5595750');
  assert.equal(app.Preview, preview ? '1' : '0');
  assert.equal(path.resolve(steam, 'vdf', app.ContentRoot), path.join(steam, 'content'));
  assert.equal(path.resolve(steam, 'vdf', app.BuildOutput), path.join(steam, 'output', preview ? 'preview' : 'upload'));
  assert.deepEqual(app.Depots, { 5595751: 'depot_build_5595751.vdf' });
}
const depot = vdf('depot_build_5595751.vdf').DepotBuild;
assert.equal(depot.DepotID, '5595751');
assert.deepEqual(depot.FileMapping, { LocalPath: '*', DepotPath: '.', Recursive: '1' });
for (const name of ['steamcmd.exe', 'steamclient.dll']) assert.ok(existsSync(path.join(steam, 'sdk/tools/ContentBuilder/builder', name)), `SteamCMD bootstrap incomplete: ${name}`);

const manifest = all.map(file => ({ path: relative(file), bytes: statSync(file).size, sha256: hash(file) })).sort((a, b) => a.path.localeCompare(b.path));
const digest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const report = { passed: true, checkedAt: new Date().toISOString(), executable: 'Wildgrid.exe', architecture: 'x64', version: pkg.version, appId: '5595750', depotId: '5595751', files: manifest.length, bytes: manifest.reduce((sum, file) => sum + file.bytes, 0), asarFiles: archiveFiles.length, nativeDependencies: dependencies, forbiddenTokens: forbidden, manifestSha256: digest, manifest };
writeFileSync(path.join(logs, 'content-verification.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(logs, 'asar-files.txt'), archiveFiles.join('\n') + '\n');
if (!process.argv.includes('--candidate')) {
  const ready = JSON.parse(readFileSync(path.join(logs, 'ready-to-upload.json'), 'utf8'));
  assert.equal(ready.manifestSha256, digest, 'Content changed since successful tests; rebuild before uploading.');
  assert.equal(ready.testsPassed, true);
  const smoke = JSON.parse(readFileSync(path.join(logs, 'packaged-smoke.json'), 'utf8'));
  assert.equal(smoke.passed, true);
  assert.equal(smoke.asarSha256, hash(archive));
}
console.log(`PASS: ${manifest.length} files, ${(report.bytes / 1024 ** 2).toFixed(2)} MiB, ${archiveFiles.length} ASAR files; no original player ID code; SteamPipe 5595750 / 5595751.`);
