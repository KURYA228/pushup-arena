import { useMemo, useRef } from 'react';
import { motion, useAnimationFrame, useMotionValue, useTransform } from 'framer-motion';
import { Heart } from 'lucide-react';
import {
  BOSS_HEARTS,
  CYCLE_WIDTH,
  VISIBLE_CYCLES,
  beatPeriod,
  beatTrace,
  clamp01,
  heartKeyframes,
  heartsLeft,
  phrase,
  pulseColor,
  phraseWidth,
  ringKeyframes,
  sampleTrack,
} from '../lib/vitals';

/**
 * The enemy's vitals: hearts and a live trace, both driven by how much health is left.
 *
 * It's a health bar you read without reading. The hearts say how close he is, and the rhythm
 * says how hard he's working — slow and shallow at full strength, racing and jagged once he's
 * nearly done.
 *
 * Both halves run off the same {@link phrase}: a handful of beats that differ from each other
 * in spacing, size and shape, looped as a group. A single beat repeated forever is what this
 * replaced, and it read as a drawing on a conveyor belt rather than a heart.
 *
 * Everything here is animated off a phase we advance ourselves, one frame at a time. Handing
 * framer a looping animation with a duration looks simpler and was wrong: such a loop only
 * takes a new duration when its target changes, and neither the scroll nor the thumps had any
 * reason to change theirs — so the pulse stayed at whatever speed it happened to start at and
 * quietly ignored the enemy's health for the rest of the fight. Advancing a phase by hand
 * means a new tempo applies on the very next frame, from wherever the beat already is: no
 * restart, no jump.
 */

/** How long one whole phrase lasts, in seconds. */
function phraseSeconds(period: number, width: number) {
  return (period * width) / CYCLE_WIDTH;
}

/**
 * A 0..1 position within the phrase, advanced every frame at the current tempo.
 *
 * `seconds` is read through a ref so that changing it never restarts anything — the loop just
 * starts covering ground at a different speed.
 */
function usePhase(seconds: number, running = true) {
  const phase = useMotionValue(0);
  const pace = useRef(0);
  pace.current = running && seconds > 0 ? 1 / seconds : 0;

  useAnimationFrame((_, delta) => {
    if (!pace.current) return;
    const next = phase.get() + (pace.current * delta) / 1000;
    phase.set(next - Math.floor(next));
  });

  return phase;
}

/* ------------------------------- hearts -------------------------------- */

export function Heartbeat({
  pct,
  size = 26,
  hearts = BOSS_HEARTS,
}: {
  pct: number;
  size?: number;
  /** Three for a boss, one for a minion — see `BOSS_HEARTS` / `MINION_HEARTS`. */
  hearts?: number;
}) {
  const health = clamp01(pct / 100);
  const strain = 1 - health;
  const lit = heartsLeft(pct, hearts);

  // Rebuilt only when the strain changes; the phase that reads them carries on regardless.
  const { beat, ring, width } = useMemo(() => {
    const beats = phrase(strain);
    const w = phraseWidth(beats);
    return { beat: heartKeyframes(beats, w), ring: ringKeyframes(beats, w), width: w };
  }, [strain]);

  const phase = usePhase(phraseSeconds(beatPeriod(health), width));

  const scale = useTransform(phase, (p) => sampleTrack(beat.times, beat.scale, p));
  const scaleX = useTransform(phase, (p) => sampleTrack(beat.times, beat.scaleX, p));
  const filter = useTransform(phase, (p) => {
    const g = sampleTrack(beat.times, beat.glow, p);
    return `brightness(${1 + g * (0.25 + strain * 0.45)}) drop-shadow(0 0 ${g * (6 + strain * 8)}px #ef4444cc)`;
  });
  const ringScale = useTransform(phase, (p) => sampleTrack(ring.times, ring.scale, p));
  const ringOpacity = useTransform(
    phase,
    (p) => sampleTrack(ring.times, ring.opacity, p) * (0.4 + strain * 0.25),
  );

  return (
    <span className="flex items-center gap-2">
      {Array.from({ length: hearts }, (_, i) => {
        // The row empties from the right: the leftmost heart is the last one standing.
        const alive = i < lit;
        return (
          <span
            key={i}
            className="relative flex items-center justify-center"
            style={{ width: size, height: size }}
          >
            {alive && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border-2"
                // The ring reads the same traffic light as the trace: two colour systems on
                // one indicator would just be two things to interpret.
                style={{ borderColor: pulseColor(pct), scale: ringScale, opacity: ringOpacity }}
              />
            )}
            {alive ? (
              <motion.span key="live" className="relative" style={{ scale, scaleX, filter }}>
                <Heart size={size} className="fill-arena-red text-arena-red" />
              </motion.span>
            ) : (
              // A spent heart shrinks and greys out where it stood, instead of the row
              // silently reflowing — losing one should be something you notice.
              <motion.span
                key="gone"
                className="relative"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 0.7, opacity: 0.22, filter: 'grayscale(1) brightness(0.8)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <Heart size={size} className="text-arena-text-dim" />
              </motion.span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/* ----------------------------- cardiogram ------------------------------ */

/** A live trace beside the hearts: the same rhythm, but as a line you can read. */
export function PulseTrace({ pct }: { pct: number }) {
  const health = clamp01(pct / 100);
  const strain = 1 - health;
  const flat = pct <= 0;

  const { d, width } = useMemo(() => beatTrace(strain), [strain]);
  const span = width * 2;
  // Green, amber, red — see `pulseColor`. The stage's own colour is not used here any more.
  const stroke = pulseColor(pct);

  // One phrase along, the strip is a copy of where it started, so the wrap is invisible.
  const phase = usePhase(phraseSeconds(beatPeriod(health), width), !flat);
  const x = useTransform(phase, (p) => `${-50 * p}%`);

  return (
    // Capped and centred: stretched across a laptop-wide card, the beats spread out until the
    // rate stops being readable. At phone width the cap does nothing.
    //
    // Tall enough for the box to be worth filling. The waveform is drawn into 40 units of
    // height and stretched to whatever this is, so a short strip squashed a spike that on
    // paper reached the ceiling down into a few pixels of twitch.
    <span className="relative mx-auto block h-11 w-full max-w-sm overflow-hidden" aria-hidden>
      <motion.svg
        viewBox={`0 0 ${span} 40`}
        preserveAspectRatio="none"
        className="absolute inset-y-0 h-full"
        // Wide enough that the window holds `VISIBLE_CYCLES` beats at a time.
        style={{ width: `${(span / (VISIBLE_CYCLES * CYCLE_WIDTH)) * 100}%`, x }}
      >
        <path
          d={flat ? `M0 20 L${span} 20` : d}
          fill="none"
          stroke={stroke}
          strokeOpacity={flat ? 0.4 : 1}
          strokeWidth={1.5 + strain * 1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </motion.svg>
      {/* The trace fades out at both ends so it reads as a window onto something continuous. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, var(--color-arena-bg) 0%, transparent 12%, transparent 88%, var(--color-arena-bg) 100%)',
        }}
      />
    </span>
  );
}
