import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync, openSync, closeSync, copyFileSync, renameSync, lstatSync } from 'node:fs';
import assert from 'node:assert/strict';
import asar from '@electron/asar';
import { root, steam, scripts, insideSteam } from './paths.mjs';
import { json, sha256, writeJSON, sourceRecord } from './source-record.mjs';

const id = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z') + '-' + process.pid;
const run = insideSteam(path.join(steam, 'runs', id));
const work = path.join(run, 'work'), logs = path.join(run, 'logs');
const source = path.join(work, 'source'), candidate = path.join(work, 'package/win-unpacked');
mkdirSync(logs, { recursive: true });
mkdirSync(path.join(steam, 'logs'), { recursive: true });
const attemptFile = path.join(steam, 'logs/current-attempt.json');
const record = { id, run, startedAt: new Date().toISOString(), status: 'building', stages: [] };
const save = () => { writeJSON(path.join(logs, 'build-record.json'), record); writeJSON(attemptFile, record); };
save();
const env = { ...process.env, WILDGRID_STEAM_RUN: run, WILDGRID_STEAM_CONTENT: candidate };
delete env.ELECTRON_RUN_AS_NODE;
for (const [name, folder] of Object.entries({ ELECTRON_BUILDER_CACHE: 'electron-builder', ELECTRON_CACHE: 'electron', TEMP: 'temp', TMP: 'temp' })) {
  env[name] = path.join(steam, 'cache', folder);
  mkdirSync(env[name], { recursive: true });
}
async function stage(name, args, cwd = source) {
  const log = path.join(logs, name + '.log');
  console.log(`Running ${name} ...`);
  const fd = openSync(log, 'w');
  const start = new Date().toISOString();
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', fd, fd] });
      child.once('error', reject); child.once('exit', resolve);
    });
  } finally { closeSync(fd); }
  record.stages.push({ name, startedAt: start, endedAt: new Date().toISOString(), passed: code === 0, log });
  save();
  console.log(readFileSync(log, 'utf8').trim().split(/\r?\n/).slice(-6).join('\n'));
  assert.equal(code, 0, `${name} failed. See ${log}`);
}
const tool = (pkg, file) => path.join(root, 'node_modules', pkg, file);
const script = name => path.join(scripts, name);
const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
let previous;
let promoted = false;
try {
  await stage('stage-source', [script('prepare-source.mjs'), 'stage'], root);
  record.source = json(path.join(logs, 'source-record.json'));
  await stage('steampipe-config', [script('write-vdf.mjs')]);
  await stage('window-unit-tests', ['--test', script('tests/window.test.cjs')]);
  await stage('typecheck-standard', [tool('typescript', 'bin/tsc'), '-b']);
  await stage('build-standard', [tool('vite', 'bin/vite.js'), 'build']);
  await stage('unit-tests', [tool('tsx', 'dist/cli.mjs'), '--test', '--test-concurrency=1', 'tests/**/*.test.ts']);
  await stage('levels-check', [tool('tsx', 'dist/cli.mjs'), 'scripts/check-levels.ts']);
  await stage('package-standard', [script('package-game.mjs'), '--standard']);
  await stage('standard-native-window', [tool('electron', 'cli.js'), script('tests/window-layout.cjs'), '--standard']);
  for (const test of ['ui-smoke', 'continuous-placement-ui']) await stage('standard-' + test, [tool('electron', 'cli.js'), `tests/ui/${test}.cjs`]);
  await stage('android-apk', [npm, 'run', 'android:apk'], root);
  await stage('platform-parity', [script('verify-platforms.mjs')]);
  await stage('strip-steam-source', [script('prepare-source.mjs'), 'strip']);
  await stage('scan-steam-source', [script('scan-source.mjs')]);
  await stage('typecheck-steam', [tool('typescript', 'bin/tsc'), '-b', '--force']);
  await stage('build-steam', [tool('vite', 'bin/vite.js'), 'build']);
  await stage('steam-unit-tests', [tool('tsx', 'dist/cli.mjs'), '--test', '--test-concurrency=1', 'tests/**/*.test.ts']);
  for (const test of ['ui-smoke', 'continuous-placement-ui', 'sandbox-sky-ui']) await stage('steam-' + test, [tool('electron', 'cli.js'), `tests/ui/${test}.cjs`]);
  await stage('package-steam', [script('package-game.mjs')]);
  await stage('verify-candidate', [script('verify-content.mjs'), '--candidate']);
  env.WILDGRID_WINDOWS_OUTPUT = path.join(source, 'release');
  const desktopResources = path.join(env.WILDGRID_WINDOWS_OUTPUT, 'win-unpacked/resources');
  mkdirSync(desktopResources, { recursive: true });
  copyFileSync(path.join(candidate, 'resources/app.asar'), path.join(desktopResources, 'app.asar'));
  await stage('steam-desktop-smoke', [tool('electron', 'cli.js'), 'tests/ui/desktop-smoke.cjs']);
  await stage('steam-window-layout', [tool('electron', 'cli.js'), script('tests/window-layout.cjs')]);
  await stage('packaged-smoke', [script('smoke-packaged.mjs')]);
  assert.equal(sourceRecord().sourceSha256, record.source.sourceSha256, 'Root source changed during build; rebuild required.');
  const report = json(path.join(logs, 'content-verification.json'));
  assert.equal(report.passed, true);
  assert.equal(json(path.join(logs, 'packaged-smoke.json')).passed, true);
  const normalAsar = path.join(work, 'standard-release/win-unpacked/resources/app.asar');
  for (const name of ['electron/main.cjs', 'electron/preload.cjs']) assert.deepEqual(asar.extractFile(normalAsar, name), readFileSync(path.join(root, name)));
  const ready = { id, run, createdAt: new Date().toISOString(), appId: '5595750', depotId: '5595751', commit: record.source.commit, dirty: record.source.dirty, sourceSha256: record.source.sourceSha256, manifestSha256: report.manifestSha256, asarSha256: sha256(readFileSync(path.join(candidate, 'resources/app.asar'))), files: report.files, bytes: report.bytes, testsPassed: true, steamPipePreviewExecuted: false, uploaded: false };
  writeJSON(path.join(logs, 'ready-to-upload.json'), ready);
  await stage('final-candidate-verification', [script('verify-content.mjs')]);
  const destination = insideSteam(path.join(steam, 'content'));
  assert.ok(!lstatSync(steam).isSymbolicLink());
  if (existsSync(destination)) {
    assert.ok(!lstatSync(destination).isSymbolicLink(), 'Refusing to replace a linked content directory');
    previous = insideSteam(path.join(run, 'previous-content'));
    renameSync(destination, previous);
  }
  try { renameSync(candidate, destination); promoted = true; }
  catch (error) { if (previous) renameSync(previous, destination); previous = undefined; throw error; }
  record.status = 'passed'; record.finishedAt = new Date().toISOString(); record.artifact = ready;
  for (const name of ['content-verification.json', 'packaged-smoke.json', 'ready-to-upload.json']) copyFileSync(path.join(logs, name), path.join(steam, 'logs', name));
  save();
  console.log(`READY: ${destination}\nEvidence: ${logs}\nSource: ${ready.commit}${ready.dirty ? ' + dirty working tree' : ''}\nSource SHA-256: ${ready.sourceSha256}`);
} catch (error) {
  if (promoted && previous) {
    renameSync(path.join(steam, 'content'), candidate);
    renameSync(previous, path.join(steam, 'content'));
  }
  record.status = 'failed'; record.error = error.stack; record.finishedAt = new Date().toISOString(); save();
  console.error(error); process.exitCode = 1;
}
