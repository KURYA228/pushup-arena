import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Gru's freeze, on the fight screen itself rather than as a one-off scene:
 *
 *  - {@link IceBlock}: while reps are frozen he stands sealed in a block of ice, which is struck
 *    and cracks with every frozen rep — so you can see both that you're frozen and how much is left.
 *  - {@link FreezeRayWarning}: stop moving and his ray comes up in the corner and charges, with a
 *    count down to the shot. Move in time and it gives up. Without it the freeze just arrived
 *    out of nowhere, and nobody could tell what they had done to deserve it.
 */

/**
 * Where each frozen rep strikes the ice, in a 100×100 box: off-centre and spread out, so three of
 * them break up the whole block instead of piling onto one spot.
 */
const IMPACTS: [number, number][] = [
  [40, 34],
  [64, 60],
  [32, 72],
];

/** A tiny seeded random, so a crack keeps its shape across renders. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t * 16807) % 2147483647;
    return t / 2147483647;
  };
}

interface Fracture {
  /** The long jagged cracks running out from the strike, with their side branches. */
  rays: string[];
  /** Short connecting cracks between neighbouring rays: the web round the point of impact. */
  web: string[];
}

/**
 * One blow's worth of cracks, the way struck ice breaks: half a dozen jagged lines running out
 * from the point, each kinking as it goes and throwing off thinner branches, and a ring or two
 * of short cracks joining them up close to the strike.
 */
function fracture([cx, cy]: [number, number], seed: number): Fracture {
  const r = seeded(seed);
  const count = 6 + Math.floor(r() * 3);
  const rays: string[] = [];
  const joints: [number, number][][] = [];
  for (let i = 0; i < count; i += 1) {
    let a = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.6;
    let x = cx;
    let y = cy;
    const pts: [number, number][] = [[x, y]];
    const steps = 4 + Math.floor(r() * 3);
    const reach = 26 + r() * 30;
    for (let k = 0; k < steps; k += 1) {
      a += (r() - 0.5) * 0.7;
      const len = (reach / steps) * (0.6 + r() * 0.8);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      pts.push([x, y]);
      // A branch now and then, off to one side and shorter.
      if (k > 0 && r() < 0.45) {
        const b = a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6);
        let bx = x;
        let by = y;
        const bpts: [number, number][] = [[bx, by]];
        for (let j = 0; j < 2 + Math.floor(r() * 2); j += 1) {
          const bl = 4 + r() * 7;
          bx += Math.cos(b + (r() - 0.5) * 0.6) * bl;
          by += Math.sin(b + (r() - 0.5) * 0.6) * bl;
          bpts.push([bx, by]);
        }
        rays.push(path(bpts));
      }
    }
    rays.unshift(path(pts));
    joints.push(pts);
  }
  // The web: link each ray to the next at their first and second joints.
  const web: string[] = [];
  for (const ring of [1, 2]) {
    for (let i = 0; i < joints.length; i += 1) {
      const p = joints[i][ring];
      const q = joints[(i + 1) % joints.length][ring];
      if (!p || !q || r() < 0.3) continue;
      const mx = (p[0] + q[0]) / 2 + (r() - 0.5) * 3;
      const my = (p[1] + q[1]) / 2 + (r() - 0.5) * 3;
      web.push(path([p, [mx, my], q]));
    }
  }
  return { rays, web };
}

const path = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;

/**
 * One strike on the ice: the cracks drawn three times over — a dark line for the split's shadow
 * in the ice, the bright white edge on top, and a soft glow — plus a frosted, crushed spot where
 * it hit. Grows out from the point of impact in a fraction of a second, as a crack runs.
 */
export function Strike({ at, seed }: { at: [number, number]; seed: number }) {
  const f = useMemo(() => fracture(at, seed), [at, seed]);
  const line = (d: string, i: number, width: number, cls: string) => (
    <path key={`${cls}${i}`} d={d} className={cls} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  );
  return (
    <motion.div
      className="absolute inset-0"
      // Runs out from the strike: a circle opening from the point until it covers everything.
      initial={{ clipPath: `circle(0% at ${at[0]}% ${at[1]}%)` }}
      animate={{ clipPath: `circle(150% at ${at[0]}% ${at[1]}%)` }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <g transform="translate(0.5 0.7)" stroke="rgba(12, 52, 86, 0.55)">
          {f.rays.map((d, i) => line(d, i, i < 8 ? 2.2 : 1.4, 'shade'))}
          {f.web.map((d, i) => line(d, i, 1.2, 'shade-w'))}
        </g>
        <g stroke="rgba(255, 255, 255, 0.95)" style={{ filter: 'drop-shadow(0 0 1.5px rgba(224,242,254,0.9))' }}>
          {f.rays.map((d, i) => line(d, i, i < 8 ? 1.5 : 0.8, 'edge'))}
          {f.web.map((d, i) => line(d, i, 0.7, 'edge-w'))}
        </g>
      </svg>
      {/* The crushed spot: white, frosted, where the blow landed. */}
      <div
        className="absolute rounded-full"
        style={{
          left: `${at[0]}%`,
          top: `${at[1]}%`,
          width: 26,
          height: 26,
          marginLeft: -13,
          marginTop: -13,
          background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 35%, rgba(224,242,254,0) 70%)',
        }}
      />
    </motion.div>
  );
}

