import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';

/**
 * A boss saying his line, made visible. `talk` is the line's loudness, 0..1, updated every frame
 * by the fight screen; everything here follows it, so the boss moves with what he actually says.
 *
 * Layered so it reads at a glance, from a phone on the floor:
 *  - the figure itself hops and squashes on each loud syllable, like a cartoon shouting;
 *  - a big halo in the stage colour breathes behind him;
 *  - a ring goes out from him on every new syllable, like a sound wave;
 *  - a comic speech bubble with a jumping equaliser sits at his shoulder while he talks.
 */
export function BossTalk({
  talk,
  active,
  color,
  children,
}: {
  talk: MotionValue<number>;
  /** His line is playing (or about to). Off the moment it ends. */
  active: boolean;
  color: string;
  children: ReactNode;
}) {
  // The figure: up, wider-and-shorter then taller-and-thinner, and a wobble.
  const y = useTransform(talk, (v) => -v * 22);
  const scaleX = useTransform(talk, (v) => 1 + v * 0.1);
  const scaleY = useTransform(talk, (v) => 1 + v * 0.2);
  const rotate = useTransform(talk, (v) => Math.sin(performance.now() / 70) * v * 7);
  const glow = useTransform(
    talk,
    (v) => `drop-shadow(0 0 ${Math.round(6 + v * 30)}px ${color}${hex(Math.min(1, v * 1.4))})`,
  );

  const bubbleScale = useTransform(talk, (v) => 1 + v * 0.3);
  const bubbleTilt = useTransform(talk, (v) => Math.sin(performance.now() / 110) * v * 6);
  const bubbleGlow = useTransform(
    talk,
    (v) => `0 6px 18px rgba(0,0,0,0.5), 0 0 ${Math.round(4 + v * 26)}px ${color}${hex(Math.min(1, 0.3 + v))}`,
  );

  const haloOpacity = useTransform(talk, (v) => Math.min(0.9, v * 1.3));
  const haloScale = useTransform(talk, (v) => 0.75 + v * 0.55);

  // The bubble: up from his first syllable, gone the moment the line itself is over. Tied to
  // `active` (the line playing) rather than to loudness alone — after the last sound the level
  // stops changing at all, so a "quiet for a while" check never got the chance to fire and the
  // bubble hung there for the rest of the fight.
  const [heard, setHeard] = useState(false);
  if (!active && heard) setHeard(false);
  const speaking = active && heard;
  // Syllable onsets, for the rings: loudness crossing up through a threshold after a dip.
  const [rings, setRings] = useState<number[]>([]);
  const armed = useRef(true);
  const lastRing = useRef(0);

  useMotionValueEvent(talk, 'change', (v) => {
    const now = performance.now();
    if (active && v > 0.12 && !heard) setHeard(true);
    if (v < 0.25) armed.current = true;
    else if (armed.current && v > 0.38 && now - lastRing.current > 160) {
      armed.current = false;
      lastRing.current = now;
      setRings((r) => [...r.slice(-4), now]);
    }
  });

  return (
    <div className="relative">
      {/* Halo, behind everything. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-12%] rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, ${color}cc 0%, ${color}55 40%, transparent 70%)`,
          opacity: haloOpacity,
          scale: haloScale,
        }}
      />

      {/* Sound-wave rings. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <AnimatePresence>
          {rings.map((id) => (
            <motion.span
              key={id}
              className="absolute aspect-square w-[55%] rounded-full border-4"
              style={{ borderColor: color, boxShadow: `0 0 18px ${color}` }}
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              onAnimationComplete={() => setRings((r) => r.filter((x) => x !== id))}
            />
          ))}
        </AnimatePresence>
      </div>

      <motion.div style={{ y, scaleX, scaleY, rotate, filter: glow, originY: 1 }}>{children}</motion.div>

      {/* Speech bubble with an equaliser in it. */}
      <AnimatePresence>
        {speaking && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute right-[2%] top-[2%] z-10"
            initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.3, rotate: 20 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            style={{ originX: 0, originY: 1 }}
          >
            {/* The bubble itself pulses with the voice too — swells and glows on the loud bits. */}
            <motion.div
              className="relative flex h-14 items-end gap-1 rounded-2xl border-[3px] bg-white px-3 pb-2.5 pt-2.5"
              style={{ borderColor: color, scale: bubbleScale, rotate: bubbleTilt, boxShadow: bubbleGlow, originX: 0, originY: 1 }}
            >
              {[0.55, 1, 0.75, 0.9, 0.6].map((k, i) => (
                <Bar key={i} talk={talk} weight={k} phase={i} color={color} />
              ))}
              {/* The bubble's tail, pointing down-left at him. */}
              <span
                className="absolute -bottom-[11px] left-4 h-5 w-5 rotate-45 border-b-[3px] border-r-[3px] bg-white"
                style={{ borderColor: color }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One equaliser bar: its height is the loudness, jittered so the bars don't move as one. */
function Bar({ talk, weight, phase, color }: { talk: MotionValue<number>; weight: number; phase: number; color: string }) {
  const height = useTransform(talk, (v) => {
    const wobble = 0.65 + 0.35 * Math.abs(Math.sin(performance.now() / (55 + phase * 17) + phase));
    return `${Math.max(14, Math.min(100, v * 140 * weight * wobble))}%`;
  });
  return <motion.span className="w-[7px] self-end rounded-full" style={{ height, background: color }} />;
}

/** 0..1 as a two-digit hex alpha. */
function hex(a: number): string {
  return Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');
}
