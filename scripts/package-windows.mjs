import { closeSync, existsSync, linkSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Arch, build, Platform } from 'electron-builder';
import lockfile from 'proper-lockfile';
import { installers, installerPath, needsInstaller, root } from './release-installers.mjs';

if (process.argv.length > 2) throw new Error('package:win uses a fixed output directory and accepts no output overrides.');
const output = path.join(root, 'release', 'camp-world');
const runtime = path.join(output, 'win-unpacked');
const work = path.join(output, '.packaging');
const candidate = path.join(work, 'win-unpacked');
const previous = path.join(work, 'previous');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;

function clearWork() {
  if (!existsSync(work)) return;
  if (realpathSync(work) !== work) throw new Error(`Unexpected staging path: ${work}`);
  const items = readdirSync(work, { recursive: true, withFileTypes: true });
  if (items.some(item => item.isSymbolicLink())) throw new Error('Unexpected link in packaging work directory.');
  for (const item of items.reverse()) {
    const file = path.join(item.parentPath, item.name);
    if (item.isDirectory()) rmdirSync(file);
    else unlinkSync(file);
  }
  rmdirSync(work);
}

function runNode(...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${args.join(' ')} failed (${code}).`)));
  });
}

mkdirSync(output, { recursive: true });
if (realpathSync(output) !== output) throw new Error(`Unexpected release path: ${output}`);
const unlock = await lockfile.lock(output);
let completed = false;
try {
  if (existsSync(work) && realpathSync(work) !== work) throw new Error(`Unexpected staging path: ${work}`);
  if (existsSync(previous) && lstatSync(previous).isSymbolicLink()) throw new Error('Unexpected link at the previous runtime path.');
  if (existsSync(previous) && !existsSync(runtime)) renameSync(previous, runtime);
  if (existsSync(runtime)) {
    if (lstatSync(runtime).isSymbolicLink()) throw new Error('Unexpected link at the Windows runtime path.');
    if (process.platform === 'win32') {
      for (const name of readdirSync(runtime).filter(name => /\.(exe|dll)$/i.test(name))) {
        try { closeSync(openSync(path.join(runtime, name), 'r+')); }
        catch (cause) { throw new Error(`Close the running game before updating ${runtime} (${name}).`, { cause }); }
      }
    }
  }
  clearWork();
  mkdirSync(work);
  const makeInstaller = needsInstaller('win', version);
  if (realpathSync(installers) !== installers) throw new Error(`Unexpected installer path: ${installers}`);
  const npm = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  await runNode('node_modules/electron/install.js');
  await runNode(npm, 'run', 'icons');
  await runNode(npm, 'run', 'build');
  await build({
    projectDir: root, targets: Platform.WINDOWS.createTarget([makeInstaller ? 'nsis' : 'dir'], Arch.x64),
    config: { extends: path.join(root, 'electron-builder.yml'), directories: { output: work } }, publish: 'never',
  });
  if (!statSync(path.join(candidate, '野格.exe')).size || !statSync(path.join(candidate, 'resources/app.asar')).size) {
    throw new Error('Incomplete Windows runtime.');
  }
  const destination = installerPath('win', version);
  const setup = path.join(work, path.basename(destination));
  if (makeInstaller && (!statSync(setup).size || !statSync(setup + '.blockmap').size)) throw new Error('Incomplete NSIS package.');
  if (existsSync(runtime)) renameSync(runtime, previous);
  let publishedRuntime = false;
  try {
    renameSync(candidate, runtime);
    publishedRuntime = true;
    if (makeInstaller) {
      // A sidecar alone can be left by an interrupted first publication. Publish the EXE last.
      if (existsSync(destination + '.blockmap') && !existsSync(destination)) unlinkSync(destination + '.blockmap');
      linkSync(setup + '.blockmap', destination + '.blockmap');
      try { linkSync(setup, destination); }
      catch (error) { unlinkSync(destination + '.blockmap'); throw error; }
    }
  } catch (error) {
    if (publishedRuntime) renameSync(runtime, candidate);
    if (existsSync(previous)) renameSync(previous, runtime);
    throw error;
  }
  completed = true;
  console.log(`Windows runtime: ${runtime}`);
  console.log(makeInstaller ? `Archived installer: ${destination}` : `Version ${version}: existing installer archive preserved.`);
} finally {
  try { if (!existsSync(previous) || completed) clearWork(); }
  finally { await unlock(); }
}
