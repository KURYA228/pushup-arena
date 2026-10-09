import { useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * A Roman legionary doing push-ups. Drawn, not photographed: side view, the same angle the
 * camera wants — so it doubles as a picture of where to put the phone.
 *
 * Three ways to run him:
 *  - `loop` (default): push-ups on his own, for the "how to play" sheet;
 *  - `follow`: copies you — `depth` comes from the camera, so he goes down when you do;
 *  - `sleep`: flat on the sand with Zs floating up, while there's nobody to copy.
 *
 * Everything that belongs to the body moves with the body: the limbs are paths whose two poses
 * share a shape, so they interpolate cleanly, and the pieces that ride on him (helmet, skirt) are
 * shifted by the same distance as the joint they hang from. The crest and the cape lag a beat
 * behind, which is what makes them read as horsehair and cloth.
 */

// Joints, top and bottom of the rep, and lying asleep.
const UP = { hip: [56, 45], head: [104, 26] } as const;
const DOWN = { hip: [56, 51], head: [105, 42] } as const;
const SLEEP = { hip: [56, 55], head: [106, 50] } as const;

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
// Asleep: stretched out flat on the sand, cheek on a folded arm, the cape pulled over his back
// like a blanket. Same shapes as the other poses, so he can sink into it smoothly.
const LEGS_SLEEP = 'M16 57 L56 55';
const TORSO_SLEEP = 'M54 55 L95 53';
const ARM_SLEEP = 'M93 54 L104 57 L114 55';
const CAPE_SLEEP = 'M92 50 Q76 44 58 50 Q72 56 90 55 Z';

const CYCLE = 1.4;
const TIMES = [0, 0.45, 0.55, 1];

const BRONZE = '#d4943a';
const BRONZE_DARK = '#8a5a1c';
const SKIN = '#f5b267';
const RED = '#ef4444';
const RED_DARK = '#b91c1c';

/** The path between two poses: every number in `a` moved `t` of the way to its twin in `b`. */
function lerpPath(a: string, b: string, t: number): string {
  const nb = b.match(/-?\d+(\.\d+)?/g)!.map(Number);
  let i = 0;
  return a.replace(/-?\d+(\.\d+)?/g, (m) => {
    const v = Number(m) + (nb[i++] - Number(m)) * t;
    return String(Math.round(v * 100) / 100);
  });
}

export type GuyMode = 'loop' | 'follow' | 'sleep';

export function PushupGuy({
  className,
  mode = 'loop',
  depth = 0,
  repKey = 0,
  quip,
  bare = false,
}: {
  className?: string;
  mode?: GuyMode;
  /** Just him — no spear and shield beside him, cropped tight so he can be drawn bigger. */
  bare?: boolean;
  /** 0 = arms straight, 1 = chest down. Used in `follow`. */
  depth?: number;
  /** Changes on every counted rep: the crest bounces and "+1" floats up. */
  repKey?: number;
  /** A one-liner to say on this rep, in a bubble. */
  quip?: string;
}) {
  const calm = useReducedMotion();
  const groundId = useId();
  const looping = mode === 'loop' && !calm;
  const sleeping = mode === 'sleep';
  // How far down he is when copying you.
  const d = mode === 'follow' ? Math.min(1, Math.max(0, depth)) : 0;

  const loopT = { duration: CYCLE, repeat: Infinity, ease: 'easeInOut' as const, times: TIMES };
  const followT = { type: 'spring' as const, stiffness: 300, damping: 28 };
  const t = looping ? loopT : followT;

  /** A pose value: looping keyframes, asleep, or a single point between top and bottom. */
  const path = (up: string, down: string, sleep: string) =>
    looping ? [up, down, down, up] : sleeping ? sleep : lerpPath(up, down, d);
  // Pieces that hang off a joint move by that joint's travel.
  const ride = (from: readonly number[], to: readonly number[], rest: readonly number[]) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    if (looping) return { x: [0, dx, dx, 0], y: [0, dy, dy, 0] };
    if (sleeping) return { x: rest[0] - from[0], y: rest[1] - from[1] };
    return { x: dx * d, y: dy * d };
  };

  return (
    // Bare, the box is cropped to him alone, so the same space draws him bigger.
    <svg viewBox={bare ? '10 6 110 56' : '0 0 140 66'} className={className} aria-hidden overflow="visible">
      <defs>
        <radialGradient id={groundId}>
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sand, lit. */}
      <ellipse cx="66" cy="60" rx="62" ry="5" fill={`url(#${groundId})`} />
      <line x1="4" y1="59" x2="136" y2="59" stroke="var(--color-arena-border)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Spear and shield planted in the sand beside him. */}
      {!bare && (
        <>
          <line x1="118" y1="8" x2="121" y2="59" stroke={BRONZE_DARK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M118 8 L116 2 L120 7 Z" fill="#e5e7eb" />
          <g transform="rotate(-6 128 46)">
            <rect x="122" y="32" width="13" height="26" rx="3" fill={RED} stroke={BRONZE} strokeWidth="1.2" />
            <line x1="128.5" y1="33" x2="128.5" y2="57" stroke={BRONZE} strokeWidth="0.8" />
            <circle cx="128.5" cy="45" r="2.4" fill={BRONZE} />
          </g>
        </>
      )}

      {/* Everything that is him, so sleep can breathe the whole body at once. */}
      <motion.g
        animate={sleeping && !calm ? { y: [0, -0.9, 0] } : { y: 0 }}
        transition={sleeping ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
      >

      {/* Cape — behind the body, lagging and fluttering. */}
      <motion.path
        fill={RED_DARK}
        initial={{ d: CAPE_UP }}
        animate={{
          d: looping
            ? [CAPE_UP, CAPE_FLUTTER, CAPE_DOWN, CAPE_FLUTTER, CAPE_UP]
            : sleeping
              ? CAPE_SLEEP
              : lerpPath(CAPE_UP, CAPE_DOWN, d),
        }}
        transition={
          looping
            ? { duration: CYCLE, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.5, 0.75, 1] }
            : { type: 'spring', stiffness: 120, damping: 14 }
        }
      />

      {/* Legs, with greaves. */}
      <motion.path
        fill="none"
        stroke={SKIN}
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ d: LEGS_UP }}
        animate={{ d: path(LEGS_UP, LEGS_DOWN, LEGS_SLEEP) }}
        transition={t}
      />
      <motion.path
        fill="none"
        stroke={BRONZE_DARK}
        strokeWidth="5.5"
        strokeLinecap="butt"
        strokeDasharray="0 6 10 100"
        initial={{ d: LEGS_UP }}
        animate={{ d: path(LEGS_UP, LEGS_DOWN, LEGS_SLEEP) }}
        transition={t}
      />

      {/* Skirt of leather strips, hanging from the hip. */}
      <motion.g animate={ride(UP.hip, DOWN.hip, SLEEP.hip)} transition={t}>
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
        animate={{ d: path(TORSO_UP, TORSO_DOWN, TORSO_SLEEP) }}
        transition={t}
      />
      <motion.path
        fill="none"
        stroke={BRONZE_DARK}
        strokeWidth="9"
        strokeDasharray="1.2 4.5"
        initial={{ d: TORSO_UP }}
        animate={{ d: path(TORSO_UP, TORSO_DOWN, TORSO_SLEEP) }}
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
        animate={{ d: path(ARM_UP, ARM_DOWN, ARM_SLEEP) }}
        transition={t}
      />

      {/* Head and helmet ride together; the crest springs a beat late. */}
      <motion.g
        // Asleep, the head turns down onto the folded arm, so the crest points forward
        // along the sand instead of standing up like he's on parade.
        animate={{ ...ride(UP.head, DOWN.head, SLEEP.head), rotate: sleeping ? 75 : 0 }}
        transition={t}
      >
        <circle cx={UP.head[0]} cy={UP.head[1]} r="5.5" fill={SKIN} />
        {/* The crest goes on first, so the bowl drawn over it hides its root: seated on the
            helmet, not floating above it. Its lower edge follows the bowl's curve. */}
        <motion.path
          // Re-keyed per rep in `follow`, so each counted rep replays the bounce once.
          key={mode === 'follow' ? repKey : 'crest'}
          d="M99 23 Q104.5 17.5 110 23 Q113.5 12 104 10.5 Q96.5 11.5 99 23 Z"
          fill={RED}
          stroke={RED_DARK}
          strokeWidth="0.6"
          // Pivots at its own base, as a share of its own box — framer measures SVG origins from
          // the element's box, so viewBox coordinates here threw the crest off the helmet.
          style={{ originX: 0.5, originY: 1 }}
          animate={
            calm || mode === 'sleep' || (mode === 'follow' && repKey === 0)
              ? {}
              : { rotate: [0, 8, -6, 3, 0], scaleY: [1, 0.85, 1.12, 0.96, 1] }
          }
          transition={
            looping
              ? { duration: CYCLE, repeat: Infinity, ease: 'easeOut', times: [0, 0.5, 0.62, 0.8, 1] }
              : { duration: 0.6, ease: 'easeOut' }
          }
        />
        {/* Bowl, brim and cheek guard. */}
        <path d="M98 26 A6.5 6.5 0 0 1 111 26 Z" fill={BRONZE} />
        <rect x="97" y="25.2" width="15" height="1.8" rx="0.9" fill={BRONZE_DARK} />
        <path d="M106 26 L109 26 L108 31 L106 30 Z" fill={BRONZE} />
      </motion.g>

      </motion.g>

      {/* A puff of effort: on every loop, or on each rep he copies from you. */}
      {looping && (
        <motion.text
          x="82"
          y="16"
          fontSize="9"
          fontWeight="800"
          fill="var(--color-arena-amber)"
          // An offset from y=16 (see the Zs below for why it isn't a position).
          animate={{ opacity: [0, 0, 1, 0], y: [0, 0, -4, -8] }}
          transition={{ duration: CYCLE, repeat: Infinity, times: [0, 0.8, 0.9, 1] }}
        >
          +1
        </motion.text>
      )}
      <AnimatePresence>
        {mode === 'follow' && repKey > 0 && !calm && (
          <motion.g
            key={repKey}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: [0, 1, 1, 0], y: [4, -2, -4, -8] }}
            transition={{ duration: 1.6, times: [0, 0.1, 0.75, 1] }}
          >
            <text x="104" y="14" fontSize="11" fontWeight="800" fill="var(--color-arena-amber)">
              +1
            </text>
            {quip && (
              <text x="66" y="5" fontSize="10" fontWeight="700" textAnchor="middle" fill="var(--color-arena-text)">
                {quip}
              </text>
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* Asleep: Zs rising out of his head, each one growing as it goes up and fading at its
          biggest — like rings spreading out — staggered so there's always one on the way. */}
      {sleeping &&
        !calm &&
        [0, 1, 2].map((i) => (
          <motion.text
            key={i}
            x={SLEEP.head[0]}
            y={SLEEP.head[1] - 6}
            textAnchor="middle"
            fontSize={10}
            fontWeight="900"
            fill="#c7d2fe"
            style={{ originX: 0.5, originY: 0.5, filter: 'drop-shadow(0 0 3px rgba(199, 210, 254, 0.6))' }}
            initial={{ opacity: 0, scale: 0.5 }}
            // Offsets, not positions: on SVG, framer's x/y are a translate added to the x/y
            // attributes above. Animating them to the head's coordinates doubled them and threw
            // the Zs clean off the side of the screen.
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1, 1.8, 2.6],
              x: [0, 2, 5, 9],
              y: [0, -10, -22, -34],
            }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: 'easeOut', times: [0, 0.2, 0.65, 1] }}
          >
            z
          </motion.text>
        ))}
    </svg>
  );
}
