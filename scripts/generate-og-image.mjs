import { existsSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';

const input = resolve('public/og-image.svg');
const output = resolve('public/og-image.png');

if (!existsSync(input)) {
  console.warn('og-image: public/og-image.svg not found, skipping PNG generation');
  process.exit(0);
}

await sharp(input, { density: 144 })
  .resize(1200, 630, { fit: 'cover' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

console.log('og-image.png written from og-image.svg');
