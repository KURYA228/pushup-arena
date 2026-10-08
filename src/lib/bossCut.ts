/**
 * The timing of the cut to the boss — see src/components/BossIntro.tsx for what it drives.
 *
 * It lives apart from the component because this is the part with rules worth pinning down:
 * the whole effect is a contrast of speeds, and a value edited by eye could quietly turn a
 * slam into a drift without anything looking broken. The test runner also executes plain
 * TypeScript but not JSX.
 *
 * Framer wants every keyframe time as a fraction of one duration, which is a terrible way to
 * think about a thing like this — lengthening the hold by half a second used to mean editing
 * seven unrelated numbers to keep everything else where it was. So the beats are written in
 * seconds and the fractions are derived.
 */

/** Every beat, in seconds from the moment the minion falls. */
const BEAT = {
  /** The dark lunges most of the way in, then eases to black. */
  veilRush: 0.17,
  veilFull: 0.52,
  /** When both are thrown in. They travel together and meet in the middle. */
  enter: 0.78,
  /** How long either takes to cross the screen. */
  slide: 0.31,
  /** How long everything stays put once they have landed. */
  hold: 1.8,
  /** The fade out at the end. */
  leave: 0.35,
};

/** How long the whole thing is on screen, in seconds. */
export const BOSS_INTRO_SEC = BEAT.enter + BEAT.slide + BEAT.hold + BEAT.leave;

/** Seconds into the cut, as the fraction framer wants. */
const at = (sec: number) => sec / BOSS_INTRO_SEC;

/**
 * The dark.
 *
 * It has to be underway the instant the minion falls, because the screen behind it has
 * already swapped to the boss by then — leave it to drift in and the player watches the boss
 * arrive in full light and *then* get covered up, which is the reverse of the point.
 *
 * So it lunges to nearly black in a sixth of a second and eases the rest of the way. Fast
 * enough to swallow the swap, soft enough not to read as a cut: the cut is what comes after.
 */
export const VEIL_RUSH = at(BEAT.veilRush);
export const VEIL_RUSH_TO = 0.82;

/** When the dark finishes arriving. */
export const VEIL_AT = at(BEAT.veilFull);

/**
 * When the two start moving. One moment, not two.
 *
 * They used to arrive a third of a second apart, which read as two separate events — a word,
 * and then, after you had finished looking at it, a picture. Thrown from opposite sides and
 * landing on the same frame, they read as one.
 */
export const ENTER_AT = at(BEAT.enter);

/** How long a thing takes to come in from its edge. Thrown, not slid. */
export const SLIDE = at(BEAT.slide);

/** Everything starts leaving here. */
export const HOLD_TO = at(BEAT.enter + BEAT.slide + BEAT.hold);

/** The moment they land. Everything violent hangs off this one instant. */
export const LAND = ENTER_AT + SLIDE;

/**
 * The same instant in seconds, for everything that is not a framer keyframe.
 *
 * The sound has to be scheduled against the audio clock rather than the animation's, and the
 * one thing that must not happen is the two drifting apart: a voice that shouts over an empty
 * screen, or arrives after the word is already sitting there, is worse than no voice. Both
 * read this.
 */
export const LAND_SEC = BEAT.enter + BEAT.slide;

/** Opacity track for the dark, and the times that go with it. */
export const VEIL_TRACK = [0, VEIL_RUSH_TO, 1, 1, 1] as const;
export function veilTimes(): number[] {
  return [0, VEIL_RUSH, VEIL_AT, HOLD_TO, 1];
}

/**
 * Where each one waits, in viewport widths.
 *
 * Measured against the screen rather than against the element, which is the whole point:
 * a share of the element's own width puts a wide one past the edge and a narrow one still
 * half in frame, and half in frame is not an entrance. Over 100 means off the screen
 * whatever the thing is and however the screen is shaped.
 */
export const OFFSCREEN_VW = 115;

/** A hair past the mark and back, so the arrival lands instead of gliding to a stop. */
const OVERSHOOT_VW = 2.5;

/** Opacity for something that is outside the frame, then in it, then gone. */
export const ENTER_OPACITY = [0, 1, 1, 1, 1, 0] as const;

/** Times for {@link ENTER_OPACITY} and {@link slideFrom}: `start` is when it begins moving. */
export function slideTimes(start: number): number[] {
  return [0, start, start + SLIDE * 0.75, start + SLIDE, HOLD_TO, 1];
}

/**
 * The horizontal track for something entering from one side and stopping in the middle.
 * Every step is in the same unit — framer cannot interpolate between `vw` and `%`.
 */
