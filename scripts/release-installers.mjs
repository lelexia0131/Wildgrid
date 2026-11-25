import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const installers = path.join(root, 'release', 'installers');

export function installerPath(platform, version) {
  if (!semver.valid(version) || /[/\\]/.test(version)) throw new Error(`Invalid release version: ${version}`);
  return path.join(installers, platform === 'win' ? `Wildgrid-Setup-${version}-x64.exe` : `野格-v${version}.apk`);
}

export function needsInstaller(platform, version) {
  const target = installerPath(platform, version);
  mkdirSync(installers, { recursive: true });
  if (existsSync(target)) {
    const file = statSync(target);
    if (!file.isFile() || !file.size) throw new Error(`Invalid archived installer: ${target}`);
    return false;
  }
  const pattern = platform === 'win' ? /^Wildgrid-Setup-(.+)-x64\.exe$/ : /^野格-v(.+)\.apk$/;
  return !readdirSync(installers).some(name => {
    const archived = name.match(pattern)?.[1];
    return archived && semver.valid(archived) && semver.gte(archived, version);
  });
}
