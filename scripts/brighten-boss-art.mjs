#!/usr/bin/env node
/**
 * Lifts dark boss artwork, in place.
 *
 *   node scripts/brighten-boss-art.mjs public/bosses/01-grunt.jpg public/bosses/01-grunt-m1.jpg …
 *
 * The illustrations come out of the generator moody — fine on a poster, murky on a phone at arm's
 * length on the floor. Each picture gets an exposure gain picked from its own brightness: the
 * darker it is, the more it's lifted, up to a cap, and a picture that is already bright still
 * gets a little. Highlights roll off softly instead of clipping, so lamps, blades and fire keep
 * their shape.
 *
 * The tsar's stage was lifted by hand first and is the reference for how far to go: its pictures
 * sit at a mean brightness of roughly 45–90, which is where TARGET_MEAN aims.
 *
 * The first run keeps each original under art/bosses-original/ (not in git), and every later run
 * starts from that copy — so running it twice doesn't lift twice, and tuning the numbers below
 * and running again just works.
 *
 * A boss's own portrait (not his minions') is also kept as drawn, under public/bosses/original/,
 * and listed in src/data/artOriginals.json: the "BOSS" cut, the scouting report and the boss card
 * show him the way he was drawn. Minions never appear there, so their originals stay out of the
 * app.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGINALS = join(ROOT, 'art', 'bosses-original');
const SHIPPED = join(ROOT, 'public', 'bosses', 'original');
const LIST = join(ROOT, 'src', 'data', 'artOriginals.json');
/** A minion's picture: `07-voidhammer-m2.jpg`. */
const isMinion = (name) => /-m\d+\.[a-z]+$/i.test(name);

/** Mean luminance (0–255) a picture is lifted towards. */
const TARGET_MEAN = 72;
/** Least and most a picture's exposure is multiplied by. */
const MIN_GAIN = 1.15;
const MAX_GAIN = 2.4;
/** Above this (0–1) highlights stop rising in a straight line and roll off towards white. */
const KNEE = 0.72;
const JPEG_QUALITY = 88;
/** Pictures that take a set gain instead of the computed one — where the formula went too far. */
const GAIN_OVERRIDES = {
  // Gru: at the full ×2.4 his face washed out against the red.
  '03-berserker.jpg': 1.6,
};

function meanLuma({ pixels }) {
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
  return sum / (pixels.length / 4);
}

/** Exposure gain with a soft shoulder: linear up to the knee, then easing into white. */
function curve(gain) {
  const lut = new Uint8Array(256);
  const room = 1 - KNEE;
  for (let v = 0; v < 256; v += 1) {
    const y = (v / 255) * gain;
    const out = y <= KNEE ? y : KNEE + room * (1 - Math.exp(-(y - KNEE) / room));
    lut[v] = Math.round(Math.min(1, out) * 255);
  }
  return lut;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/brighten-boss-art.mjs <image.jpg> …');
  process.exit(1);
}

mkdirSync(ORIGINALS, { recursive: true });
mkdirSync(SHIPPED, { recursive: true });
const shipped = new Set(existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : []);
const work = mkdtempSync(join(tmpdir(), 'brighten-'));
try {
  for (const file of files) {
    const original = join(ORIGINALS, basename(file));
    if (!existsSync(original)) copyFileSync(file, original);

    const png = join(work, 'in.png');
    execFileSync('sips', ['-s', 'format', 'png', original, '--out', png], { stdio: 'ignore' });
    const img = decodePng(readFileSync(png));
    const before = meanLuma(img);
    const gain = GAIN_OVERRIDES[basename(file)] ?? Math.min(MAX_GAIN, Math.max(MIN_GAIN, TARGET_MEAN / Math.max(1, before)));
    const lut = curve(gain);
    for (let i = 0; i < img.pixels.length; i += 4) {
      img.pixels[i] = lut[img.pixels[i]];
      img.pixels[i + 1] = lut[img.pixels[i + 1]];
      img.pixels[i + 2] = lut[img.pixels[i + 2]];
    }
    const lifted = join(work, 'out.png');
    writeFileSync(lifted, encodePng(img));
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY), lifted, '--out', file], {
      stdio: 'ignore',
    });
    if (!isMinion(basename(file))) {
      copyFileSync(original, join(SHIPPED, basename(file)));
      shipped.add(basename(file));
    }
    console.log(`${basename(file).padEnd(26)} ${before.toFixed(0).padStart(4)} → ${meanLuma(img).toFixed(0).padStart(4)}  ×${gain.toFixed(2)}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
  writeFileSync(LIST, `${JSON.stringify([...shipped].sort(), null, 2)}\n`);
}
