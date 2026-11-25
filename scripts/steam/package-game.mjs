import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { build, Platform, Arch } from 'electron-builder';

import { root, source, work, scripts } from './paths.mjs';
const standard = process.argv.includes('--standard');
const pkg = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8'));
if (!standard) {
  writeFileSync(path.join(source, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: 'module', description: pkg.description, author: pkg.author, main: 'electron/main.cjs' }, null, 2));
}
const common = {
  directories: { app: source, buildResources: path.join(source, 'build'), output: path.join(work, standard ? 'standard-release' : 'package') },
  electronDist: path.join(root, 'node_modules/electron/dist'),
  electronVersion: JSON.parse(readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version,
  npmRebuild: false,
};

await build({
  projectDir: source,
  targets: Platform.WINDOWS.createTarget(standard ? ['nsis'] : ['dir'], Arch.x64),
  publish: 'never',
  config: standard ? { extends: path.join(source, 'electron-builder.yml'), ...common } : path.join(scripts, 'electron-builder.cjs'),
});
