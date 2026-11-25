import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { source, logs } from './paths.mjs';
import { writeJSON } from './source-record.mjs';
const forbidden = /player.?id|device.?hash|MachineGuid|ANDROID_ID|179\.255\.156\.84|玩家\s*ID|获取中…|暂未获取/i;
let files = 0;
function scan(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) scan(file);
    else {
      assert.doesNotMatch(file, forbidden);
      if (/\.(tsx?|cjs|css|json)$/.test(file)) { assert.doesNotMatch(readFileSync(file, 'utf8'), forbidden, file); files++; }
    }
  }
}
scan(path.join(source, 'src')); scan(path.join(source, 'electron'));
writeJSON(path.join(logs, 'source-id-scan.json'), { passed: true, files });
console.log(`PASS: ${files} Steam source files contain no original device identity implementation.`);
