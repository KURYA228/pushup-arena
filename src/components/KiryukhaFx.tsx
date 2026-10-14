import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Kiryukha's stage — the master of the arena, a gladiator among ruins — drawn the way the other
 * bosses' things are, in CSS and SVG, no art files.
 *
 *  - {@link KiryukhaAmbient}: what's always on while he's up — dust drifting through the air
 *    over the ruins and lightning flickering in the storm behind him.
 *  - {@link RomanEvents}: the arena putting on a show, one set piece at a time — a chariot race,
 *    a lion that thinks better of it, him posing for the crowd's cameras, a volley of arrows
 *    bouncing off him, a phalanx of spartans marching past.
 *  - {@link RageAura}: "Ярость" made visible — under 40% HP he's wreathed in a red glow with
 *    embers coming off him.
 *  - {@link StillStanding}: "Ложная смерть" made visible — at 1 HP, «ОН ЕЩЁ СТОИТ» and the count
 *    of reps in a row it still takes.
 *  - {@link Spartan}, {@link Laurel}: the figures those and his last scene are
 *    made of.
 */

export function KiryukhaAmbient({ active }: { active: boolean }) {
  const calm = useReducedMotion();
  const dust = useMemo(
    () => Array.from({ length: 14 }, () => ({ x: Math.random() * 100, y: 30 + Math.random() * 65, s: 2 + Math.random() * 3, d: 5 + Math.random() * 5, delay: Math.random() * 6 })),
    [],
  );
  const [flash, setFlash] = useState<number | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        setFlash(Date.now());
        next(5000 + Math.random() * 6000);
      }, wait);
    };
    next(3000);
    return () => window.clearTimeout(t);
  }, [active, calm]);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="kiryukha"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* The storm lighting up behind him. */}
          {flash != null && (
            <motion.div
              key={flash}
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(226,232,240,0.45), transparent 50%)', mixBlendMode: 'screen' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.15, 0.7, 0] }}
              transition={{ duration: 0.6, times: [0, 0.08, 0.2, 0.3, 1] }}
            />
          )}
          {/* Dust in the air, catching the light. */}
          {!calm &&
            dust.map((d, i) => (
              <motion.span
                key={i}
                className="absolute block rounded-full"
                style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, background: 'rgba(253,230,200,0.7)', filter: 'blur(0.5px)' }}
                animate={{ x: [0, 30, 60], y: [0, -12, 4], opacity: [0, 0.8, 0] }}
                transition={{ duration: d.d, delay: d.delay, repeat: Infinity, ease: 'linear' }}
              />
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The set pieces that take turns on his stage. */
export type RomanEvent = 'chariot' | 'lion' | 'flex' | 'arrows' | 'spartans';
const EVENTS: RomanEvent[] = ['chariot', 'lion', 'flex', 'arrows', 'spartans'];
/** How long each one runs (s). */
const EVENT_SEC: Record<RomanEvent, number> = { chariot: 3, lion: 4.2, flex: 2.6, arrows: 3, spartans: 4.5 };
/** Beats inside them, for the sounds and the picture's moves (s from the start). */
export const SPARTAN_BEATS = [1.4, 2.1, 2.8];
export const LION_ROAR_AT = 0.9;
export const LION_MEOW_AT = 2.1;
export const FLEX_BEATS = [0.3, 1, 1.7];
export const ARROWS_LAND_AT = 0.8;

/**
 * The arena putting on a show around him: one set piece at a time, every 4–7 s, never the same
 * one twice running, first a few seconds in.
 *
 *  - a chariot thundering across the floor in a cloud of dust;
 *  - a lion bounding in and roaring at him — and, on getting a proper look at him, a tiny meow
 *    and a hasty exit;
 *  - him striking a pose while the crowd's cameras go off all round — «ПОЗИРУЕТ»;
 *  - a volley of arrows raining down on him and bouncing off — «ЩЕКОТНО»;
 *  - a little phalanx of spartans marching across, «АУ! АУ! АУ!».
 *
 * `onEvent` is told which one is starting, for its sound and for anything the fight screen does
 * to his picture (the pose).
 */
export function RomanEvents({
  active,
  span,
  onEvent,
}: {
  active: boolean;
  span: () => { left: number; right: number; top: number; bottom: number } | null;
  onEvent: (kind: RomanEvent) => void;
}) {
  const calm = useReducedMotion();
  const [ev, setEv] = useState<{ id: number; kind: RomanEvent; dir: -1 | 1; r: { left: number; right: number; top: number; bottom: number } } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let t = 0;
    let last: RomanEvent | null = null;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        const r = span();
        if (r) {
          const pool = EVENTS.filter((e) => e !== last);
          const kind = pool[Math.floor(Math.random() * pool.length)];
          last = kind;
          setEv({ id: Date.now(), kind, dir: Math.random() < 0.5 ? -1 : 1, r });
          onEvent(kind);
        }
        next(4000 + Math.random() * 3000);
      }, wait);
    };
    next(3000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  // Cleared once it's had its time, so nothing lingers between them.
  useEffect(() => {
    if (!ev) return;
    const id = ev.id;
    const t = window.setTimeout(() => setEv((cur) => (cur?.id === id ? null : cur)), EVENT_SEC[ev.kind] * 1000 + 200);
    return () => window.clearTimeout(t);
  }, [ev]);

  if (!active || calm || !ev) return null;
  const body =
    ev.kind === 'chariot' ? <Chariot dir={ev.dir} floor={ev.r.bottom} /> :
    ev.kind === 'lion' ? <LionGag dir={ev.dir} r={ev.r} /> :
    ev.kind === 'flex' ? <FlexPose r={ev.r} /> :
    ev.kind === 'arrows' ? <ArrowVolley r={ev.r} /> :
    <SpartanMarch dir={ev.dir} floor={ev.r.bottom} />;
  return createPortal(
    <div key={ev.id} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {body}
    </div>,
    document.body,
  );
}

