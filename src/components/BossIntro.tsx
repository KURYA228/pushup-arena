import { motion, useReducedMotion } from 'framer-motion';
import type { BossDef } from '../data/bosses';
import {
  BLINK,
  BOSS_INTRO_SEC,
  CALM_OPACITY,
  ENTER_OPACITY,
  ENTER_AT,
  calmTimes,
  LAND,
  JOLT_X,
  SHARD_COUNT,
  SHARD_OPACITY,
  SHINE_DELAY_SEC,
  SHINE_FROM,
  SHINE_SEC,
  SHINE_TO,
  SLOW_OPACITY,
  TEAR_COUNT,
  TOPLIGHT,
  VEIL_TRACK,
  WAVE_OPACITY,
  WAVE_SCALE,
  WORD_TEAR,
  blinkTimes,
  impactTimes,
  joltTimes,
  nameNudge,
  restingAt,
  slideFrom,
  slideTimes,
  shardAngle,
  shardReach,
  shardSpot,
  shardTimes,
  slowLineTimes,
  tearAt,
  topLightTimes,
  wordTearTimes,
  veilTimes,
  waveTimes,
} from '../lib/bossCut';
import { BossIcon } from './BossIcon';

/**
 * The cut between the last minion and the boss himself.
 *
 * Three minions die exactly the way the boss will, with the same numbers coming off the same
 * bar, so without a break the stage's one real fight starts as if nothing had changed. This
 * is the break.
 *
 * It is built on a contrast of speeds. The room darkens and then holds, completely still —
 * and into that quiet the word and the figure are thrown in from the sides, each landing
 * with a white-out, a set of tears across the picture and a jolt of the whole composition.
 * The stillness is what the violence is measured against; without it there is only motion.
 *
 * It never takes the input. A flourish that eats a rep is a flourish that costs the player
 * something, so taps go straight through to the button underneath and the camera keeps
 * counting — the screen is the only thing interrupted.
 */

/**
 * A stroke that comes to a point at both ends instead of stopping square.
 *
 * A rectangle with a gradient fading out still ends in two right angles, and at these
 * lengths the eye finds them: the line reads as a bar someone laid down. Tapered over a
 * fifth of its length at each end it reads as something that cut the screen.
 *
 * The glow has to move from `box-shadow` to a `drop-shadow` filter along with it — a clip
 * path cuts the box shadow off dead at the edge, while the filter traces whatever shape is
 * left and so follows the point.
 */
const NEEDLE = 'polygon(0% 50%, 20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%)';

/**
 * The word's own glow, as keyframes.
 *
 * Two tracks, because the two versions of the cut do not have the same number of moments to
 * hang them off. The loud one blazes on the landing and decays to a steady burn over the hold;
 * the quiet one goes straight to the burn, since a flare is the look of being struck and in
 * that version nothing strikes. Each has to be exactly as long as the `times` it is given.
 */
const GLOW_OFF = 'drop-shadow(0 0 0 #ef444400)';
const GLOW_BLAZE = 'drop-shadow(0 0 34px #ef4444) drop-shadow(0 0 86px #b91c1ccc)';
const GLOW_COOLING = 'drop-shadow(0 0 26px #ef4444) drop-shadow(0 0 66px #b91c1cbb)';
const GLOW_STEADY = 'drop-shadow(0 0 16px #ef4444cc) drop-shadow(0 0 46px #b91c1c99)';

const WORD_GLOW = [GLOW_OFF, GLOW_OFF, GLOW_BLAZE, GLOW_COOLING, GLOW_STEADY, GLOW_STEADY];
const CALM_GLOW = [GLOW_OFF, GLOW_OFF, GLOW_STEADY, GLOW_STEADY, GLOW_STEADY];

/** Where each tear sits, how long and how thick. Uneven on purpose — even ones read as a grid. */
const TEARS = [
  { top: '21%', left: '-6%', width: '62%', height: 5 },
  { top: '38%', left: '26%', width: '80%', height: 11 },
  { top: '63%', left: '-10%', width: '54%', height: 3 },
  { top: '52%', left: '38%', width: '68%', height: 7 },
  { top: '79%', left: '12%', width: '46%', height: 4 },
  // The heavy one, struck under the word on the same frame the word lands.
  { top: '66%', left: '-8%', width: '58%', height: 9 },
];

