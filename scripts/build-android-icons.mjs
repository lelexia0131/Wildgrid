import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(densities)) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  mkdirSync(dir, { recursive: true });
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(`${dir}/ic_launcher.png`, png);
  writeFileSync(`${dir}/ic_launcher_round.png`, png);
  const foregroundSize = size * 2.25, inset = Math.round(foregroundSize / 6);
  const foreground = await sharp(svg).resize(Math.round(foregroundSize) - inset * 2).extend({ top: inset, bottom: inset, left: inset, right: inset, background: '#f4f3e9' }).png().toBuffer();
  writeFileSync(`${dir}/ic_launcher_foreground.png`, foreground);
}
console.log('Android launcher icons generated from public/icon.svg (mdpi–xxxhdpi).');
