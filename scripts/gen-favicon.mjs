// Generates all BullionDesk favicon assets from an inline SVG using sharp.
// Run: node scripts/gen-favicon.mjs
import sharp from "sharp";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, "../public");

// ── SVG source ────────────────────────────────────────────────────────────────
// "BD" bold, gold #D4A843, on transparent background.
// We use a square viewBox so it scales cleanly at every size.
// font-family falls back through system fonts available in libvips/fontconfig.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="#FFFFFF"/>
  <text
    x="50" y="73"
    text-anchor="middle"
    font-family="'Inter','Helvetica Neue',Arial,sans-serif"
    font-weight="800"
    font-size="62"
    fill="#D4A843"
  >BD</text>
</svg>`;

const svgBuf = Buffer.from(svg);

// ── Helper: render SVG → RGBA PNG at a given square size ─────────────────────
async function toPng(size) {
  return sharp(svgBuf, { density: Math.ceil((size / 100) * 96) })
    .resize(size, size)
    .flatten({ background: "#FFFFFF" })
    .png()
    .toBuffer();
}

// ── Generate all sizes ────────────────────────────────────────────────────────
console.log("Generating favicon assets…");

const [png16, png32, png180, png512] = await Promise.all([
  toPng(16),
  toPng(32),
  toPng(180),
  toPng(512),
]);

// ── Write PNGs ────────────────────────────────────────────────────────────────
writeFileSync(`${PUBLIC}/apple-touch-icon.png`, png180);
console.log("✓ public/apple-touch-icon.png  (180×180)");

writeFileSync(`${PUBLIC}/icon-512.png`, png512);
console.log("✓ public/icon-512.png          (512×512)");

writeFileSync(`${PUBLIC}/icon-32.png`, png32);
console.log("✓ public/icon-32.png           (32×32)");

// ── Build ICO (16×16 + 32×32 PNG entries) ────────────────────────────────────
// Modern ICO format: header + directory + raw PNG blobs.
// https://en.wikipedia.org/wiki/ICO_(file_format)
function buildIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;

  let offset = headerSize + dirSize;
  const entries = images.map(({ size, buf }) => {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0);   // width  (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1);   // height
    entry.writeUInt8(0, 2);                           // colour count
    entry.writeUInt8(0, 3);                           // reserved
    entry.writeUInt16LE(1, 4);                        // planes
    entry.writeUInt16LE(32, 6);                       // bit count
    entry.writeUInt32LE(buf.length, 8);               // image size
    entry.writeUInt32LE(offset, 12);                  // offset
    offset += buf.length;
    return { entry, buf };
  });

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: ICO
  header.writeUInt16LE(count, 4); // image count

  return Buffer.concat([
    header,
    ...entries.map((e) => e.entry),
    ...entries.map((e) => e.buf),
  ]);
}

const ico = buildIco([
  { size: 16, buf: png16 },
  { size: 32, buf: png32 },
]);

writeFileSync(`${PUBLIC}/favicon.ico`, ico);
console.log("✓ public/favicon.ico           (16×16 + 32×32)");

// Also drop a copy in app/ so Next.js App Router picks it up automatically
import { mkdirSync } from "fs";
const APP = resolve(__dirname, "../app");
writeFileSync(`${APP}/favicon.ico`, ico);
console.log("✓ app/favicon.ico              (16×16 + 32×32)");

console.log("\nDone. All favicon assets written.");
