import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
mkdirSync('build', { recursive: true });
function writeIcon(file, data) {
  if (!existsSync(file) || !readFileSync(file).equals(data)) writeFileSync(file, data);
}
writeIcon('build/icon.png', await sharp(svg).resize(512, 512).png().toBuffer());
writeIcon('public/icon-192.png', await sharp(svg).resize(192, 192).png().toBuffer());
writeIcon('public/icon-512.png', await sharp(svg).resize(512, 512).png().toBuffer());
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(size => sharp(svg).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, i) => {
  const at = 6 + i * 16, size = sizes[i];
  header[at] = size === 256 ? 0 : size; header[at + 1] = header[at];
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
writeIcon('build/icon.ico', Buffer.concat([header, ...images]));
console.log('Created warm camping icon: PNG and ICO (16–256px).');
