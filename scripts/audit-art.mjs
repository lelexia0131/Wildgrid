import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const images = walk('src/assets').filter(file => /\.(svg|png|webp|jpe?g)$/.test(file));
const reused = /(?:backgrounds\/(?:home-woodland(?:-portrait)?|camp-diary|wilderness-survival)\.webp|survival-badges\/)/;
const assets = [];
for (const file of images) {
  const name = file.replaceAll('\\', '/'), bytes = readFileSync(file);
  const metadata = await sharp(bytes).metadata();
  // Decode pixels too: metadata alone does not catch every broken SVG document.
  await sharp(bytes).resize({ width: 64, height: 64, fit: 'inside' }).png().toBuffer();
  if (name.endsWith('.svg')) {
    const source = bytes.toString();
    assert.ok(!/var\(|data:image|(?:href|src)="https?:/.test(source), `Nonlocal/unresolved image reference: ${name}`);
    const ids = new Set([...source.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    for (const ref of source.matchAll(/(?:url\(#|href="#)([^)"\s]+)/g)) assert.ok(ids.has(ref[1]), `Missing #${ref[1]} in ${name}`);
  }
  assets.push({ file: name, status: reused.test(name) ? 'reused' : /branding\//.test(name) ? 'redesigned' : 'external-art', bytes: statSync(file).size, width: metadata.width, height: metadata.height, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const retainedSvg = {
  'src/ui/components/Art.tsx': 'State-dependent facility footprints and roof construction',
  'src/ui/components/Blueprint.tsx': 'Current level, clues and placements',
  'src/ui/components/HeroArt.tsx': 'External image coordinate stage and animated water dash',
  'src/ui/components/TutorialOverlay.tsx': 'Dynamic spotlight and correct/incorrect placement demonstration; artwork uses external images',
};
const packagingAssets = [];
for (const file of ['public', 'build', 'android/app/src/main/res'].flatMap(walk).filter(file => /\.(svg|png|webp|jpe?g|ico)$/.test(file))) {
  const bytes = readFileSync(file);
  if (!file.endsWith('.ico')) await sharp(bytes).resize({ width: 64, height: 64, fit: 'inside' }).png().toBuffer();
  packagingAssets.push({ file: file.replaceAll('\\', '/'), status: 'preserved-platform-icon', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const sources = walk('src').filter(file => /\.(tsx|css)$/.test(file)).map(file => {
  const name = file.replaceAll('\\', '/'), source = readFileSync(file, 'utf8');
  return { file: name, inlineSvg: (source.match(/<svg\b/g) || []).length, retainedReason: retainedSvg[name], gradients: [...source.matchAll(/([^{}]+)\{([^{}]*gradient[^{}]*)\}/g)].map(m => m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim()) };
});
mkdirSync('.desktop-smoke', { recursive: true });
writeFileSync('.desktop-smoke/art-inventory.json', JSON.stringify({ assets, packagingAssets, sources }, null, 2) + '\n');
console.log(`PASS: decoded ${assets.length} game images; inspected ${packagingAssets.length} platform icons; SVG references local and resolved. Inventory: .desktop-smoke/art-inventory.json`);
