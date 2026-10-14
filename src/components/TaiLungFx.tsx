import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Tai Lung's stage, from Kung Fu Panda, drawn the way the other bosses' things are — in CSS and
 * SVG, no art files.
 *
 *  - {@link TaiLungAmbient}: what's always on while he's up — the lanterns by the temple
 *    flickering, lightning cracking across the storm behind him, and peach blossom from Oogway's
 *    tree drifting down through it all.
 *  - {@link DumplingSnack}: his regeneration, made a joke — whenever he gets HP back, a dumpling
 *    flies in from the side and he snaps it up, «ням!».
 *  - {@link FuriousRaid}: now and then Po comes rolling in to belly-bump him — «БУМ!» — with one
 *    of the Furious Five coming in from the other side, each with their own move.
 *  - {@link FireworkChair}: Po strapped to a chair of fireworks, as in the film, streaking over the
 *    top and going off in a burst of colour — «ВОИН ДРАКОНА!».
 *  - {@link DragonScroll}: the Dragon Scroll unrolling in front of Tai Lung, all shining gold —
 *    «ЗДЕСЬ НИЧЕГО НЕТ!» — and rolling back up.
 *  - {@link MiniPo}, {@link Paw}, {@link Dumpling}, {@link PeachPetal}: the figures those and his
 *    scenes are made of (in AbilityScene and HitFx).
 */

/** Where things are in his artwork (14-threshold.jpg), as % of its width and height. */
const LANTERNS: [number, number][] = [
  [2, 48],
  [15, 51],
];
/** His mouth, for the dumplings. */
const MOUTH: [number, number] = [43, 28];

