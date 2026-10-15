#!/usr/bin/env node
/**
 * Takes the steady background noise out of a voice clip.
 *
 *   node scripts/denoise.mjs <in.wav> <out.wav> <noiseFromSec> <noiseToSec> [--trim <sec>] [--peak <dB>]
 *
 * Spectral subtraction: the stretch between `noiseFrom` and `noiseTo` must be noise only (a pause,
 * or the tail after the words); its spectrum is the noise print, and every moment of the clip has
 * that print taken out, frequency by frequency. The gain is smoothed across time and frequency so
 * the leftover doesn't turn into "musical" chirps. `--trim` cuts the clip there with a short fade —
 * for a tail that was nothing but noise to begin with. `--peak` scales the result so its loudest
 * sample sits at that level (e.g. -1), level with the other voice clips.
 *
 * Works on 16-bit mono WAV, so convert first and after — on a Mac, with the built-in afconvert:
 *   afconvert -f WAVE -d LEI16@44100 -c 1 in.mp3 in.wav
 *   afconvert -f m4af -d aac -b 128000 out.wav public/sfx/name.m4a
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath, fromArg, toArg, ...rest] = process.argv.slice(2);
if (!inPath || !outPath || fromArg == null || toArg == null) {
  console.error('Usage: node scripts/denoise.mjs <in.wav> <out.wav> <noiseFromSec> <noiseToSec> [--trim <sec>] [--peak <dB>]');
  process.exit(1);
}
const opt = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? Number(rest[i + 1]) : null;
};
const trimAt = opt('--trim');
const peakDb = opt('--peak');

function readWav(path) {
  const b = readFileSync(path);
  let off = 12;
  let rate = 0;
  let data = null;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      if (b.readUInt16LE(off + 10) !== 1 || b.readUInt16LE(off + 22) !== 16) throw new Error('need 16-bit mono WAV');
      rate = b.readUInt32LE(off + 12);
    }
    if (id === 'data') {
      data = b.subarray(off + 8, off + 8 + size);
      break;
    }
    off += 8 + size + (size & 1);
  }
  const x = new Float64Array(data.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = data.readInt16LE(i * 2) / 32768;
  return { rate, x };
}

function writeWav(path, rate, x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  writeFileSync(path, b);
}

/** In-place radix-2 FFT; `inverse` without the 1/N. */
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const N = 2048;
const HOP = 512;
const OVERSUB = 2.2; // take out a bit more than the print, so the floor stays quiet between words
const FLOOR = 0.06; // never below this gain — a hard zero sounds like a gate slamming
const SMOOTH_T = 0.6; // gain smoothing from frame to frame

const { rate, x } = readWav(inPath);
const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
const frames = Math.ceil((x.length + N) / HOP);
const padded = new Float64Array(frames * HOP + N);
padded.set(x, N / 2);

// Spectrum of every frame.
const spec = [];
for (let f = 0; f < frames; f++) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = padded[f * HOP + i] * win[i];
  fft(re, im, false);
  spec.push({ re, im });
}

// The noise print: mean power per bin over the noise-only stretch.
const frameTime = (f) => (f * HOP) / rate;
const noise = new Float64Array(N / 2 + 1);
let count = 0;
for (let f = 0; f < frames; f++) {
  const t = frameTime(f);
  if (t < Number(fromArg) || t + N / rate > Number(toArg)) continue;
  for (let k = 0; k <= N / 2; k++) noise[k] += spec[f].re[k] ** 2 + spec[f].im[k] ** 2;
  count++;
}
if (!count) throw new Error('no whole frame fits in the noise stretch — make it longer');
for (let k = 0; k <= N / 2; k++) noise[k] /= count;

// Gain per frame and bin, smoothed across frequency and time, applied symmetrically.
const out = new Float64Array(padded.length);
const norm = new Float64Array(padded.length);
let prev = new Float64Array(N / 2 + 1).fill(1);
for (let f = 0; f < frames; f++) {
  const { re, im } = spec[f];
  const raw = new Float64Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) {
    const p = re[k] ** 2 + im[k] ** 2;
    raw[k] = p > 0 ? Math.max(FLOOR, Math.sqrt(Math.max(0, p - OVERSUB * noise[k]) / p)) : FLOOR;
  }
  const g = new Float64Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) {
    const a = raw[Math.max(0, k - 1)];
    const c = raw[Math.min(N / 2, k + 1)];
    const s = (a + 2 * raw[k] + c) / 4;
    g[k] = SMOOTH_T * prev[k] + (1 - SMOOTH_T) * s;
  }
  prev = g;
  for (let k = 0; k <= N / 2; k++) {
    re[k] *= g[k];
    im[k] *= g[k];
    if (k > 0 && k < N / 2) {
      re[N - k] *= g[k];
      im[N - k] *= g[k];
    }
  }
  fft(re, im, true);
  for (let i = 0; i < N; i++) {
    out[f * HOP + i] += (re[i] / N) * win[i];
    norm[f * HOP + i] += win[i] * win[i];
  }
}

let y = new Float64Array(x.length);
for (let i = 0; i < x.length; i++) {
  const j = i + N / 2;
  y[i] = norm[j] > 1e-8 ? out[j] / norm[j] : 0;
}

if (trimAt != null) {
  const end = Math.min(y.length, Math.round(trimAt * rate));
  const fade = Math.round(0.04 * rate);
  y = y.slice(0, end);
  for (let i = 0; i < fade && i < end; i++) y[end - 1 - i] *= i / fade;
}

if (peakDb != null) {
  const peak = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (peak > 0) {
    const k = 10 ** (peakDb / 20) / peak;
    for (let i = 0; i < y.length; i++) y[i] *= k;
  }
}

writeWav(outPath, rate, y);
console.log(`→ ${outPath}: ${(y.length / rate).toFixed(2)} s, noise print from ${count} frames`);
