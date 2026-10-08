/**
 * How an enemy's remaining health turns into something you can see without reading numbers.
 *
 * Kept apart from the component that draws it for the usual reason: this is the part with rules
 * worth pinning down, and the test runner executes plain TypeScript but not JSX.
 */

/**
 * How many hearts a fight shows. A boss is worth three, which turn into a coarse health read;
 * a minion gets one that never goes out, so all it reports is that he's still standing and how
 * hard he's breathing.
 */
export const BOSS_HEARTS = 3;
export const MINION_HEARTS = 1;

/**
 * Beats per minute at full health and at death's door.
 *
 * Both ends are deliberately calmer than a real heart would be. The two only have to be far
 * enough apart that the pulse reads as a health gauge rather than one fixed speed; pushed
 * much past this the beats stop being separate thumps and turn into a flutter, which reads
 * as a broken animation rather than a racing heart.
 */
const CALM_BPM = 52;
const PANIC_BPM = 160;

/**
 * How the rate climbs as health drains. Above 1 it starts gently and steepens, so the first
 * hits barely move it and the last ones send it racing — the heart panics when the end is
 * near, not when the fight starts.
 */
const RAMP = 1.4;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Trimmed to two decimals: the jitter makes every coordinate fractional otherwise. */
const n = (v: number) => Math.round(v * 100) / 100;

/**
 * How many of `total` hearts are still lit: equal slices, rounded up, so the last one only
 * goes out when he does. With three that's thirds — above two thirds all three, above one
 * third two, anything left at all keeps one. Rounding up is the load-bearing part: a heart
 * going dark before the enemy dies would announce a death that hasn't happened, and with a
 * single heart it's what keeps a minion's heart lit for his whole fight.
 */
export function heartsLeft(pct: number, total = BOSS_HEARTS): number {
  if (pct <= 0) return 0;
  return Math.min(total, Math.ceil(pct / (100 / total)));
}

/**
 * The colour of the pulse, on the traffic light everyone already knows: green while he's
 * fresh, amber once he's hurt, red when he's nearly done. Grey is a stopped heart.
 *
 * Deliberately not the stage's own colour, which is what this replaced. That made the trace
 * decorative — gold on stage one, green on stage two — so the same colour meant a different
 * thing in every fight, which is to say it meant nothing. The thresholds are the hearts'
 * thirds, so the line changes colour on the very beat a heart goes out.
 */
const PULSE_COLORS = ['#6b7280', '#ef4444', '#eab308', '#22c55e'] as const;

export function pulseColor(pct: number): string {
  return PULSE_COLORS[heartsLeft(pct, BOSS_HEARTS)];
}

/**
 * Beats per minute at a given health (0..1).
 *
 * The interpolation is done in beats per minute rather than in seconds per beat, because that
 * is the thing an eye reads — a rate. Halving a period doubles a rate, so easing the seconds
 * evenly makes the change look front-loaded and then stalled.
 */
export function beatRate(health: number): number {
  const drained = Math.pow(1 - clamp01(health), RAMP);
  return CALM_BPM + (PANIC_BPM - CALM_BPM) * drained;
}

/** Seconds per beat. Healthy is slow, cornered races. */
export function beatPeriod(health: number): number {
  return 60 / beatRate(health);
}

/* ------------------------------- rhythm -------------------------------- */

/** Width of one average cardiogram cycle in viewBox units. */
export const CYCLE_WIDTH = 100;

/**
 * How many average cycles the window shows at once. Several beats on screen together is what
 * makes the line read as a rate instead of a single blip crossing an empty field.
 */
export const VISIBLE_CYCLES = 5;

/**
 * How many beats make up one phrase.
 *
 * A heart doesn't tick. Beats within a phrase differ in spacing, in height and in shape, so
 * the line never looks like one drawing scrolling past — which is exactly what it looked like
 * when every cycle was identical. The phrase is what repeats, and nine beats is half again
 * more than the window holds, so you never see the whole loop at once.
 */
export const PHRASE_BEATS = 9;

