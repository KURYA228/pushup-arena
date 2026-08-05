import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RepDetector, type PoseSample, type Strictness } from './repDetector.ts';

const FPS = 30;
const DT = 1000 / FPS;

interface SimOptions {
  bottom: number;
  top: number;
  reps: number;
  periodMs?: number;
  noise?: number;
  t0?: number;
  /**
   * What the rest of the body does while the elbow bends:
   *  - `pushup`  — hands planted, torso travels (a real rep)
   *  - `gesture` — shoulder anchored, hand travels (a wave, a curl, a thumbs-up)
   *  - `shaken`  — body moving independently of the angle, to isolate the angle logic in tests
   *                that are about thresholds rather than about engagement
   */
  body?: 'pushup' | 'gesture' | 'shaken';
}

/** Deterministic noise, so a failure is reproducible. */
function noiseSource() {
  let seed = 12345;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
}

/**
 * Builds the sample a real pipeline would produce. Positions are in body lengths (scale = 1),
 * matching what the hook feeds after dividing by torso length.
 */
function sampleFor(angle: number, depth: number, t: number, body: SimOptions['body'], jitter: number): PoseSample {
  if (body === 'gesture') {
    // Standing still, bending the elbow: shoulder pinned, hand sweeping up toward the shoulder.
    return {
      angle,
      shoulder: { x: jitter * 0.01, y: jitter * 0.01 },
      wrist: { x: 0.1, y: 0.9 - 0.7 * depth },
      scale: 1,
    };
  }
  if (body === 'shaken') {
    return {
      angle,
      shoulder: { x: 0, y: 0.35 * Math.sin((2 * Math.PI * t) / 1500) },
      wrist: { x: 0.35, y: 0.9 },
      scale: 1,
    };
  }
  // Push-up: wrists planted on the floor, shoulders descending with the rep.
  return {
    angle,
    shoulder: { x: 0, y: 0.6 * depth + jitter * 0.01 },
    wrist: { x: 0.35 + jitter * 0.005, y: 0.9 + jitter * 0.005 },
    scale: 1,
  };
}

function simulate(d: RepDetector, o: SimOptions): { counted: number; endT: number } {
  const { bottom, top, reps, periodMs = 2000, noise = 2, t0 = 0, body = 'pushup' } = o;
  const rand = noiseSource();

  let t = t0;
  let counted = 0;
  const end = t0 + reps * periodMs;
  while (t < end) {
    const p = ((t - t0) % periodMs) / periodMs;
    const depth = 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
    const angle = top - (top - bottom) * depth + rand() * noise;
    if (d.push(sampleFor(angle, depth, t, body, rand()), t)) counted += 1;
    t += DT;
  }
  return { counted, endT: t };
}

function countReps(o: SimOptions, strictness: Strictness = 'normal'): number {
  return simulate(new RepDetector(strictness), o).counted;
}

// The whole point of the adaptive thresholds: these ranges are all realistic, and fixed
// 90°/160° thresholds counted zero reps for most of them.
test('counts every rep across realistic ranges of motion', () => {
  assert.equal(countReps({ bottom: 95, top: 160, reps: 10 }), 10, 'deep');
  assert.equal(countReps({ bottom: 100, top: 150, reps: 10 }), 10, 'typical');
  assert.equal(countReps({ bottom: 115, top: 155, reps: 10 }), 10, 'partial lockout');
  assert.equal(countReps({ bottom: 120, top: 152, reps: 10 }), 10, 'shallow but legitimate');
});

test('handles both fast and slow cadences', () => {
  assert.equal(countReps({ bottom: 100, top: 155, reps: 20, periodMs: 800 }), 20, 'fast');
  assert.equal(countReps({ bottom: 95, top: 158, reps: 6, periodMs: 4000 }), 6, 'slow');
});

test('survives a noisy landmark stream', () => {
  assert.equal(countReps({ bottom: 100, top: 152, reps: 10, noise: 6 }), 10);
});

test('every strictness level still counts honest reps', () => {
  for (const s of ['soft', 'normal', 'strict'] as Strictness[]) {
    assert.equal(countReps({ bottom: 118, top: 150, reps: 10 }, s), 10, s);
  }
});

