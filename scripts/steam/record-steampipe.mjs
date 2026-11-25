import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { steam } from './paths.mjs';
import { json, writeJSON } from './source-record.mjs';

const [action, mode] = process.argv.slice(2);
assert.ok(['Preview', 'Upload'].includes(mode));
const ready = json(path.join(steam, 'logs/ready-to-upload.json'));
const requestFile = path.join(ready.run, 'logs', mode.toLowerCase() + '-request.json');
const resultFile = path.join(ready.run, 'logs', mode.toLowerCase() + '-result.json');
if (action === 'begin') {
  if (mode === 'Upload') {
    const preview = json(path.join(ready.run, 'logs/preview-result.json'));
    assert.equal(preview.passed, true); assert.equal(preview.manifestSha256, ready.manifestSha256);
  }
  writeJSON(requestFile, { startedAt: new Date().toISOString(), id: ready.id, manifestSha256: ready.manifestSha256 });
  writeJSON(resultFile, { passed: false, status: 'pending' });
} else if (action === 'finish') {
  const request = json(requestFile);
  assert.equal(request.id, ready.id); assert.equal(request.manifestSha256, ready.manifestSha256);
  const start = Math.floor(Date.parse(request.startedAt) / 1000) * 1000;
  const output = path.join(steam, 'output', mode.toLowerCase());
  const appLog = path.join(output, 'app_build_5595750.log');
  assert.ok(existsSync(appLog) && statSync(appLog).mtimeMs >= start, 'No fresh official app log');
  const freshLines = readFileSync(appLog, 'utf8').split(/\r?\n/).filter(line => {
    const timestamp = /^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\]/.exec(line)?.[1];
    return timestamp && Date.parse(timestamp.replace(' ', 'T')) >= start;
  }).join('\n');
  assert.doesNotMatch(freshLines, /ERROR!|Failed to|Build failed|Access Denied/i);
  const match = mode === 'Preview' ? /Successfully finished AppID 5595750 build preview\./i.exec(freshLines) : /Successfully finished AppID 5595750 build \(BuildID (\d+)\)/i.exec(freshLines);
  assert.ok(match, 'Current SteamPipe operation has no official success record');
  let mappedFiles;
  if (mode === 'Preview') {
    const file = path.join(output, '5595751_preview.manifest.txt');
    assert.ok(statSync(file).mtimeMs >= start, 'Stale Preview manifest');
    // Steam's manifest prints flags in hexadecimal (40 is the directory flag).
    const rows = [...readFileSync(file, 'utf8').matchAll(/^\s*([\d,]+)\s+\d+\s+([a-f0-9]{40})\s+([a-f0-9]+)\s+(.+)\r?$/gmi)].filter(row => (parseInt(row[3], 16) & 0x40) === 0);
    const report = json(path.join(ready.run, 'logs/content-verification.json'));
    assert.equal(rows.length, report.files, 'Official Preview file count mismatch');
    const names = new Set();
    for (const row of rows) {
      const name = row[4].trim().replaceAll('\\', '/');
      assert.ok(!names.has(name)); names.add(name);
      const expected = report.manifest.find(item => item.path === name);
      assert.ok(expected, `Unexpected depot path: ${name}`);
      assert.equal(Number(row[1].replaceAll(',', '')), expected.bytes);
      assert.equal(createHash('sha1').update(readFileSync(path.join(steam, 'content', name))).digest('hex'), row[2].toLowerCase(), `Preview SHA-1 mismatch: ${name}`);
    }
    mappedFiles = rows.length;
  }
  const result = { passed: true, mode, completedAt: new Date().toISOString(), id: ready.id, manifestSha256: ready.manifestSha256, officialLog: appLog, mappedFiles, buildId: mode === 'Upload' ? match[1] : null, branchChanged: false };
  writeJSON(resultFile, result);
  console.log(JSON.stringify(result, null, 2));
} else throw new Error('Usage: record-steampipe.mjs begin|finish Preview|Upload');
