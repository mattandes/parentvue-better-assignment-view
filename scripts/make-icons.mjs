// Generates extension/icons/icon-{16,32,48,128}.png (a blue rounded square with a white list). Dev tool only:
// the PNGs are committed, so this only needs re-running when the artwork changes.
//   node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(fileURLToPath(new URL("..", import.meta.url)), "extension", "icons");
const BLUE = [0x25, 0x57, 0xd6];
const WHITE = [255, 255, 255];
const SUPERSAMPLE = 4;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Is the point (x, y), in 0..1 units, inside a rounded rectangle? */
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** The colour at (x, y) in 0..1 units as [r, g, b, covered], or null outside the icon. */
const shade = (x, y) => {
  if (!inRoundRect(x, y, 0.02, 0.02, 0.98, 0.98, 0.22)) return null;
  for (const top of [0.27, 0.45, 0.63]) {
    if (inRoundRect(x, y, 0.2, top, 0.31, top + 0.1, 0.05) || inRoundRect(x, y, 0.38, top, 0.8, top + 0.1, 0.05)) {
      return WHITE;
    }
  }
  return BLUE;
};

const render = (size) => {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4); // leading 0 = PNG filter "none"
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const c = shade((px + (sx + 0.5) / SUPERSAMPLE) / size, (py + (sy + 0.5) / SUPERSAMPLE) / size);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            covered++;
          }
        }
      }
      const o = 1 + px * 4;
      if (covered) {
        row[o] = Math.round(r / covered);
        row[o + 1] = Math.round(g / covered);
        row[o + 2] = Math.round(b / covered);
        row[o + 3] = Math.round((255 * covered) / (SUPERSAMPLE * SUPERSAMPLE));
      }
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), render(size));
  console.log(`wrote extension/icons/icon-${size}.png`);
}
