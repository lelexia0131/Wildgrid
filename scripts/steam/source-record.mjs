import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, lstatSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, source, logs } from './paths.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export const writeJSON = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
export function sourceRecord() {
  const names = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean))].sort();
  const manifest = names.filter(name => existsSync(path.join(root, name))).map(name => {
    assert.ok(lstatSync(path.join(root, name)).isFile(), `Source must be a regular file: ${name}`);
    const bytes = readFileSync(path.join(root, name));
    return { path: name, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const status = git('status', '--porcelain=v1', '--untracked-files=all');
  return { commit: git('rev-parse', 'HEAD').trim(), dirty: Boolean(status), status, capturedAt: new Date().toISOString(), sourceSha256: sha256(JSON.stringify(manifest)), manifest };
}
export function stageSource() {
  const record = sourceRecord();
  for (const item of record.manifest) {
    if (!/^(src|public|electron|build|tests|scripts)\//.test(item.path) && !['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'electron-builder.yml'].includes(item.path)) continue;
    const target = path.join(source, item.path);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(root, item.path), target);
    assert.equal(sha256(readFileSync(target)), item.sha256, `Source changed while staging: ${item.path}`);
  }
  const lock = json(path.join(source, 'package-lock.json'));
  const versions = {};
  for (const name of ['typescript', 'vite', 'electron', 'electron-builder', 'tsx', '@electron/asar', 'postcss', '@capacitor/cli', '@capacitor/android', '@capacitor/core', 'react', 'react-dom']) {
    versions[name] = json(path.join(root, 'node_modules', name, 'package.json')).version;
    assert.equal(versions[name], lock.packages[`node_modules/${name}`].version, `Run npm ci: installed ${name} differs from package-lock.json`);
  }
  writeJSON(path.join(logs, 'source-record.json'), { ...record, toolchain: { node: process.version, ...versions } });
}
export function verifySourceUnchanged() {
  assert.equal(sourceRecord().sourceSha256, json(path.join(logs, 'source-record.json')).sourceSha256, 'Root source changed during build; candidate cannot be promoted.');
}
