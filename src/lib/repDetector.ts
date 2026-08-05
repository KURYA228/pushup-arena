/**
 * Rep counting from a stream of pose samples.
 *
 * Deliberately free of React and MediaPipe so it can be reasoned about (and tested) on its own:
 * feed it `push(sample, timestampMs)` and it tells you when a rep completed.
 *
 * Two ideas carry the whole thing:
 *
 * 1. Fixed angle thresholds don't work. Everyone's push-up covers a different slice of the angle
 *    range — one person goes 95°→160°, another 115°→148° — and the camera position shifts those
 *    numbers further. So instead of asking "did you cross 90°", the detector observes a rolling
 *    window of your actual angles, takes the 5th/95th percentiles as your personal bottom/top,
 *    and puts the thresholds at fractions of *that* range. It self-tunes within a couple of reps.
 *
 * 2. Elbow angle alone can't tell a push-up from a wave. Bending an elbow while standing produces
 *    exactly the same angle trace as a rep. What separates them is what the rest of the body does:
 *    in a push-up your hands are planted and your torso travels; in an arm gesture your shoulder
 *    is anchored and your wrist travels. So counting is gated on that motion signature.
 */

/** Landmark indices in the MediaPipe Pose topology. */
export const ARMS = [
  { shoulder: 11, elbow: 13, wrist: 15, hip: 23 }, // left
  { shoulder: 12, elbow: 14, wrist: 16, hip: 24 }, // right
] as const;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface PoseSample {
  /** Elbow angle in degrees, ideally from metric 3D landmarks. */
  angle: number;
  /** Shoulder position in image space, aspect-corrected so x and y share a unit. */
  shoulder: Vec2;
  /** Wrist position in the same space. */
  wrist: Vec2;
  /** Body reference length (torso or upper arm) in the same units — makes travel distance-free. */
  scale: number;
}

/** Angle ABC in degrees, computed in 3D so it doesn't depend on camera placement or frame aspect. */
export function angleAt(a: Point3, b: Point3, c: Point3): number | null {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = a.z - b.z;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = c.z - b.z;
  const magAB = Math.hypot(abx, aby, abz);
  const magCB = Math.hypot(cbx, cby, cbz);
  if (magAB === 0 || magCB === 0) return null;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby + abz * cbz) / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** How deep you have to go for a rep to count. Exposed in the UI as a three-way switch. */
export type Strictness = 'soft' | 'normal' | 'strict';

/** Fraction of your range you must descend into. Lower = must go deeper. */
const DOWN_FRAC: Record<Strictness, number> = { soft: 0.42, normal: 0.3, strict: 0.2 };
/** Fraction of your range you must come back up to. */
const UP_FRAC: Record<Strictness, number> = { soft: 0.7, normal: 0.75, strict: 0.82 };

export interface DetectorTuning {
  /** Minimum spread in the rolling window before we trust it as a personal range. */
  minRomDeg: number;
  /** Time in the down position before an up-swing may close a rep — rejects jitter. */
  minDownMs: number;
  /** Floor on rep spacing. 500ms ≈ 2 reps/sec, faster than anyone actually does push-ups. */
  minRepIntervalMs: number;
  /** How much history feeds the personal-range estimate. */
  romWindowMs: number;
  /** A gap this long means we lost you — restart the cycle rather than fake a rep across it. */
  poseGapResetMs: number;
  /** Deliberately forgiving thresholds used only until the personal range is learned. */
  fallbackDown: number;
  fallbackUp: number;
  /** Low-pass factor applied after the median filter. */
  emaAlpha: number;
  /** Valid samples required before the state machine arms, so a garbage first frame can't fake a rep. */
  warmupSamples: number;
  /** How much recent motion the body-engagement test looks at. */
  motionWindowMs: number;
  /** Shoulder travel, in body lengths, required within that window. */
  minBodyTravel: number;
  /** Shoulder must out-travel the wrist by this factor — the part that rejects arm-only gestures. */
  bodyOverArmRatio: number;
  /** Engagement persists this long after the last qualifying motion, so a pause at the top holds. */
  engagementHoldMs: number;
  /** How fast a fresh range estimate replaces the stored one. */
  rangeBlend: number;
}

