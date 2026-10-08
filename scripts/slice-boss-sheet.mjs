#!/usr/bin/env node
/**
 * Cuts one stage sheet into the four images the app expects.
 *
 *   node scripts/slice-boss-sheet.mjs art/sheets/01-grunt.png 1
 *
 * The sheet is a four-panel collage separated by black gutters:
 *
 *   ┌───────────┬─────┬─────┐
 *   │           │ m1  │ m2  │
 *   │   BOSS    ├─────┴─────┤
 *   │           │    m3     │
 *   └───────────┴───────────┘
 *
 * The panels are found by the gutters rather than by fixed proportions, so the exact pixel
 * positions may drift from sheet to sheet without breaking anything.
 *
 * Two things happen on the way out. Each panel is cropped towards a portrait, because a wide
 * frame shown inside a roughly square slot ends up tiny. And a soft vignette is burned into the
 * alpha channel, so the app gets a cut-out with no hard rectangle around it — the sheets are
 * opaque photographs, and a square edge is exactly what we don't want on the fight screen.
 * That's also why everything is re-encoded as RGBA: the app treats every PNG as a cut-out.
 *
 * No image library is installed and none is wanted — PNG is decoded and encoded here with zlib.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'bosses');

/** Stage number → the base name used by `src/data/bosses.ts`. Spelling is load-bearing. */
const STAGE_BASE = [
  '01-grunt', '02-brawler', '03-berserker', '04-steelguard', '05-wraith',
  '06-titanprime', '07-voidhammer', '08-ironmaw', '09-bloodking', '10-stormborn',
  '11-worldbreaker', '12-apex', '13-nameless', '14-threshold', '15-absolute',
];

/**
 * How a gutter is recognised.
 *
 * The test is the brightest pixel on a line, not the average: the bottom of a night-time photo
 * averages just as dark as a divider, but it always has a highlight somewhere and a divider
 * never does. The threshold is relative to the sheet's own brightness, because the dividers turn
 * out not to be perfectly black — they pick up a little bleed from the panels beside them, and a
 * fixed cutoff either misses them or swallows half a photo. A gutter is also thin, so anything
 * wide is content however dark it is.
 */
const GUTTER_PEAK_SHARE = 0.35;
const GUTTER_PEAK_FLOOR = 24;
const GUTTER_MAX_SHARE = 0.12;
/** Widest portrait a cut-out may be. Wider panels are cropped inwards from both sides. */
const MAX_ASPECT = 0.8;
/** Longest side of a finished crop. The fight screen shows 190 CSS px; this covers 2–3x screens. */
const MAX_SIDE = 512;
/** JPEG quality handed to `sips`. */
const JPEG_QUALITY = 82;

/* ----------------------------- PNG decoding ----------------------------- */

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('это не PNG');
  const chunks = [];
  let at = 8;
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    chunks.push({ type: buf.toString('ascii', at + 4, at + 8), data: buf.subarray(at + 8, at + 8 + len) });
    at += 12 + len;
  }

  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('в файле нет заголовка IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colorType = ihdr.data[9];
  if (ihdr.data[12] !== 0) throw new Error('файл чересстрочный (Interlaced) — пересохрани без этого');
  if (depth !== 8) throw new Error(`нужно 8 бит на канал, а здесь ${depth}`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`тип цвета ${colorType} не поддерживается (палитра?) — сохрани как RGB или RGBA`);

  const raw = inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    // Undo the per-scanline filter; these five are the whole of the PNG filtering spec.
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      const grey = channels <= 2;
      out[d] = line[s];
      out[d + 1] = grey ? line[s] : line[s + 1];
      out[d + 2] = grey ? line[s] : line[s + 2];
      out[d + 3] = channels === 4 ? line[s + 3] : channels === 2 ? line[s + 1] : 255;
    }
    line.copy(prev);
  }
  return { width, height, pixels: out };
}

/* ----------------------------- PNG encoding ----------------------------- */

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng({ width, height, pixels }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------- finding the panels -------------------------- */

const lumAt = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return (img.pixels[i] * 299 + img.pixels[i + 1] * 587 + img.pixels[i + 2] * 114) / 1000;
};

/** Brightest pixel on each column (axis 'x') or row (axis 'y') inside a box. */
function profile(img, axis, box) {
  const { x0, y0, x1, y1 } = box;
  const peaks = [];
  if (axis === 'x') {
    for (let x = x0; x <= x1; x += 1) {
      let m = 0;
      for (let y = y0; y <= y1; y += 1) m = Math.max(m, lumAt(img, x, y));
      peaks.push(m);
    }
  } else {
    for (let y = y0; y <= y1; y += 1) {
      let m = 0;
      for (let x = x0; x <= x1; x += 1) m = Math.max(m, lumAt(img, x, y));
      peaks.push(m);
    }
  }
  return peaks;
}

/**
 * The widest black band inside the middle of a box — that's the gutter. Restricted to the
 * middle so an unlit strip along the sheet's own edge can't be mistaken for a divider.
 */
