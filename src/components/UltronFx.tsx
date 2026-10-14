import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Ultron's stage, from Avengers: Age of Ultron, drawn the way the other bosses' things are — in
 * CSS and SVG, no art files.
 *
 *  - {@link UltronAmbient}: what's always on while he's up — red arcs turning round the ring
 *    behind him, a red scanning line sweeping down over him, and a little HUD in the corner
 *    "analysing" you.
 *  - {@link DronePushups}: now and then three of his drones fly in, line up under him and do
 *    push-ups in perfect sync, counting them out — showing you how it's done — and fly off.
 *  - {@link PuppetStrings}: once in a while puppet strings drop onto him from above… and snap.
 *    «НЕТ НА МНЕ НИТОЧЕК!»
 *  - {@link RebootGlitch}: "Ложная смерть" made visible — at 1 HP he glitches, «ПЕРЕЗАГРУЗКА»,
 *    with the count of reps still needed to finish him.
 *  - {@link AvengersAssist}: now and then an Avenger joins in — Iron Man flies in and blasts him
 *    with a repulsor, or Captain America throws his shield, which rings off him and comes back.
 *  - {@link UltronDrone}, {@link Mjolnir}, {@link IronMan}, {@link CaptainAmerica}, {@link CapShield}: the figures those and his scenes are made of.
 */

/** The ring behind him in the artwork (15-absolute.jpg): centre and radius, as % of its width. */
const RING = { x: 52, y: 43, r: 32 };
/** What the HUD cycles through. */
const HUD_LINES = ['АНАЛИЗ…', 'ЦЕЛЬ: ЧЕЛОВЕК', 'УГРОЗА: НИЗКАЯ', 'ЭВОЛЮЦИЯ: 0%', 'ОТЖИМАНИЯ? СЛАБО'];

export function UltronAmbient({ active }: { active: boolean }) {
  const calm = useReducedMotion();
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (!active || calm) return;
    const id = window.setInterval(() => setLine((n) => (n + 1) % HUD_LINES.length), 2200);
    return () => window.clearInterval(id);
  }, [active, calm]);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="ultron"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Arcs turning round the ring behind him. */}
          <motion.div
            className="absolute"
            style={{ left: `${RING.x}%`, top: `${RING.y}%`, width: `${RING.r * 2}%`, aspectRatio: '1', translateX: '-50%', translateY: '-50%' }}
            animate={calm ? undefined : { rotate: 360 }}
            transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 4px #ef4444)' }}>
              <circle cx={50} cy={50} r={48} fill="none" stroke="#ef4444" strokeWidth={0.9} strokeDasharray="22 14 6 14" opacity={0.75} />
            </svg>
          </motion.div>

          {/* The scanner, sweeping down over him and starting again. */}
          {!calm && (
            <motion.div
              className="absolute inset-x-0 h-[3px]"
              style={{ background: 'linear-gradient(90deg, transparent, #ef4444 20%, #fecaca 50%, #ef4444 80%, transparent)', boxShadow: '0 0 10px #ef4444' }}
              animate={{ top: ['-2%', '102%'], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }}
            />
          )}

          {/* His HUD in the corner. */}
          <div
            className="absolute left-[3%] top-[4%] rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ color: '#fca5a5', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(239,68,68,0.6)' }}
          >
            <AnimatePresence mode="wait">
              <motion.span key={line} className="block" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                {HUD_LINES[line]}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One drone visit (s), and how many push-ups they do in it. */
const DRONE_SEC = 5.2;
const PUSHUPS = 5;
const FLY_IN = 0.8;
const PUSHUP_SEC = 0.6;

/**
 * Three of Ultron's drones flying in and landing in a row on the floor under him, then doing
 * push-ups in perfect sync while the count goes up over them — «1… 2… 3…» — with a taunt at the
 * end, and flying off. Showing a human how push-ups are done. First some 8 s in, then every
 * 14–20 s. `onPushup` gets each push-up's number as it's done, for a blip.
 */
