#!/usr/bin/env node
/**
 * Cuts a sheet of ability icons into one round icon per ability.
 *
 *   node scripts/slice-ability-sheet.mjs [--out <dir under public>] <sheet.jpg|png> <name> [<name> …]
 *
 * The sheet is round icons on white, in a grid, read left to right and top to bottom; the kinds
 * are given in that order (the `AbilityKind`s of src/data/abilities.ts). A last row that isn't
 * full is fine: empty cells are skipped. Same idea as slice-achievement-sheet.mjs, only the
 * background is white, so "ink" is anything that isn't near-white.
 *
 * Out: public/abilities/<name>.png (or public/<dir>/ with --out — the shop's are in public/shop),
 * 128×128, transparent outside the disc.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIDE = 128;
/** Darker than this (on its lightest channel) counts as icon; the paper is near-white. */
const PAPER = 225;
/** The discs have a pale rim and a soft shadow; cutting a little inside drops both. */
const INSET = 0.035;

const isInk = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return Math.min(img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]) < PAPER;
};

/** Runs of lines (rows or columns) with any icon on them: the grid's bands. */
function bands(img, axis, within) {
  const len = axis === 'x' ? img.width : img.height;
  const [o0, o1] = within ?? [0, (axis === 'x' ? img.height : img.width) - 1];
  const lit = [];
  for (let i = 0; i < len; i += 1) {
    let n = 0;
    for (let j = o0; j <= o1; j += 2) if (axis === 'x' ? isInk(img, i, j) : isInk(img, j, i)) n += 1;
    // A few stray grey pixels of JPEG noise don't make a band.
    lit.push(n > 3);
  }
  const out = [];
  let start = -1;
  for (let i = 0; i <= len; i += 1) {
    if (i < len && lit[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (i - start > 40) out.push([start, i - 1]);
      start = -1;
    }
  }
  return out;
}

/** The icon in one box, as a transparent square with only the disc left; null if the box is empty. */
function disc(img, [x0, x1], [y0, y1]) {
  let bx0 = x1;
  let bx1 = x0;
  let by0 = y1;
  let by1 = y0;
  let count = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!isInk(img, x, y)) continue;
      count += 1;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
  if (count < 2000) return null;
  const cx = (bx0 + bx1 + 1) / 2;
  const cy = (by0 + by1 + 1) / 2;
  const r = (Math.min(bx1 - bx0 + 1, by1 - by0 + 1) / 2) * (1 - INSET);
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

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT_DIR = join(ROOT, 'public', outAt >= 0 ? args.splice(outAt, 2)[1] : 'abilities');
const [sheet, ...kinds] = args;
if (!sheet || !kinds.length) {
  console.error('usage: node scripts/slice-ability-sheet.mjs [--out <dir>] <sheet> <name> [<name> …]');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'abilities-'));
try {
  const sheetPng = join(work, 'sheet.png');
  execFileSync('sips', ['-s', 'format', 'png', sheet, '--out', sheetPng], { stdio: 'ignore' });
  const img = decodePng(readFileSync(sheetPng));
  // Rows first, then the columns inside each row: a short last row has its own columns.
  const cells = bands(img, 'y').flatMap((row) => bands(img, 'x', row).map((col) => [col, row]));
  const discs = cells.map(([col, row]) => disc(img, col, row)).filter(Boolean);
  if (discs.length !== kinds.length) {
    throw new Error(`на листе ${discs.length} иконок, а способностей передано ${kinds.length}`);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  discs.forEach((d, i) => {
    const big = join(work, 'disc.png');
    writeFileSync(big, encodePng(d));
    const file = join(OUT_DIR, `${kinds[i]}.png`);
    execFileSync('sips', ['-z', String(SIDE), String(SIDE), big, '--out', file], { stdio: 'ignore' });
    console.log('→', file.slice(ROOT.length + 1));
  });
} finally {
  rmSync(work, { recursive: true, force: true });
}