export function TaiLungAmbient({ active }: { active: boolean }) {
  const calm = useReducedMotion();
  const petals = useMemo(
    () => Array.from({ length: 7 }, () => ({ x: Math.random() * 95, d: 5 + Math.random() * 4, delay: Math.random() * 7, rot: Math.random() * 360 })),
    [],
  );
  const [bolt, setBolt] = useState<{ id: number; x: number; flip: boolean } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        setBolt({ id: Date.now(), x: 55 + Math.random() * 30, flip: Math.random() < 0.5 });
        next(4000 + Math.random() * 5000);
      }, wait);
    };
    next(2500);
    return () => window.clearTimeout(t);
  }, [active, calm]);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="tailung"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* The lanterns, warm and unsteady. */}
          {LANTERNS.map(([x, y], i) => (
            <motion.span
              key={`l${i}`}
              className="absolute block rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: '18%',
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, rgba(254,202,202,0.55) 0%, rgba(239,68,68,0.25) 35%, transparent 70%)',
                mixBlendMode: 'screen',
              }}
              animate={calm ? { opacity: 0.8 } : { opacity: [0.6, 1, 0.7, 0.9, 0.6] }}
              transition={{ duration: 1.6 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

          {/* Lightning: the sky flashes and a bolt forks down behind the pagodas. */}
          {bolt && (
            <div key={bolt.id} className="absolute inset-0">
              <motion.div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, rgba(219,234,254,0.55), transparent 55%)', mixBlendMode: 'screen' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.2, 0.8, 0] }}
                transition={{ duration: 0.5, times: [0, 0.1, 0.25, 0.35, 1] }}
              />
              <motion.svg
                viewBox="0 0 40 100"
                className="absolute top-0"
                style={{ left: `${bolt.x}%`, width: '12%', height: '42%', transform: bolt.flip ? 'scaleX(-1)' : undefined, filter: 'drop-shadow(0 0 6px #bfdbfe)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0, 1, 0] }}
                transition={{ duration: 0.45, times: [0, 0.1, 0.25, 0.35, 1] }}
              >
                <path d="M22 0 L14 34 L24 36 L10 70 L18 72 L6 100 L30 58 L20 56 L32 28 L22 26 L30 0 Z" fill="#eff6ff" />
              </motion.svg>
            </div>
          )}

          {/* Peach blossom drifting down. */}
          {!calm &&
            petals.map((p, i) => (
              <motion.span
                key={`p${i}`}
                className="absolute block"
                style={{ left: `${p.x}%`, top: '-6%' }}
                animate={{ y: [0, 280], x: [0, 30, 0, 40], rotate: [p.rot, p.rot + 360], opacity: [0, 0.9, 0.9, 0] }}
                transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: 'linear' }}
              >
                <PeachPetal size={10} />
              </motion.span>
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * His regeneration as a snack: a dumpling flies in from the side in a little arc, he snaps it up
 * — it squashes into his mouth with a puff of steam — and «ням!» pops up. Keyed by `snackId`;
 * nothing under reduced motion.
 */
export function DumplingSnack({ snackId }: { snackId: number | null }) {
  const calm = useReducedMotion();
  // A fresh side for every dumpling.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const side = useMemo(() => (Math.random() < 0.5 ? -1 : 1), [snackId]);
  if (snackId == null || calm) return null;
  return (
    <div key={snackId} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      <div className="absolute" style={{ left: `${MOUTH[0]}%`, top: `${MOUTH[1]}%` }}>
        {/* The dumpling's flight: in from the side, up, and down into his mouth. */}
        <motion.div
          className="absolute"
          style={{ left: -16, top: -14 }}
          initial={{ x: side * 220, y: 80, rotate: 0, opacity: 0, scale: 1 }}
          animate={{ x: [side * 220, side * 90, 0], y: [80, -60, 0], rotate: [0, side * -200, side * -360], opacity: [0, 1, 1, 0], scale: [1, 1, 1, 0.3] }}
          transition={{ duration: 0.6, times: [0, 0.5, 0.9, 1], ease: 'easeOut' }}
        >
          <Dumpling size={32} />
        </motion.div>
        {/* The steam puff as it goes in. */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute block rounded-full"
            style={{ left: -8 + (i - 1) * 12, top: -10, width: 16, height: 16, background: 'rgba(255,255,255,0.75)', filter: 'blur(2px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.9, 0], y: [0, 0, -30], scale: [0.4, 0.4, 1.6] }}
            transition={{ duration: 1.1, times: [0, 0.5, 0.65, 1] }}
          />
        ))}
        {/* «ням!» */}
        <motion.div
          className="absolute whitespace-nowrap text-xl font-black"
          style={{ left: 18, top: -34, color: '#fef3c7', WebkitTextStroke: '1.5px #78350f', textShadow: '0 2px 0 #78350f', fontFamily: "'Russo One', sans-serif" }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.3, 1, 1], y: [0, 0, 0, -10, -18], rotate: [0, 0, -8, 4, 0] }}
          transition={{ duration: 1.4, times: [0, 0.42, 0.52, 0.8, 1] }}
        >
          ням!
        </motion.div>
      </div>
    </div>
  );
}

/** Po's mates from the Jade Palace, any of whom can come in with him. */
export type Hero = 'tigress' | 'monkey' | 'mantis' | 'viper' | 'crane';
const HEROES: Hero[] = ['tigress', 'monkey', 'mantis', 'viper', 'crane'];
/** What each of them shouts as the blow lands. */
const HERO_SHOUT: Record<Hero, string> = {
  tigress: 'КИЯ!',
  monkey: 'У-У-А-А!',
  mantis: 'ТА-ТА-ТА!',
  viper: 'ХЛЯСЬ!',
  crane: 'ВЖУХ!',
};

/** How long one raid takes (s), when Po's belly lands, when his mate's blow lands. */
const RAID_SEC = 3.6;
const PO_HIT = 1.1;
const HERO_HIT = 1.7;

/** One blow of a raid, for the caller's sound and for jolting the picture. */
export type RaidBlow = 'belly' | Hero;

/**
 * Po and one of the Furious Five raiding Tai Lung together. Po comes rolling in along the floor
 * from one side, kicking up dust, squashes flat against him — «БУМ!» — and bounces back out; a
 * beat later his mate comes in from the other side with their own move: Tigress's flying kick,
 * Monkey cartwheeling in with his staff, Mantis zipping about landing a flurry of tiny punches,
 * Viper slithering up and whipping her tail, Crane swooping down out of the sky on a gust. Tai
 * Lung is left with stars going round his head. First a few seconds in, then every 9–14 s.
 * `onBlow` is called as each blow lands. Nothing under reduced motion.
 */
export function FuriousRaid({
  active,
  span,
  onBlow,
}: {
  active: boolean;
  /** Tai Lung's picture on screen. */
  span: () => { left: number; right: number; top: number; bottom: number } | null;
  onBlow: (blow: RaidBlow) => void;
}) {
  const calm = useReducedMotion();
  const [raid, setRaid] = useState<{ id: number; dir: -1 | 1; hero: Hero; r: { left: number; right: number; top: number; bottom: number } } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    let last: Hero | null = null;
    const timers: number[] = [];
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        const r = span();
        if (r) {
          // Never the same mate twice running.
          const pool = HEROES.filter((h) => h !== last);
          const hero = pool[Math.floor(Math.random() * pool.length)];
          last = hero;
          setRaid({ id: Date.now(), dir: Math.random() < 0.5 ? -1 : 1, hero, r });
          timers.push(window.setTimeout(() => onBlow('belly'), PO_HIT * 1000));
          timers.push(window.setTimeout(() => onBlow(hero), HERO_HIT * 1000));
        }
        next(9000 + Math.random() * 5000);
      }, wait);
    };
    next(5000);
    return () => {
      window.clearTimeout(t);
      timers.forEach((x) => window.clearTimeout(x));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || !raid) return null;
  const { r, dir, hero } = raid;
  const w = window.innerWidth;
  const mid = (r.left + r.right) / 2;
  const chest = r.top + (r.bottom - r.top) * 0.45;
  const P = 64;
  const H = 58;
  const poFrom = dir === 1 ? -P - 20 : w + 20;
  const poHit = mid - dir * 46 - P / 2;
  const poBack = poHit - dir * 80;
  const f = (sec: number) => sec / RAID_SEC;
  const shout = {
    color: '#fde68a',
    WebkitTextStroke: '1.5px #7c2d12',
    textShadow: '0 3px 0 #7c2d12',
    fontFamily: "'Russo One', sans-serif",
  } as const;

  return createPortal(
    <div key={raid.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {/* Po: rolling in, flat against him, bounced back and rolling off. */}
      <motion.div
        className="absolute left-0"
        style={{ top: r.bottom - P }}
        initial={{ x: poFrom }}
        animate={{ x: [poFrom, poHit, poBack, poBack, poFrom], y: [0, 0, -60, 0, 0] }}
        transition={{ duration: RAID_SEC, times: [0, f(PO_HIT), f(PO_HIT + 0.35), f(PO_HIT + 0.6), 1], ease: 'easeOut' }}
        onAnimationComplete={() => setRaid((x) => (x?.id === raid.id ? null : x))}
      >
        <motion.div
          style={{ transformOrigin: '50% 100%' }}
          animate={{
            rotate: [0, dir * 900, dir * 900, dir * 900, dir * 900 - dir * 1080],
            scaleX: [1, 1, 1.35, 0.85, 1.1, 1, 1],
            scaleY: [1, 1, 0.65, 1.2, 0.9, 1, 1],
          }}
          transition={{
            rotate: { duration: RAID_SEC, times: [0, f(PO_HIT), f(PO_HIT + 0.6), f(2.6), 1], ease: 'linear' },
            scaleX: { duration: RAID_SEC, times: [0, f(PO_HIT - 0.02), f(PO_HIT + 0.05), f(PO_HIT + 0.2), f(PO_HIT + 0.6), f(PO_HIT + 0.75), 1] },
            scaleY: { duration: RAID_SEC, times: [0, f(PO_HIT - 0.02), f(PO_HIT + 0.05), f(PO_HIT + 0.2), f(PO_HIT + 0.6), f(PO_HIT + 0.75), 1] },
          }}
        >
          <MiniPo size={P} />
        </motion.div>
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black"
          style={{ bottom: P + 10, ...shout }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.35, 1, 0.9], rotate: [0, 0, -8, 4, 0] }}
          transition={{ duration: RAID_SEC, times: [0, f(PO_HIT), f(PO_HIT + 0.1), f(PO_HIT + 0.8), f(PO_HIT + 1)] }}
        >
          БУМ!
        </motion.div>
      </motion.div>
      {/* The dust he kicks up rolling in. */}
      {[0.2, 0.45, 0.7, 0.95].map((at, i) => (
        <motion.span
          key={`d${i}`}
          className="absolute block rounded-full"
          style={{ left: poFrom + (poHit - poFrom) * (at / PO_HIT) + P / 2 - 12, top: r.bottom - 22, width: 24, height: 24, background: 'radial-gradient(circle at 40% 35%, #f5f5f4, #a8a29e 60%, rgba(120,113,108,0.3))' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.8, 0], scale: [0.3, 0.3, 1.3, 1.8], y: [0, 0, -10, -18] }}
          transition={{ duration: at + 0.7, times: [0, at / (at + 0.7), (at + 0.15) / (at + 0.7), 1] }}
        />
      ))}

      {/* His mate, from the other side. */}
      <HeroMove hero={hero} side={-dir as -1 | 1} mid={mid} chest={chest} floor={r.bottom} top={r.top} size={H} />
      <motion.div
        className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-black"
        style={{ left: mid - dir * 30, top: r.top + 8, ...shout }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.35, 1, 0.9], rotate: [0, 0, 8, -4, 0] }}
        transition={{ duration: RAID_SEC, times: [0, f(HERO_HIT), f(HERO_HIT + 0.1), f(HERO_HIT + 0.8), f(HERO_HIT + 1)] }}
      >
        {HERO_SHOUT[hero]}
      </motion.div>

      {/* Stars going round Tai Lung's head after it. */}
      <motion.div
        className="absolute"
        style={{ left: mid, top: r.top + (r.bottom - r.top) * 0.12 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: RAID_SEC, times: [0, f(HERO_HIT + 0.1), f(HERO_HIT + 0.25), 0.92, 1] }}
      >
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 0, height: 0 }}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="absolute block text-lg leading-none"
              style={{ transform: `rotate(${i * 90}deg) translateX(34px) rotate(${-i * 90}deg) translate(-50%, -50%)`, color: '#fde047', textShadow: '0 0 4px #f59e0b' }}
            >
              ★
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>,
    document.body,
  );
}

