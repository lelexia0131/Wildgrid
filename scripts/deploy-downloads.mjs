import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { installerPath } from './release-installers.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const host = process.env.WILDGRID_SSH_HOST || 'DMIT-root-179.255.156.84';
const sshOptions = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];
const remoteScript = await readFile(new URL('./deploy-downloads.py', import.meta.url), 'utf8');

function run(command, args, { input, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root, windowsHide: true,
      stdio: [input ? 'pipe' : 'ignore', capture ? 'pipe' : 'inherit', 'inherit'],
    });
    let output = '';
    child.stdout?.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`${command} exited with ${code}`)));
    if (input) {
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
  });
}

async function releaseFile(script, platform, version) {
  const file = installerPath(platform, version);
  if (!existsSync(file)) {
    if (process.platform === 'win32') await run('cmd.exe', ['/d', '/s', '/c', `npm run ${script}`]);
    else await run('npm', ['run', script]);
  }
  const info = await stat(file);
  if (!info.isFile() || !info.size) throw new Error(`Invalid archived installer: ${file}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return { path: file, size: info.size, hash: hash.digest('hex') };
}

async function checkLegacy(base) {
  const url = `${base}/FiveRealms`;
  const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
  if (response.status !== 200) throw new Error(`${url}: HTTP ${response.status}`);
  console.log(`FiveRealms HTTP 200: ${url}`);
}

async function checkDownload(base, name, file, type) {
  const url = `${base}/${name}`;
  console.log(`Downloading to verify SHA-256: ${url}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(600000), headers: { 'Cache-Control': 'no-cache' } });
  if (response.status !== 200) throw new Error(`${url}: HTTP ${response.status}`);
  if (response.headers.get('content-type') !== type
    || response.headers.get('content-disposition') !== `attachment; filename="${name}"`) {
    await response.body.cancel();
    throw new Error(`${url}: incorrect download headers`);
  }
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of response.body) { hash.update(chunk); size += chunk.length; }
  if (size !== file.size || hash.digest('hex') !== file.hash) throw new Error(`${url}: downloaded content differs from local build`);
  console.log(`Verified HTTP 200, ${size} bytes, SHA-256 ${file.hash}: ${url}`);
}

async function main() {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.@:-]*$/.test(host)) throw new Error('Invalid WILDGRID_SSH_HOST');
  const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const exe = await releaseFile('package:win', 'win', version);
  const apk = await releaseFile('android:apk', 'android', version);
  console.log(`EXE: ${exe.path} (${exe.size} bytes)`);
  console.log(`APK: ${apk.path} (${apk.size} bytes; existing Android build/signing configuration)`);
  const settings = await run('ssh', [...sshOptions, '-G', host], { capture: true });
  const hostname = settings.match(/^hostname (.+)$/m)?.[1].trim();
  if (!hostname) throw new Error('SSH configuration has no HostName');
  const base = `http://${hostname.includes(':') ? `[${hostname}]` : hostname}:8080`;
  await checkLegacy(base);
  const token = randomUUID();
  const remote = (action, ...args) => run('ssh', [...sshOptions, host, 'python3', '-', action, token, ...args], { input: remoteScript });
  await remote('prepare');
  try {
    for (const [name, file] of [['Wildgrid.exe', exe], ['Wildgrid.apk', apk]]) {
      console.log(`Uploading ${name} to a temporary file...`);
      await run('scp', [...sshOptions, file.path, `${host}:/var/www/Wildgrid/.${name}.${token}.upload`]);
    }
    await remote('publish', exe.hash, apk.hash);
  } finally {
    await remote('cleanup');
  }
  await checkDownload(base, 'Wildgrid.exe', exe, 'application/octet-stream');
  await checkDownload(base, 'Wildgrid.apk', apk, 'application/vnd.android.package-archive');
  await checkLegacy(base);
  console.log('Download deployment and verification completed.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