/** Samples kept while disengaged, ready to be admitted when movement is recognised. */
const PRE_ROLL_MS = 1500;
/** How far back the first calibration looks for a descent that already happened. */
const LOOKBACK_MS = 2000;

export const DEFAULT_TUNING: DetectorTuning = {
  minRomDeg: 30,
  minDownMs: 140,
  minRepIntervalMs: 500,
  romWindowMs: 12_000,
  poseGapResetMs: 700,
  fallbackDown: 110,
  fallbackUp: 145,
  emaAlpha: 0.45,
  warmupSamples: 5,
  motionWindowMs: 1200,
  minBodyTravel: 0.2,
  bodyOverArmRatio: 1.15,
  engagementHoldMs: 2500,
  rangeBlend: 0.5,
};

export interface DetectorSnapshot {
  phase: 'up' | 'down';
  /** Smoothed elbow angle, or null before the first sample. */
  angle: number | null;
  /** 0 = arms straight, 1 = at the bottom of your range. Drives the depth bar. */
  depth: number;
  /** Learned personal range in degrees, or null while still learning. */
  rom: number | null;
  bottom: number | null;
  top: number | null;
  /** True once thresholds come from your own range instead of the fallback. */
  calibrated: boolean;
  /** Depth (in the same 0..1 scale) you have to reach for the rep to register. Drives the UI marker. */
  downAtDepth: number;
  /** False when only your arm is moving — the signature of a gesture rather than a push-up. */
  bodyEngaged: boolean;
  reps: number;
}

interface MotionPoint {
  t: number;
  sx: number;
  sy: number;
  wx: number;
  wy: number;
}

export class RepDetector {
  private tuning: DetectorTuning;
  private strictness: Strictness;

  private window: { t: number; v: number }[] = [];
  /** Samples held while disengaged, admitted retroactively once movement is recognised. */
  private pending: { t: number; v: number }[] = [];
  private medianBuf: number[] = [];
  private smoothed: number | null = null;

  private motion: MotionPoint[] = [];
  private lastBodyMotionAt: number | null = null;
  private engaged = false;
  private wasEngaged = false;

  private bottom: number | null = null;
  private top: number | null = null;

  private phase: 'up' | 'down' = 'up';
  private downAt = 0;
  private lastRepAt = -Infinity;
  private lastSampleAt: number | null = null;
  private lastRangeCalcAt = -Infinity;
  private warmup = 0;
  private repCount = 0;

  constructor(strictness: Strictness = 'normal', tuning: DetectorTuning = DEFAULT_TUNING) {
    this.strictness = strictness;
    this.tuning = tuning;
  }

  setStrictness(s: Strictness) {
    this.strictness = s;
  }

  /** Drop everything learned so far — used by the "recalibrate" button. */
  reset() {
    this.window = [];
    this.pending = [];
    this.medianBuf = [];
    this.smoothed = null;
    this.motion = [];
    this.lastBodyMotionAt = null;
    this.engaged = false;
    this.wasEngaged = false;
    this.bottom = null;
    this.top = null;
    this.phase = 'up';
    this.lastSampleAt = null;
    this.lastRepAt = -Infinity;
    this.lastRangeCalcAt = -Infinity;
    this.warmup = 0;
  }

  /** Reset the session rep tally without discarding the learned range. */
  resetCount() {
    this.repCount = 0;
  }

