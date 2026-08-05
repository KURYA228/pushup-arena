#!/usr/bin/env node
/**
 * Imports the generated boss artwork into public/bosses/ under the names BOSSES expects.
 *
 *   node scripts/import-boss-icons.mjs <папка-с-исходными-png>
 *
 * The generator emits one file per boss, named in Russian, with the caption ("1. Хват") baked
 * into the bottom of the image and a varying amount of black padding around the art. Cropping a
 * fixed fraction doesn't work — the caption sits anywhere between 75% and 83% of the height
 * depending on how tall the artwork is. So this reads the actual pixels: it finds the caption as
 * the bottom-most block of content separated from the art by a band of black rows, drops it, then
 * squares the crop on the artwork's true bounding box so every icon is framed alike.
 *
 * Decoding goes through `sips` (macOS built-in) converting to BMP, which is trivial to parse —
 * that keeps the project free of image dependencies.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'bosses');
const MAX_DIM = 320;
// JPEG, not PNG: the art is painted, has no transparency to preserve (BossIcon clips the circle
// in CSS), and the service worker precaches every icon — 240KB per PNG vs ~57KB per JPEG.
const JPEG_QUALITY = 85;

/** Source basename (without .png) → destination basename, in BOSSES order. */
const MAP = [
  ['Хват', '01-grunt'],
  ['Кувалда', '02-brawler'],
  ['Ярость', '03-berserker'],
  ['Страж стали', '04-steelguard'],
  ['Тень ярости', '05-wraith'],
  ['Титан', '06-titanprime'],
  ['Молот Бездны', '07-voidhammer'],
  ['Железная пасть', '08-ironmaw'],
  ['Багровый царь', '09-bloodking'],
  ['Грозоворожденный', '10-stormborn'],
  ['Крушитель мира', '11-worldbreaker'],
  ['Апекс', '12-apex'],
];

const sips = (...args) => execFileSync('/usr/bin/sips', args, { encoding: 'utf8' });

/** Minimal BMP reader: uncompressed 24/32-bit, which is all sips emits here. */
function readBmp(path) {
  const buf = readFileSync(path);
  const offset = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const rawHeight = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  if (bpp !== 24 && bpp !== 32) throw new Error(`unexpected ${bpp}bpp BMP`);

  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const bytesPerPx = bpp / 8;
  const stride = Math.ceil((width * bytesPerPx) / 4) * 4;

  return {
    width,
    height,
    /** @returns {[number, number, number]} RGB at (x, y), y counted from the top. */
    px(x, y) {
      const row = topDown ? y : height - 1 - y;
      const i = offset + row * stride + x * bytesPerPx;
      return [buf[i + 2], buf[i + 1], buf[i]];
    },
  };
}

const brightness = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const saturation = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);

/**
 * Per-row: how much of it is non-black, and how colourful that content is. The caption is
 * greyscale text, the artwork is not — saturation separates them when they nearly touch.
 */
function rowProfile(img) {
  const rows = [];
  for (let y = 0; y < img.height; y += 1) {
    let lit = 0;
    let colourful = 0;
    for (let x = 0; x < img.width; x += 1) {
      const p = img.px(x, y);
      if (brightness(p) > 34) lit += 1;
      if (saturation(p) > 26) colourful += 1;
    }
    rows.push({ lit: lit / img.width, colourful: colourful / img.width });
  }
  return rows;
}

/** Row index where the caption starts, or the image height if none was found. */
function findCaptionTop(rows, height) {
  const hasContent = (r) => r.lit > 0.004;

  let y = height - 1;
  while (y >= 0 && !hasContent(rows[y])) y -= 1; // trailing black margin
  if (y < 0) return height;
  const blockBottom = y;
  while (y >= 0 && hasContent(rows[y])) y -= 1; // the block itself
  const blockTop = y + 1;

  const blockHeight = blockBottom - blockTop + 1;
  const block = rows.slice(blockTop, blockBottom + 1);
  const colour = block.reduce((m, r) => Math.max(m, r.colourful), 0);

  // A caption is short, sits low, and is essentially greyscale. Anything else is artwork.
  const looksLikeCaption = blockHeight < height * 0.18 && blockTop > height * 0.6 && colour < 0.02;
  return looksLikeCaption ? blockTop : height;
}

/** Tight bounding box of the artwork above `limit`. */
function contentBox(img, rows, limit) {
  let top = 0;
  while (top < limit && rows[top].lit <= 0.004) top += 1;
  let bottom = limit - 1;
  while (bottom > top && rows[bottom].lit <= 0.004) bottom -= 1;

  let left = img.width;
  let right = -1;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (brightness(img.px(x, y)) > 34) {
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right < left) return { left: 0, top: 0, width: img.width, height: limit };
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('Использование: node scripts/import-boss-icons.mjs <папка-с-исходными-png>');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'boss-icons-'));

try {
  for (const [from, to] of MAP) {
    const src = join(srcDir, `${from}.png`);
    const bmp = join(tmp, `${to}.bmp`);
    try {
      sips('-s', 'format', 'bmp', src, '--out', bmp);
    } catch {
      console.error(`  ПРОПУЩЕН ${from} — не удалось прочитать ${src}`);
      continue;
    }

    const img = readBmp(bmp);
    const rows = rowProfile(img);
    const captionTop = findCaptionTop(rows, img.height);
    const box = contentBox(img, rows, captionTop);

    // Square the crop on the artwork's centre so every icon is framed identically.
    const side = Math.min(Math.max(box.width, box.height), img.width, captionTop);
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const offX = Math.round(Math.min(Math.max(cx - side / 2, 0), img.width - side));
    const offY = Math.round(Math.min(Math.max(cy - side / 2, 0), captionTop - side));

    const staged = join(tmp, `${to}.png`);
    sips('-c', String(side), String(side), '--cropOffset', String(offY), String(offX), src, '--out', staged);
    sips('-Z', String(MAX_DIM), staged);

    const dest = join(OUT, `${to}.jpg`);
    sips('-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY), staged, '--out', dest);

    const captioned = captionTop < img.height ? `подпись с ${captionTop}` : 'подписи нет';
    console.log(
      `  ${to} ← ${basename(src)}  ${img.width}x${img.height} → квадрат ${side} @ ${offX},${offY}  (${captioned})`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('Готово.');
