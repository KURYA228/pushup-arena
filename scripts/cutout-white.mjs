#!/usr/bin/env node
/**
 * Lifts a figure off a plain white background, for pictures that come on white.
 *
 *   node scripts/cutout-white.mjs <in.jpg> <out.png> [height] [--keep-enclosed] [--trim]
 *
 * scripts/cutout.jxa.js (Vision) keeps only the main figure: anything lying apart from it — the
 * halves of a broken slab on the floor beside him — is dropped. Here the background is taken to be
 * the white that reaches the edges of the picture, filled inwards from them, so whatever stands on
 * it stays, separate or not, and white *inside* something (the letters on the slab) is untouched
 * because the fill can't get to it.
 *
 * White the figure shuts in — between a raised arm and the head — is found too, by being the
 * background's pure paper white rather than the greyer white painted in the picture.
 *
 * --keep-enclosed turns that off, for a picture whose own white is as pure as the paper's (pixel
 * letters drawn pure white on a sign). --trim crops the result to what's left.
 *
 * The edge is then un-matted: a pixel on the rim is part figure, part white, and keeping its colour
 * as is leaves a pale halo that shows on a dark screen. Each rim pixel's alpha is taken from how
 * far it is from white, and the white is subtracted back out of its colour.
 */

import { copyFileSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodePng, encodePng } from './lib/png.mjs';

/** At or above this in every channel, a pixel counts as background white. */
const WHITE = 226;
/** How far into the figure (px) the rim is un-matted. */
const RIM = 2;
/** The darkest a rim pixel can be and still be partly white. */
const SOLID = 150;
/** An enclosed patch at least this big and this white (mean of its darkest channel) is background. */
const ISLAND_MIN = 200;
const PAPER = 244;

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const [input, output, height] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const keepEnclosed = flags.includes('--keep-enclosed');
const trim = flags.includes('--trim');
if (!input || !output) {
  console.error('usage: node scripts/cutout-white.mjs <in.jpg> <out.png> [height] [--keep-enclosed] [--trim]');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'cutout-white-'));
try {
  const png = join(work, 'in.png');
  execFileSync('sips', ['-s', 'format', 'png', input, '--out', png], { stdio: 'ignore' });
  const { width: w, height: h, pixels: p } = decodePng(readFileSync(png));
  const minc = (i) => Math.min(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]);

  // The background: white reached from the edges.
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => {
    if (!bg[i] && minc(i) >= WHITE) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x += 1) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }

  // White shut in by the figure — the gap between a raised arm and the head, under the slab held
  // overhead — is background too, but the fill from the edges can't reach it. It's told from the
  // white that belongs to the picture (the letters on the slab) by being pure: the paper white of
  // the background, where painted white is a shade greyer.
  const seen = new Uint8Array(w * h);
  for (let s = 0; s < w * h && !keepEnclosed; s += 1) {
    if (bg[s] || seen[s] || minc(s) < WHITE) continue;
    const island = [s];
    seen[s] = 1;
    let sum = 0;
    for (let k = 0; k < island.length; k += 1) {
      const i = island[k];
      sum += minc(i);
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < w * h && !bg[j] && !seen[j] && minc(j) >= WHITE) {
          seen[j] = 1;
          island.push(j);
        }
      }
    }
    if (island.length >= ISLAND_MIN && sum / island.length >= PAPER) for (const i of island) bg[i] = 1;
  }

  // Distance (in steps, up to RIM) from the background, for the rim.
  const near = new Uint8Array(w * h);
  let front = [];
  for (let i = 0; i < w * h; i += 1) if (bg[i]) front.push(i);
  for (let d = 1; d <= RIM; d += 1) {
    const next = [];
    for (const i of front) {
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < w * h && !bg[j] && !near[j]) {
          near[j] = d;
          next.push(j);
        }
      }
    }
    front = next;
  }

  for (let i = 0; i < w * h; i += 1) {
    const o = i * 4;
    if (bg[i]) {
      p[o + 3] = 0;
      continue;
    }
    if (!near[i]) continue;
    // Part white: alpha from how far the pixel is from white, colour with the white taken out.
    const a = Math.max(0, Math.min(1, (255 - minc(i)) / (255 - SOLID)));
    if (a <= 0.02) {
      p[o + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c += 1) p[o + c] = Math.max(0, Math.min(255, Math.round((p[o + c] - (1 - a) * 255) / a)));
    p[o + 3] = Math.round(a * 255);
  }

  let out = { width: w, height: h, pixels: p };
  if (trim) {
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < w * h; i += 1) {
      if (p[i * 4 + 3] > 16) {
        const x = i % w;
        const y = (i - x) / w;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const tw = x1 - x0 + 1;
    const th = y1 - y0 + 1;
    const tp = Buffer.alloc(tw * th * 4);
    for (let y = 0; y < th; y += 1) p.copy(tp, y * tw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1 + 1) * 4);
    out = { width: tw, height: th, pixels: tp };
  }
  const cut = join(work, 'cut.png');
  writeFileSync(cut, encodePng(out));
  if (height) execFileSync('sips', ['--resampleHeight', String(height), cut, '--out', output], { stdio: 'ignore' });
  else copyFileSync(cut, output);
  console.log(`${output}: ${out.width}x${out.height}${height ? ` → height ${height}` : ''}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