  /**
   * Feed one sample. Returns true exactly when a rep completes.
   * Callers must skip frames where the arm isn't reliably visible — a dropout fed as data
   * looks like a huge angle swing and would count a phantom rep.
   */
  push(s: PoseSample, t: number): boolean {
    if (this.lastSampleAt != null && t - this.lastSampleAt > this.tuning.poseGapResetMs) {
      // Lost the pose for a while: the arm may be anywhere now, so start a fresh cycle.
      this.medianBuf = [];
      this.smoothed = null;
      this.motion = [];
      this.warmup = 0;
      this.phase = 'up';
    }
    this.lastSampleAt = t;

    const a = this.smooth(s.angle);
    this.engaged = this.updateEngagement(s, t);

    // Let the median/EMA filter fill before the sample is trusted anywhere. A garbage frame
    // arriving first would otherwise be recorded as a genuine angle, and the range estimator
    // would later hand it back as evidence of a descent that never happened.
    if (this.warmup < this.tuning.warmupSamples) {
      this.warmup += 1;
      return false;
    }

    // An arm-only movement must not reach the counter *or* the range estimator — letting a wave
    // widen the learned range would push the thresholds out of reach of real push-ups.
    if (!this.engaged) {
      this.phase = 'up';
      this.wasEngaged = false;
      this.pending.push({ t, v: a });
      while (this.pending.length && t - this.pending[0].t > PRE_ROLL_MS) this.pending.shift();
      return false;
    }

    if (!this.wasEngaged) {
      // Engagement is only recognised partway into the first descent, since it takes movement to
      // prove movement. Those earlier samples are still honest evidence of your range, so admit
      // them rather than starting a set already blind.
      if (this.pending.length) {
        this.window = this.window.concat(this.pending);
        this.pending = [];
      }
      this.wasEngaged = true;
    }

    const wasCalibrated = this.bottom != null;
    this.window.push({ t, v: a });
    if (t - this.lastRangeCalcAt > 250) {
      this.lastRangeCalcAt = t;
      this.recomputeRange(t);
    }
    if (!wasCalibrated && this.bottom != null) this.armFromHistory(t);

    const { down, up } = this.thresholds();
    if (this.phase === 'up') {
      if (a < down) {
        this.phase = 'down';
        this.downAt = t;
      }
      return false;
    }

    const dwelt = t - this.downAt >= this.tuning.minDownMs;
    const spaced = t - this.lastRepAt >= this.tuning.minRepIntervalMs;
    if (a > up && dwelt && spaced) {
      this.phase = 'up';
      this.lastRepAt = t;
      this.repCount += 1;
      return true;
    }
    return false;
  }

  /** Call when the pose is missing so stale samples don't bridge the gap. */
  markPoseLost() {
    this.medianBuf = [];
    this.smoothed = null;
    this.motion = [];
    this.warmup = 0;
  }

  snapshot(): DetectorSnapshot {
    const calibrated = this.bottom != null && this.top != null;
    const rom = calibrated ? this.top! - this.bottom! : null;
    const a = this.smoothed;

    let depth = 0;
    if (a != null) {
      const hi = calibrated ? this.top! : this.tuning.fallbackUp;
      const lo = calibrated ? this.bottom! : this.tuning.fallbackDown;
      depth = Math.min(1, Math.max(0, (hi - a) / Math.max(1, hi - lo)));
    }

    return {
      phase: this.phase,
      angle: a == null ? null : Math.round(a),
      depth,
      rom: rom == null ? null : Math.round(rom),
      bottom: this.bottom == null ? null : Math.round(this.bottom),
      top: this.top == null ? null : Math.round(this.top),
      calibrated,
      // In fallback mode the depth scale already ends exactly at the down threshold.
      downAtDepth: calibrated ? 1 - DOWN_FRAC[this.strictness] : 1,
      bodyEngaged: this.engaged,
      reps: this.repCount,
    };
  }