/** One of the Furious Five coming in from `side` and landing their blow at HERO_HIT. */
function HeroMove({
  hero,
  side,
  mid,
  chest,
  floor,
  top,
  size,
}: {
  hero: Hero;
  side: -1 | 1;
  mid: number;
  chest: number;
  floor: number;
  top: number;
  size: number;
}) {
  const w = window.innerWidth;
  const f = (sec: number) => sec / RAID_SEC;
  // `side` is where they come from: -1 the left edge, 1 the right.
  const edge = side < 0 ? -size - 20 : w + 20;
  const at = mid + side * 40 - size / 2;
  const away = at + side * 70;
  const face = side < 0 ? 1 : -1;
  const T = [0, f(0.6), f(HERO_HIT), f(HERO_HIT + 0.35), f(2.7), 1];

  if (hero === 'tigress') {
    // A run, a leap and a flying kick into his chest; a backflip off him; out.
    const ground = floor - size;
    return (
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: edge, y: ground }}
        animate={{ x: [edge, at - side * 60, at, away, away, edge], y: [ground, ground, chest - size / 2, ground - 50, ground, ground], rotate: [0, 0, face * -25, face * -360, face * -360, face * -360] }}
        transition={{ duration: RAID_SEC, times: T, ease: 'easeOut' }}
      >
        <div style={{ transform: `scaleX(${face})` }}>
          <Tigress size={size} />
        </div>
      </motion.div>
    );
  }
  if (hero === 'monkey') {
    // Cartwheeling in, staff whirling, a strike, and cartwheeling off.
    const ground = floor - size;
    return (
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: edge, y: ground }}
        animate={{ x: [edge, at - side * 30, at, away, away, edge], y: [ground, ground - 20, ground - 30, ground, ground, ground], rotate: [0, face * 720, face * 720, face * 720, face * 720, face * 1440] }}
        transition={{ duration: RAID_SEC, times: T, ease: 'easeOut' }}
      >
        <div style={{ transform: `scaleX(${face})` }}>
          <MonkeyHero size={size} />
        </div>
      </motion.div>
    );
  }
  if (hero === 'mantis') {
    // Tiny and everywhere at once: zig-zagging in, a flurry of punches with stars, and gone.
    const ground = chest - size * 0.3;
    return (
      <>
        <motion.div
          className="absolute left-0 top-0"
          initial={{ x: edge, y: ground }}
          animate={{
            x: [edge, at - side * 50, at - side * 10, at + side * 6, at - side * 10, at + side * 6, away, edge],
            y: [ground, ground - 40, ground, ground - 14, ground + 6, ground - 10, ground - 30, ground],
          }}
          transition={{ duration: RAID_SEC, times: [0, f(0.8), f(HERO_HIT), f(HERO_HIT + 0.12), f(HERO_HIT + 0.24), f(HERO_HIT + 0.36), f(2.6), 1], ease: 'easeInOut' }}
        >
          <div style={{ transform: `scaleX(${face})` }}>
            <Mantis size={size * 0.6} />
          </div>
        </motion.div>
        {[0, 0.12, 0.24, 0.36].map((d, i) => (
          <motion.span
            key={i}
            className="absolute block text-xl leading-none"
            style={{ left: mid + side * 10 + (i % 2 ? 14 : -14), top: chest - 10 + (i - 1.5) * 12, color: '#fff', textShadow: '0 0 6px #fde047' }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 1.4, 0.6] }}
            transition={{ duration: HERO_HIT + d + 0.25, times: [0, (HERO_HIT + d) / (HERO_HIT + d + 0.25), (HERO_HIT + d + 0.08) / (HERO_HIT + d + 0.25), 1] }}
          >
            ✦
          </motion.span>
        ))}
      </>
    );
  }
  if (hero === 'viper') {
    // Slithering along the floor in waves, rearing up and whipping her tail; slithering off.
    const ground = floor - size * 0.6;
    return (
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: edge, y: ground }}
        animate={{ x: [edge, at - side * 40, at, away, away, edge], y: [ground, ground, ground - 30, ground, ground, ground], rotate: [0, 0, face * -20, face * 15, 0, 0] }}
        transition={{ duration: RAID_SEC, times: T, ease: 'easeOut' }}
      >
        <motion.div animate={{ scaleY: [1, 0.85, 1, 0.85, 1] }} transition={{ duration: 0.4, repeat: Infinity }}>
          <div style={{ transform: `scaleX(${face})` }}>
            <Viper size={size} />
          </div>
        </motion.div>
      </motion.div>
    );
  }
  // Crane: swooping down out of the sky, a gust off his wings at the bottom of the dive, up and away.
  const sky = Math.max(0, top - 120);
  return (
    <>
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: edge, y: sky }}
        animate={{ x: [edge, at - side * 60, at, away, away + side * 120, edge], y: [sky, sky + 40, chest - size / 2, sky + 20, sky - 60, sky - 120], rotate: [0, face * 20, face * -10, face * -25, face * -25, face * -25] }}
        transition={{ duration: RAID_SEC, times: T, ease: 'easeInOut' }}
      >
        <div style={{ transform: `scaleX(${face})` }}>
          <Crane size={size} />
        </div>
      </motion.div>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute h-[3px] rounded-full bg-white/80"
          style={{ left: mid - side * 10 - 40, top: chest - 16 + i * 14, width: 80, transformOrigin: side < 0 ? '0% 50%' : '100% 50%' }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: [0, 0, 1, 0], scaleX: [0, 0, 1, 1.4], x: [0, 0, -side * 20, -side * 50] }}
          transition={{ duration: HERO_HIT + 0.6, times: [0, HERO_HIT / (HERO_HIT + 0.6), (HERO_HIT + 0.15) / (HERO_HIT + 0.6), 1], delay: i * 0.04 }}
        />
      ))}
    </>
  );
}

