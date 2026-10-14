import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * The Green Goblin's stage, drawn the way the other bosses' things are — in CSS and SVG, no art
 * files.
 *
 *  - {@link GoblinAmbient}: what's always on while he's up — the pumpkin bomb in his hand
 *    flickering like a lit jack-o'-lantern, his monitors stuttering and sparks zapping off the
 *    cables.
 *  - {@link GliderFlyby}: now and then a little Goblin screams across on his glider, cackling,
 *    and lobs a pumpkin bomb that goes off with a «БАХ!».
 *  - {@link SpideyTeam}: once in a while, two Spider-Men drop in on their webs either side of him,
 *    point at each other — the meme — then both web him up and zip away.
 *  - {@link GoblinMini}, {@link JackO}, {@link SpiderMan}, {@link Web}: the figures those and his
 *    scenes are made of (in AbilityScene and HitFx).
 */

/** Where things are in his artwork (12-apex.jpg), as % of its width and height. */
const PUMPKIN: [number, number] = [75, 39];
const MONITORS: { x: number; y: number; w: number; h: number }[] = [
  { x: 3, y: 44, w: 11, h: 17 },
  { x: 20, y: 29, w: 9, h: 13 },
  { x: 85, y: 40, w: 10, h: 17 },
];

export function GoblinAmbient({ active }: { active: boolean }) {
  const calm = useReducedMotion();
  const zaps = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        x: i % 2 ? 88 + Math.random() * 8 : 2 + Math.random() * 10,
        y: 20 + Math.random() * 60,
        delay: Math.random() * 4,
        every: 2.5 + Math.random() * 3,
      })),
    [],
  );
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="goblin"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* The pumpkin in his hand, lit from inside and flickering. */}
          <motion.span
            className="absolute block rounded-full"
            style={{
              left: `${PUMPKIN[0]}%`,
              top: `${PUMPKIN[1]}%`,
              width: '22%',
              aspectRatio: '1',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(254,215,170,0.7) 0%, rgba(249,115,22,0.35) 30%, transparent 68%)',
              mixBlendMode: 'screen',
            }}
            animate={calm ? { opacity: 0.8 } : { opacity: [0.55, 1, 0.7, 0.95, 0.6], scale: [1, 1.1, 0.96, 1.06, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* The monitors stuttering. */}
          {MONITORS.map((m, i) => (
            <motion.span
              key={`m${i}`}
              className="absolute block"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.w}%`,
                height: `${m.h}%`,
                background: 'repeating-linear-gradient(180deg, rgba(134,239,172,0.35) 0 2px, transparent 2px 4px)',
                mixBlendMode: 'screen',
              }}
              animate={calm ? { opacity: 0.4 } : { opacity: [0.2, 0.6, 0.15, 0.5, 0.05, 0.45, 0.2] }}
              transition={{ duration: 1.7 + i * 0.4, repeat: Infinity, ease: 'linear' }}
            />
          ))}

          {/* Sparks zapping off the cables at the sides. */}
          {!calm &&
            zaps.map((z, i) => (
              <motion.span
                key={`z${i}`}
                className="absolute block"
                style={{ left: `${z.x}%`, top: `${z.y}%`, width: 26, height: 26, marginLeft: -13, marginTop: -13 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1.2, 0.6], rotate: [0, 40] }}
                transition={{ duration: 0.25, delay: z.delay, repeat: Infinity, repeatDelay: z.every }}
              >
                <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 4px #fbbf24)' }}>
                  <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="#fde68a" />
                </svg>
              </motion.span>
            ))}

        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** How long one glider pass takes (s), and when in it he lets the pumpkin go (fraction). */
const GLIDE_SEC = 2.2;
const DROP_AT = 0.42;
/** How long the pumpkin falls before it goes off (s). */
const FALL_SEC = 0.55;

/**
 * A little Goblin screaming across the top of the screen on his glider, cackling — and halfway
 * over, a pumpkin bomb dropped, tumbling down past the boss and going off in a «БАХ!». First one
 * a few seconds in, then every 6–10 s. `onPass` and `onBlast` are for the sounds. Nothing under
 * reduced motion.
 */
export function GliderFlyby({
  active,
  span,
  onPass,
  onBlast,
}: {
  active: boolean;
  /** Where the boss is on screen: the glider flies over his top, the bomb lands at his feet. */
  span: () => { top: number; bottom: number } | null;
  onPass: () => void;
  onBlast: () => void;
}) {
  const calm = useReducedMotion();
  const [pass, setPass] = useState<{ id: number; dir: -1 | 1; top: number; floor: number; dropX: number } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        const s = span();
        const dir = Math.random() < 0.5 ? -1 : 1;
        setPass({
          id: Date.now(),
          dir,
          top: Math.max(8, (s?.top ?? 120) - 40),
          floor: (s?.bottom ?? window.innerHeight * 0.5) - 30,
          dropX: window.innerWidth * (0.25 + Math.random() * 0.5),
        });
        onPass();
        window.setTimeout(onBlast, (DROP_AT * GLIDE_SEC + FALL_SEC) * 1000);
        next(6000 + Math.random() * 4000);
      }, wait);
    };
    next(4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || !pass) return null;
  const w = window.innerWidth;
  const G = 86;
  const from = pass.dir === 1 ? -G - 30 : w + 30;
  const to = pass.dir === 1 ? w + 30 : -G - 30;
  const fall = pass.floor - pass.top;
  return createPortal(
    <div key={pass.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {/* The glider, bobbing as it goes. */}
      <motion.div
        className="absolute left-0"
        style={{ top: pass.top }}
        initial={{ x: from }}
        animate={{ x: to, y: [0, 10, -6, 8, 0] }}
        transition={{ duration: GLIDE_SEC, ease: 'linear' }}
        onAnimationComplete={() => window.setTimeout(() => setPass((p) => (p?.id === pass.id ? null : p)), FALL_SEC * 1000 + 900)}
      >
        <div style={{ transform: `scaleX(${pass.dir})` }}>
          <GoblinMini size={G} />
        </div>
        {/* His cackle, written out. */}
        <motion.div
          className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px] font-black"
          style={{ color: '#bef264', WebkitTextStroke: '1px #1a2e05', fontFamily: "'Russo One', sans-serif" }}
          animate={{ y: [0, -3, 0], rotate: [-4, 4, -4] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          ХЕ-ХЕ-ХЕ!
        </motion.div>
      </motion.div>

      {/* The bomb, tumbling down to where it goes off. */}
      <motion.div
        className="absolute"
        style={{ left: pass.dropX - 14, top: pass.top + 40 }}
        initial={{ y: 0, opacity: 0, rotate: 0 }}
        animate={{ y: [0, 0, fall], opacity: [0, 1, 1, 0], rotate: [0, 0, 540 * pass.dir] }}
        transition={{
          duration: DROP_AT * GLIDE_SEC + FALL_SEC,
          times: [0, (DROP_AT * GLIDE_SEC) / (DROP_AT * GLIDE_SEC + FALL_SEC), 1],
          ease: 'easeIn',
          opacity: { duration: DROP_AT * GLIDE_SEC + FALL_SEC + 0.02, times: [0, 0.6, 0.98, 1] },
        }}
      >
        <JackO size={28} />
      </motion.div>

      {/* «БАХ!»: an orange flash, green smoke, pumpkin bits and the word. */}
      <div className="absolute" style={{ left: pass.dropX, top: pass.floor + 40 }}>
        <motion.div
          className="absolute rounded-full"
          style={{ width: 160, height: 160, left: -80, top: -80, background: 'radial-gradient(circle, #fff 0%, #fdba74 25%, #ea580c 50%, transparent 72%)' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 0, 1.6], opacity: [0, 1, 0] }}
          transition={{ duration: DROP_AT * GLIDE_SEC + FALL_SEC + 0.45, times: [0, 0.82, 1], ease: 'easeOut' }}
        />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <motion.span
              key={i}
              className="absolute block rounded-full"
              style={{
                width: i % 2 ? 26 : 12,
                height: i % 2 ? 26 : 10,
                left: -8,
                top: -8,
                background: i % 2 ? 'radial-gradient(circle at 40% 35%, #d9f99d, #65a30d 60%, rgba(54,83,20,0.4))' : '#f97316',
              }}
              initial={{ opacity: 0 }}
              animate={{ x: [0, 0, Math.cos(a) * 70], y: [0, 0, Math.sin(a) * 50 - 20], opacity: [0, 0, 1, 0], scale: [0.3, 0.3, 1.3] }}
              transition={{ duration: DROP_AT * GLIDE_SEC + FALL_SEC + 0.7, times: [0, 0.6, 0.7, 1], ease: 'easeOut' }}
            />
          );
        })}
        <motion.div
          className="absolute whitespace-nowrap text-3xl font-black"
          style={{ left: -44, top: -70, color: '#fde047', WebkitTextStroke: '2px #7c2d12', textShadow: '0 3px 0 #7c2d12', fontFamily: "'Russo One', sans-serif" }}
          initial={{ scale: 0, opacity: 0, rotate: -10 }}
          animate={{ scale: [0, 0, 1.3, 1], opacity: [0, 0, 1, 0], rotate: [-10, -10, 6, 0] }}
          transition={{ duration: DROP_AT * GLIDE_SEC + FALL_SEC + 0.9, times: [0, 0.55, 0.65, 1] }}
        >
          БАХ!
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}

/** How long the two Spider-Men's visit takes (s), and its beats as fractions of it. */
const SPIDEY_SEC = 4;
/** Landed · start shooting · web on him · web gone, zipping off. */
const SP = { land: 0.1, shoot: 0.42, stuck: 0.47, free: 0.78 };

/**
 * Two Spider-Men drop in on their web lines, one either side of the Goblin, and point at each
 * other across him — the meme, «?!» — then remember who the bad guy is: both fire their webs at
 * him at once, he's stuck under a web for a moment, and they zip back up out of sight. First one
 * some 9 s into the fight, then every 12–18 s. `onThwip` is called for each web shot, for the
 * sound. Nothing under reduced motion.
 */
export function SpideyTeam({
  active,
  span,
  onThwip,
}: {
  active: boolean;
  /** The Goblin's picture on screen. */
  span: () => { left: number; right: number; top: number; bottom: number } | null;
  onThwip: () => void;
}) {
  const calm = useReducedMotion();
  const [visit, setVisit] = useState<{ id: number; left: number; right: number; top: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const timers: number[] = [];
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        const r = span();
        if (r) {
          setVisit({ id: Date.now(), ...r });
          onThwip();
          timers.push(window.setTimeout(onThwip, SP.shoot * SPIDEY_SEC * 1000));
          timers.push(window.setTimeout(onThwip, (SP.shoot * SPIDEY_SEC + 0.08) * 1000));
          timers.push(window.setTimeout(onThwip, SP.free * SPIDEY_SEC * 1000));
        }
        next(12000 + Math.random() * 6000);
      }, wait);
    };
    next(9000);
    return () => {
      window.clearTimeout(t);
      timers.forEach((x) => window.clearTimeout(x));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || !visit) return null;
  const width = visit.right - visit.left;
  // Little, the same size as the Goblin on his glider.
  const S = 72;
  const midX = (visit.left + visit.right) / 2;
  const midY = (visit.top + visit.bottom) / 2;
  // Where each one stands: at the picture's bottom corners, a little in from the screen edges.
  const spots = [-1, 1].map((side) => {
    const x = side < 0 ? Math.max(4, visit.left - S * 0.15) : Math.min(window.innerWidth - S - 4, visit.right - S * 0.85);
    return { side, x, y: visit.bottom - S };
  });
  const up = -(visit.bottom + 40);
  return createPortal(
    <div key={visit.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {spots.map(({ side, x, y }) => (
        <motion.div
          key={side}
          className="absolute"
          style={{ left: x, top: y }}
          initial={{ y: up }}
          animate={{ y: [up, 0, 0, 0, 0, up], rotate: [0, 0, side * 5, side * -5, 0, 0] }}
          transition={{ duration: SPIDEY_SEC, times: [0, SP.land, 0.25, SP.shoot - 0.05, SP.free, 1], ease: 'easeInOut' }}
          onAnimationComplete={() => side > 0 && setVisit((v) => (v?.id === visit.id ? null : v))}
        >
          {/* The line he hangs from, up out of the top of the screen. */}
          <div className="absolute left-1/2 w-[2px] -translate-x-1/2 bg-white/80" style={{ bottom: S * 0.9, height: 1200 }} />
          <div style={{ transform: `scaleX(${side < 0 ? 1 : -1})` }}>
            <SpiderMan size={S} />
          </div>
        </motion.div>
      ))}

      {/* «?!» over the Goblin while they point at each other. */}
      <motion.div
        className="absolute -translate-x-1/2 whitespace-nowrap text-3xl font-black"
        style={{ left: midX, top: visit.top + 6, color: '#fff', WebkitTextStroke: '1.5px #1e3a8a', textShadow: '0 2px 0 #b91c1c', fontFamily: "'Russo One', sans-serif" }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.25, 1, 0.8] }}
        transition={{ duration: SPIDEY_SEC, times: [0, SP.land + 0.04, SP.land + 0.1, SP.shoot - 0.06, SP.shoot] }}
      >
        ?!
      </motion.div>

      {/* Both webs at once, from their hands to him. */}
      {spots.map(({ side, x, y }) => {
        const hx = side < 0 ? x + S * 1.05 : x + S - S * 1.05;
        const hy = y + S * 0.48;
        const dx = midX - hx;
        const dy = midY - hy;
        return (
          <motion.div
            key={`w${side}`}
            className="absolute h-[3px] rounded-full"
            style={{
              left: hx,
              top: hy,
              width: Math.hypot(dx, dy),
              transformOrigin: '0% 50%',
              rotate: (Math.atan2(dy, dx) * 180) / Math.PI,
              background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0.75))',
              boxShadow: '0 0 4px #fff',
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 0, 1, 1, 1], opacity: [0, 0, 1, 1, 0] }}
            transition={{ duration: SPIDEY_SEC, times: [0, SP.shoot, SP.stuck, SP.free - 0.04, SP.free] }}
          />
        );
      })}

      {/* The Goblin under a web for a moment. */}
      <motion.div
        className="absolute"
        style={{ left: midX - width * 0.32, top: midY - width * 0.32 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.12, 1, 1, 1.05], opacity: [0, 0, 1, 1, 1, 0] }}
        transition={{ duration: SPIDEY_SEC, times: [0, SP.stuck - 0.01, SP.stuck + 0.04, 0.55, SP.free - 0.04, SP.free + 0.04] }}
      >
        <Web size={width * 0.64} />
      </motion.div>
      <motion.div
        className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-black"
        style={{ left: midX, top: visit.bottom - 44, color: '#fff', WebkitTextStroke: '1.5px #1e3a8a', textShadow: '0 2px 0 #b91c1c', fontFamily: "'Russo One', sans-serif" }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.2, 1, 0.9] }}
        transition={{ duration: SPIDEY_SEC, times: [0, SP.stuck, SP.stuck + 0.06, SP.free - 0.06, SP.free] }}
      >
        ПОПАЛСЯ!
      </motion.div>
    </div>,
    document.body,
  );
}

/** A jack-o'-lantern pumpkin bomb: orange, ribbed, a carved grin glowing yellow, a green stalk. */
export function JackO({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ filter: 'drop-shadow(0 0 5px #f97316)' }}>
      <path d="M20 6 C22 3 25 2 27 3" stroke="#3f6212" strokeWidth={3} fill="none" strokeLinecap="round" />
      <ellipse cx={20} cy={23} rx={17} ry={14} fill="#ea580c" stroke="#7c2d12" strokeWidth={2} />
      <path d="M14 10 C10 18 10 28 14 36 M26 10 C30 18 30 28 26 36 M20 9 L20 37" stroke="#9a3412" strokeWidth={1.4} fill="none" opacity={0.6} />
      <path d="M10 18 L15 15 L16 21 Z M30 18 L25 15 L24 21 Z" fill="#fde047" />
      <path d="M9 26 L13 25 L15 28 L18 25 L20 28 L22 25 L25 28 L27 25 L31 26 C29 32 11 32 9 26 Z" fill="#fde047" />
    </svg>
  );
}

/**
 * A little Green Goblin on his glider: green face with pointy ears and a huge grin, purple hood
 * with its curled tip flying back, a bag of pumpkins at his hip; the glider a bat-winged blade
 * with a jet of flame out the back. Faces right.
 */
export function GoblinMini({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 100 85" aria-hidden style={{ overflow: 'visible' }}>
      {/* Jet flame, flickering. */}
      <motion.path
        d="M8 66 L-14 62 L-6 68 L-18 72 L8 72 Z"
        fill="#fb923c"
        animate={{ scaleX: [1, 1.4, 0.9, 1.3, 1] }}
        style={{ transformOrigin: '8px 69px' }}
        transition={{ duration: 0.25, repeat: Infinity }}
      />
      {/* The glider: bat wings. */}
      <path d="M6 64 L30 58 L50 62 L70 58 L96 64 L86 70 L76 66 L66 72 L50 68 L34 72 L24 66 L14 70 Z" fill="#4b5563" stroke="#111827" strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={50} cy={64} r={3} fill="#facc15" />
      {/* Legs, crouched on it. */}
      <path d="M40 60 L36 48 L46 44 M58 60 L62 48 L52 44" stroke="#65a30d" strokeWidth={8} strokeLinecap="round" fill="none" />
      <path d="M34 60 L42 60 M56 60 L64 60" stroke="#6b21a8" strokeWidth={6} strokeLinecap="round" />
      {/* Body. */}
      <path d="M38 46 C36 30 62 30 60 46 Z" fill="#7e22ce" stroke="#3b0764" strokeWidth={2} />
      {/* The bag of bombs. */}
      <ellipse cx={36} cy={44} rx={6} ry={5} fill="#a16207" stroke="#422006" strokeWidth={1.5} />
      {/* Throwing arm, with a pumpkin. */}
      <motion.g
        style={{ transformOrigin: '58px 36px' }}
        animate={{ rotate: [-20, 30, -20] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      >
        <path d="M58 36 L74 28" stroke="#65a30d" strokeWidth={6} strokeLinecap="round" />
        <circle cx={77} cy={26} r={5} fill="#ea580c" stroke="#7c2d12" strokeWidth={1.5} />
      </motion.g>
      {/* Head: hood, ears, grin. */}
      <path d="M36 22 C30 4 60 -4 64 16 C70 12 76 6 72 0 C82 6 78 18 66 22 Z" fill="#7e22ce" stroke="#3b0764" strokeWidth={2} />
      <path d="M38 20 L28 14 L40 26 Z M62 20 L72 14 L60 26 Z" fill="#65a30d" stroke="#1a2e05" strokeWidth={1.5} />
      <ellipse cx={50} cy={26} rx={12} ry={11} fill="#84cc16" stroke="#1a2e05" strokeWidth={2} />
      <path d="M42 22 L48 24 M58 22 L52 24" stroke="#1a2e05" strokeWidth={2.4} strokeLinecap="round" />
      <ellipse cx={45.5} cy={25.5} rx={2.4} ry={1.8} fill="#fde047" />
      <ellipse cx={54.5} cy={25.5} rx={2.4} ry={1.8} fill="#fde047" />
      <path d="M41 29 Q50 40 59 29 Z" fill="#1a2e05" />
      <path d="M43 29.5 L57 29.5 L56 32 L44 32 Z" fill="#fefce8" />
    </svg>
  );
}

/**
 * Spider-Man, pointing: the red suit with its web lines, blue flanks, the big white eyes, one arm
 * thrust out to the right. For the meme he's used twice, one of them flipped.
 */
export function SpiderMan({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ overflow: 'visible' }}>
      <defs>
        <pattern id="spidey-web" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 0 L8 8 M8 0 L0 8" stroke="#111827" strokeWidth={0.6} opacity={0.5} />
        </pattern>
      </defs>
      {/* Body. */}
      <path d="M26 100 C24 70 30 52 50 52 C70 52 76 70 74 100 Z" fill="#1d4ed8" stroke="#0b1020" strokeWidth={2.5} />
      <path d="M38 100 C37 72 42 56 50 56 C58 56 63 72 62 100 Z" fill="#dc2626" />
      <path d="M38 100 C37 72 42 56 50 56 C58 56 63 72 62 100 Z" fill="url(#spidey-web)" />
      {/* The spider on his chest. */}
      <path d="M50 66 L50 78 M44 68 L56 76 M56 68 L44 76" stroke="#0b1020" strokeWidth={2} strokeLinecap="round" />
      {/* The pointing arm. */}
      <path d="M66 62 C78 58 88 54 98 50" stroke="#dc2626" strokeWidth={11} strokeLinecap="round" fill="none" />
      <path d="M66 62 C78 58 88 54 98 50" stroke="url(#spidey-web)" strokeWidth={11} strokeLinecap="round" fill="none" />
      <path d="M98 50 L110 46" stroke="#dc2626" strokeWidth={4.5} strokeLinecap="round" />
      {/* Head. */}
      <ellipse cx={50} cy={32} rx={20} ry={23} fill="#dc2626" stroke="#0b1020" strokeWidth={2.5} />
      <ellipse cx={50} cy={32} rx={20} ry={23} fill="url(#spidey-web)" />
      <path d="M36 28 C38 20 46 22 47 32 C42 36 36 34 36 28 Z" fill="#f8fafc" stroke="#0b1020" strokeWidth={2.5} />
      <path d="M64 28 C62 20 54 22 53 32 C58 36 64 34 64 28 Z" fill="#f8fafc" stroke="#0b1020" strokeWidth={2.5} />
    </svg>
  );
}

/** A spider web: spokes and rings, white. */
export function Web({ size }: { size: number }) {
  const spokes = 10;
  const rings = [0.25, 0.45, 0.65, 0.85, 1];
  const pt = (i: number, r: number) => {
    const a = (i / spokes) * Math.PI * 2;
    return `${50 + Math.cos(a) * 48 * r},${50 + Math.sin(a) * 48 * r}`;
  };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.7))' }}>
      {Array.from({ length: spokes }, (_, i) => (
        <path key={i} d={`M50 50 L${pt(i, 1)}`} stroke="#f8fafc" strokeWidth={1.2} />
      ))}
      {rings.map((r) => (
        <polygon key={r} points={Array.from({ length: spokes }, (_, i) => pt(i, r)).join(' ')} fill="none" stroke="#f8fafc" strokeWidth={1} />
      ))}
    </svg>
  );
}