const SHOUT = { WebkitTextStroke: '1.5px #78350f', textShadow: '0 3px 0 #78350f', fontFamily: "'Russo One', sans-serif" } as const;

/** A chariot and its horse thundering across the floor under him, dust boiling up behind. */
function Chariot({ dir, floor }: { dir: -1 | 1; floor: number }) {
  const w = window.innerWidth;
  const S = 110;
  const from = dir === 1 ? -S - 40 : w + 40;
  const to = dir === 1 ? w + 40 : -S - 40;
  const D = EVENT_SEC.chariot;
  return (
    <>
      <motion.div
        className="absolute left-0"
        style={{ top: floor - S * 0.62 }}
        initial={{ x: from }}
        animate={{ x: to, y: [0, -3, 0, -3, 0, -3, 0, -3, 0, -3, 0] }}
        transition={{ duration: D, ease: [0.3, 0, 0.7, 1], y: { duration: D, ease: 'linear' } }}
      >
        <div style={{ transform: `scaleX(${dir})` }}>
          <ChariotFigure size={S} />
        </div>
      </motion.div>
      {/* The dust it kicks up, left hanging behind it. */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = 0.1 + i * 0.1;
        const x = from + (to - from) * t;
        return (
          <motion.span
            key={i}
            className="absolute block rounded-full"
            style={{ left: x + S * 0.3, top: floor - 30, width: 40, height: 40, background: 'radial-gradient(circle at 40% 35%, #f5e6cf, #d6b48a 55%, rgba(168,135,95,0.3))' }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0, 0.8, 0], scale: [0.3, 0.3, 1.4, 2], y: [0, 0, -14, -26] }}
            transition={{ duration: D * t + 1.2, times: [0, (D * t) / (D * t + 1.2), (D * t + 0.2) / (D * t + 1.2), 1] }}
          />
        );
      })}
    </>
  );
}

