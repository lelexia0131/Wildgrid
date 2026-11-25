import { readFileSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import asar from '@electron/asar';
import yauzl from 'yauzl';
import { root, source, work, logs } from './paths.mjs';
import { json, sha256, writeJSON } from './source-record.mjs';

const apk = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const archive = path.join(work, 'standard-release/win-unpacked/resources/app.asar');
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(dir, item.name)) : [path.join(dir, item.name)]);
const assets = files(path.join(root, 'dist')).map(file => path.relative(path.join(root, 'dist'), file).replaceAll('\\', '/'));
for (const relative of assets.filter(file => file !== 'sw.js')) {
  assert.deepEqual(readFileSync(path.join(root, 'dist', relative)), readFileSync(path.join(source, 'dist', relative)), `Android / Windows web mismatch: ${relative}`);
  assert.deepEqual(asar.extractFile(archive, path.join('dist', relative)), readFileSync(path.join(source, 'dist', relative)), `Windows ASAR mismatch: ${relative}`);
}
for (const relative of ['electron/main.cjs', 'electron/preload.cjs']) assert.deepEqual(asar.extractFile(archive, relative), readFileSync(path.join(root, relative)));
assert.match(asar.extractFile(archive, 'electron/main.cjs').toString(), /MachineGuid/);
assert.match(asar.extractFile(archive, 'electron/preload.cjs').toString(), /wildgridPlayerId/);
assert.doesNotMatch(asar.extractFile(archive, 'electron/main.cjs').toString(), /windowOptions|fullscreen:|frame: false/);
const entries = new Map();
await new Promise((resolve, reject) => {
  yauzl.open(apk, { lazyEntries: true }, (error, zip) => {
    if (error) return reject(error);
    zip.on('error', reject); zip.on('end', resolve);
    zip.on('entry', entry => {
      if (!entry.fileName.startsWith('assets/public/') && !/^classes\d*\.dex$/.test(entry.fileName)) return zip.readEntry();
      zip.openReadStream(entry, (error, stream) => {
        if (error) return reject(error);
        const parts = []; stream.on('data', data => parts.push(data)); stream.on('error', reject);
        stream.on('end', () => { entries.set(entry.fileName, Buffer.concat(parts)); zip.readEntry(); });
      });
    });
    zip.readEntry();
  });
});
for (const relative of assets) assert.deepEqual(entries.get('assets/public/' + relative), readFileSync(path.join(root, 'dist', relative)), `APK asset mismatch: ${relative}`);
const dex = Buffer.concat([...entries].filter(([name]) => name.endsWith('.dex')).map(([, data]) => data)).toString('latin1');
for (const token of ['PlayerIdPlugin', 'ClipboardPlugin', 'wildgrid-player-id-v1']) assert.ok(dex.includes(token), `Native Android capability missing: ${token}`);
assert.equal(existsSync(path.join(source, 'electron/steam-window.cjs')), false, 'Standard source must precede Steam transformation');
const nsis = path.join(work, `standard-release/Wildgrid-Setup-${json(path.join(root, 'package.json')).version}-x64.exe`);
const artifacts = [nsis, apk].map(file => ({ path: file, bytes: readFileSync(file).length, sha256: sha256(readFileSync(file)) }));
copyFileSync(apk, path.join(work, 'wildgrid-android-debug.apk'));
writeJSON(path.join(logs, 'platform-parity.json'), { passed: true, assets: assets.length, identicalWebAssetsExceptTimestampedServiceWorker: true, standardIdPreserved: true, androidNativeIdAndClipboardPresent: true, androidRealDeviceTested: false, artifacts });
console.log(`PASS: ${assets.length} APK web assets verified; ordinary Windows and Android share identical bundles; native ID retained.`);
