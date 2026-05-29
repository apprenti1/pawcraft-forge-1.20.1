/**
 * Generates the pawcraft-gui Minecraft resource pack into assets/pawcraft-gui/
 * Run with: node scripts/build-gui-pack.js
 *
 * Produces:
 *   - 6 panorama images (512x512, #0c0b10) for the main menu background
 *   - menu_background.png (16x16 dark tile)
 *   - pack.mcmeta + pack.png
 */

const path = require('path');
const fs   = require('fs-extra');
const zlib = require('zlib');

// ── Minimal PNG writer ────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len  = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const typ  = Buffer.from(type, 'latin1');
  const crc  = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([typ, data])));
  return Buffer.concat([len, typ, data, crc]);
}

function solidPNG(w, h, r, g, b) {
  const PNG_SIG = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;

  // Raw scanlines: filter(0) + RGB * width, repeated height times
  const row = Buffer.allocUnsafe(1 + w * 3);
  row[0] = 0;
  for (let x = 0; x < w; x++) { row[1+x*3]=r; row[2+x*3]=g; row[3+x*3]=b; }
  const raw  = Buffer.concat(Array.from({ length: h }, () => row));
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([PNG_SIG, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ── Pack contents ─────────────────────────────────────────────────────────────

const OUT = path.join(__dirname, '..', 'assets', 'pawcraft-gui');

// Dark background color: #0c0b10
const BG = [0x0c, 0x0b, 0x10];
// Accent purple: #9b7de8
const ACCENT = [0x9b, 0x7d, 0xe8];
// Slightly lighter bg for menu tiles: #13111a
const BG2 = [0x13, 0x11, 0x1a];

const PACK_MCMETA = JSON.stringify({
  pack: {
    pack_format: 15,
    description: '§5Pawcraft §7— Interface personnalisée'
  }
}, null, 2);

async function build() {
  await fs.emptyDir(OUT);

  // pack.mcmeta
  await fs.writeFile(path.join(OUT, 'pack.mcmeta'), PACK_MCMETA);

  // pack.png — 64x64 purple square as icon
  await fs.writeFile(path.join(OUT, 'pack.png'), solidPNG(64, 64, ...ACCENT));

  // Panorama — 6 images 512x512 (main menu 3D background)
  const panoramaDir = path.join(OUT, 'assets', 'minecraft', 'textures', 'gui', 'title', 'background');
  await fs.ensureDir(panoramaDir);
  const panorama = solidPNG(512, 512, ...BG);
  for (let i = 0; i < 6; i++) {
    await fs.writeFile(path.join(panoramaDir, `panorama_${i}.png`), panorama);
  }

  // menu_background — 16x16 dark tile (replaces dirt pattern in option screens)
  const miscDir = path.join(OUT, 'assets', 'minecraft', 'textures', 'misc');
  await fs.ensureDir(miscDir);
  await fs.writeFile(path.join(miscDir, 'menu_background.png'), solidPNG(16, 16, ...BG2));

  console.log(`✓ Resource pack généré dans ${OUT}`);
  console.log(`  - panorama_0..5.png (512×512, #${BG.map(b=>b.toString(16).padStart(2,'0')).join('')})`);
  console.log(`  - menu_background.png (16×16, #${BG2.map(b=>b.toString(16).padStart(2,'0')).join('')})`);
}

build().catch(err => { console.error(err); process.exit(1); });