// The failure this guards against: standing in front of the camera and bending an elbow —
// a wave, a bicep curl, a thumbs-up — produces an angle trace identical to a push-up.
test('arm-only gestures never count as reps', () => {
  assert.equal(countReps({ bottom: 95, top: 160, reps: 12, body: 'gesture' }), 0, 'deep bend');
  assert.equal(countReps({ bottom: 60, top: 170, reps: 12, body: 'gesture' }), 0, 'exaggerated bend');
  assert.equal(
    countReps({ bottom: 95, top: 160, reps: 12, periodMs: 1200, body: 'gesture' }),
    0,
    'rapid waving',
  );
});

test('gestures after a real set do not extend the count', () => {
  const d = new RepDetector();
  const set = simulate(d, { bottom: 100, top: 155, reps: 8 });
  // Long enough after the set that engagement has lapsed — picking the phone up and waving.
  const after = simulate(d, { bottom: 95, top: 165, reps: 10, t0: set.endT + 5000, body: 'gesture' });
  assert.equal(set.counted, 8);
  assert.equal(after.counted, 0);
});

test('a long rest between sets does not cost the first rep of the next one', () => {
  const d = new RepDetector();
  const first = simulate(d, { bottom: 112, top: 152, reps: 5 });
  // Well past the 12s range window — the calibration has to survive the rest.
  const second = simulate(d, { bottom: 112, top: 152, reps: 5, t0: first.endT + 90_000 });
  assert.equal(first.counted, 5);
  assert.equal(second.counted, 5);
});

test('gestures do not pollute the learned range', () => {
  const d = new RepDetector();
  simulate(d, { bottom: 100, top: 150, reps: 6 });
  const learned = d.snapshot();
  // A huge arm swing would widen the range and push thresholds out of reach of real push-ups.
  simulate(d, { bottom: 40, top: 175, reps: 6, t0: 20_000, body: 'gesture' });
  const after = d.snapshot();
  assert.equal(after.bottom, learned.bottom);
  assert.equal(after.top, learned.top);
});

test('rest and threshold jitter produce no reps', () => {
  const resting = new RepDetector();
  let jitterReps = 0;
  for (let t = 0; t < 20_000; t += DT) {
    const a = 168 + Math.sin(t / 90) * 4;
    if (resting.push(sampleFor(a, 0, t, 'shaken', 0), t)) jitterReps += 1;
  }
  assert.equal(jitterReps, 0, 'straight arms at rest');

  const onThreshold = new RepDetector();
  let borderline = 0;
  for (let t = 0; t < 20_000; t += DT) {
    const a = 128 + Math.sin(t / 70) * 5;
    if (onThreshold.push(sampleFor(a, 0.5, t, 'shaken', 0), t)) borderline += 1;
  }
  assert.equal(borderline, 0, 'jitter sitting on the down threshold');
});

test('twitches below the minimum range of motion do not count', () => {
  assert.equal(countReps({ bottom: 142, top: 160, reps: 15 }), 0);
});

test('an isolated garbage frame never opens a rep cycle', () => {
  const d = new RepDetector();
  let reps = 0;
  for (let t = 0; t < 15_000; t += DT) {
    // First frame is garbage — the worst case, since no filter history exists yet.
    const angle = t === 0 || Math.round(t) % 3000 === 0 ? 60 : 160;
    if (d.push(sampleFor(angle, 0, t, 'shaken', 0), t)) reps += 1;
  }
  assert.equal(reps, 0);
});

test('losing tracking mid-rep does not fabricate one on return', () => {
  const d = new RepDetector();
  const { counted } = simulate(d, { bottom: 100, top: 155, reps: 5 });
  d.push(sampleFor(105, 0.9, 10_000, 'pushup', 0), 10_000); // descended
  d.markPoseLost();
  // Reappeared 2s later with arms straight.
  const fabricated = d.push(sampleFor(155, 0, 12_000, 'pushup', 0), 12_000);
  assert.equal(fabricated, false);
  assert.equal(d.snapshot().reps, counted);
});

test('learns the personal range and reports it', () => {
  const d = new RepDetector();
  simulate(d, { bottom: 100, top: 150, reps: 6 });
  const s = d.snapshot();
  assert.equal(s.calibrated, true);
  assert.ok(s.bottom != null && Math.abs(s.bottom - 100) <= 6, `bottom ${s.bottom}`);
  assert.ok(s.top != null && Math.abs(s.top - 150) <= 6, `top ${s.top}`);
});

test('reset discards the learned range', () => {
  const d = new RepDetector();
  simulate(d, { bottom: 100, top: 150, reps: 6 });
  assert.equal(d.snapshot().calibrated, true);
  d.reset();
  assert.equal(d.snapshot().calibrated, false);
});