function findGutter(img, axis, box, label) {
  const peaks = profile(img, axis, box);
  const origin = axis === 'x' ? box.x0 : box.y0;
  const from = Math.floor(peaks.length * 0.25);
  const to = Math.ceil(peaks.length * 0.75);

  const sorted = [...peaks].sort((p, q) => p - q);
  const median = sorted[Math.floor(sorted.length / 2)];
  const limit = Math.max(GUTTER_PEAK_FLOOR, median * GUTTER_PEAK_SHARE);
  const widest = Math.max(4, Math.round(peaks.length * GUTTER_MAX_SHARE));

  let best = null;
  let start = -1;
  for (let i = from; i <= to; i += 1) {
    if (i < to && peaks[i] < limit) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      const run = { a: origin + start, b: origin + i - 1, len: i - start };
      if (run.len <= widest && (!best || run.len > best.len)) best = run;
      start = -1;
    }
  }
  if (!best || best.len < 3) {
    throw new Error(
      `не нашёл разделитель «${label}». Полосы между кадрами должны быть чёрными ` +
        'и сплошными, шириной хотя бы в несколько пикселей.',
    );
  }
  return best;
}

/* ------------------------------- cutting -------------------------------- */

/** Crops towards a portrait and shrinks if oversized. The soft edge is the app's job, not ours. */
function cutOut(img, box) {
  let { x0, y0, x1, y1 } = box;
  let w = x1 - x0 + 1;
  let h = y1 - y0 + 1;

  // A landscape frame inside a near-square slot renders tiny, so it's narrowed to a portrait
  // from both sides. Whatever the panel is about is in the middle of it.
  if (w / h > MAX_ASPECT) {
    const want = Math.round(h * MAX_ASPECT);
    x0 += Math.floor((w - want) / 2);
    x1 = x0 + want - 1;
    w = want;
  }

  const canvas = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const src = ((y0 + y) * img.width + x0) * 4;
    img.pixels.copy(canvas, y * w * 4, src, src + w * 4);
  }

  // Resizing is left to `sips` further down: a whole-number box average is all that's reasonable
  // to write by hand, and it would force 520px down to 260 when 512 was wanted.
  return { width: w, height: h, pixels: canvas };
}

/* --------------------------------- main --------------------------------- */

const [sheetPath, stageArg] = process.argv.slice(2);
if (!sheetPath || !stageArg) {
  console.error('Использование: node scripts/slice-boss-sheet.mjs <лист.png> <номер этапа 1..15>');
  process.exit(1);
}
const stage = Number(stageArg);
if (!Number.isInteger(stage) || stage < 1 || stage > 15) {
  console.error(`Этап должен быть числом от 1 до 15, а не «${stageArg}».`);
  process.exit(1);
}

const img = decodePng(readFileSync(sheetPath));

// Boss on the left, everything else on the right.
const vertical = findGutter(img, 'x', { x0: 0, y0: 0, x1: img.width - 1, y1: img.height - 1 }, 'босс | подчинённые');
const rightBox = { x0: vertical.b + 1, y0: 0, x1: img.width - 1, y1: img.height - 1 };

// Inside the right column: the pair on top, the third one underneath.
const horizontal = findGutter(img, 'y', rightBox, 'верхний ряд | нижний кадр');
const topBox = { ...rightBox, y1: horizontal.a - 1 };

// And the pair itself splits in two.
const topSplit = findGutter(img, 'x', topBox, 'подчинённый 1 | подчинённый 2');

const panels = [
  { name: 'm1', box: { x0: topBox.x0, y0: 0, x1: topSplit.a - 1, y1: topBox.y1 } },
  { name: 'm2', box: { x0: topSplit.b + 1, y0: 0, x1: img.width - 1, y1: topBox.y1 } },
  { name: 'm3', box: { x0: rightBox.x0, y0: horizontal.b + 1, x1: img.width - 1, y1: img.height - 1 } },
  { name: 'boss', box: { x0: 0, y0: 0, x1: vertical.a - 1, y1: img.height - 1 } },
];

const base = STAGE_BASE[stage - 1];
const fileFor = (name) => (name === 'boss' ? `${base}.jpg` : `${base}-${name}.jpg`);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

console.log(`Лист ${img.width}×${img.height}, этап ${stage}.`);
console.log(
  `Разделители: по x ${vertical.a}–${vertical.b}, по y ${horizontal.a}–${horizontal.b}, ` +
    `между верхними по x ${topSplit.a}–${topSplit.b}.`,
);
for (const { name, box } of panels) {
  const out = cutOut(img, box);
  const file = fileFor(name);
  const target = join(OUT_DIR, file);

  // PNG on photographs is hopeless — these came out around 450 KB each, which is 27 MB across
  // the full roster, all of it precached by the service worker. `sips` ships with macOS and the
  // project already leaned on it, so the crop goes out through a throwaway PNG and comes back
  // as a JPEG a sixth of the size.
  const temp = join(tmpdir(), `arena-slice-${process.pid}-${name}.png`);
  writeFileSync(temp, encodePng(out));
  execFileSync(
    'sips',
    ['-Z', String(MAX_SIDE), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY), temp, '--out', target],
    { stdio: 'ignore' },
  );
  rmSync(temp, { force: true });

  const final = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', target], { encoding: 'utf8' })
    .match(/pixel(?:Width|Height): (\d+)/g)
    .map((s) => s.split(': ')[1])
    .join('×');
  const kb = (readFileSync(target).length / 1024).toFixed(0);
  console.log(`  ${file.padEnd(24)} из ${out.width}×${out.height} → ${final}, ${kb} КБ`);
}
console.log('\nГотово.');