/** Tigress: orange tiger face with black stripes, red silk vest, fists up. Faces right. */
export function Tigress({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden style={{ overflow: 'visible' }}>
      <rect x={20} y={44} width={8} height={14} rx={3} fill="#111" />
      <rect x={32} y={44} width={8} height={14} rx={3} fill="#111" />
      <path d="M16 28 L44 28 L42 48 L18 48 Z" fill="#b91c1c" stroke="#450a0a" strokeWidth={1.5} />
      <path d="M30 28 L30 48" stroke="#fbbf24" strokeWidth={1.5} />
      <circle cx={50} cy={30} r={5} fill="#f59e0b" stroke="#78350f" strokeWidth={1.2} />
      <path d="M42 32 L48 30" stroke="#f59e0b" strokeWidth={5} strokeLinecap="round" />
      <circle cx={10} cy={34} r={5} fill="#f59e0b" stroke="#78350f" strokeWidth={1.2} />
      <path d="M18 33 L12 34" stroke="#f59e0b" strokeWidth={5} strokeLinecap="round" />
      <path d="M20 8 L22 2 L27 7 Z M40 8 L38 2 L33 7 Z" fill="#f59e0b" stroke="#78350f" strokeWidth={1.2} />
      <ellipse cx={30} cy={16} rx={13} ry={12} fill="#f59e0b" stroke="#78350f" strokeWidth={1.5} />
      <path d="M30 5 L30 10 M24 6 L26 10 M36 6 L34 10 M18 14 L22 15 M42 14 L38 15" stroke="#111" strokeWidth={1.6} strokeLinecap="round" />
      <ellipse cx={30} cy={21} rx={7} ry={5} fill="#fef3c7" />
      <path d="M24 15 L28 16 M36 15 L32 16" stroke="#111" strokeWidth={2} strokeLinecap="round" />
      <circle cx={30} cy={19} r={1.5} fill="#111" />
    </svg>
  );
}