export function DronePushups({
  active,
  span,
  onPushup,
}: {
  active: boolean;
  span: () => { left: number; right: number; bottom: number } | null;
  onPushup: (n: number) => void;
}) {
  const calm = useReducedMotion();
  const [visit, setVisit] = useState<{ id: number; left: number; right: number; floor: number } | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const timers: number[] = [];
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        const r = span();
        if (r) {
          setVisit({ id: Date.now(), left: r.left, right: r.right, floor: r.bottom });
          setCount(0);
          for (let i = 1; i <= PUSHUPS; i += 1) {
            timers.push(
              window.setTimeout(() => {
                setCount(i);
                onPushup(i);
              }, (FLY_IN + i * PUSHUP_SEC) * 1000),
            );
          }
        }
        next(14000 + Math.random() * 6000);
      }, wait);
    };
    next(8000);
    return () => {
      window.clearTimeout(t);
      timers.forEach((x) => window.clearTimeout(x));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || !visit) return null;
  const D = 46;
  const mid = (visit.left + visit.right) / 2;
  const xs = [-1, 0, 1].map((k) => mid + k * (D + 14) - D / 2);
  const ground = visit.floor - D * 0.8;
  const f = (s: number) => s / DRONE_SEC;
  const done = FLY_IN + PUSHUPS * PUSHUP_SEC + 0.2;
  return createPortal(
    <div key={visit.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {xs.map((x, i) => (
        <motion.div
          key={i}
          className="absolute left-0 top-0"
          initial={{ x, y: -80 }}
          animate={{ x, y: [-80, ground, ground, -120] }}
          transition={{ duration: DRONE_SEC, times: [0, f(FLY_IN + i * 0.08), f(done + 0.4), 1], ease: 'easeInOut' }}
          onAnimationComplete={() => i === 2 && setVisit((v) => (v?.id === visit.id ? null : v))}
        >
          {/* The push-ups: down and up together, squashing a little at the bottom. */}
          <motion.div
            style={{ transformOrigin: '50% 100%' }}
            animate={{ scaleY: [1, 1, ...Array.from({ length: PUSHUPS }, () => [0.55, 1]).flat(), 1], rotate: [0, 0, ...Array.from({ length: PUSHUPS }, () => [0, 0]).flat(), 0] }}
            transition={{
              duration: DRONE_SEC,
              times: [0, f(FLY_IN + 0.15), ...Array.from({ length: PUSHUPS }, (_, k) => [f(FLY_IN + (k + 0.5) * PUSHUP_SEC + 0.15), f(FLY_IN + (k + 1) * PUSHUP_SEC + 0.15)]).flat(), 1],
            }}
          >
            <UltronDrone size={D} pushing />
          </motion.div>
        </motion.div>
      ))}
      {/* The count, and the taunt. */}
      <div className="absolute -translate-x-1/2 text-center" style={{ left: mid, top: ground - 46 }}>
        <AnimatePresence mode="popLayout">
          {count > 0 && (
            <motion.div
              key={count}
              className="font-mono text-2xl font-black"
              style={{ color: '#fecaca', textShadow: '0 0 8px #ef4444, 0 2px 0 #450a0a' }}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {count}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          className="whitespace-nowrap rounded px-1.5 font-mono text-[12px] font-bold"
          style={{ color: '#fca5a5', background: 'rgba(0,0,0,0.6)', border: '1px solid #ef4444' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: DRONE_SEC, times: [0, f(done - 0.2), f(done), f(done + 1.1), f(done + 1.4)] }}
        >
          ВОТ ТАК, ЧЕЛОВЕК
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}

/** How long the strings' visit takes (s), and when they snap. */
const STRINGS_SEC = 3;
const SNAP_AT = 1.5;

/**
 * Puppet strings dropping onto Ultron from above, hooking his head and his shoulders, pulling
 * taut — and snapping, the loose ends whipping away. «НЕТ НА МНЕ НИТОЧЕК!» First some 18 s in,
 * then every 22–30 s. `onDrop` is told when the snap is (s from now), for the sound.
 */
export function PuppetStrings({ active, onDrop }: { active: boolean; onDrop: (snapAt: number) => void }) {
  const calm = useReducedMotion();
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        setId(Date.now());
        onDrop(SNAP_AT);
        next(22000 + Math.random() * 8000);
      }, wait);
    };
    next(18000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || id == null) return null;
  const f = (s: number) => s / STRINGS_SEC;
  // Where they hook on: his head and both shoulders, as % of the picture.
  const HOOKS = [
    { x: 52, y: 14 },
    { x: 22, y: 62 },
    { x: 80, y: 66 },
  ];
  return (
    <div key={id} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {HOOKS.map((h, i) => (
        <div key={i} className="absolute" style={{ left: `${h.x}%`, top: `${h.y}%` }}>
          {/* The string: down from above to the hook, taut, then the two halves whipping apart. */}
          {[0, 1].map((half) => (
            <motion.div
              key={half}
              className="absolute left-0 w-[2px] -translate-x-1/2 bg-red-200"
              style={{ bottom: half ? undefined : 0, top: half ? -240 : undefined, height: half ? 120 : 120, transformOrigin: half ? '50% 0%' : '50% 100%', boxShadow: '0 0 4px #f87171' }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{
                scaleY: [0, 1, 1, 1, 0.4],
                opacity: [0, 1, 1, 1, 0],
                rotate: [0, 0, 0, half ? 25 - i * 10 : -30 + i * 12, half ? 50 - i * 20 : -70 + i * 25],
                y: [0, 0, 0, half ? -30 : 20, half ? -80 : 60],
              }}
              transition={{ duration: STRINGS_SEC, times: [0, f(0.5), f(SNAP_AT), f(SNAP_AT + 0.15), f(SNAP_AT + 0.9)] }}
            />
          ))}
          {/* The snap: a spark at the break. */}
          <motion.span
            className="absolute block h-3 w-3 -translate-x-1/2 rounded-full"
            style={{ top: -126, background: 'radial-gradient(circle, #fff, #ef4444 60%, transparent)' }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 2.4, 0.5] }}
            transition={{ duration: STRINGS_SEC, times: [0, f(SNAP_AT - 0.01), f(SNAP_AT + 0.05), f(SNAP_AT + 0.35)], delay: i * 0.07 }}
          />
        </div>
      ))}
      <motion.div
        className="absolute left-1/2 top-[6%] -translate-x-1/2 whitespace-nowrap text-lg font-black"
        style={{ color: '#fff', WebkitTextStroke: '1.5px #7f1d1d', textShadow: '0 2px 0 #7f1d1d', fontFamily: "'Russo One', sans-serif" }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.25, 1, 0.9] }}
        transition={{ duration: STRINGS_SEC, times: [0, f(SNAP_AT), f(SNAP_AT + 0.12), f(STRINGS_SEC - 0.4), 1] }}
      >
        НЕТ НА МНЕ НИТОЧЕК!
      </motion.div>
    </div>
  );
}

