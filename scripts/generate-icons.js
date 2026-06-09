const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'icon_converted.png');
const BUILD_DIR = path.join(__dirname, '..', 'build', 'icons');
const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

async function generate() {
  await fs.ensureDir(BUILD_DIR);

  // Get source image metadata
  const metadata = await sharp(SOURCE).metadata();
  const sourceSize = Math.min(metadata.width, metadata.height);
  console.log(`Source icon: ${metadata.width}x${metadata.height}`);

  for (const size of SIZES) {
    // For sizes larger than source, use nearest-neighbor to avoid blur
    const resizeOptions = size > sourceSize
      ? { width: size, height: size, fit: 'fill', kernel: 'nearest' }
      : { width: size, height: size };

    await sharp(SOURCE)
      .resize(resizeOptions)
      .ensureAlpha() // Ensure RGBA format
      .png({ compressionLevel: 9 })
      .toFile(path.join(BUILD_DIR, `${size}x${size}.png`));

    console.log(`Generated ${size}x${size}.png`);
  }

  // Copy main icon for electron-builder
  await fs.copy(
    path.join(BUILD_DIR, '256x256.png'),
    path.join(BUILD_DIR, 'icon.png')
  );

  console.log('Icons generated in build/icons/');
}

generate().catch(console.error);