/**
 * A lion bounding in from the side, stopping in front of him and roaring — «РРРААА!» — then a
 * beat, a good look up at who that is, a tiny «мяу…», and off it scurries the way it came.
 */
function LionGag({ dir, r }: { dir: -1 | 1; r: { left: number; right: number; bottom: number } }) {
  const w = window.innerWidth;
  const S = 84;
  const from = dir === 1 ? -S - 30 : w + 30;
  const stop = (r.left + r.right) / 2 - S / 2 - dir * 70;
  const D = EVENT_SEC.lion;
  const f = (s: number) => s / D;
  return (
    <>
      <motion.div
        className="absolute left-0"
        style={{ top: r.bottom - S * 0.75 }}
        initial={{ x: from }}
        animate={{ x: [from, stop, stop, stop - dir * 10, from] }}
        transition={{ duration: D, times: [0, f(0.7), f(LION_MEOW_AT), f(LION_MEOW_AT + 0.4), 1], ease: 'easeInOut' }}
      >
        {/* Facing him on the way in and the roar; turned tail on the way out, a little smaller. */}
        <motion.div
          animate={{ scaleX: [dir, dir, dir, -dir, -dir], scaleY: [1, 1.12, 1, 0.85, 0.85], y: [0, -6, 0, 4, 4] }}
          transition={{ duration: D, times: [0, f(LION_ROAR_AT), f(LION_ROAR_AT + 0.8), f(LION_MEOW_AT + 0.4), 1] }}
          style={{ transformOrigin: '50% 100%' }}
        >
          <Lion size={S} />
        </motion.div>
      </motion.div>
      <motion.div
        className="absolute whitespace-nowrap text-3xl font-black"
        style={{ left: stop + (dir === 1 ? S : -40), top: r.bottom - S - 30, color: '#fde68a', ...SHOUT }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.3, 1.1, 1] }}
        transition={{ duration: D, times: [0, f(LION_ROAR_AT), f(LION_ROAR_AT + 0.1), f(LION_ROAR_AT + 0.8), f(LION_ROAR_AT + 1)] }}
      >
        РРРААА!
      </motion.div>
      <motion.div
        className="absolute whitespace-nowrap text-sm font-bold italic"
        style={{ left: stop + S * 0.3, top: r.bottom - S - 6, color: '#fef3c7', textShadow: '0 1px 2px #000' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], y: [0, 0, 0, -6, -10] }}
        transition={{ duration: D, times: [0, f(LION_MEOW_AT), f(LION_MEOW_AT + 0.1), f(LION_MEOW_AT + 0.9), f(LION_MEOW_AT + 1.2)] }}
      >
        мяу…
      </motion.div>
    </>
  );
}

/**
 * Him striking a pose: the crowd's camera flashes popping all round his picture, gold sparkles
 * off him, «ПОЗИРУЕТ». (The flex itself — his picture pumping three times — is the fight
 * screen's, on the beats in FLEX_BEATS.)
 */
