#!/usr/bin/env node
/**
 * Cuts the achievements sheet into one medal per achievement.
 *
 *   node scripts/slice-achievement-sheet.mjs art/achievements/sheet.png
 *
 * The sheet is round medals on black, in a grid, read left to right and top to bottom in the
 * order of `ACHIEVEMENTS` (src/data/achievements.ts). The grid is found from the black gaps
 * between the medals, not from fixed numbers, so a sheet with another count of rows or columns
 * works as long as the order holds.
 *
 * Each medal is round, so instead of a segmentation pass it gets a circle: the bright pixels in
 * its cell give the box, the box gives the circle, and everything outside it goes transparent
 * with a one-pixel soft edge. Out: public/achievements/<id>.png, 128×128.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'achievements');
const SIDE = 128;

/** In the order of `ACHIEVEMENTS`. Read from the source so the two can't drift apart. */
const IDS = [...readFileSync(join(ROOT, 'src', 'data', 'achievements.ts'), 'utf8').matchAll(/\{ id: '([a-z0-9_]+)'/g)].map(
  (m) => m[1],
);

/** Brighter than this counts as medal; the background is near-black. */
const INK = 40;

const lum = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return Math.max(img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]);
};

/** Runs of lines (rows or columns) that have any medal on them: the grid's bands. */
function bands(img, axis) {
  const len = axis === 'x' ? img.width : img.height;
  const other = axis === 'x' ? img.height : img.width;
  const lit = [];
  for (let i = 0; i < len; i += 1) {
    let any = false;
    for (let j = 0; j < other && !any; j += 2) any = (axis === 'x' ? lum(img, i, j) : lum(img, j, i)) > INK;
    lit.push(any);
  }
  const out = [];
  let start = -1;
  for (let i = 0; i <= len; i += 1) {
    if (i < len && lit[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      // A sliver isn't a band — a speck of noise between two medals.
      if (i - start > 20) out.push([start, i - 1]);
      start = -1;
    }
  }
  return out;
}

/** The medal in one cell, as a transparent square with only the disc left. */
function medal(img, [x0, x1], [y0, y1]) {
  let bx0 = x1;
  let bx1 = x0;
  let by0 = y1;
  let by1 = y0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (lum(img, x, y) > INK) {
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      }
    }
  }
  const cx = (bx0 + bx1 + 1) / 2;
  const cy = (by0 + by1 + 1) / 2;
  const r = Math.min(bx1 - bx0 + 1, by1 - by0 + 1) / 2;
  const side = Math.ceil(r * 2);
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);
  const pixels = Buffer.alloc(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const sx = left + x;
      const sy = top + y;
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const d = Math.hypot(x + 0.5 - side / 2, y + 0.5 - side / 2);
      const a = Math.max(0, Math.min(1, r - d));
      if (a <= 0) continue;
      const s = (sy * img.width + sx) * 4;
      const o = (y * side + x) * 4;
      img.pixels.copy(pixels, o, s, s + 3);
      pixels[o + 3] = Math.round(a * 255);
    }
  }
  return { width: side, height: side, pixels };
}

const sheet = process.argv[2];
if (!sheet) {
  console.error('usage: node scripts/slice-achievement-sheet.mjs <sheet.png|jpg>');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'achievements-'));
try {
  const sheetPng = join(work, 'sheet.png');
  execFileSync('sips', ['-s', 'format', 'png', sheet, '--out', sheetPng], { stdio: 'ignore' });
  const img = decodePng(readFileSync(sheetPng));
  const cols = bands(img, 'x');
  const rows = bands(img, 'y');
  const cells = rows.flatMap((row) => cols.map((col) => [col, row]));
  if (cells.length !== IDS.length) {
    throw new Error(`на листе ${cells.length} медалей (${cols.length}×${rows.length}), а достижений ${IDS.length}`);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  cells.forEach(([col, row], i) => {
    const big = join(work, 'medal.png');
    writeFileSync(big, encodePng(medal(img, col, row)));
    const file = join(OUT_DIR, `${IDS[i]}.png`);
    execFileSync('sips', ['-z', String(SIDE), String(SIDE), big, '--out', file], { stdio: 'ignore' });
    console.log('→', file.slice(ROOT.length + 1));
  });
} finally {
  rmSync(work, { recursive: true, force: true });
}