export function IceBlock({ frozenLeft, of }: { frozenLeft: number; of: number }) {
  const strikes = Math.max(0, Math.min(IMPACTS.length, of - frozenLeft));
  // A fresh pattern for every freeze, so no two blocks crack alike.
  const [seed] = useState(() => 1 + Math.floor(Math.random() * 100000));
  return (
    <AnimatePresence>
      {frozenLeft > 0 && (
        <motion.div
          key="ice"
          aria-hidden
          className="pointer-events-none absolute inset-[-4%] z-10 overflow-hidden rounded-[22%]"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(186,230,253,0.35) 18%, rgba(125,211,252,0.28) 50%, rgba(56,189,248,0.38) 100%)',
            border: '2px solid rgba(224,242,254,0.85)',
            boxShadow: 'inset 0 0 24px rgba(255,255,255,0.7), inset 0 0 60px rgba(125,211,252,0.6), 0 0 24px rgba(125,211,252,0.6)',
            backdropFilter: 'saturate(0.6) hue-rotate(10deg)',
            WebkitBackdropFilter: 'saturate(0.6) hue-rotate(10deg)',
          }}
          initial={{ opacity: 0, scale: 1.25 }}
          animate={{ opacity: 1, scale: 1 }}
          // Closes round him as the ray's bolt lands, not the moment you press.
          transition={{ type: 'spring', stiffness: 380, damping: 20, delay: SHOT_FLY_S }}
          // The break itself is a scene (ice-shatter); the block just goes.
          exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.15 } }}
        >
          {/* Glints down the face of it. */}
          <div className="absolute left-[12%] top-[6%] h-[40%] w-[10%] rotate-[18deg] rounded-full bg-white/50 blur-[2px]" />
          <div className="absolute left-[26%] top-[8%] h-[22%] w-[4%] rotate-[18deg] rounded-full bg-white/40 blur-[1px]" />
          {IMPACTS.slice(0, strikes).map((at, i) => (
            <Strike key={i} at={at} seed={seed + i * 7919} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** When the gun comes up, as a share of the pause that fires it. */
const SHOW_AT = 0.5;

/**
 * The ray charging while you rest. `lastRepAt` is when the last rep landed and `fireMs` the
 * pause that sets the freeze off (five seconds, plus whatever "Второе дыхание" adds). Shown
 * from half way through that pause; at the end it's charged and stays up, aimed, until the next
 * rep — and fires on that press, which is the rep that comes out frozen. `onFizzle` is called when a rep cuts the
 * charge short, for the sound.
 */
export function FreezeRayWarning({
  lastRepAt,
  fireMs,
  enabled,
  onFizzle,
  aimAt,
}: {
  lastRepAt: number | null;
  fireMs: number;
  enabled: boolean;
  onFizzle: () => void;
  /** Where Gru is on screen right now — the shot flies at him. */
  aimAt: () => { x: number; y: number } | null;
}) {
  const calm = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || lastRepAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [enabled, lastRepAt]);

  const idle = lastRepAt == null ? 0 : now - lastRepAt;
  const charging = enabled && lastRepAt != null && idle >= fireMs * SHOW_AT;
  const fired = charging && idle >= fireMs;
  const left = Math.max(1, Math.ceil((fireMs - idle) / 1000));
  const charge = Math.min(1, Math.max(0, (idle - fireMs * SHOW_AT) / (fireMs * (1 - SHOW_AT))));

  // A rep that lands while it's still charging makes it give up — that's the "pfff". Watched by
  // the change in `lastRepAt` against what was showing a moment before.
  // What was on screen is recorded after each render, so the render that brings the new rep
  // still sees what the one before it showed.
  const wasCharging = useRef(false);
  const lastSeen = useRef(lastRepAt);
  useEffect(() => {
    if (lastRepAt !== lastSeen.current) {
      if (wasCharging.current) onFizzle();
      lastSeen.current = lastRepAt;
    }
    wasCharging.current = charging && !fired;
  });

  // The shot. Once charged the gun waits, aimed, and the rep you finally make is what it fires
  // on — the bolt of ice leaves the nozzle on that press, and that's the rep that comes out
  // frozen. Where the nozzle was is kept while it waits: by the render that sees the rep, the
  // gun is already on its way out.
  const nozzleRef = useRef<HTMLDivElement>(null);
  const aimed = useRef<{ x: number; y: number } | null>(null);
  const shotFor = useRef(lastRepAt);
  const [shot, setShot] = useState<{ id: number; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  useEffect(() => {
    if (lastRepAt !== shotFor.current) {
      const to = aimAt();
      if (aimed.current && to) {
        const id = Date.now();
        setShot({ id, from: aimed.current, to });
        window.setTimeout(() => setShot((cur) => (cur?.id === id ? null : cur)), 1500);
      }
      shotFor.current = lastRepAt;
    }
    const r = fired ? nozzleRef.current?.getBoundingClientRect() : null;
    aimed.current = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  });

  if (calm) return null;
  return createPortal(
    <>
    {shot && <IceShot key={shot.id} from={shot.from} to={shot.to} />}
    <AnimatePresence>
      {charging && (
        <motion.div
          key={`ray-${lastRepAt}`}
          aria-hidden
          className="pointer-events-none fixed bottom-[22%] left-2 z-40 flex items-end gap-2"
          initial={{ x: -140, rotate: -20, opacity: 0 }}
          animate={{ x: 0, rotate: fired ? [-8, -2, -8] : -8, opacity: 1 }}
          exit={{ y: 60, rotate: 30, opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          <Gun charge={charge} fired={fired} nozzleRef={nozzleRef} />
          <motion.span
            key={fired ? 'fired' : left}
            className="mb-6 rounded-xl border-2 border-[#7dd3fc] bg-black/70 px-2 text-2xl font-black text-[#bae6fd]"
            style={{ fontFamily: "'Russo One', sans-serif", textShadow: '0 0 10px #38bdf8' }}
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          >
            {fired ? '❄ ЗАРЯЖЕНО' : left}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
    </>,
    document.body,
  );
}

/** How long the bolt is in the air. Gru's ice waits for it — see IceBlock and the freeze scene. */
export const SHOT_FLY_S = 0.5;

/**
 * The ray's shot: a bolt of ice flies out of the nozzle at Gru, trailing frost, and bursts on
 * him in a splash of ice and a ring of cold — and only then does the ice close round him.
 */
function IceShot({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const FLY = SHOT_FLY_S;
  const trail = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ delay: i * 0.03, s: 10 - i * 0.6, off: (Math.random() - 0.5) * 14 })), []);
  const shards = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        const d = 90 + Math.random() * 130;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, rot: Math.random() * 360, s: 0.6 + Math.random() * 0.8 };
      }),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {/* Frost left in its wake. */}
      {trail.map((t, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: from.x,
            top: from.y,
            width: t.s,
            height: t.s,
            marginLeft: -t.s / 2,
            marginTop: -t.s / 2,
            background: 'radial-gradient(circle, #ffffff, #7dd3fc 60%, transparent)',
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [0, dx], y: [t.off, dy + t.off], opacity: [0, 0.9, 0], scale: [0.6, 1.4] }}
          transition={{ duration: FLY, delay: t.delay, ease: 'easeIn' }}
        />
      ))}
      {/* The bolt: a long ice crystal pointing the way it flies. */}
      <motion.div
        className="absolute"
        style={{ left: from.x, top: from.y, width: 0, height: 0 }}
        initial={{ x: 0, y: 0, scale: 0.5, opacity: 1 }}
        animate={{ x: dx, y: dy, scale: 1.8, opacity: [1, 1, 0] }}
        transition={{ duration: FLY, ease: 'easeIn', opacity: { duration: FLY, times: [0, 0.92, 1] } }}
      >
        <motion.div
          style={{
            position: 'absolute',
            width: 46,
            height: 18,
            left: -30,
            top: -9,
            rotate: angle,
            clipPath: 'polygon(0 50%, 22% 8%, 70% 0, 100% 50%, 70% 100%, 22% 92%)',
            background: 'linear-gradient(90deg, rgba(186,230,253,0.4), #e0f2fe 40%, #ffffff 70%, #7dd3fc)',
            filter: 'drop-shadow(0 0 8px #38bdf8) drop-shadow(0 0 16px #0ea5e9)',
          }}
          animate={{ scaleY: [1, 0.85, 1] }}
          transition={{ duration: 0.12, repeat: Infinity }}
        />
      </motion.div>
      {/* The splash on arrival. */}
      <div className="absolute" style={{ left: to.x, top: to.y }}>
        <motion.div
          className="absolute"
          style={{
            width: 210,
            height: 210,
            left: -105,
            top: -105,
            clipPath:
              'polygon(50% 0, 58% 34%, 86% 12%, 66% 42%, 100% 50%, 66% 58%, 88% 88%, 58% 66%, 50% 100%, 42% 66%, 12% 88%, 34% 58%, 0 50%, 34% 42%, 14% 12%, 42% 34%)',
            background: 'radial-gradient(circle, #ffffff 0%, rgba(224,242,254,0.95) 25%, rgba(125,211,252,0.7) 55%, rgba(56,189,248,0) 80%)',
          }}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.15, 1], opacity: [0, 1, 0], rotate: 12 }}
          transition={{ duration: 0.8, delay: FLY - 0.03, times: [0, 0.25, 1], ease: 'easeOut' }}
        />
        <motion.div
          className="absolute rounded-full border-[5px]"
          style={{ width: 80, height: 80, left: -40, top: -40, borderColor: '#e0f2fe', boxShadow: '0 0 24px #38bdf8, inset 0 0 18px #7dd3fc' }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 4.5], opacity: [0, 1, 0] }}
          transition={{ duration: 0.7, delay: FLY - 0.03, ease: 'easeOut' }}
        />
        {shards.map((p, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              width: 14 * p.s,
              height: 22 * p.s,
              marginLeft: -7 * p.s,
              marginTop: -11 * p.s,
              clipPath: 'polygon(50% 0, 100% 40%, 60% 100%, 0 60%)',
              background: 'linear-gradient(140deg, #ffffff, #bae6fd 50%, #38bdf8)',
              filter: 'drop-shadow(0 0 4px #7dd3fc)',
            }}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
            animate={{ x: p.dx, y: p.dy + 60, opacity: [0, 1, 0], rotate: p.rot }}
            transition={{ duration: 0.8, delay: FLY - 0.03, ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/** Gru's freeze ray: a chunky grey blaster with a glowing coil that fills as it charges. */
function Gun({ charge, fired, nozzleRef }: { charge: number; fired: boolean; nozzleRef: React.Ref<HTMLDivElement> }) {
  const glow = `rgba(56,189,248,${0.25 + charge * 0.75})`;
  return (
    <div className="relative" style={{ width: 120, height: 70 }}>
      {/* Grip. */}
      <div className="absolute rounded-md bg-[#374151]" style={{ left: 18, top: 34, width: 20, height: 34, rotate: '12deg' }} />
      {/* Body. */}
      <div
        className="absolute rounded-xl border-2 border-[#1f2937]"
        style={{ left: 6, top: 14, width: 78, height: 30, background: 'linear-gradient(180deg, #9ca3af, #4b5563)' }}
      >
        {/* The coil, filling with blue. */}
        <div className="absolute inset-y-1.5 left-3 right-3 overflow-hidden rounded-md bg-[#1e293b]">
          <motion.div
            className="h-full"
            style={{ width: `${Math.round(charge * 100)}%`, background: 'linear-gradient(90deg, #0ea5e9, #bae6fd)', boxShadow: `0 0 12px ${glow}` }}
          />
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg, transparent 0 6px, rgba(0,0,0,0.35) 6px 8px)' }} />
        </div>
      </div>
      {/* Barrel and the bell of the nozzle. */}
      <div className="absolute rounded-r-md bg-[#6b7280]" style={{ left: 82, top: 21, width: 20, height: 16 }} />
      <motion.div
        ref={nozzleRef}
        className="absolute rounded-full border-2 border-[#1f2937]"
        style={{ left: 98, top: 14, width: 18, height: 30, background: `radial-gradient(circle, #e0f2fe, ${glow} 60%, #475569)` }}
        animate={{ boxShadow: [`0 0 ${8 + charge * 20}px ${glow}`, `0 0 ${14 + charge * 30}px ${glow}`] }}
        transition={{ duration: 0.3, repeat: Infinity, repeatType: 'reverse' }}
      />
      {/* The shot: a burst of cold off the nozzle. */}
      {fired && (
        <motion.div
          className="absolute rounded-full"
          style={{ left: 96, top: 4, width: 50, height: 50, background: 'radial-gradient(circle, #ffffff, rgba(125,211,252,0.7) 40%, transparent 70%)' }}
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
    </div>
  );
}