export function slideFrom(side: 'left' | 'right'): string[] {
  const sign = side === 'left' ? -1 : 1;
  const out = `${sign * OFFSCREEN_VW}vw`;
  // Past the mark in the direction it was travelling, then settled.
  const past = `${-sign * OVERSHOOT_VW}vw`;
  return [out, out, past, '0vw', '0vw', '0vw'];
}

/** Where it sits before anything starts, so no frame is ever drawn with it in the middle. */
export function restingAt(side: 'left' | 'right'): string {
  return slideFrom(side)[0];
}

/* ------------------------------ the blows ------------------------------ */

/**
 * A gate: nothing, then the thing, then nothing again.
 *
 * The leading zero just before the moment is what makes it a gate rather than a slow reveal.
 * Without it the value interpolates from the first keyframe at t=0 all the way there, so a
 * flash meant to last two frames instead fades up across the whole approach and is already
 * sitting there, fully lit, before the moment it belongs to. That is the bug that put the
 * lightning on screen before the animation started, and it is why this is one function
 * rather than a shape written out at each use.
 */
const GATE = 0.004;
export const BLINK = [0, 0, 1, 1, 0, 0] as const;

export function blinkTimes(moment: number, hold = at(0.04), fade = at(0.14)): number[] {
  return [0, moment - GATE, moment, moment + hold, moment + hold + fade, 1];
}

/**
 * The tears: short gashes that are simply *there* for a couple of frames at each landing.
 *
 * These replaced bars that swept across the screen. A sweep is something you watch travel,
 * and watching is the opposite of being hit; appearing and vanishing before the eye can
 * follow is what reads as violence.
 */
export const TEAR_COUNT = 6;

/**
 * The index of the heavy one that sits under the word. It waits a breath for the flash to
 * pass — see {@link wordTearTimes} — while the rest come straight off the impact.
 */
export const WORD_TEAR = TEAR_COUNT - 1;

/** All of them come off the one landing, a frame or two apart so it reads as tearing. */
export function tearAt(i: number): number {
  if (i === WORD_TEAR) return LAND + WORD_TEAR_LAG;
  return LAND + i * at(0.035);
}

/**
 * The shine that travels across the word: one slow pass, not a loop.
 *
 * Repeating it turned the word into a sign in a shop window — something cycling, which the
 * eye stops reading after the second time round. Once, slowly, over most of the time the
 * word is up, is a highlight moving over metal.
 */
export const SHINE_SEC = 1.4;
/**
 * The sweep runs between the two ends of the background box and no further.
 *
 * The background is wider than the word, so any position from 0% to 100% still covers every
 * letter. Push past either end and the gradient slides off the glyphs altogether — and since
 * the letters are painted *by* that gradient, the word simply disappears. It did, for most of
 * the animation, until this was measured on screen.
 */
export const SHINE_FROM = '100% 0%';
export const SHINE_TO = '0% 0%';
/** It starts the moment the word is in place, not while it is still crossing the screen. */
export const SHINE_DELAY_SEC = LAND_SEC;

/**
 * The white-out on impact. Two frames of it does more than any amount of decoration — but
 * only two: the long fade it used to have left the screen washed red for a quarter of a
 * second, and everything struck in that moment, the tears included, was red on red.
 */
export function impactTimes(moment: number): number[] {
  return blinkTimes(moment, at(0.03), at(0.08));
}

/**
 * The heavy line under the word gets its own timing: a breath after the flash, and held
 * several times longer than the others.
 *
 * On the same frame as the word it was invisible — struck underneath a screen that was, at
 * that exact moment, entirely red. And at a tear's usual two frames there was nothing to
 * see even once the flash had gone.
 */
export const WORD_TEAR_LAG = at(0.07);
export function wordTearTimes(): number[] {
  return blinkTimes(LAND + WORD_TEAR_LAG, at(0.12), at(0.3));
}

/**
 * The shockwave: a ring thrown out from the middle when the figure lands.
 *
 * It expands and thins at the same time, which is what makes it read as air being pushed
 * rather than a circle being drawn. Gone in a quarter of a second.
 */
export const WAVE_SCALE = [0.15, 0.15, 0.3, 2.6, 2.6] as const;
export const WAVE_OPACITY = [0, 0, 0.9, 0, 0] as const;
export function waveTimes(): number[] {
  return [0, LAND - GATE, LAND, LAND + at(0.3), 1];
}

/**
 * The sparks: brief flecks struck all over the screen on the first blow.
 *
 * They used to radiate from the centre, which made a star — a shape, sitting in the middle
 * of the composition, impossible not to look at. Scattered across the frame and gone in a
 * tenth of a second they are something you half-notice, which is what a spark should be.
 */
export const SHARD_COUNT = 16;

