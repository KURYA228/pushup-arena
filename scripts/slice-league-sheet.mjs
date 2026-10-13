#!/usr/bin/env node
/**
 * Cuts the weekly-league sheet into the icons the app expects.
 *
 *   node scripts/slice-league-sheet.mjs art/leagues/sheet.jpg
 *
 * The sheet is a 2×3 grid of panels, one per league: the league's big emblem on the left, its
 * three divisions (I, II, III) small along the bottom, and Мастер with the emblem alone. Each
 * icon is cut out of a generous box around it, lifted off the dark background with the same
 * Vision segmentation the rank badges went through (scripts/cutout.jxa.js), trimmed to what is
 * left, centred on a transparent square and scaled down.
 *
 * Out: public/leagues/<league>.png for the emblem, <league>-i.png / -ii.png / -iii.png for the
 * divisions.
 *
 * The boxes are fixed, not found: the sheet is one picture laid out once. A new sheet with a
 * different layout means new numbers below.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'leagues');
const CUTOUT = join(ROOT, 'scripts', 'cutout.jxa.js');
/** Side of the finished icons. Twice the size they're drawn at, for sharp edges on a phone. */
const SIDE = 128;
/** Breathing room around the trimmed figure, as a share of the side. */
const PAD = 0.04;

/** Top-left corner of each league's panel on the sheet, in the order of `LEAGUES`. */
const PANELS = [
  { id: 'bronze', x: 18, y: 85, divisions: true },
  { id: 'silver', x: 638, y: 85, divisions: true },
  { id: 'gold', x: 18, y: 298, divisions: true },
  { id: 'platinum', x: 638, y: 298, divisions: true },
  { id: 'diamond', x: 18, y: 523, divisions: true },
  { id: 'master', x: 638, y: 523, divisions: false },
];

/** Boxes inside a panel. The division boxes stop short of the I / II / III under them. */
const EMBLEM = { x: 8, y: 8, w: 158, h: 172 };
const DIVISION_BOXES = [
  { name: 'i', x: 196, y: 58, w: 104, h: 100 },
  { name: 'ii', x: 332, y: 58, w: 104, h: 100 },
  { name: 'iii', x: 467, y: 58, w: 104, h: 100 },
];

/* ---------------------------------- cutting --------------------------------- */

/**
 * Trims a cut-out to its visible pixels and centres it on a transparent square. Faint alpha
 * (glow fringes the mask let through) doesn't count towards the bounds, so a stray haze at a
 * corner can't shrink the emblem.
 */
function squareUp(img) {
  const { width, height, pixels } = img;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('после вырезания ничего не осталось');
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const side = Math.ceil(Math.max(w, h) * (1 + 2 * PAD));
  const out = Buffer.alloc(side * side * 4);
  const ox = Math.floor((side - w) / 2);
  const oy = Math.floor((side - h) / 2);
  for (let y = 0; y < h; y += 1) {
    pixels.copy(out, ((oy + y) * side + ox) * 4, ((y0 + y) * width + x0) * 4, ((y0 + y) * width + x1 + 1) * 4);
  }
  return { width: side, height: side, pixels: out };
}

function cut(sheetPng, box, outFile, work) {
  const crop = join(work, 'crop.png');
  const lifted = join(work, 'lifted.png');
  const square = join(work, 'square.png');
  execFileSync('sips', ['--cropOffset', String(box.y), String(box.x), '-c', String(box.h), String(box.w), sheetPng, '--out', crop], { stdio: 'ignore' });
  execFileSync('osascript', ['-l', 'JavaScript', CUTOUT, crop, lifted], { stdio: 'ignore' });
  writeFileSync(square, encodePng(squareUp(decodePng(readFileSync(lifted)))));
  execFileSync('sips', ['-z', String(SIDE), String(SIDE), square, '--out', outFile], { stdio: 'ignore' });
}

const sheet = process.argv[2];
if (!sheet) {
  console.error('usage: node scripts/slice-league-sheet.mjs <sheet.jpg|png>');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'leagues-'));
try {
  const sheetPng = join(work, 'sheet.png');
  execFileSync('sips', ['-s', 'format', 'png', sheet, '--out', sheetPng], { stdio: 'ignore' });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const panel of PANELS) {
    const boxes = [{ name: '', ...EMBLEM }, ...(panel.divisions ? DIVISION_BOXES : [])];
    for (const b of boxes) {
      const file = join(OUT_DIR, b.name ? `${panel.id}-${b.name}.png` : `${panel.id}.png`);
      cut(sheetPng, { x: panel.x + b.x, y: panel.y + b.y, w: b.w, h: b.h }, file, work);
      console.log('→', file.slice(ROOT.length + 1));
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