function FlexPose({ r }: { r: { left: number; right: number; top: number; bottom: number } }) {
  const flashes = useMemo(
    () =>
      Array.from({ length: 12 }, () => {
        const side = Math.random() < 0.5;
        return {
          x: side ? (Math.random() < 0.5 ? r.left - 10 + Math.random() * 30 : r.right - 20 + Math.random() * 30) : r.left + Math.random() * (r.right - r.left),
          y: side ? r.top + Math.random() * (r.bottom - r.top) : Math.random() < 0.5 ? r.top - 10 + Math.random() * 20 : r.bottom - 10 + Math.random() * 20,
          at: Math.random() * (EVENT_SEC.flex - 0.6),
        };
      }),
    [r],
  );
  const mid = (r.left + r.right) / 2;
  return (
    <>
      {flashes.map((fl, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full"
          style={{ left: fl.x - 30, top: fl.y - 30, width: 60, height: 60, background: 'radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0.6) 25%, transparent 65%)' }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0.3, 0.3, 1.2, 1.4] }}
          transition={{ duration: fl.at + 0.35, times: [0, fl.at / (fl.at + 0.35), (fl.at + 0.05) / (fl.at + 0.35), 1] }}
        />
      ))}
      {FLEX_BEATS.map((b, i) => (
        <motion.span
          key={`s${i}`}
          className="absolute block text-2xl leading-none"
          style={{ left: mid + (i - 1) * 60, top: r.top + (r.bottom - r.top) * 0.3, color: '#fde047', textShadow: '0 0 8px #f59e0b' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 1.4, 0.6], rotate: [0, 0, 45, 90] }}
          transition={{ duration: b + 0.6, times: [0, b / (b + 0.6), (b + 0.12) / (b + 0.6), 1] }}
        >
          ✦
        </motion.span>
      ))}
      <motion.div
        className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-black"
        style={{ left: mid, top: r.top + 6, color: '#fde68a', ...SHOUT }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.25, 1, 0.9] }}
        transition={{ duration: EVENT_SEC.flex, times: [0, 0.12, 0.8, 1] }}
      >
        ПОЗИРУЕТ 💪
      </motion.div>
    </>
  );
}

/** A volley of arrows raining down on him from the sky — and bouncing off. «ЩЕКОТНО». */
function ArrowVolley({ r }: { r: { left: number; right: number; top: number; bottom: number } }) {
  const arrows = useMemo(
    () =>
      Array.from({ length: 12 }, () => ({
        x: r.left + 30 + Math.random() * (r.right - r.left - 60),
        y: r.top + (r.bottom - r.top) * (0.2 + Math.random() * 0.5),
        delay: Math.random() * 0.35,
        bounce: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 50),
      })),
    [r],
  );
  const L = ARROWS_LAND_AT;
  const mid = (r.left + r.right) / 2;
  return (
    <>
      {arrows.map((a, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: a.x, top: a.y - 40, width: 4, height: 40, rotate: 20, transformOrigin: '50% 100%' }}
          initial={{ x: -260, y: -420, opacity: 0 }}
          animate={{
            x: [-260, 0, a.bounce, a.bounce * 1.2],
            y: [-420, 0, -40, 120],
            rotate: [20, 20, 20 + a.bounce * 3, 20 + a.bounce * 6],
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: L + 1, delay: a.delay, times: [0, L / (L + 1), (L + 0.25) / (L + 1), 1], ease: 'easeIn' }}
        >
          <svg width={8} height={42} viewBox="0 0 8 42" style={{ overflow: 'visible', marginLeft: -2 }}>
            <path d="M4 4 L4 42" stroke="#78350f" strokeWidth={1.6} />
            <path d="M4 42 L1 34 L7 34 Z" fill="#d1d5db" />
            <path d="M4 4 L0 0 M4 4 L8 0 M4 8 L0 4 M4 8 L8 4" stroke="#e5e7eb" strokeWidth={1.2} />
          </svg>
        </motion.div>
      ))}
      {/* The tings: a spark where each one glances off. */}
      {arrows.map((a, i) => (
        <motion.span
          key={`t${i}`}
          className="absolute block text-lg leading-none"
          style={{ left: a.x - 6, top: a.y - 8, color: '#fff', textShadow: '0 0 6px #fde68a' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 1.3, 0.5] }}
          transition={{ duration: L + a.delay + 0.3, times: [0, (L + a.delay) / (L + a.delay + 0.3), (L + a.delay + 0.06) / (L + a.delay + 0.3), 1] }}
        >
          ✦
        </motion.span>
      ))}
      <motion.div
        className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-black"
        style={{ left: mid, top: r.bottom - 50, color: '#fde68a', ...SHOUT }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1.3, 1, 0.9] }}
        transition={{ duration: EVENT_SEC.arrows, times: [0, (L + 0.3) / 3, (L + 0.45) / 3, 0.85, 1] }}
      >
        ЩЕКОТНО
      </motion.div>
    </>
  );
}