/** A spread that looks unplanned and is the same every time. */
export function shardSpot(i: number): { left: number; top: number } {
  return { left: (i * 37 + 9) % 100, top: (i * 61 + 23) % 100 };
}

export function shardAngle(i: number): number {
  return (i * 97 + 13) % 360;
}

export function shardReach(i: number): number {
  return 34 + ((i * 29) % 46);
}

export const SHARD_OPACITY = [0, 0, 1, 0, 0] as const;

export function shardTimes(i: number): number[] {
  const moment = LAND + (i % 5) * at(0.016);
  return [0, moment - GATE, moment, moment + at(0.1), 1];
}

/**
 * The slow line.
 *
 * The same kind of stroke as all the others and in the same place in the world — it only
 * differs in pace. It fades up where it is, holds for as long as the shine takes to cross
 * the word, and fades out.
 *
 * It used to unroll from its left end, which meant it also pivoted about that end rather
 * than about its middle like every other line here, and the two together read as the thing
 * toppling over. Growing and swinging is a different gesture from appearing; what was wanted
 * was appearing, slowly.
 *
 * Having one thing move slowly is what makes the quick things read as quick — a screen where
 * everything snaps has no fast in it.
 */
const SLOW_IN_SEC = 0.35;
export const SLOW_OPACITY = [0, 0, 0.85, 0.85, 0] as const;

/**
 * It holds until everything else starts leaving, and goes with it.
 *
 * It used to fade out on its own clock, a breath before the rest — which left a moment of
 * the composition standing there with a hole in it where the line had been. Nothing here
 * should be seen to leave separately; the cut ends as one thing.
 */
export function slowLineTimes(): number[] {
  return [0, LAND - GATE, LAND + at(SLOW_IN_SEC), HOLD_TO, 1];
}

/**
 * How far the name is nudged right of the word's centre, in pixels.
 *
 * Everything here leans by thirteen degrees, and in a leaning world a plumb drop is not
 * "below": something a hundred and sixty pixels under the word's middle, placed by its own
 * middle, sits visibly to the left of it. To be under the word in the word's own frame it
 * has to come right by the drop times the tangent of the tilt — hence the number, and hence
 * it being larger where the drop is.
 */
export function nameNudge(wide: boolean): number {
  // On a phone the word stands straight (see WORD_TILT), so straight down is under it.
  return wide ? 36 : 0;
}

/** How far the word, its line and the name lean back where they're set beside the picture. */
export const WORD_TILT = -13;

/**
 * Light pouring down from above, as if something overhead switched on.
 *
 * Unlike the blows this one stays: it comes on with the landing, settles, and holds until
 * everything leaves. It is what keeps the picture lit rather than floating in black.
 */
export const TOPLIGHT = [0, 0, 1, 0.62, 0.62, 0] as const;
export function topLightTimes(): number[] {
  return [0, LAND - GATE, LAND, LAND + at(0.3), HOLD_TO, 1];
}

/**
 * The jolt. The whole composition is knocked sideways on the landing and shakes it off.
 *
 * Decoration can only suggest force; moving the picture is force. One knock now rather than
 * two, and harder for it: both halves arrive at once, so there is only one blow to feel.
 * Applied to the word and the figure rather than to the dark behind them, which would peel
 * away from the edges.
 */
export const JOLT_X = [0, 0, -15, 10, -4, 0, 0] as const;
export function joltTimes(): number[] {
  return [0, LAND, LAND + at(0.06), LAND + at(0.14), LAND + at(0.22), LAND + at(0.3), 1];
}

/* --------------------------- the quiet version --------------------------- */

/**
 * What the cut becomes for someone who has asked their phone to reduce motion.
 *
 * Not a shorter cut and not a skipped one: the same composition, arriving at the same moments
 * and leaving on the same frame, with nothing displaced. The word and the figure fade up where
 * they will stand instead of being thrown across the screen; the knock, the white-out, the
 * tears, the sparks and the shockwave are simply absent. What is left is the part that carries
 * the meaning — the room goes dark, the light comes on overhead, and the boss is there.
 *
 * Opacity is kept rather than removed. The setting is about movement and scale, which is what
 * provokes the nausea; a fade shifts nothing across the visual field and is how you say "this
 * is a different scene now" without moving anything.
 *
 * The leading zero is the same gate as everywhere else here — see {@link blinkTimes}. Without
 * it the fade starts at t=0 and the boss is already half visible through the dark, which is
 * exactly the reveal the veil exists to prevent.
 */
export const CALM_OPACITY = [0, 0, 1, 1, 0] as const;
export function calmTimes(): number[] {
  return [0, ENTER_AT, LAND, HOLD_TO, 1];
}