/** Monkey: brown, a pale face, a long curling tail and his staff. Faces right. */
export function MonkeyHero({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden style={{ overflow: 'visible' }}>
      <path d="M18 44 C6 46 4 30 12 28" stroke="#78350f" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M2 50 L58 14" stroke="#a16207" strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={30} cy={38} rx={11} ry={12} fill="#92400e" stroke="#451a03" strokeWidth={1.5} />
      <rect x={22} y={46} width={6} height={12} rx={3} fill="#92400e" />
      <rect x={32} y={46} width={6} height={12} rx={3} fill="#92400e" />
      <circle cx={18} cy={16} r={5} fill="#d6b48a" stroke="#451a03" strokeWidth={1.2} />
      <circle cx={42} cy={16} r={5} fill="#d6b48a" stroke="#451a03" strokeWidth={1.2} />
      <circle cx={30} cy={18} r={12} fill="#92400e" stroke="#451a03" strokeWidth={1.5} />
      <ellipse cx={30} cy={21} rx={8} ry={7} fill="#e7cba3" />
      <circle cx={27} cy={18} r={1.5} fill="#111" />
      <circle cx={33} cy={18} r={1.5} fill="#111" />
      <path d="M26 24 Q30 27 34 24" stroke="#451a03" strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Mantis: tiny and green, big eyes, two raised forelegs. Faces right. */
export function Mantis({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ overflow: 'visible' }}>
      <ellipse cx={16} cy={28} rx={10} ry={5} fill="#65a30d" stroke="#1a2e05" strokeWidth={1.2} />
      <path d="M10 32 L6 39 M16 32 L15 39 M22 32 L24 39" stroke="#3f6212" strokeWidth={1.5} />
      <path d="M24 24 L28 12" stroke="#65a30d" strokeWidth={4} strokeLinecap="round" />
      <path d="M26 20 L36 14 L34 10 M24 18 L34 6 L30 4" stroke="#4d7c0f" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 8 L30 4 L32 12 Z" fill="#84cc16" stroke="#1a2e05" strokeWidth={1.2} />
      <circle cx={25} cy={6} r={2.6} fill="#fef08a" stroke="#1a2e05" strokeWidth={0.8} />
      <circle cx={30} cy={5} r={2.6} fill="#fef08a" stroke="#1a2e05" strokeWidth={0.8} />
      <path d="M26 3 L22 -4 M30 3 L32 -4" stroke="#3f6212" strokeWidth={1} />
    </svg>
  );
}

/** Viper: a green snake with a yellow-flowered pattern, reared up. Faces right. */
export function Viper({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 60 42" aria-hidden style={{ overflow: 'visible' }}>
      <path d="M2 36 C12 26 20 42 30 34 C38 28 40 18 44 12" stroke="#16a34a" strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d="M2 36 C12 26 20 42 30 34 C38 28 40 18 44 12" stroke="#fde047" strokeWidth={2} strokeDasharray="2 7" fill="none" strokeLinecap="round" />
      <ellipse cx={48} cy={9} rx={9} ry={7} fill="#16a34a" stroke="#14532d" strokeWidth={1.5} />
      <circle cx={51} cy={7} r={2.2} fill="#fff" />
      <circle cx={51.5} cy={7} r={1.1} fill="#111" />
      <path d="M56 11 L61 12 M61 12 L63 10 M61 12 L63 14" stroke="#dc2626" strokeWidth={1.2} strokeLinecap="round" />
      <circle cx={44} cy={4} r={2.6} fill="#f472b6" />
    </svg>
  );
}

