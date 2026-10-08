import { motion, useReducedMotion } from 'framer-motion';

/**
 * A Roman legionary doing push-ups, for the top of the "how to play" sheet. Drawn, not
 * photographed: side view, the same angle the camera wants — so it doubles as a picture of
 * where to put the phone.
 *
 * Everything that belongs to the body moves on one clock with the body: the limbs are paths
 * whose two poses share a shape, so they interpolate cleanly, and the pieces that ride on him
 * (helmet, skirt, cape) are shifted by the same distance as the joint they hang from. The crest
 * and the cape lag a beat behind, which is what makes them read as horsehair and cloth.
 */

// Joints, top and bottom of the rep.
const UP = { hip: [56, 45], shoulder: [94, 33], head: [104, 26] } as const;
const DOWN = { hip: [56, 51], shoulder: [94, 47], head: [105, 42] } as const;

const LEGS_UP = 'M16 58 L56 45';
const LEGS_DOWN = 'M16 58 L56 51';
const TORSO_UP = 'M54 46 L95 32';
const TORSO_DOWN = 'M54 52 L95 46';
const ARM_UP = 'M93 34 L95 46 L97 58';
const ARM_DOWN = 'M93 47 L83 50 L97 58';
// The cape, from the shoulders back along the spine; at the bottom it bunches and lifts.
const CAPE_UP = 'M92 30 Q76 22 60 34 Q72 36 90 35 Z';
const CAPE_DOWN = 'M92 44 Q78 36 60 41 Q74 46 90 48 Z';
const CAPE_FLUTTER = 'M92 37 Q74 26 58 35 Q72 41 90 41 Z';

const CYCLE = 1.4;
const TIMES = [0, 0.45, 0.55, 1];

const BRONZE = '#d4943a';
const BRONZE_DARK = '#8a5a1c';
const SKIN = '#f5b267';
const RED = '#ef4444';
const RED_DARK = '#b91c1c';