/** One beat: where it sits, how much room it gets, and what it looks like when it lands. */
export type Beat = {
  /** Left edge in viewBox units, measured from the start of the phrase. */
  at: number;
  /** Width as a multiple of {@link CYCLE_WIDTH} — the gap before the next beat. */
  scale: number;
  /** Overall height as a multiple of the baseline shape. */
  amp: number;
  /** The small bump before the spike. Sometimes almost gone. */
  p: number;
  /** The wave after it. Negative means inverted, which is a sick-looking beat. */
  t: number;
  /** A misfire: wide, misshapen, no lead-in, and the next beat comes late. */
  ectopic: boolean;
  /** How much the flat stretches shiver. */
  tremor: number;
  /** Which slice of the noise this beat draws its shivering from. */
  seed: number;
};

/**
 * Stable pseudo-random 0..1. Stable is the point: the path is rebuilt on every render, and a
 * fresh `Math.random()` each time would redraw the line mid-scroll.
 */
const noise = (i: number) => {
  const v = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
const wobble = (i: number) => noise(i) * 2 - 1;

/**
 * The beats of one phrase.
 *
 * Everything wanders, and each trait draws from its own slice of the noise — heights that rose
 * and fell in step with the gaps would just be a slower pattern. The strain decides how far
 * things wander and how often a beat misfires: a fresh heart keeps decent time with the odd
 * stumble, a spent one is all over the place.
 *
 * The bounds are deliberate. A beat is never narrower than 0.7 of a cycle, because the
 * waveform itself is 91 units wide and two of them would collide; and no combination of
 * heights can push the drawing out of the box it lives in — {@link beatPath} has the numbers.
 */
export function phrase(strain: number, count = PHRASE_BEATS): Beat[] {
  const s = clamp01(strain);
  const misfire = 0.12 + s * 0.3;

  // Shapes first, then positions: an ectopic beat comes early and steals room from the one
  // after it, so the gaps can only be worked out once we know which beats misfire.
  const shaped = Array.from({ length: count }, (_, i) => {
    const w = wobble(i);
    return {
      // Long gaps may stretch further than short ones may squeeze — the floor is a collision,
      // the ceiling is only a pause.
      scale: 1 + (w > 0 ? w * 0.5 : w * 0.3),
      amp: 1 + wobble(i + 41) * 0.22,
      p: 0.2 + noise(i + 97) * 1.2,
      // An inverted T shows up only on a heart that is genuinely in trouble.
      t: (0.3 + noise(i + 151) * 1.2) * (noise(i + 199) < s * 0.3 ? -1 : 1),
      ectopic: noise(i + 211) < misfire,
      tremor: (0.25 + s * 2.2) * (0.6 + noise(i + 263) * 0.8),
      seed: i,
    };
  });

  let at = 0;
  return shaped.map((b, i) => {
    // A misfire jumps the queue and is paid for by a longer wait afterwards. It's the pair
    // that reads as a stumble — an early beat alone just looks like noise.
    const early = b.ectopic ? 0.76 : 1;
    const late = shaped[i - 1]?.ectopic ? 1.32 : 1;
    const scale = Math.max(0.7, Math.min(1.75, b.scale * early * late));
    const beat = { ...b, scale, at };
    at += CYCLE_WIDTH * scale;
    return beat;
  });
}

/** Total width of a phrase in viewBox units. */
export function phraseWidth(beats: Beat[]): number {
  const last = beats[beats.length - 1];
  return last.at + CYCLE_WIDTH * last.scale;
}

/**
 * The scrolling strip: the phrase drawn twice, end to end.
 *
 * Scrolling by exactly one phrase lands on a copy of itself, so the loop point is invisible
 * even though no two neighbouring beats look alike.
 */
export function beatTrace(strain: number, beats = phrase(strain)): { d: string; width: number } {
  const width = phraseWidth(beats);
  const once = (shift: number) => beats.map((b) => beatPath(b, strain, shift)).join(' ');
  return { d: `${once(0)} ${once(width)}`, width };
}

/** A reference beat: the shape everything else is a deviation from. Handy for tests. */
export const PLAIN: Beat = {
  at: 0,
  scale: 1,
  amp: 1,
  p: 1,
  t: 1,
  ectopic: false,
  tremor: 0,
  seed: 0,
};

/**
 * One cardiogram cycle across 100 units of a 40-unit-tall box.
 *
 * `strain` runs 0 at full health to 1 at death's door and drives everything that makes a trace
 * look agitated: the spike grows, the waves around it deepen, the baseline shivers, and past
 * halfway an extra beat squeezes into the gap. The `beat` carries this particular cycle's
 * deviations from that shape — see {@link phrase}.
 *
 * Every cycle begins and ends exactly on the baseline, whatever else it does. That is what
 * lets them be laid end to end without a visible joint.
 */
export function beatPath(beat: Beat, strain: number, shift = 0): string {
  const s = clamp01(strain);
  const { amp, scale } = beat;
  const offset = beat.at + shift;
  const x = (v: number) => n(offset + v * scale);
  const mid = 20;
  const y = (v: number) => n(mid - v * amp);

  // Calm stays small; the strain terms are what open the whole box up, so a dying heart
  // throws the line from the top edge to the bottom and back.
  //
  // The ceilings matter: the box is 40 tall, and an earlier set of numbers sent the R peak to
  // -2 at full strain, where it was silently clipped — the trace stopped growing exactly when
  // it was supposed to look worst. Every figure below is the base before `amp` (up to 1.22),
  // the P and T multipliers and the ectopic beat's wider swings pile on, and the worst of
  // those products has to stay inside 1 … 39.
  const p = (2.2 + s * 4) * beat.p; // ≤ 8.7 → ×1.22 = 10.6
  const q = 1.8 + s * 4; // ≤ 5.8 → ectopic ×1.2, ×1.22 = 8.5
  const r = 6 + s * 9.2; // ≤ 15.2 → ×1.22 = 18.5, so the peak stops at y = 1.5
  const dip = 2.8 + s * 8; // ≤ 10.8 → ectopic ×1.35, ×1.22 = 17.8, y = 37.8
  const t = (3 + s * 6) * beat.t; // ≤ 13.5 either way → ×1.22 = 16.5, y within 3.5 … 36.5

  /** A flat stretch, drawn as a shiver rather than a ruled line. */
  const flat = (from: number, to: number, steps: number, k: number) => {
    const out: string[] = [];
    for (let i = 1; i <= steps; i++) {
      out.push(
        `L${x(from + ((to - from) * i) / (steps + 1))} ${n(mid + beat.tremor * wobble(beat.seed * 17 + k + i))}`,
      );
    }
    // Back on the baseline at the far end: the joints between stretches have to be exact.
    out.push(`L${x(to)} ${mid}`);
    return out.join(' ');
  };

  const parts = [`M${x(0)} ${mid} ${flat(0, 18, 3, 0)}`];

  if (beat.ectopic) {
    // A misfire: no lead-in bump, a wide misshapen spike, and a heavy wave the wrong way up.
    parts.push(
      `L${x(30)} ${mid} L${x(38)} ${y(-q * 1.2)} L${x(45)} ${y(r * 0.72)} L${x(53)} ${y(-dip * 1.35)} L${x(61)} ${mid}`,
      `Q${x(70)} ${y(-Math.abs(t) * 0.9)} ${x(78)} ${mid}`,
    );
  } else {
    parts.push(
      `Q${x(22)} ${y(p)} ${x(26)} ${mid}`, // P
      `L${x(33)} ${mid} L${x(36)} ${y(-q)} L${x(41)} ${y(r)} L${x(46)} ${y(-dip)} L${x(50)} ${mid}`, // QRS
      `${flat(50, 58, 1, 20)} Q${x(66)} ${y(t)} ${x(74)} ${mid}`, // T
    );
  }

  // The stumbling extra beat only appears once he's genuinely struggling.
  const stumble = s > 0.5 && !beat.ectopic;
  if (stumble) {
    const e = (s - 0.5) * 2;
    // ≤ 12 up and 7 down, ×1.22 → y within 5.4 … 28.5.
    parts.push(`L${x(82)} ${mid} L${x(85)} ${y(12 * e)} L${x(88)} ${y(-7 * e)} L${x(91)} ${mid}`);
  }

  parts.push(flat(stumble ? 91 : beat.ectopic ? 78 : 74, 100, 2, 40));
  return parts.join(' ');
}

/* ----------------------------- keyframes ------------------------------- */

/**
 * The hearts beat on the same phrase as the line, which is the whole reason these exist.
 *
 * Framer's `repeat` plays one fixed cycle forever, so an uneven rhythm has to be spelled out:
 * one long animation covering the entire phrase, with each beat's thump placed at its own
 * moment and given its own size. `times` are fractions of the phrase and strictly increasing,
 * as framer requires.
 *
 * `glow` is 0 at rest and 1 at the hardest point of a full-strength thump; the component turns
 * it into brightness and shadow, which are the parts that need a colour.
 */
export function heartKeyframes(beats: Beat[], width = phraseWidth(beats)) {
  const times: number[] = [];
  const scale: number[] = [];
  const scaleX: number[] = [];
  const glow: number[] = [];

  const at = (t: number, s: number, sx: number, g: number) => {
    times.push(n(t) / 100);
    scale.push(s);
    scaleX.push(sx);
    glow.push(g);
  };

  for (const b of beats) {
    const f = (b.at / width) * 100;
    const w = ((CYCLE_WIDTH * b.scale) / width) * 100;
    // A misfire lands as one heavy lurch instead of the usual lub-dub.
    const a = b.ectopic ? b.amp * 1.3 : b.amp;
    at(f, 1, 1, 0);
    at(f + w * 0.1, 1 + 0.28 * a, 1 + 0.34 * a, Math.min(1, a));
    at(f + w * 0.22, 1.05, 1.03, 0.25);
    at(f + w * 0.32, 1 + (b.ectopic ? 0.05 : 0.18) * a, 1 + (b.ectopic ? 0.06 : 0.22) * a, 0.6 * a);
  }
  at(100, 1, 1, 0);

  return { times, scale, scaleX, glow };
}

/**
 * Read a keyframe track at a point in the phrase, 0..1.
 *
 * The hearts are driven by hand from a phase that we advance ourselves, rather than handed to
 * framer as a looping animation with a duration. A declarative loop only picks up a new speed
 * when it restarts, and these never had a reason to restart — so the pulse kept whatever
 * tempo it was born with and ignored every hit after that. Sampling a track means the rate
 * can change between one frame and the next, from wherever the beat currently is.
 *
 * Eased within each segment the way the declarative version was, so a thump still snaps and
 * then settles instead of sliding evenly.
 */
export function sampleTrack(times: number[], values: number[], phase: number): number {
  const p = clamp01(phase);
  let i = 1;
  while (i < times.length - 1 && times[i] < p) i++;
  const span = times[i] - times[i - 1];
  const k = span <= 0 ? 1 : clamp01((p - times[i - 1]) / span);
  const eased = 1 - (1 - k) * (1 - k);
  return values[i - 1] + (values[i] - values[i - 1]) * eased;
}

/**
 * The ring that expands out of each heart, on the same phrase.
 *
 * It fades out well before its beat is over and shrinks back while invisible, so the reset is
 * never seen — a keyframe track can't jump.
 */
export function ringKeyframes(beats: Beat[], width = phraseWidth(beats)) {
  const times: number[] = [];
  const scale: number[] = [];
  const opacity: number[] = [];

  const at = (t: number, s: number, o: number) => {
    times.push(n(t) / 100);
    scale.push(s);
    opacity.push(o);
  };

  for (const b of beats) {
    const f = (b.at / width) * 100;
    const w = ((CYCLE_WIDTH * b.scale) / width) * 100;
    at(f, 0.75, b.ectopic ? 1.35 : b.amp);
    at(f + w * 0.55, b.ectopic ? 2.3 : 1.9, 0);
    at(f + w * 0.9, 0.75, 0);
  }
  at(100, 0.75, 0);

  return { times, scale, opacity };
}