/** Crane: a white bird in a straw hat, wings spread, long thin legs. Faces right. */
export function Crane({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden style={{ overflow: 'visible' }}>
      <motion.g style={{ transformOrigin: '30px 30px' }} animate={{ scaleY: [1, -0.4, 1] }} transition={{ duration: 0.35, repeat: Infinity }}>
        <path d="M30 30 L2 18 L8 30 L2 34 Z" fill="#f8fafc" stroke="#475569" strokeWidth={1.2} />
        <path d="M30 30 L58 18 L52 30 L58 34 Z" fill="#f8fafc" stroke="#475569" strokeWidth={1.2} />
      </motion.g>
      <ellipse cx={30} cy={32} rx={9} ry={7} fill="#f8fafc" stroke="#475569" strokeWidth={1.2} />
      <path d="M26 38 L22 56 M34 38 L38 56" stroke="#1f2937" strokeWidth={1.4} />
      <path d="M36 28 C40 22 42 18 44 14" stroke="#f8fafc" strokeWidth={4} strokeLinecap="round" />
      <circle cx={45} cy={12} r={4.5} fill="#f8fafc" stroke="#475569" strokeWidth={1.2} />
      <path d="M49 12 L58 14 L49 14 Z" fill="#facc15" stroke="#a16207" strokeWidth={0.8} />
      <circle cx={46} cy={11} r={1} fill="#111" />
      <ellipse cx={45} cy={8} rx={8} ry={2.2} fill="#d6b45a" stroke="#854d0e" strokeWidth={1} />
      <path d="M41 8 L45 3 L49 8 Z" fill="#d6b45a" stroke="#854d0e" strokeWidth={1} />
    </svg>
  );
}

/** A little Po, round as a ball: white belly, black arms, legs and ears, eye patches, a big grin. */
export function MiniPo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden style={{ overflow: 'visible' }}>
      <circle cx={18} cy={14} r={8} fill="#111" />
      <circle cx={62} cy={14} r={8} fill="#111" />
      <ellipse cx={22} cy={70} rx={10} ry={8} fill="#111" />
      <ellipse cx={58} cy={70} rx={10} ry={8} fill="#111" />
      <circle cx={40} cy={42} r={32} fill="#fafafa" stroke="#111" strokeWidth={2.5} />
      <ellipse cx={8} cy={46} rx={8} ry={12} fill="#111" />
      <ellipse cx={72} cy={46} rx={8} ry={12} fill="#111" />
      {/* Shorts. */}
      <path d="M14 58 C22 72 58 72 66 58 L66 64 C58 78 22 78 14 64 Z" fill="#b45309" />
      <path d="M14 58 C22 72 58 72 66 58" stroke="#7c2d12" strokeWidth={2} fill="none" />
      {/* Face. */}
      <ellipse cx={30} cy={32} rx={7} ry={8} fill="#111" transform="rotate(-20 30 32)" />
      <ellipse cx={50} cy={32} rx={7} ry={8} fill="#111" transform="rotate(20 50 32)" />
      <circle cx={31} cy={32} r={3.2} fill="#fff" />
      <circle cx={49} cy={32} r={3.2} fill="#fff" />
      <circle cx={31.5} cy={32.5} r={1.6} fill="#111" />
      <circle cx={48.5} cy={32.5} r={1.6} fill="#111" />
      <ellipse cx={40} cy={40} rx={4} ry={2.6} fill="#111" />
      <path d="M31 45 Q40 56 49 45 Z" fill="#7f1d1d" stroke="#111" strokeWidth={1.5} />
    </svg>
  );
}

/** A panda's paw print: a big pad and four toes. */
export function Paw({ size, color = '#111' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <ellipse cx={20} cy={27} rx={11} ry={9} fill={color} />
      <ellipse cx={8} cy={15} rx={4} ry={5} fill={color} transform="rotate(-20 8 15)" />
      <ellipse cx={16} cy={9} rx={4} ry={5} fill={color} />
      <ellipse cx={24} cy={9} rx={4} ry={5} fill={color} />
      <ellipse cx={32} cy={15} rx={4} ry={5} fill={color} transform="rotate(20 32 15)" />
    </svg>
  );
}

/** A steamed dumpling: a pleated white bun. */
export function Dumpling({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))' }}>
      <path d="M4 30 C4 16 12 8 20 8 C28 8 36 16 36 30 Z" fill="#fef9ec" stroke="#a8a29e" strokeWidth={1.6} />
      <path d="M20 8 L18 18 M20 8 L23 18 M20 8 L13 17 M20 8 L28 17" stroke="#d6d3d1" strokeWidth={1.4} />
      <ellipse cx={20} cy={30} rx={16} ry={3} fill="#e7e5e4" />
    </svg>
  );
}

/** A peach blossom petal. */
export function PeachPetal({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M10 1 C16 4 18 12 10 19 C2 12 4 4 10 1 Z" fill="#f9a8d4" stroke="#ec4899" strokeWidth={0.8} />
    </svg>
  );
}