export function PushupGuy({ className }: { className?: string }) {
  const calm = useReducedMotion();
  /** Top → bottom → hold → top, or just the top pose under reduced motion. */
  const loop = <T,>(up: T, down: T) => (calm ? up : [up, down, down, up]);
  const t = { duration: CYCLE, repeat: Infinity, ease: 'easeInOut' as const, times: TIMES };
  // Pieces that hang off a joint move by that joint's travel.
  const ride = (from: readonly number[], to: readonly number[]) =>
    calm ? {} : { x: [0, to[0] - from[0], to[0] - from[0], 0], y: [0, to[1] - from[1], to[1] - from[1], 0] };

  return (
    <svg viewBox="0 0 140 66" className={className} aria-hidden>
      <defs>
        <radialGradient id="lg-ground">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sand, lit. */}
      <ellipse cx="66" cy="60" rx="62" ry="5" fill="url(#lg-ground)" />
      <line x1="4" y1="59" x2="136" y2="59" stroke="var(--color-arena-border)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Spear and shield planted in the sand beside him. */}
      <line x1="118" y1="8" x2="121" y2="59" stroke={BRONZE_DARK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M118 8 L116 2 L120 7 Z" fill="#e5e7eb" />
      <g transform="rotate(-6 128 46)">
        <rect x="122" y="32" width="13" height="26" rx="3" fill={RED} stroke={BRONZE} strokeWidth="1.2" />
        <line x1="128.5" y1="33" x2="128.5" y2="57" stroke={BRONZE} strokeWidth="0.8" />
        <circle cx="128.5" cy="45" r="2.4" fill={BRONZE} />
      </g>

      {/* Cape — behind the body, lagging and fluttering. */}
      <motion.path
        fill={RED_DARK}
        initial={{ d: CAPE_UP }}
        animate={{ d: calm ? CAPE_UP : [CAPE_UP, CAPE_FLUTTER, CAPE_DOWN, CAPE_FLUTTER, CAPE_UP] }}
        transition={{ duration: CYCLE, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.5, 0.75, 1] }}
      />

      {/* Legs, with greaves. */}
      <motion.path
        fill="none"
        stroke={SKIN}
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ d: LEGS_UP }}
        animate={{ d: loop(LEGS_UP, LEGS_DOWN) }}
        transition={t}
      />
      <motion.path
        fill="none"
        stroke={BRONZE_DARK}
        strokeWidth="5.5"
        strokeLinecap="butt"
        strokeDasharray="0 6 10 100"
        initial={{ d: LEGS_UP }}
        animate={{ d: loop(LEGS_UP, LEGS_DOWN) }}
        transition={t}
      />

      {/* Skirt of leather strips, hanging from the hip. */}
      <motion.g animate={ride(UP.hip, DOWN.hip)} transition={t}>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={52 + i * 3}
            y1={47 - i}
            x2={51 + i * 3}
            y2={54 - i}
            stroke={RED_DARK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ))}
      </motion.g>

      {/* Torso in segmented armour: bronze, banded by a dashed darker stroke on top. */}
      <motion.path
        fill="none"
        stroke={BRONZE}
        strokeWidth="9"
        strokeLinecap="round"
        initial={{ d: TORSO_UP }}
        animate={{ d: loop(TORSO_UP, TORSO_DOWN) }}
        transition={t}
      />
      <motion.path
        fill="none"
        stroke={BRONZE_DARK}
        strokeWidth="9"
        strokeDasharray="1.2 4.5"
        initial={{ d: TORSO_UP }}
        animate={{ d: loop(TORSO_UP, TORSO_DOWN) }}
        transition={t}
      />

      {/* Arm. */}
      <motion.path
        fill="none"
        stroke={SKIN}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ d: ARM_UP }}
        animate={{ d: loop(ARM_UP, ARM_DOWN) }}
        transition={t}
      />

      {/* Head and helmet ride together; the crest springs a beat late. */}
      <motion.g animate={ride(UP.head, DOWN.head)} transition={t}>
        <circle cx={UP.head[0]} cy={UP.head[1]} r="5.5" fill={SKIN} />
        {/* The crest goes on first, so the bowl drawn over it hides its root: seated on the
            helmet, not floating above it. Its lower edge follows the bowl's curve. */}
        <motion.path
          d="M99 23 Q104.5 17.5 110 23 Q113.5 12 104 10.5 Q96.5 11.5 99 23 Z"
          fill={RED}
          stroke={RED_DARK}
          strokeWidth="0.6"
          // Pivots at its own base, as a share of its own box — framer measures SVG origins from
          // the element's box, so viewBox coordinates here threw the crest off the helmet.
          style={{ originX: 0.5, originY: 1 }}
          animate={calm ? {} : { rotate: [0, 8, -6, 3, 0], scaleY: [1, 0.85, 1.12, 0.96, 1] }}
          transition={{ duration: CYCLE, repeat: Infinity, ease: 'easeOut', times: [0, 0.5, 0.62, 0.8, 1] }}
        />
        {/* Bowl, brim and cheek guard. */}
        <path d="M98 26 A6.5 6.5 0 0 1 111 26 Z" fill={BRONZE} />
        <rect x="97" y="25.2" width="15" height="1.8" rx="0.9" fill={BRONZE_DARK} />
        <path d="M106 26 L109 26 L108 31 L106 30 Z" fill={BRONZE} />
      </motion.g>

      {/* A puff of effort at the top of every rep. */}
      {!calm && (
        <motion.text
          x="82"
          y="16"
          fontSize="9"
          fontWeight="800"
          fill="var(--color-arena-amber)"
          animate={{ opacity: [0, 0, 1, 0], y: [16, 16, 12, 8] }}
          transition={{ duration: CYCLE, repeat: Infinity, times: [0, 0.8, 0.9, 1] }}
        >
          +1
        </motion.text>
      )}
    </svg>
  );
}
