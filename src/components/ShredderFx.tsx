import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Shredder's stage, drawn the way the other bosses' things are — in CSS and SVG, no art files.
 *
 *  - {@link ShredderAmbient}: what's always on while he's up — his eyes burning red in the
 *    helmet and flaring on every blow, the Foot Clan's sign pulsing in the dark behind him,
 *    embers rising off the lanterns and petals drifting down.
 *  - {@link SoupPot}: the pot for "Суп из черепашек", heating up a notch with every rest.
 *  - {@link FootNinja}, {@link Turtle}, {@link Mouser}: the figures his scenes are made of
 *    (in AbilityScene).
 */

/** Where his eyes are in the artwork (10-stormborn.jpg), as % of its width and height. */
const EYES: [number, number][] = [
  [43.3, 18.6],
  [47.4, 18.6],
];

/** The Foot Clan's sign: a three-toed red foot, the toes as claws. */
export function FootEmblem({ size, color = '#dc2626' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <g fill={color}>
        <path d="M50 96 C30 96 22 80 26 66 C30 54 40 50 50 50 C60 50 70 54 74 66 C78 80 70 96 50 96 Z" />
        <path d="M50 6 C56 18 58 32 55 44 L45 44 C42 32 44 18 50 6 Z" />
        <path d="M18 18 C28 24 36 34 38 46 L29 50 C22 40 18 30 18 18 Z" />
        <path d="M82 18 C82 30 78 40 71 50 L62 46 C64 34 72 24 82 18 Z" />
      </g>
    </svg>
  );
}