/** How long the chair takes to cross (s), and where along it the fireworks go off (fraction). */
const CHAIR_SEC = 2.4;
const BURST_AT = 0.55;

/**
 * Po on his chair of fireworks, the way he got to the Jade Palace: launched up from a bottom
 * corner on a trail of sparks, arcing over the top of the screen — and blowing up into a burst of
 * coloured stars, chair legs flying, Po tumbling off the side. «ВОИН ДРАКОНА!». First some 12 s
 * in, then every 16–24 s. `onLaunch` gets when the burst is (s from now), for the sound.
 */
export function FireworkChair({
  active,
  sky,
  onLaunch,
}: {
  active: boolean;
  /** How high up to fly — just above the top of Tai Lung's picture. */
  sky: () => number | null;
  onLaunch: (burstAt: number) => void;
}) {
  const calm = useReducedMotion();
  const [run, setRun] = useState<{ id: number; dir: -1 | 1; top: number } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        setRun({ id: Date.now(), dir: Math.random() < 0.5 ? -1 : 1, top: Math.max(30, (sky() ?? 160) - 30) });
        onLaunch(BURST_AT * CHAIR_SEC);
        next(16000 + Math.random() * 8000);
      }, wait);
    };
    next(12000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const d = 60 + Math.random() * 50;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, color: ['#f472b6', '#fde047', '#60a5fa', '#4ade80', '#f97316'][i % 5] };
      }),
    // A fresh burst for every flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run?.id],
  );
  if (!active || calm || !run) return null;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const C = 60;
  const startX = run.dir === 1 ? -C : w;
  const burstX = w * (run.dir === 1 ? 0.55 : 0.45) - C / 2;
  const startY = h * 0.75;
  const burstY = run.top;
  return createPortal(
    <div key={run.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {/* The chair, up on its sparks and over. */}
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: startX, y: startY, rotate: run.dir * 40 }}
        animate={{ x: [startX, burstX], y: [startY, burstY], rotate: [run.dir * 40, run.dir * 10] }}
        transition={{ duration: BURST_AT * CHAIR_SEC, ease: 'easeOut' }}
        onAnimationComplete={() => window.setTimeout(() => setRun((r) => (r?.id === run.id ? null : r)), (1 - BURST_AT) * CHAIR_SEC * 1000)}
      >
        <motion.div animate={{ rotate: [-4, 4, -4] }} transition={{ duration: 0.15, repeat: Infinity }}>
          <div style={{ transform: `scaleX(${run.dir})` }}>
            <ChairPo size={C} />
          </div>
        </motion.div>
      </motion.div>

      {/* The burst. */}
      <div className="absolute" style={{ left: burstX + C / 2, top: burstY + C / 2 }}>
        <motion.div
          className="absolute rounded-full"
          style={{ width: 120, height: 120, left: -60, top: -60, background: 'radial-gradient(circle, #fff 0%, #fde68a 30%, transparent 70%)' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 0, 1.6], opacity: [0, 1, 0] }}
          transition={{ duration: BURST_AT * CHAIR_SEC + 0.4, times: [0, BURST_AT * CHAIR_SEC / (BURST_AT * CHAIR_SEC + 0.4), 1] }}
        />
        {stars.map((p, i) => (
          <motion.span
            key={i}
            className="absolute block h-2 w-2 rounded-full"
            style={{ left: -4, top: -4, background: p.color, boxShadow: `0 0 6px ${p.color}` }}
            initial={{ opacity: 0 }}
            animate={{ x: [0, 0, p.dx, p.dx * 1.1], y: [0, 0, p.dy, p.dy + 40], opacity: [0, 0, 1, 0] }}
            transition={{ duration: CHAIR_SEC + 0.3, times: [0, BURST_AT, BURST_AT + 0.15, 1], ease: 'easeOut' }}
          />
        ))}
        {/* Po, blown off it, tumbling down out of shot. */}
        <motion.div
          className="absolute"
          style={{ left: -22, top: -22 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1], x: [0, 0, run.dir * 40, run.dir * 90], y: [0, 0, -30, h], rotate: [0, 0, 180, 720] }}
          transition={{ duration: CHAIR_SEC + 0.4, times: [0, BURST_AT, BURST_AT + 0.12, 1], ease: 'easeIn' }}
        >
          <MiniPo size={44} />
        </motion.div>
        <motion.div
          className="absolute -translate-x-1/2 whitespace-nowrap text-xl font-black"
          style={{ left: 0, top: -70, color: '#fde68a', WebkitTextStroke: '1.5px #7c2d12', textShadow: '0 2px 0 #7c2d12', fontFamily: "'Russo One', sans-serif" }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.25, 1, 1] }}
          transition={{ duration: CHAIR_SEC + 0.5, times: [0, BURST_AT, BURST_AT + 0.08, 0.85, 1] }}
        >
          ВОИН ДРАКОНА!
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}

