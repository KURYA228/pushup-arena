/**
 * Tells that the camera is filming a screen — a phone, a laptop, a TV playing someone else's
 * push-ups — rather than a body in the room.
 *
 * None of these is proof on its own, and how strongly each shows depends on the screen, the
 * distance and the light. That's why every reading is exposed as a number (the measurement mode
 * in the dev panel shows them live): the thresholds below are starting guesses, to be set
 * from real side-by-side runs, a person versus a video.
 *
 * Works on a small RGBA frame (the video drawn into a canvas of a few dozen pixels a side) and
 * the body's box from the pose landmarks. Free of the DOM and MediaPipe so it can be tested on
 * synthetic pictures.
 */

export interface BodyBox {
  /** Normalised 0..1, as MediaPipe gives landmarks. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ScreenReadings {
  /** Brightness around the body ÷ brightness of the frame's edges. A lit screen in a dim room: high. */
  glow: number;
  /** Mean brightness of the frame's edges, 0..255 — `glow` means little when the room is bright. */
  edgeLuma: number;
  /** 0..1: how much of a straight-edged frame encloses the body (best two sides). */
  border: number;
  /** 0..1: regular horizontal bands across the picture — a screen's refresh seen by a camera. */
  bands: number;
  /** Colour ripple relative to plain detail — the rainbow moiré of a pixel grid. */
  moire: number;
  /** 0..1: glare — blown-out spots that sit still from look to look while the body moves. */
  glare: number;
  /** The body's larger side as a share of the frame, 0..1. */
  size: number;
}

export interface ScreenThresholds {
  glow: number;
  maxEdgeLuma: number;
  border: number;
  /** A border this clear is enough on its own. */
  borderStrong: number;
  bands: number;
  moire: number;
  glare: number;
  maxSize: number;
}

/**
 * Set from the first real runs (15 October 2026, a laptop webcam): a live person read border 0.52,
 * moiré 0.71, glare 0.83 (a window behind); a phone playing a push-up video held up to the camera
 * read border 0.84, moiré 0.59, glare 0. Only the border told them apart — the phone's edge is a
 * hard straight line — so a clear border counts double, and moiré and glare, which fired on the
 * live person (webcam noise, a bright window), are shown in the readout but don't count at all.
 */
export const SCREEN_THRESHOLDS: ScreenThresholds = {
  glow: 1.8,
  maxEdgeLuma: 70,
  border: 0.5,
  borderStrong: 0.7,
  bands: 0.4,
  moire: 0.5,
  glare: 0.5,
  maxSize: 0.4,
};

export type TellName = 'glow' | 'border' | 'bands' | 'moire' | 'glare' | 'small';

/** Tells measured and shown, but not counted: they fired on a live person in real runs. */
export const IGNORED_TELLS: readonly TellName[] = ['moire', 'glare'];

/** Which tells are past their thresholds in these readings, counted or not. */
export function tellsShowing(r: ScreenReadings, t: ScreenThresholds = SCREEN_THRESHOLDS): TellName[] {
  const on: TellName[] = [];
  if (r.glow >= t.glow && r.edgeLuma <= t.maxEdgeLuma) on.push('glow');
  if (r.border >= t.border) on.push('border');
  if (r.bands >= t.bands) on.push('bands');
  if (r.moire >= t.moire) on.push('moire');
  if (r.glare >= t.glare) on.push('glare');
  if (r.size > 0 && r.size <= t.maxSize) on.push('small');
  return on;
}

/**
 * How much these readings look like a screen: a point per counted tell, two for a clear border.
 * The guard (lib/screenGuard.ts) treats 2 as "a screen".
 */
