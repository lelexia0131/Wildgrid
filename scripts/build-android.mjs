import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
// Prefer an explicit JDK; otherwise use Android Studio's bundled JDK on Windows.
if (!env.JAVA_HOME && process.platform === 'win32') {
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  const candidates = [
    env.ANDROID_STUDIO_HOME && join(env.ANDROID_STUDIO_HOME, 'jbr'),
    sdk && join(dirname(sdk), 'AndroidStudio', 'jbr'),
    join(env.ProgramFiles || 'C:/Program Files', 'Android', 'Android Studio', 'jbr'),
  ];
  env.JAVA_HOME = candidates.find(path => path && existsSync(join(path, 'bin', 'java.exe')));
}
const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'cmd.exe' : './gradlew', windows ? ['/d', '/s', '/c', 'gradlew.bat assembleDebug'] : ['assembleDebug'], {
  cwd: resolve('android'), env, stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const apk = resolve('android/app/build/outputs/apk/debug/app-debug.apk');
if (!existsSync(apk) || !statSync(apk).size) throw new Error('Gradle finished without a debug APK.');
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const output = resolve(`release/野格-v${version}.apk`);
mkdirSync(dirname(output), { recursive: true });
copyFileSync(apk, output);
console.log(`APK: ${output} (${statSync(output).size} bytes)`);