export function ShredderAmbient({ active, hitId }: { active: boolean; hitId: number | null }) {
  const calm = useReducedMotion();
  const embers = useMemo(
    () => Array.from({ length: 9 }, () => ({ x: 8 + Math.random() * 84, s: 2 + Math.random() * 3, d: 3 + Math.random() * 3, delay: Math.random() * 5 })),
    [],
  );
  const petals = useMemo(
    () => Array.from({ length: 5 }, () => ({ x: Math.random() * 90, d: 6 + Math.random() * 4, delay: Math.random() * 8, rot: Math.random() * 360 })),
    [],
  );
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* The Foot's sign, faint in the sky over the pagodas, breathing. */}
          <motion.div
            className="absolute"
            style={{ left: '8%', top: '10%', width: '20%', mixBlendMode: 'screen' }}
            animate={calm ? { opacity: 0.22 } : { opacity: [0.12, 0.32, 0.12], scale: [1, 1.04, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div style={{ filter: 'drop-shadow(0 0 10px #ef4444)' }}>
              <FootEmblem size={80} />
            </div>
          </motion.div>

          {/* His eyes in the helmet: always smouldering, and flaring with every blow. */}
          {EYES.map(([x, y], i) => (
            <motion.span
              key={`${i}-${hitId ?? 'idle'}`}
              className="absolute block rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: 10,
                height: 6,
                marginLeft: -5,
                marginTop: -3,
                background: 'radial-gradient(circle, #fff 0%, #fca5a5 30%, #dc2626 70%)',
                boxShadow: '0 0 8px #ef4444, 0 0 18px #dc2626',
              }}
              initial={hitId != null && !calm ? { scale: 2.2, opacity: 1 } : false}
              animate={calm ? { opacity: 0.85 } : { scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          ))}

          {!calm &&
            embers.map((e, i) => (
              <motion.span
                key={`e${i}`}
                className="absolute block rounded-full"
                style={{ left: `${e.x}%`, bottom: '4%', width: e.s, height: e.s, background: '#fb923c', boxShadow: '0 0 6px #f97316' }}
                animate={{ y: [0, -140], x: [0, (i % 2 ? 1 : -1) * 14], opacity: [0, 1, 0] }}
                transition={{ duration: e.d, delay: e.delay, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
          {!calm &&
            petals.map((p, i) => (
              <motion.span
                key={`p${i}`}
                className="absolute block"
                style={{ left: `${p.x}%`, top: '-4%', width: 7, height: 5, borderRadius: '70% 0 70% 0', background: '#f9a8d4', opacity: 0.8 }}
                animate={{ y: [0, 260], x: [0, 40, 10, 50], rotate: [p.rot, p.rot + 360], opacity: [0, 0.85, 0.85, 0] }}
                transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: 'linear' }}
              />
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The pot for "Суп из черепашек", in the corner of his picture. Cold, it just sits there; each
 * rest lights the fire higher and sends up more steam, and the notch before it boils it rattles
 * and bubbles over. A turtle shell bobs in it, to say whose soup it is.
 */
export function SoupPot({ heat, of }: { heat: number; of: number }) {
  const calm = useReducedMotion();
  const hot = heat / of;
  const nearly = heat >= of - 1;
  return (
    <div aria-hidden className="pointer-events-none absolute z-10" style={{ left: '3%', bottom: '3%', width: 64 }}>
      {/* Steam: a wisp per notch of heat. */}
      {!calm &&
        Array.from({ length: heat }, (_, i) => (
          <motion.span
            key={i}
            className="absolute block rounded-full"
            style={{ left: 16 + i * 12, top: -6, width: 10, height: 18, background: 'rgba(226,232,240,0.55)', filter: 'blur(3px)' }}
            animate={{ y: [0, -34], scaleX: [1, 1.8], opacity: [0, 0.8, 0] }}
            transition={{ duration: 1.6, delay: i * 0.4, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      <motion.svg
        width={64}
        height={56}
        viewBox="0 0 64 56"
        animate={nearly && !calm ? { x: [0, -1.5, 1.5, -1, 0], rotate: [0, -2, 2, -1, 0] } : { x: 0, rotate: 0 }}
        transition={nearly ? { duration: 0.35, repeat: Infinity } : undefined}
      >
        {/* The fire under it, taller as it heats. */}
        {heat > 0 && (
          <motion.g
            style={{ transformOrigin: '32px 56px' }}
            animate={calm ? undefined : { scaleY: [0.85, 1.1, 0.9, 1.05, 0.85] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            <path d={`M18 56 C20 ${50 - hot * 8} 24 ${48 - hot * 10} 26 ${46 - hot * 12} C28 ${50 - hot * 6} 30 52 32 56 Z`} fill="#f97316" />
            <path d={`M28 56 C30 ${48 - hot * 10} 33 ${44 - hot * 12} 34 ${42 - hot * 14} C36 ${48 - hot * 8} 40 52 42 56 Z`} fill="#fb923c" />
            <path d={`M38 56 C40 ${50 - hot * 8} 43 ${48 - hot * 10} 45 ${46 - hot * 12} C46 ${50 - hot * 6} 47 53 48 56 Z`} fill="#fbbf24" />
          </motion.g>
        )}
        {/* The cauldron. */}
        <path d="M6 16 L58 16 C60 34 50 46 32 46 C14 46 4 34 6 16 Z" fill="#1f2937" stroke="#0b0c0f" strokeWidth={2} />
        <rect x={3} y={12} width={58} height={7} rx={3.5} fill="#374151" stroke="#0b0c0f" strokeWidth={2} />
        {/* The soup, greener the hotter it is. */}
        <ellipse cx={32} cy={15} rx={25} ry={3.5} fill={heat ? '#65a30d' : '#3f6212'} />
        {/* The shell bobbing in it. */}
        <motion.g animate={calm ? undefined : { y: [0, -1.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <ellipse cx={40} cy={13} rx={7} ry={4} fill="#4d7c0f" stroke="#1a2e05" strokeWidth={1.2} />
          <path d="M35 13 L45 13 M40 9.5 L40 16.5" stroke="#1a2e05" strokeWidth={1} />
        </motion.g>
        {nearly && !calm && (
          <>
            <motion.circle cx={20} cy={14} r={2} fill="#a3e635" animate={{ y: [0, -6], opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} />
            <motion.circle cx={28} cy={14} r={1.5} fill="#a3e635" animate={{ y: [0, -8], opacity: [1, 0] }} transition={{ duration: 0.6, delay: 0.2, repeat: Infinity }} />
          </>
        )}
      </motion.svg>
      <div
        className="mx-auto -mt-0.5 w-fit rounded-full border px-1.5 text-[10px] font-bold leading-tight"
        style={{ borderColor: nearly ? '#ef4444' : '#4d7c0f', color: nearly ? '#fca5a5' : '#bef264', background: 'rgba(0,0,0,0.6)' }}
      >
        🍲 {heat}/{of}
      </div>
    </div>
  );
}

/** A Foot Clan ninja: black gi, a slit of eyes, the red foot on the chest. */
export function FootNinja({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 80 100" aria-hidden>
      <rect x={30} y={70} width={8} height={26} rx={3} fill="#111827" />
      <rect x={42} y={70} width={8} height={26} rx={3} fill="#111827" />
      <path d="M22 40 L58 40 L54 74 L26 74 Z" fill="#1f2937" />
      <rect x={24} y={60} width={32} height={5} fill="#4c1d95" />
      <rect x={10} y={42} width={14} height={7} rx={3.5} fill="#1f2937" transform="rotate(-25 17 45)" />
      <rect x={56} y={42} width={14} height={7} rx={3.5} fill="#1f2937" transform="rotate(25 63 45)" />
      <circle cx={40} cy={24} r={16} fill="#111827" />
      <rect x={27} y={20} width={26} height={7} rx={3} fill="#e5e7eb" />
      <circle cx={34} cy={23.5} r={2} fill="#111827" />
      <circle cx={46} cy={23.5} r={2} fill="#111827" />
      <path d="M53 14 C62 10 66 14 70 8" stroke="#111827" strokeWidth={3} fill="none" strokeLinecap="round" />
      <g transform="translate(33 46) scale(0.14)">
        <path d="M50 96 C30 96 22 80 26 66 C30 54 40 50 50 50 C60 50 70 54 74 66 C78 80 70 96 50 96 Z M50 6 C56 18 58 32 55 44 L45 44 C42 32 44 18 50 6 Z M18 18 C28 24 36 34 38 46 L29 50 C22 40 18 30 18 18 Z M82 18 C82 30 78 40 71 50 L62 46 C64 34 72 24 82 18 Z" fill="#dc2626" />
      </g>
    </svg>
  );
}

/** A turtle mid-run: green, shell on his back, his bandana's tails streaming behind. */
export function Turtle({ size, bandana }: { size: number; bandana: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden>
      <path d="M14 22 C6 20 2 26 0 22 M14 25 C8 28 4 32 0 30" stroke={bandana} strokeWidth={3} fill="none" strokeLinecap="round" />
      <rect x={24} y={58} width={9} height={18} rx={4} fill="#4d7c0f" transform="rotate(20 28 66)" />
      <rect x={44} y={58} width={9} height={18} rx={4} fill="#4d7c0f" transform="rotate(-25 48 66)" />
      <ellipse cx={34} cy={46} rx={18} ry={16} fill="#78350f" stroke="#451a03" strokeWidth={2} />
      <ellipse cx={42} cy={46} rx={11} ry={13} fill="#fde68a" stroke="#a16207" strokeWidth={1.5} />
      <rect x={54} y={36} width={16} height={8} rx={4} fill="#65a30d" transform="rotate(-20 62 40)" />
      <circle cx={40} cy={22} r={14} fill="#65a30d" stroke="#365314" strokeWidth={1.5} />
      <rect x={24} y={17} width={31} height={8} rx={3} fill={bandana} />
      <circle cx={42} cy={21} r={2.6} fill="#fff" />
      <circle cx={50} cy={21} r={2.6} fill="#fff" />
      <path d="M40 29 Q47 33 53 28" stroke="#1a2e05" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** One of Stockman's mousers: a grey box of a robot that's mostly jaw, on two little legs. */
export function Mouser({ size, bite }: { size: number; bite: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden>
      <rect x={18} y={44} width={5} height={14} rx={2} fill="#4b5563" />
      <rect x={36} y={44} width={5} height={14} rx={2} fill="#4b5563" />
      <rect x={10} y={8} width={40} height={20} rx={5} fill="#9ca3af" stroke="#374151" strokeWidth={2} />
      <circle cx={22} cy={16} r={3.5} fill="#ef4444" />
      <motion.g
        style={{ transformOrigin: '10px 28px' }}
        animate={{ rotate: [0, 22, 0] }}
        transition={{ duration: 0.22, delay: bite, repeat: Infinity }}
      >
        <rect x={10} y={28} width={40} height={16} rx={4} fill="#6b7280" stroke="#374151" strokeWidth={2} />
        <path d="M14 28 L18 33 L22 28 L26 33 L30 28 L34 33 L38 28 L42 33 L46 28" stroke="#f3f4f6" strokeWidth={2} fill="none" />
      </motion.g>
      <path d="M14 28 L18 23 L22 28 L26 23 L30 28 L34 23 L38 28 L42 23 L46 28" stroke="#f3f4f6" strokeWidth={2} fill="none" />
    </svg>
  );
}