  /**
   * Decides whether the body — not just an arm — is doing the work.
   *
   * Compares how far the shoulder and the wrist have travelled over the last second or so, both
   * expressed in body lengths so distance from the camera doesn't matter. A push-up plants the
   * hands and swings the torso; a bicep curl, a wave or a thumbs-up anchors the shoulder and swings
   * the hand. The verdict is held for a couple of seconds so a pause at the top of a rep — where
   * nothing moves at all — doesn't drop engagement mid-set.
   */
  private updateEngagement(s: PoseSample, t: number): boolean {
    if (s.scale > 1e-4) {
      this.motion.push({
        t,
        sx: s.shoulder.x / s.scale,
        sy: s.shoulder.y / s.scale,
        wx: s.wrist.x / s.scale,
        wy: s.wrist.y / s.scale,
      });
      let cut = 0;
      while (cut < this.motion.length && t - this.motion[cut].t > this.tuning.motionWindowMs) cut += 1;
      if (cut > 0) this.motion = this.motion.slice(cut);

      if (this.motion.length >= 3) {
        const shoulderTravel = spread(this.motion, (p) => p.sx, (p) => p.sy);
        const wristTravel = spread(this.motion, (p) => p.wx, (p) => p.wy);
        if (
          shoulderTravel >= this.tuning.minBodyTravel &&
          shoulderTravel > wristTravel * this.tuning.bodyOverArmRatio
        ) {
          this.lastBodyMotionAt = t;
        }
      }
    }

    return this.lastBodyMotionAt != null && t - this.lastBodyMotionAt <= this.tuning.engagementHoldMs;
  }

  private smooth(raw: number): number {
    this.medianBuf.push(raw);
    if (this.medianBuf.length > 3) this.medianBuf.shift();
    const sorted = [...this.medianBuf].sort((x, y) => x - y);
    const med = sorted[Math.floor(sorted.length / 2)];
    this.smoothed = this.smoothed == null ? med : this.smoothed + this.tuning.emaAlpha * (med - this.smoothed);
    return this.smoothed;
  }

  /**
   * Personal range from the rolling window, via 5th/95th percentile rather than min/max so a
   * single bad frame can't stretch it.
   *
   * Once learned, the range is kept rather than discarded when the window empties: resting a
   * minute between sets would otherwise throw away the calibration and cost you the first rep of
   * every set. Fresh estimates are blended in, so it still follows you if your form drifts.
   */
  private recomputeRange(now: number) {
    const w = this.window;
    let cut = 0;
    while (cut < w.length && now - w[cut].t > this.tuning.romWindowMs) cut += 1;
    if (cut > 0) this.window = w.slice(cut);

    if (this.window.length < 20) return;
    const vals = this.window.map((s) => s.v).sort((x, y) => x - y);
    const lo = vals[Math.floor(vals.length * 0.05)];
    const hi = vals[Math.floor(vals.length * 0.95)];
    if (hi - lo < this.tuning.minRomDeg) return;

    const blend = this.tuning.rangeBlend;
    this.bottom = this.bottom == null ? lo : this.bottom + blend * (lo - this.bottom);
    this.top = this.top == null ? hi : this.top + blend * (hi - this.top);
  }

  /**
   * Called the moment a range first becomes available. The descent that taught us the range has
   * already happened, so without this the very first rep of a session is always swallowed: the
   * thresholds only exist by the time you're on your way back up.
   */
  private armFromHistory(t: number) {
    if (this.phase !== 'up') return;
    const { down } = this.thresholds();
    let minV = Infinity;
    let minT = 0;
    for (let i = this.window.length - 1; i >= 0; i -= 1) {
      const p = this.window[i];
      if (t - p.t > LOOKBACK_MS) break;
      if (p.v < minV) {
        minV = p.v;
        minT = p.t;
      }
    }
    if (minV < down) {
      this.phase = 'down';
      this.downAt = minT;
    }
  }

  private thresholds(): { down: number; up: number } {
    if (this.bottom != null && this.top != null) {
      const rom = this.top - this.bottom;
      return {
        down: this.bottom + DOWN_FRAC[this.strictness] * rom,
        up: this.bottom + UP_FRAC[this.strictness] * rom,
      };
    }
    return { down: this.tuning.fallbackDown, up: this.tuning.fallbackUp };
  }
}

/** Diagonal of the bounding box a point traced over the window — a cheap stand-in for travel. */
function spread<T>(points: T[], getX: (p: T) => number, getY: (p: T) => number): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const x = getX(p);
    const y = getY(p);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}