/** Po strapped into a wooden chair with a ring of red rockets under it, all of them lit. */
function ChairPo({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 60 72" aria-hidden style={{ overflow: 'visible' }}>
      {/* Rocket flames, flickering. */}
      {[10, 22, 34, 46].map((x, i) => (
        <motion.path
          key={x}
          d={`M${x} 60 L${x + 3} 74 L${x + 6} 60 Z`}
          fill={i % 2 ? '#fde047' : '#fb923c'}
          style={{ transformOrigin: `${x + 3}px 60px` }}
          animate={{ scaleY: [1, 1.8, 1.2, 1.6, 1] }}
          transition={{ duration: 0.18, repeat: Infinity, delay: i * 0.04 }}
        />
      ))}
      {/* Rockets. */}
      {[9, 21, 33, 45].map((x) => (
        <rect key={x} x={x} y={44} width={8} height={16} rx={1.5} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1.2} />
      ))}
      {/* The chair. */}
      <rect x={6} y={40} width={48} height={6} rx={1.5} fill="#a16207" stroke="#422006" strokeWidth={1.5} />
      <rect x={44} y={8} width={6} height={34} rx={1.5} fill="#a16207" stroke="#422006" strokeWidth={1.5} />
      {/* Po in it. */}
      <g transform="translate(6 2) scale(0.5)">
        <MiniPoShape />
      </g>
    </svg>
  );
}

/** The same Po as {@link MiniPo}, as bare shapes so it can be placed inside another SVG. */
function MiniPoShape() {
  return (
    <>
      <circle cx={18} cy={14} r={8} fill="#111" />
      <circle cx={62} cy={14} r={8} fill="#111" />
      <circle cx={40} cy={42} r={32} fill="#fafafa" stroke="#111" strokeWidth={2.5} />
      <ellipse cx={8} cy={46} rx={8} ry={12} fill="#111" />
      <ellipse cx={72} cy={46} rx={8} ry={12} fill="#111" />
      <ellipse cx={30} cy={32} rx={7} ry={8} fill="#111" transform="rotate(-20 30 32)" />
      <ellipse cx={50} cy={32} rx={7} ry={8} fill="#111" transform="rotate(20 50 32)" />
      <circle cx={31} cy={32} r={3.2} fill="#fff" />
      <circle cx={49} cy={32} r={3.2} fill="#fff" />
      <ellipse cx={40} cy={40} rx={4} ry={2.6} fill="#111" />
      <ellipse cx={40} cy={50} rx={7} ry={6} fill="#7f1d1d" stroke="#111" strokeWidth={1.5} />
    </>
  );
}

/** How long the scroll's visit takes (s). */
const SCROLL_SEC = 3.4;

/**
 * The Dragon Scroll, unrolling across Tai Lung's chest: two wooden rollers drawing apart over a
 * sheet of shining gold, a glint running over it — and his line from the film over the top, «ЗДЕСЬ
 * НИЧЕГО НЕТ!» — before it rolls back up. Every 20–30 s, first some 18 s in. `onOpen` is for the
 * sound.
 */
export function DragonScroll({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  const calm = useReducedMotion();
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        setId(Date.now());
        onOpen();
        next(20000 + Math.random() * 10000);
      }, wait);
    };
    next(18000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || id == null) return null;
  const open = [0, 0.15, 0.78, 0.92];
  return (
    <div key={id} aria-hidden className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="relative" style={{ width: '62%', height: '38%', marginTop: '6%' }}>
        {/* The gold sheet, opening from the middle out. */}
        <motion.div
          className="absolute inset-y-[6%] left-0 right-0 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #fef3c7, #fbbf24 30%, #fde68a 50%, #d97706 75%, #fef3c7)',
            border: '2px solid #92400e',
            transformOrigin: '50% 50%',
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 1, 1, 0] }}
          transition={{ duration: SCROLL_SEC, times: open, ease: 'easeInOut' }}
          onAnimationComplete={() => setId((cur) => (cur === id ? null : cur))}
        >
          <motion.div
            className="absolute inset-y-0 w-1/4"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
            animate={{ left: ['-30%', '130%'] }}
            transition={{ duration: 0.9, delay: 0.6, repeat: 1, repeatDelay: 0.4 }}
          />
        </motion.div>
        {/* The rollers, drawing apart and back. */}
        {[-1, 1].map((side) => (
          <motion.div
            key={side}
            className="absolute inset-y-0 w-[7%] rounded-full"
            style={{ left: '46.5%', background: 'linear-gradient(90deg, #7c2d12, #c2410c, #7c2d12)', border: '1.5px solid #431407' }}
            animate={{ x: ['0%', `${side * 700}%`, `${side * 700}%`, '0%'] }}
            transition={{ duration: SCROLL_SEC, times: open, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <motion.div
        className="absolute left-1/2 top-[8%] -translate-x-1/2 whitespace-nowrap text-xl font-black"
        style={{ color: '#fff', WebkitTextStroke: '1.5px #78350f', textShadow: '0 2px 0 #78350f', fontFamily: "'Russo One', sans-serif" }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.2, 1, 0.9], rotate: [0, 0, -4, 2, 0] }}
        transition={{ duration: SCROLL_SEC, times: [0, 0.3, 0.38, 0.75, 0.82] }}
      >
        ЗДЕСЬ НИЧЕГО НЕТ!
      </motion.div>
    </div>
  );
}
