import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

import { steam, scripts } from './paths.mjs';
const config = JSON.parse(readFileSync(path.join(scripts, 'steam-config.json'), 'utf8').replace(/^\uFEFF/, ''));
assert.equal(config.appId, '5595750');
assert.equal(config.depotId, '5595751', 'Use the Windows Depot ID confirmed by the developer.');
const dir = path.join(steam, 'vdf');
mkdirSync(dir, { recursive: true });
for (const preview of [false, true]) {
  mkdirSync(path.join(steam, 'output', preview ? 'preview' : 'upload'), { recursive: true });
  writeFileSync(path.join(dir, preview ? 'app_build_5595750_preview.vdf' : 'app_build_5595750.vdf'), `"AppBuild"
{
  "AppID" "5595750"
  "Desc" "Wildgrid Windows x64"
  "ContentRoot" "../content"
  "BuildOutput" "../output/${preview ? 'preview' : 'upload'}"
  "Preview" "${preview ? 1 : 0}"
  "Depots"
  {
    "${config.depotId}" "depot_build_5595751.vdf"
  }
}
`);
}
writeFileSync(path.join(dir, 'depot_build_5595751.vdf'), `"DepotBuild"
{
  "DepotID" "${config.depotId}"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "Recursive" "1"
  }
}
`);
console.log(`SteamPipe VDF generated; depot: ${config.depotId}`);