export function screenScore(r: ScreenReadings, t: ScreenThresholds = SCREEN_THRESHOLDS): number {
  return tellsShowing(r, t)
    .filter((n) => !IGNORED_TELLS.includes(n))
    .reduce((sum, n) => sum + (n === 'border' && r.border >= t.borderStrong ? 2 : 1), 0);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Keeps the little history some tells need (glare compares spots across looks) and turns one
 * frame into readings.
 */
export class ScreenTells {
  private prevGlare: Uint8Array | null = null;
  private prevCenter: { x: number; y: number } | null = null;

  reset() {
    this.prevGlare = null;
    this.prevCenter = null;
  }

  analyze(rgba: Uint8ClampedArray, w: number, h: number, box: BodyBox): ScreenReadings {
    const n = w * h;
    const luma = new Float32Array(n);
    const chromaA = new Float32Array(n);
    const chromaB = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      chromaA[i] = r - g;
      chromaB[i] = b - g;
    }

    // Where a screen showing this body would be: the body box grown by a third each way.
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const rx0 = clamp(Math.floor((box.x0 - bw / 3) * w), 0, w - 1);
    const rx1 = clamp(Math.ceil((box.x1 + bw / 3) * w), 0, w - 1);
    const ry0 = clamp(Math.floor((box.y0 - bh / 3) * h), 0, h - 1);
    const ry1 = clamp(Math.ceil((box.y1 + bh / 3) * h), 0, h - 1);
    const inRegion = (x: number, y: number) => x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1;

    return {
      ...this.glow(luma, w, h, inRegion),
      border: this.border(luma, w, h, box),
      bands: this.bands(luma, w, rx0, rx1, ry0, ry1),
      moire: this.moire(luma, chromaA, chromaB, w, h, inRegion),
      glare: this.glare(luma, w, h, inRegion, box),
      size: Math.max(bw, bh),
    };
  }

  private glow(luma: Float32Array, w: number, h: number, inRegion: (x: number, y: number) => boolean) {
    let inner = 0;
    let innerN = 0;
    let edge = 0;
    let edgeN = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = luma[y * w + x];
        if (inRegion(x, y)) {
          inner += l;
          innerN++;
        } else if (x < w * 0.12 || x >= w * 0.88 || y < h * 0.12 || y >= h * 0.88) {
          edge += l;
          edgeN++;
        }
      }
    }
    const innerMean = innerN ? inner / innerN : 0;
    const edgeMean = edgeN ? edge / edgeN : 255;
    return { glow: innerMean / Math.max(edgeMean, 1), edgeLuma: edgeMean };
  }

  /**
   * A screen's edge is a long straight line of strong contrast on each side of the body. For each
   * side, the best column (or row) between the body and the edge of the frame: the share of the
   * span alongside the body where the brightness steps sharply, the same way round. Rooms have
   * straight lines too — door frames, the floor — which is why it takes two sides.
   */
  private border(luma: Float32Array, w: number, h: number, box: BodyBox): number {
    const STEP = 28;
    const at = (x: number, y: number) => luma[y * w + x];
    const yA = clamp(Math.floor(box.y0 * h), 1, h - 2);
    const yB = clamp(Math.ceil(box.y1 * h), 1, h - 2);
    const xA = clamp(Math.floor(box.x0 * w), 1, w - 2);
    const xB = clamp(Math.ceil(box.x1 * w), 1, w - 2);

    const column = (x: number) => {
      if (yB <= yA) return 0;
      let pos = 0;
      let neg = 0;
      for (let y = yA; y <= yB; y++) {
        const d = at(x + 1, y) - at(x - 1, y);
        if (d > STEP) pos++;
        else if (d < -STEP) neg++;
      }
      return Math.max(pos, neg) / (yB - yA + 1);
    };
    const row = (y: number) => {
      if (xB <= xA) return 0;
      let pos = 0;
      let neg = 0;
      for (let x = xA; x <= xB; x++) {
        const d = at(x, y + 1) - at(x, y - 1);
        if (d > STEP) pos++;
        else if (d < -STEP) neg++;
      }
      return Math.max(pos, neg) / (xB - xA + 1);
    };
    const best = (from: number, to: number, f: (i: number) => number) => {
      let m = 0;
      for (let i = from; i <= to; i++) m = Math.max(m, f(i));
      return m;
    };
    const sides = [
      best(1, Math.max(1, xA - 1), column),
      best(Math.min(w - 2, xB + 1), w - 2, column),
      best(1, Math.max(1, yA - 1), row),
      best(Math.min(h - 2, yB + 1), h - 2, row),
    ].sort((a, b) => b - a);
    return (sides[0] + sides[1]) / 2;
  }

  /**
   * Rows' mean brightness down the region, with the slow trend taken out; what's left, if it
   * repeats at a steady spacing, is banding. Scored by the strongest autocorrelation at a lag of
   * 2–12 rows, and only when the ripple is big enough to see (>1.5% of the brightness).
   */
  private bands(luma: Float32Array, w: number, x0: number, x1: number, y0: number, y1: number): number {
    const rows = y1 - y0 + 1;
    if (rows < 16 || x1 <= x0) return 0;
    const prof = new Float32Array(rows);
    let mean = 0;
    for (let y = y0; y <= y1; y++) {
      let s = 0;
      for (let x = x0; x <= x1; x++) s += luma[y * w + x];
      prof[y - y0] = s / (x1 - x0 + 1);
      mean += prof[y - y0];
    }
    mean /= rows;
    const detr = new Float32Array(rows);
    const R = 4;
    for (let i = 0; i < rows; i++) {
      let s = 0;
      let c = 0;
      for (let j = Math.max(0, i - R); j <= Math.min(rows - 1, i + R); j++) {
        s += prof[j];
        c++;
      }
      detr[i] = prof[i] - s / c;
    }
    let e0 = 0;
    for (let i = 0; i < rows; i++) e0 += detr[i] * detr[i];
    const rms = Math.sqrt(e0 / rows);
    if (e0 === 0 || rms < Math.max(1, mean) * 0.015) return 0;
    let bestCorr = 0;
    for (let lag = 2; lag <= Math.min(12, rows >> 1); lag++) {
      let s = 0;
      for (let i = 0; i + lag < rows; i++) s += detr[i] * detr[i + lag];
      bestCorr = Math.max(bestCorr, s / e0);
    }
    return clamp(bestCorr, 0, 1);
  }

  /**
   * Fine colour ripple versus fine brightness detail inside the region. A pixel grid filmed at an
   * angle throws rainbow fringes — colour that changes from pixel to pixel far more than real
   * skin, clothes and floors do.
   */
  private moire(
    luma: Float32Array,
    a: Float32Array,
    b: Float32Array,
    w: number,
    h: number,
    inRegion: (x: number, y: number) => boolean,
  ): number {
    let chroma = 0;
    let detail = 0;
    let count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!inRegion(x, y)) continue;
        const i = y * w + x;
        const hp = (arr: Float32Array) => Math.abs(arr[i] - (arr[i - 1] + arr[i + 1] + arr[i - w] + arr[i + w]) / 4);
        chroma += hp(a) + hp(b);
        detail += hp(luma);
        count++;
      }
    }
    if (!count) return 0;
    return chroma / count / Math.max(detail / count, 2);
  }

  /**
   * Blown-out spots in the region that stay put between looks while the body has moved: a
   * reflection on glass doesn't follow the person in the video. A still lamp in a real room does
   * the same, which is why this only counts alongside the others.
   */
  private glare(luma: Float32Array, w: number, h: number, inRegion: (x: number, y: number) => boolean, box: BodyBox): number {
    const mask = new Uint8Array(w * h);
    let spots = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (inRegion(x, y) && luma[y * w + x] >= 245) {
          mask[y * w + x] = 1;
          spots++;
        }
      }
    }
    const center = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
    const prev = this.prevGlare;
    const prevCenter = this.prevCenter;
    this.prevGlare = mask;
    this.prevCenter = center;
    if (!prev || !prevCenter || spots < 3) return 0;
    const moved = Math.hypot(center.x - prevCenter.x, center.y - prevCenter.y) > 0.01;
    if (!moved) return 0;
    let both = 0;
    let either = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] && prev[i]) both++;
      if (mask[i] || prev[i]) either++;
    }
    return either ? both / either : 0;
  }
}
