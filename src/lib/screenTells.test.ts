import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScreenTells, screenScore, tellsShowing, type BodyBox, type ScreenReadings } from './screenTells.ts';

const W = 96;
const H = 72;

/** A deterministic pseudo-random source, so the pictures are the same on every run. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type Px = (x: number, y: number) => [number, number, number];

function picture(px: Px): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = px(x, y);
      const i = (y * W + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** A lit room: soft gradient, mild texture, a person-coloured blob in the middle. */
function room(seed: number, body: BodyBox): Uint8ClampedArray {
  const r = rng(seed);
  return picture((x, y) => {
    const base = 110 + 30 * (y / H) + (r() - 0.5) * 12;
    const inBody = x / W > body.x0 && x / W < body.x1 && y / H > body.y0 && y / H < body.y1;
    return inBody ? [base + 25, base + 5, base - 10] : [base, base, base + 5];
  });
}

/** A phone screen in a dim room: dark surround, a bright rectangle with refresh bands and rainbow grid noise. */
function screen(seed: number, body: BodyBox, shift = 0): Uint8ClampedArray {
  const r = rng(seed);
  const sx0 = 0.3;
  const sx1 = 0.7;
  const sy0 = 0.25;
  const sy1 = 0.75;
  return picture((x, y) => {
    const u = x / W;
    const v = y / H;
    if (u < sx0 || u > sx1 || v < sy0 || v > sy1) return [18, 18, 20];
    const band = 22 * Math.sin(((y + shift) * 2 * Math.PI) / 5);
    const grid = (x + y) % 2 === 0 ? 30 : -30;
    const inBody = u > body.x0 && u < body.x1 && v > body.y0 && v < body.y1;
    const base = (inBody ? 150 : 175) + band + (r() - 0.5) * 6;
    // A blown-out reflection in the corner of the glass, in the same place every time.
    if (u > 0.62 && u < 0.66 && v > 0.3 && v < 0.34) return [255, 255, 255];
    return [base + grid, base - grid, base + grid];
  });
}

const BODY: BodyBox = { x0: 0.36, y0: 0.35, x1: 0.62, y1: 0.62 };
const BIG_BODY: BodyBox = { x0: 0.1, y0: 0.3, x1: 0.9, y1: 0.8 };

test('a person in a lit room shows no screen tells', () => {
  const t = new ScreenTells();
  t.analyze(room(1, BIG_BODY), W, H, BIG_BODY);
  const r = t.analyze(room(2, { ...BIG_BODY, x0: 0.12, x1: 0.92 }), W, H, { ...BIG_BODY, x0: 0.12, x1: 0.92 });
  assert.deepEqual(tellsShowing(r), [], JSON.stringify(r));
  assert.equal(screenScore(r), 0);
});

test('a screen in a dim room shows several', () => {
  const t = new ScreenTells();
  t.analyze(screen(1, BODY), W, H, BODY);
  const moved = { ...BODY, x0: BODY.x0 + 0.03, x1: BODY.x1 + 0.03 };
  const r = t.analyze(screen(2, moved, 2), W, H, moved);
  const on = tellsShowing(r);
  for (const tell of ['glow', 'border', 'bands', 'moire', 'glare', 'small'] as const) {
    assert.ok(on.includes(tell), `${tell} expected in ${on.join(',')} — ${JSON.stringify(r)}`);
  }
  assert.ok(screenScore(r) >= 2);
});

// The first real runs, read off the dev panel (laptop webcam, 15 October 2026).
const LIVE: ScreenReadings = { glow: 0.62, edgeLuma: 193, border: 0.52, bands: 0.26, moire: 0.71, glare: 0.83, size: 0.64 };
const PHONE_VIDEO: ScreenReadings = { glow: 1.09, edgeLuma: 136, border: 0.84, bands: 0.2, moire: 0.59, glare: 0, size: 0.54 };

test('real run: a live person in front of a window is not a screen', () => {
  assert.ok(screenScore(LIVE) < 2, `score ${screenScore(LIVE)}`);
});

test('real run: a phone playing a push-up video is', () => {
  assert.ok(screenScore(PHONE_VIDEO) >= 2, `score ${screenScore(PHONE_VIDEO)}`);
});