/**
 * Five little spartans with round shields and red crests, marching across the floor under him in
 * step — stopping in the middle to thrust their spears up three times, «АУ! АУ! АУ!» — and
 * marching off.
 */
function SpartanMarch({ dir, floor }: { dir: -1 | 1; floor: number }) {
  const w = window.innerWidth;
  const S = 44;
  const N = 5;
  const rowW = N * (S + 6);
  const from = dir === 1 ? -rowW - 20 : w + 20;
  const mid = w / 2 - rowW / 2;
  const to = dir === 1 ? w + 20 : -rowW - 20;
  const D = EVENT_SEC.spartans;
  const f = (s: number) => s / D;
  return (
    <>
      <motion.div
        className="absolute left-0 flex"
        style={{ top: floor - S * 1.15, gap: 6 }}
        initial={{ x: from }}
        animate={{ x: [from, mid, mid, to] }}
        transition={{ duration: D, times: [0, f(1.2), f(3.2), 1], ease: 'linear' }}
      >
        {Array.from({ length: N }, (_, i) => (
          <motion.div
            key={i}
            // Marching: a bob in step; the spear thrust up on each cry.
            animate={{ y: [0, -4, 0, -4, 0, -4, 0, -10, 0, -10, 0, -10, 0, -4, 0, -4, 0] }}
            transition={{ duration: D, ease: 'linear' }}
          >
            <div style={{ transform: `scaleX(${dir})` }}>
              <Spartan size={S} />
            </div>
          </motion.div>
        ))}
      </motion.div>
      {SPARTAN_BEATS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-black"
          style={{ left: w / 2 + (i - 1) * 50, top: floor - S * 1.15 - 40, color: '#fde68a', WebkitTextStroke: '1.5px #7f1d1d', textShadow: '0 2px 0 #7f1d1d', fontFamily: "'Russo One', sans-serif" }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 1.3, 1], y: [0, 0, 0, -16] }}
          transition={{ duration: D, times: [0, f(b), f(b + 0.08), f(b + 0.6)] }}
        >
          АУ!
        </motion.div>
      ))}
    </>
  );
}