/**
 * "Ложная смерть", made visible: while he's held at 1 HP his picture glitches — red and cyan
 * copies tearing sideways, bands of it jumping — with «ПЕРЕЗАГРУЗКА» and how many reps in a row
 * are still needed to finish him.
 */
export function RebootGlitch({ active, done, of }: { active: boolean; done: number; of: number }) {
  const calm = useReducedMotion();
  const bands = useMemo(() => Array.from({ length: 4 }, () => ({ top: Math.random() * 85, h: 4 + Math.random() * 10, d: 0.3 + Math.random() * 0.4 })), []);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="reboot"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {!calm &&
            bands.map((b, i) => (
              <motion.div
                key={i}
                className="absolute inset-x-0"
                style={{ top: `${b.top}%`, height: `${b.h}%`, background: i % 2 ? 'rgba(34,211,238,0.28)' : 'rgba(239,68,68,0.32)', mixBlendMode: 'screen' }}
                animate={{ x: ['0%', i % 2 ? '6%' : '-6%', '0%', i % 2 ? '-3%' : '4%', '0%'], opacity: [0, 1, 0.3, 1, 0] }}
                transition={{ duration: b.d, repeat: Infinity, repeatDelay: 0.4 + i * 0.2 }}
              />
            ))}
          <motion.div
            className="absolute inset-0"
            style={{ boxShadow: 'inset 0 0 40px rgba(239,68,68,0.8)' }}
            animate={calm ? { opacity: 0.7 } : { opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.7, repeat: Infinity }}
          />
          <div className="absolute inset-x-0 bottom-[6%] text-center font-mono font-black" style={{ color: '#fecaca', textShadow: '0 0 8px #ef4444, 0 2px 0 #000' }}>
            <motion.div className="text-sm" animate={calm ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
              ПЕРЕЗАГРУЗКА…
            </motion.div>
            <div className="text-[11px]">
              добей без паузы: {done}/{of}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One of Ultron's drones: a dark steel pod with a red eye cluster and stubby arms. */
export function UltronDrone({ size, pushing = false }: { size: number; pushing?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" aria-hidden style={{ overflow: 'visible' }}>
      {/* Arms out to the floor for the push-ups, or folded up for flying. */}
      {pushing ? (
        <path d="M10 30 L2 46 M40 30 L48 46" stroke="#374151" strokeWidth={4} strokeLinecap="round" />
      ) : (
        <path d="M10 26 L2 18 M40 26 L48 18" stroke="#374151" strokeWidth={4} strokeLinecap="round" />
      )}
      <ellipse cx={25} cy={26} rx={17} ry={16} fill="#1f2937" stroke="#0b0d12" strokeWidth={2} />
      <path d="M12 20 C18 14 32 14 38 20" stroke="#4b5563" strokeWidth={2} fill="none" />
      <path d="M14 32 L36 32 M18 38 L32 38" stroke="#374151" strokeWidth={1.5} />
      <circle cx={19} cy={25} r={2.6} fill="#ef4444" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
      <circle cx={31} cy={25} r={2.6} fill="#ef4444" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
      <circle cx={25} cy={30} r={2} fill="#ef4444" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
    </svg>
  );
}

/** Mjolnir: Thor's hammer — a grey block head with a leather-wrapped handle and a strap. */
export function Mjolnir({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden style={{ filter: 'drop-shadow(0 0 8px #93c5fd)' }}>
      <rect x={10} y={6} width={40} height={24} rx={3} fill="#9ca3af" stroke="#374151" strokeWidth={2.5} />
      <path d="M14 12 L46 12 M14 24 L46 24" stroke="#d1d5db" strokeWidth={1.5} />
      <rect x={26} y={30} width={8} height={22} rx={2} fill="#78350f" stroke="#451a03" strokeWidth={1.5} />
      <path d="M26 35 L34 38 M26 41 L34 44 M26 47 L34 50" stroke="#451a03" strokeWidth={1.2} />
      <path d="M30 52 C24 58 36 58 30 52" stroke="#78350f" strokeWidth={2} fill="none" />
    </svg>
  );
}

/** Who joins in. */
export type Avenger = 'ironman' | 'cap';
/** One Avenger's visit (s), and when their blow lands. */
const ASSIST_SEC = 3.2;
const ASSIST_HIT = 1.4;

/**
 * An Avenger joining in, every 10–15 s — Iron Man and Captain America by turns, first some 6 s
 * in. Iron Man flies down to hover beside Ultron, a repulsor charging in his palm, and blasts him
 * with a beam — «ПИУ!» — before rocketing off. Cap runs in along the floor and throws his shield;
 * it spins over, rings off Ultron in a star of sparks — «ДЗЫНЬ!» — and curves back into his hand,
 * and off he goes. `onAssist` is told who and when the blow lands (s from now), for the sound;
 * `onHit` is called as it lands, for jolting the picture.
 */
export function AvengersAssist({
  active,
  span,
  onAssist,
  onHit,
}: {
  active: boolean;
  span: () => { left: number; right: number; top: number; bottom: number } | null;
  onAssist: (who: Avenger, hitAt: number) => void;
  onHit: (who: Avenger) => void;
}) {
  const calm = useReducedMotion();
  const [visit, setVisit] = useState<{ id: number; who: Avenger; side: -1 | 1; r: { left: number; right: number; top: number; bottom: number } } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    let turn: Avenger = Math.random() < 0.5 ? 'ironman' : 'cap';
    const timers: number[] = [];
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        const r = span();
        if (r) {
          const who = turn;
          turn = turn === 'ironman' ? 'cap' : 'ironman';
          setVisit({ id: Date.now(), who, side: Math.random() < 0.5 ? -1 : 1, r });
          onAssist(who, ASSIST_HIT);
          timers.push(window.setTimeout(() => onHit(who), ASSIST_HIT * 1000));
        }
        next(10000 + Math.random() * 5000);
      }, wait);
    };
    next(6000);
    return () => {
      window.clearTimeout(t);
      timers.forEach((x) => window.clearTimeout(x));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm || !visit) return null;
  const { r, side, who } = visit;
  const w = window.innerWidth;
  const mid = (r.left + r.right) / 2;
  const chest = r.top + (r.bottom - r.top) * 0.55;
  const S = 64;
  const f = (s: number) => s / ASSIST_SEC;
  const done = () => setVisit((v) => (v?.id === visit.id ? null : v));
  const word = {
    color: '#fff',
    WebkitTextStroke: '1.5px #1e3a8a',
    textShadow: '0 3px 0 #b91c1c',
    fontFamily: "'Russo One', sans-serif",
  } as const;

  if (who === 'ironman') {
    // Hovering beside the picture, a little above his chest, facing him.
    const hx = side < 0 ? Math.max(4, r.left - S * 0.2) : Math.min(w - S - 4, r.right - S * 0.8);
    const hy = Math.max(10, r.top - S * 0.3);
    const fromX = side < 0 ? -S - 40 : w + 40;
    const face = side < 0 ? 1 : -1;
    // The beam: from his palm to Ultron's chest.
    const px = hx + (side < 0 ? S * 0.95 : S * 0.05);
    const py = hy + S * 0.42;
    const dx = mid - px;
    const dy = chest - py;
    return createPortal(
      <div key={visit.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <motion.div
          className="absolute left-0 top-0"
          initial={{ x: fromX, y: -S }}
          animate={{ x: [fromX, hx, hx, hx, fromX], y: [-S, hy, hy - 4, hy + 4, -S - 60], rotate: [face * 30, 0, face * -8, 0, face * -30] }}
          transition={{ duration: ASSIST_SEC, times: [0, f(0.7), f(ASSIST_HIT), f(2.2), 1], ease: 'easeInOut' }}
          onAnimationComplete={done}
        >
          <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>
            <div style={{ transform: `scaleX(${face})` }}>
              <IronMan size={S} />
            </div>
          </motion.div>
        </motion.div>
        {/* The charge in his palm. */}
        <motion.span
          className="absolute block rounded-full"
          style={{ left: px - 8, top: py - 8, width: 16, height: 16, background: 'radial-gradient(circle, #fff, #67e8f9 50%, transparent)' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1, 2.2, 0.5] }}
          transition={{ duration: ASSIST_SEC, times: [0, f(0.75), f(ASSIST_HIT - 0.05), f(ASSIST_HIT + 0.05), f(ASSIST_HIT + 0.3)] }}
        />
        {/* The beam. */}
        <motion.div
          className="absolute h-[7px] rounded-full"
          style={{
            left: px,
            top: py - 3.5,
            width: Math.hypot(dx, dy),
            transformOrigin: '0% 50%',
            rotate: (Math.atan2(dy, dx) * 180) / Math.PI,
            background: 'linear-gradient(90deg, #ffffff, #a5f3fc 40%, #22d3ee)',
            boxShadow: '0 0 12px #22d3ee, 0 0 24px #67e8f9',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 0, 1, 1, 1], opacity: [0, 0, 1, 1, 0], scaleY: [1, 1, 1, 1.4, 0.3] }}
          transition={{ duration: ASSIST_SEC, times: [0, f(ASSIST_HIT - 0.06), f(ASSIST_HIT), f(ASSIST_HIT + 0.25), f(ASSIST_HIT + 0.45)] }}
        />
        {/* Where it hits. */}
        <motion.div
          className="absolute rounded-full"
          style={{ left: mid - 50, top: chest - 50, width: 100, height: 100, background: 'radial-gradient(circle, #fff 0%, #a5f3fc 30%, transparent 70%)' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 1, 1.8] }}
          transition={{ duration: ASSIST_SEC, times: [0, f(ASSIST_HIT), f(ASSIST_HIT + 0.08), f(ASSIST_HIT + 0.5)] }}
        />
        <motion.div
          className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-black"
          style={{ left: mid, top: r.top + 6, ...word }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.3, 1, 0.9] }}
          transition={{ duration: ASSIST_SEC, times: [0, f(ASSIST_HIT), f(ASSIST_HIT + 0.1), f(ASSIST_HIT + 0.8), f(ASSIST_HIT + 1)] }}
        >
          ПИУ!
        </motion.div>
      </div>,
      document.body,
    );
  }

  // Captain America: runs in along the floor, throws, catches, runs off.
  const ground = r.bottom - S;
  const fromX = side < 0 ? -S - 30 : w + 30;
  const standX = side < 0 ? Math.max(4, r.left - S * 0.15) : Math.min(w - S - 4, r.right - S * 0.85);
  const face = side < 0 ? 1 : -1;
  const handX = standX + S / 2 + face * S * 0.3;
  const handY = ground + S * 0.35;
  const SH = 30;
  const THROW = 0.9;
  const BACK = ASSIST_HIT + (ASSIST_HIT - THROW);
  return createPortal(
    <div key={visit.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <motion.div
        className="absolute left-0"
        style={{ top: ground }}
        initial={{ x: fromX }}
        animate={{ x: [fromX, standX, standX, standX, fromX] }}
        transition={{ duration: ASSIST_SEC, times: [0, f(0.7), f(THROW), f(BACK + 0.1), 1], ease: 'easeInOut' }}
        onAnimationComplete={done}
      >
        {/* The throw: a wind-up and a lunge. */}
        <motion.div
          style={{ transformOrigin: '50% 100%' }}
          animate={{ rotate: [0, 0, face * -12, face * 10, 0, 0], y: [0, -4, 0, -4, 0, 0] }}
          transition={{ duration: ASSIST_SEC, times: [0, f(0.35), f(THROW - 0.1), f(THROW + 0.05), f(THROW + 0.3), 1] }}
        >
          <div style={{ transform: `scaleX(${face})` }}>
            <CaptainAmerica size={S} />
          </div>
        </motion.div>
      </motion.div>
      {/* The shield: carried in, thrown spinning in an arc, ringing off him, curving back. */}
      <motion.div
        className="absolute left-0 top-0"
        style={{ width: SH, height: SH }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 0, 1, 1, 1, 0],
          x: [handX - SH / 2, handX - SH / 2, handX - SH / 2, mid - SH / 2, (handX + mid) / 2 - SH / 2, handX - SH / 2],
          y: [handY - SH / 2, handY - SH / 2, handY - SH / 2, chest - SH / 2, chest - 90, handY - SH / 2],
          rotate: [0, 0, 0, 720, 1080, 1440],
        }}
        transition={{ duration: ASSIST_SEC, times: [0, f(0.6), f(THROW), f(ASSIST_HIT), f((ASSIST_HIT + BACK) / 2), f(BACK)], ease: 'linear' }}
      >
        <CapShield size={SH} />
      </motion.div>
      {/* The clang: a star of sparks where it rings off him. */}
      <motion.div
        className="absolute"
        style={{ left: mid - 30, top: chest - 30, width: 60, height: 60 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 1.3, 0.8], rotate: [0, 0, 0, 30] }}
        transition={{ duration: ASSIST_SEC, times: [0, f(ASSIST_HIT), f(ASSIST_HIT + 0.06), f(ASSIST_HIT + 0.4)] }}
      >
        <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 6px #fde68a)' }}>
          <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="#fff" />
        </svg>
      </motion.div>
      <motion.div
        className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-black"
        style={{ left: mid, top: r.top + 6, ...word }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.3, 1, 0.9] }}
        transition={{ duration: ASSIST_SEC, times: [0, f(ASSIST_HIT), f(ASSIST_HIT + 0.1), f(ASSIST_HIT + 0.8), f(ASSIST_HIT + 1)] }}
      >
        ДЗЫНЬ!
      </motion.div>
    </div>,
    document.body,
  );
}