export function BossIntro({
  boss,
  index,
  size,
  wide = false,
}: {
  boss: BossDef;
  index: number;
  /** Width budget for the artwork, in pixels. */
  size: number;
  /** Whether the two sit side by side; the name's nudge depends on how far it hangs. */
  wide?: boolean;
}) {
  // Set when the player has asked their phone for less movement. Everything that travels,
  // shakes, flashes or expands is dropped; see CALM_OPACITY in bossCut for what is left and
  // why. The cut keeps its length either way — BossView dismisses it on its own clock, and a
  // version that finished early would start the fight before the screen had come back.
  const calm = useReducedMotion();

  /** Thrown in from `side`, landing at `at` — or, if asked, simply there by then. */
  const enter = (at: number, side: 'left' | 'right') =>
    calm
      ? {
          initial: { opacity: 0 },
          animate: { opacity: [...CALM_OPACITY] },
          transition: { duration: BOSS_INTRO_SEC, times: calmTimes(), ease: 'easeOut' as const },
        }
      : {
          // The resting position is pinned in `initial`, not left to the first keyframe: without
          // it React paints one frame with the thing sitting in the middle, already arrived,
          // before framer gets its first tick and shoves it off the edge.
          initial: { opacity: 0, x: restingAt(side) },
          animate: { opacity: [...ENTER_OPACITY], x: slideFrom(side) },
          // Decelerating: fastest the moment it enters the frame, slowest as it settles.
          transition: {
            duration: BOSS_INTRO_SEC,
            times: slideTimes(at),
            ease: 'easeOut' as const,
          },
        };
  // One moment, two directions: they are thrown from opposite sides and meet in the middle.
  const word = enter(ENTER_AT, 'left');
  const figure = enter(ENTER_AT, 'right');
  // The name is thrown in with them, from the word's side. It used to fade up on the spot
  // a quarter of a second behind, which next to two things slamming in read as a caption
  // that had been lying there all along.
  const name = enter(ENTER_AT, 'left');

  /** Two frames of something, at `at` and not a moment before. */
  const blink = (at: number, times = blinkTimes(at)) => ({
    initial: { opacity: 0 },
    animate: { opacity: [...BLINK] },
    transition: { duration: BOSS_INTRO_SEC, times },
  });

  return (
    <motion.div
      aria-hidden
      // Above the toasts, which also sit at z-50 and would otherwise stack on top of the
      // darkness — three «повержен» cards floating over the cut defeats the point of it.
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden px-2 md:px-4"
      // No entrance of its own. It used to fade in over a third of a second on top of the
      // veil's own fade, and the two together meant the better part of a second in which the
      // boss stood on a lit screen before anything started getting dark. Only the leaving is
      // animated here; the arriving belongs to the veil.
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* The dark goes all the way to black and stays. Left a few percent short, the fight
          screen kept showing through: the boss's own artwork is sitting right in the middle
          of it, and the win flash from the minion who just died fires underneath. The screen
          comes back on the way out, when the whole overlay fades. */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: [...VEIL_TRACK] }}
        transition={{
          duration: BOSS_INTRO_SEC,
          times: veilTimes(),
          ease: 'easeOut',
        }}
      />

      {/* Light from overhead, switched on by the word and turned up by the figure. */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #ef4444 -14%, #b91c1c 14%, rgba(127, 29, 29, 0.55) 34%, transparent 62%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [...TOPLIGHT] }}
        transition={{ duration: BOSS_INTRO_SEC, times: topLightTimes() }}
      />

      {/* The white-out. Two frames of this is worth any amount of decoration. */}
      {!calm && (
        <motion.div className="absolute inset-0 bg-arena-red" {...blink(LAND, impactTimes(LAND))} />
      )}

      {/* Tears across the picture — there and gone, never travelling. */}
      {!calm &&
        TEARS.slice(0, TEAR_COUNT).map((tear, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: tear.top,
            left: tear.left,
            width: tear.width,
            height: tear.height,
            rotate: -13,
            background:
              'linear-gradient(90deg, transparent 0%, #ef4444 12%, #fff5f5 48%, #ef4444 86%, transparent 100%)',
            clipPath: NEEDLE,
            filter: 'drop-shadow(0 0 12px #ef4444)',
          }}
            {...blink(tearAt(i), i === WORD_TEAR ? wordTearTimes() : undefined)}
          />
        ))}

      {/* Sparks struck all over the frame on the first blow. Scattered rather than radiating
          from one point: a dozen lines out of the middle makes a star, and a star sitting in
          the centre of the composition is the one thing in here you cannot look away from. */}
      {!calm &&
        Array.from({ length: SHARD_COUNT }, (_, i) => (
        <motion.div
          key={`shard-${i}`}
          className="absolute h-[3px] origin-left rounded-full"
          style={{
            left: `${shardSpot(i).left}%`,
            top: `${shardSpot(i).top}%`,
            width: 34,
            rotate: shardAngle(i),
            background: 'linear-gradient(90deg, #fff5f5, #ef4444 55%, transparent)',
            boxShadow: '0 0 14px #ef4444',
          }}
          initial={{ opacity: 0, x: 0 }}
          animate={{
            opacity: [...SHARD_OPACITY],
            x: [0, 0, 0, shardReach(i), shardReach(i)],
          }}
            transition={{
              duration: BOSS_INTRO_SEC,
              times: shardTimes(i),
              ease: 'easeOut',
            }}
          />
        ))}

      {/* A ring of pushed air on the second. The one thing here that grows across the frame,
          which is exactly the gesture the setting is asking about — so it goes first. */}
      {!calm && (
        <motion.div
          className="absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-arena-red"
          style={{ boxShadow: '0 0 40px #ef4444, inset 0 0 40px #ef4444' }}
          initial={{ opacity: 0, scale: WAVE_SCALE[0] }}
          animate={{ opacity: [...WAVE_OPACITY], scale: [...WAVE_SCALE] }}
          transition={{
            duration: BOSS_INTRO_SEC,
            times: waveTimes(),
            ease: 'easeOut',
          }}
        />
      )}

      {/* Knocked sideways on each landing. Decoration can only suggest force; moving the
          picture is force. */}
      <motion.div
        className="relative w-full"
        animate={calm ? undefined : { x: [...JOLT_X] }}
        transition={{
          duration: BOSS_INTRO_SEC,
          times: joltTimes(),
          ease: 'easeOut',
        }}
      >
        <div
          // Side by side where there is room for it. On a phone the two of them in one row
          // left each about a hundred and fifty pixels, which is not an entrance — so they
          // stack, each still pinned to the side it came from, and each gets twice the size.
          // The gap on a phone is what keeps the picture clear of the name. At four pixels
          // the artwork's box started above the name's, and only the transparent margin at
          // the top of the figure hid it — a boss drawn tight to the edge of his picture
          // would have had the name across his head.
          className="relative mx-auto flex w-full max-w-5xl flex-col items-stretch gap-5 md:flex-row md:items-center md:justify-center md:gap-10"
        >
          {/* The word and the slow line share a slot, so the line can start exactly where
              the word starts instead of at some share of the screen that happens to look
              right at one size. The slot itself never moves — the slide lives on the word,
              and a line that flew in with it would not be a slow line. */}
          <div className="shrink-0 self-start md:self-auto">
            <div className="relative">
              <motion.p
                // Tipped back to the left, so it reads as stamped onto the screen rather than
                // set in it. The tilt is fixed — the entrance is the slide, nothing else moves.
                className="block text-[clamp(3.2rem,22vw,8.75rem)] font-black leading-none tracking-[0.06em] text-arena-red"
                // The letters are painted by a gradient rather than a colour, so a highlight can
                // be slid across them. `color: transparent` is what lets the fill show through
                // the glyphs; the drop-shadow below still reads the shape, so the glow survives.
                style={{
                  rotate: -13,
                  backgroundImage:
                    'linear-gradient(100deg, #e03030 0%, #ef4444 32%, #ffe3e3 48%, #ff8a8a 56%, #ef4444 72%, #e03030 100%)',
                  backgroundSize: '240% 100%',
                  backgroundRepeat: 'no-repeat',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  // Not `color: transparent`: anything that cannot clip a background to text
                  // ignores this one and falls back to the class's red, instead of rendering
                  // nothing at all.
                  WebkitTextFillColor: 'transparent',
                }}
                initial={word.initial}
                animate={{
                  ...word.animate,
                  // The shine is kept in the quiet version: it is a highlight crossing the
                  // letters, a couple of hundred pixels of gradient, and nothing about it
                  // travels across the visual field.
                  backgroundPosition: [SHINE_FROM, SHINE_TO],
                  filter: calm ? CALM_GLOW : WORD_GLOW,
                }}
                transition={{
                  ...word.transition,
                  // Its own clock: one unhurried pass, started once the word is in place.
                  backgroundPosition: {
                    duration: SHINE_SEC,
                    delay: SHINE_DELAY_SEC,
                    ease: 'easeInOut',
                  },
                }}
              >
                BOSS
              </motion.p>

              {/* The same stroke as the rest, only unhurried: it fades up where it lies and
              stays for as long as the shine takes to cross the letters. */}
              <motion.div
                className="absolute"
                style={{
                  left: 0,
                  // Just under the word, a touch wider than it, and stopping short of the
                  // artwork — the line belongs to the word, and one that runs into the
                  // picture belongs to neither.
                  top: '100%',
                  width: '105%',
                  height: 6,
                  rotate: -13,
                  background:
                    'linear-gradient(90deg, #ef4444 0%, #ffc2c2 46%, #ef4444 74%, transparent 100%)',
                  clipPath: NEEDLE,
                  filter: 'drop-shadow(0 0 9px #ef4444)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [...SLOW_OPACITY] }}
                transition={{
                  duration: BOSS_INTRO_SEC,
                  times: slowLineTimes(),
                  ease: 'easeInOut',
                }}
              />
            </div>

            {/* The name sits under the word, as the title under a poster — and arrives with
                everything else rather than turning up afterwards. The nudge lives on a
                wrapper so the slide underneath can stay in viewport widths: framer cannot
                interpolate a track that mixes units. */}
            <div style={{ transform: `translateX(${nameNudge(wide)}px)` }}>
              <motion.p
                className="mt-8 truncate text-center text-lg font-black uppercase tracking-[0.18em] text-arena-text md:mt-12 md:text-3xl"
                // Tilted to match the word, and turned about its own middle like the word
                // is. Hinged on the left end instead, the rotation drags the centred text a
                // few pixels left of the word's centre, and lifts it by nearly fifty.
                style={{ rotate: -13 }}
                initial={name.initial}
                animate={name.animate}
                transition={name.transition}
              >
                {boss.name}
              </motion.p>
            </div>
          </div>

          <motion.div
            // Centred under the name on a phone, beside the word where there is room for a
            // row. Pinned to the right edge it sat level with the name rather than below it,
            // and the two read as one lopsided block with the screen empty underneath.
            className="flex min-w-0 flex-col items-center self-center md:self-auto"
            initial={figure.initial}
            animate={figure.animate}
            transition={figure.transition}
          >
            {/* A dark bed under the artwork.

                The picture's own edges are dissolved into transparency so it has no frame,
                which works over black and fails over anything bright: with the red light
                pouring down, the lit screen came through those edges and the figure looked
                as though its top had been sliced off. The bed is what the picture sits on,
                so however strong the light gets, it never shines through the thing it is
                supposed to be lighting. */}
            <span className="relative flex items-center justify-center">
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-x-10 -inset-y-6"
                style={{
                  background:
                    'radial-gradient(ellipse 54% 56% at 50% 48%, rgba(0, 0, 0, 0.96) 0%, rgba(0, 0, 0, 0.9) 52%, transparent 82%)',
                }}
              />
              <BossIcon boss={boss} index={index} size={size} maxWidth={size} ratio={1.05} bare />
            </span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