/** "Ярость", made visible: a red glow pulsing round him and embers rising off him. */
export function RageAura({ active }: { active: boolean }) {
  const calm = useReducedMotion();
  const embers = useMemo(() => Array.from({ length: 10 }, () => ({ x: 25 + Math.random() * 50, d: 1.6 + Math.random() * 1.4, delay: Math.random() * 2 })), []);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="rage"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[6%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(239,68,68,0.35), transparent 60%)', mixBlendMode: 'screen', boxShadow: 'inset 0 0 40px rgba(220,38,38,0.6)' }}
            animate={calm ? { opacity: 0.7 } : { opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />
          {!calm &&
            embers.map((e, i) => (
              <motion.span
                key={i}
                className="absolute block h-1.5 w-1.5 rounded-full"
                style={{ left: `${e.x}%`, bottom: '10%', background: '#fb923c', boxShadow: '0 0 6px #ef4444' }}
                animate={{ y: [0, -160], x: [0, (i % 2 ? 1 : -1) * 16], opacity: [0, 1, 0] }}
                transition={{ duration: e.d, delay: e.delay, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
          <div className="absolute inset-x-0 top-[4%] text-center text-[11px] font-black uppercase tracking-widest" style={{ color: '#fecaca', textShadow: '0 0 6px #ef4444, 0 1px 0 #000' }}>
            В ярости
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * "Ложная смерть", made visible: at 1 HP he won't go down — he sways on his feet, a heartbeat
 * pulse at the edges, «ОН ЕЩЁ СТОИТ» and how many reps in a row are still needed.
 */
export function StillStanding({ active, done, of }: { active: boolean; done: number; of: number }) {
  const calm = useReducedMotion();
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="standing"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ boxShadow: 'inset 0 0 50px rgba(127,29,29,0.9)' }}
            animate={calm ? { opacity: 0.8 } : { opacity: [0.3, 1, 0.5, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, times: [0, 0.1, 0.25, 0.35, 1] }}
          />
          <div className="absolute inset-x-0 bottom-[6%] text-center font-black" style={{ color: '#fde68a', textShadow: '0 2px 0 #000, 0 0 8px #b91c1c', fontFamily: "'Russo One', sans-serif" }}>
            <div className="text-base">ОН ЕЩЁ СТОИТ</div>
            <div className="text-[11px]">
              добей без паузы: {done}/{of}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A little spartan: bronze helmet with a red crest, round shield, spear. Faces right. */
export function Spartan({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden style={{ overflow: 'visible' }}>
      {/* Spear. */}
      <path d="M30 44 L30 2" stroke="#78350f" strokeWidth={1.6} />
      <path d="M30 -3 L32 3 L28 3 Z" fill="#d1d5db" />
      {/* Legs. */}
      <rect x={13} y={32} width={4} height={13} rx={1.5} fill="#c08457" />
      <rect x={19} y={32} width={4} height={13} rx={1.5} fill="#c08457" />
      {/* Body and red cloak. */}
      <path d="M10 18 L26 18 L25 34 L11 34 Z" fill="#c08457" />
      <path d="M10 18 L4 36 L12 34 Z" fill="#b91c1c" />
      <rect x={11} y={28} width={14} height={6} fill="#7f1d1d" />
      {/* Arm to the spear. */}
      <path d="M24 22 L30 24" stroke="#c08457" strokeWidth={3} strokeLinecap="round" />
      {/* Helmet with the crest. */}
      <circle cx={18} cy={11} r={7} fill="#b45309" stroke="#78350f" strokeWidth={1.2} />
      <path d="M14 10 L22 10 L21 16 L15 16 Z" fill="#78350f" />
      <path d="M11 6 C14 0 22 0 25 6 L22 6 C20 3 16 3 14 6 Z" fill="#dc2626" />
      {/* Round shield in front. */}
      <circle cx={14} cy={25} r={9} fill="#b45309" stroke="#78350f" strokeWidth={1.5} />
      <path d="M10 22 L14 30 L18 22" stroke="#fde68a" strokeWidth={1.6} fill="none" />
    </svg>
  );
}

/** A chariot: a galloping horse in front, a little charioteer in a red-crested helmet behind. Faces right. */
function ChariotFigure({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 110 68" aria-hidden style={{ overflow: 'visible' }}>
      {/* The horse, legs going. */}
      <motion.g animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 0.25, repeat: Infinity }} style={{ transformOrigin: '80px 40px' }}>
        <path d="M62 28 C70 20 92 20 98 28 L100 40 L64 40 Z" fill="#7c4a24" stroke="#3b2210" strokeWidth={1.5} />
        <path d="M94 26 C98 14 104 10 108 14 L106 24 L98 30 Z" fill="#7c4a24" stroke="#3b2210" strokeWidth={1.5} />
        <path d="M96 14 C98 8 102 6 104 10" stroke="#1c120c" strokeWidth={3} fill="none" />
        <circle cx={104} cy={15} r={1.2} fill="#111" />
        {[[68, 1], [76, -1], [90, 1], [96, -1]].map(([x, k], i) => (
          <motion.path
            key={i}
            d={`M${x} 40 L${x} 58`}
            stroke="#5b3518"
            strokeWidth={3.5}
            strokeLinecap="round"
            style={{ transformOrigin: `${x}px 40px` }}
            animate={{ rotate: [k * 30, -k * 30, k * 30] }}
            transition={{ duration: 0.25, repeat: Infinity }}
          />
        ))}
        <path d="M62 30 C56 30 52 34 50 40" stroke="#1c120c" strokeWidth={3} fill="none" />
      </motion.g>
      {/* The traces to the chariot. */}
      <path d="M40 40 L64 34" stroke="#a16207" strokeWidth={2} />
      {/* The chariot: a gilded front and a wheel turning. */}
      <path d="M14 26 L42 26 L44 46 L16 46 Z" fill="#b45309" stroke="#78350f" strokeWidth={1.5} />
      <path d="M18 30 L40 30" stroke="#fde68a" strokeWidth={1.5} />
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '28px 52px' }}>
        <circle cx={28} cy={52} r={12} fill="none" stroke="#78350f" strokeWidth={3} />
        <path d="M28 40 L28 64 M16 52 L40 52 M20 44 L36 60 M36 44 L20 60" stroke="#78350f" strokeWidth={1.5} />
      </motion.g>
      {/* The charioteer, reins out. */}
      <rect x={24} y={12} width={10} height={16} rx={3} fill="#c08457" />
      <circle cx={29} cy={9} r={5.5} fill="#b45309" stroke="#78350f" strokeWidth={1} />
      <path d="M23 6 C25 0 33 0 35 6" fill="#dc2626" />
      <path d="M33 18 L60 30" stroke="#78350f" strokeWidth={1} />
    </svg>
  );
}

/** A lion: golden body, a big brown mane, a tufted tail. Faces right. */
function Lion({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 80 60" aria-hidden style={{ overflow: 'visible' }}>
      <path d="M10 30 C2 26 2 16 8 14" stroke="#ca8a04" strokeWidth={3} fill="none" />
      <circle cx={8} cy={13} r={3.5} fill="#78350f" />
      <rect x={18} y={40} width={7} height={18} rx={3} fill="#eab308" />
      <rect x={30} y={40} width={7} height={18} rx={3} fill="#eab308" />
      <rect x={46} y={40} width={7} height={18} rx={3} fill="#eab308" />
      <ellipse cx={34} cy={34} rx={24} ry={13} fill="#eab308" stroke="#a16207" strokeWidth={1.5} />
      <circle cx={58} cy={24} r={16} fill="#92400e" stroke="#451a03" strokeWidth={1.5} />
      <circle cx={60} cy={25} r={10} fill="#facc15" stroke="#a16207" strokeWidth={1.2} />
      <circle cx={57} cy={22} r={1.6} fill="#111" />
      <circle cx={64} cy={22} r={1.6} fill="#111" />
      <path d="M58 28 L62 28 L60 30 Z" fill="#7c2d12" />
      <path d="M57 31 Q60 34 63 31" stroke="#7c2d12" strokeWidth={1.2} fill="none" />
    </svg>
  );
}

/** A golden laurel wreath. */
export function Laurel({ size }: { size: number }) {
  const leaves = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 100 80" aria-hidden style={{ filter: 'drop-shadow(0 0 10px #facc15)' }}>
      {[-1, 1].map((side) => (
        <g key={side} transform={side > 0 ? 'translate(100 0) scale(-1 1)' : undefined}>
          <path d="M48 74 C20 70 8 46 14 14" stroke="#a16207" strokeWidth={2.5} fill="none" />
          {leaves.map((i) => {
            const t = i / (leaves.length - 1);
            const x = 48 - 36 * Math.sin(t * 1.4) - 2;
            const y = 72 - 60 * t;
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y}
                rx={7}
                ry={3.2}
                fill="#facc15"
                stroke="#a16207"
                strokeWidth={1}
                transform={`rotate(${-50 - t * 40} ${x} ${y})`}
              />
            );
          })}
        </g>
      ))}
      <path d="M40 74 L50 80 L60 74" stroke="#b91c1c" strokeWidth={3} fill="none" />
    </svg>
  );
}