/** Iron Man, flying: red and gold armour, a glowing arc reactor, one arm out, jets at his boots. Faces right. */
export function IronMan({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden style={{ overflow: 'visible' }}>
      {/* Boot jets. */}
      {[22, 32].map((x, i) => (
        <motion.path
          key={x}
          d={`M${x} 56 L${x + 3} 66 L${x + 6} 56 Z`}
          fill="#a5f3fc"
          style={{ transformOrigin: `${x + 3}px 56px` }}
          animate={{ scaleY: [1, 1.6, 1] }}
          transition={{ duration: 0.15, repeat: Infinity, delay: i * 0.05 }}
        />
      ))}
      <rect x={21} y={40} width={8} height={17} rx={2} fill="#b91c1c" stroke="#450a0a" strokeWidth={1.2} />
      <rect x={31} y={40} width={8} height={17} rx={2} fill="#b91c1c" stroke="#450a0a" strokeWidth={1.2} />
      <path d="M18 22 L42 22 L40 42 L20 42 Z" fill="#dc2626" stroke="#450a0a" strokeWidth={1.5} />
      <path d="M22 30 L38 30 L36 40 L24 40 Z" fill="#eab308" />
      <circle cx={30} cy={27} r={3.2} fill="#cffafe" style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
      {/* The firing arm, out towards him, and the other at his side. */}
      <path d="M40 26 L56 26" stroke="#dc2626" strokeWidth={6} strokeLinecap="round" />
      <circle cx={57} cy={26} r={3} fill="#eab308" />
      <path d="M20 26 L14 38" stroke="#dc2626" strokeWidth={6} strokeLinecap="round" />
      {/* Helmet: red with the gold faceplate and white eye slits. */}
      <path d="M21 10 C21 0 39 0 39 10 L39 18 C39 22 21 22 21 18 Z" fill="#dc2626" stroke="#450a0a" strokeWidth={1.5} />
      <path d="M24 9 L36 9 L35 19 L25 19 Z" fill="#eab308" stroke="#854d0e" strokeWidth={1} />
      <path d="M25.5 12 L29 12.5 M31 12.5 L34.5 12" stroke="#ecfeff" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

/** Captain America: blue suit, the white star on his chest, red and white stripes, the helmet with its A. Faces right. */
export function CaptainAmerica({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden style={{ overflow: 'visible' }}>
      <rect x={21} y={40} width={8} height={18} rx={2} fill="#1e3a8a" />
      <rect x={31} y={40} width={8} height={18} rx={2} fill="#1e3a8a" />
      <rect x={20} y={54} width={10} height={5} rx={1.5} fill="#7f1d1d" />
      <rect x={30} y={54} width={10} height={5} rx={1.5} fill="#7f1d1d" />
      <path d="M18 20 L42 20 L40 42 L20 42 Z" fill="#1d4ed8" stroke="#172554" strokeWidth={1.5} />
      <path d="M22 32 L38 32 M22 36 L38 36 M22 40 L38 40" stroke="#dc2626" strokeWidth={2} />
      <path d="M22 34 L38 34 M22 38 L38 38" stroke="#f8fafc" strokeWidth={2} />
      <path d="M30 22 L31.5 26 L35.5 26 L32.3 28.4 L33.5 32 L30 29.8 L26.5 32 L27.7 28.4 L24.5 26 L28.5 26 Z" fill="#f8fafc" />
      <path d="M42 24 L52 20" stroke="#1d4ed8" strokeWidth={6} strokeLinecap="round" />
      <circle cx={53} cy={20} r={3} fill="#7f1d1d" />
      <path d="M18 24 L12 34" stroke="#1d4ed8" strokeWidth={6} strokeLinecap="round" />
      <circle cx={11.5} cy={35} r={3} fill="#7f1d1d" />
      {/* Head: helmet with the white A and wings, his chin below. */}
      <path d="M21 12 C21 1 39 1 39 12 L39 15 L21 15 Z" fill="#1d4ed8" stroke="#172554" strokeWidth={1.5} />
      <path d="M27.5 11 L30 4.5 L32.5 11 M28.4 9 L31.6 9" stroke="#f8fafc" strokeWidth={1.5} fill="none" />
      <path d="M22 9 L19 6 M38 9 L41 6" stroke="#f8fafc" strokeWidth={1.5} />
      <path d="M22 15 L38 15 L36 20 C33 22 27 22 24 20 Z" fill="#f2c4a0" stroke="#7c2d12" strokeWidth={1} />
      <path d="M26 13 L28.5 13.3 M31.5 13.3 L34 13" stroke="#111" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/** Cap's shield: red and white rings, a blue disc, a white star. */
export function CapShield({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}>
      <circle cx={20} cy={20} r={19} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1} />
      <circle cx={20} cy={20} r={15} fill="#f8fafc" />
      <circle cx={20} cy={20} r={11} fill="#dc2626" />
      <circle cx={20} cy={20} r={7.5} fill="#1d4ed8" />
      <path d="M20 13.5 L21.5 18 L26.2 18 L22.4 20.8 L23.8 25.3 L20 22.5 L16.2 25.3 L17.6 20.8 L13.8 18 L18.5 18 Z" fill="#f8fafc" />
    </svg>
  );
}
