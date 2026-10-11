import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * The End, on the fight screen:
 *
 *  - {@link EndCrystals}: the three End crystals on their obsidian pillars round the dragon, each
 *    beaming healing into him while it stands, with the progress to the next one breaking over
 *    it. When one breaks an arrow flies into it and it goes up in a pink blast.
 *  - {@link InfectionBadge}: on the stage's minions, the count to the infection, and the minion
 *    going green and bubbling as it nears.
 */

/** Where the pillars stand, as a share of the picture's box: x of the centre, height. */
const PILLARS = [
  { x: 4, h: 58 },
  { x: 96, h: 58 },
  { x: 16, h: 42 },
];
/** Where the beams go: the dragon, roughly. */
const DRAGON = { x: 50, y: 38 };

export function EndCrystals({ broken, progress, of }: { broken: number; progress: number; of: number }) {
  // Watch for one breaking, to play its blast.
  const [blast, setBlast] = useState<number | null>(null);
  const seen = useRef(broken);
  useEffect(() => {
    if (broken > seen.current) {
      setBlast(broken - 1);
      const id = window.setTimeout(() => setBlast(null), 1400);
      seen.current = broken;
      return () => window.clearTimeout(id);
    }
    seen.current = broken;
  }, [broken]);

  const next = broken < PILLARS.length ? broken : null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      {/* The healing beams, from each standing crystal to him. */}
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {PILLARS.map((p, i) =>
          i >= broken ? (
            <motion.line
              key={i}
              x1={p.x}
              y1={100 - p.h - 4}
              x2={DRAGON.x}
              y2={DRAGON.y}
              stroke="#f0abfc"
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="4 3"
              style={{ filter: 'drop-shadow(0 0 3px #e879f9)' }}
              animate={{ strokeDashoffset: [0, -14], opacity: [0.55, 0.95, 0.55] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          ) : null,
        )}
      </svg>
      {PILLARS.map((p, i) => {
        const standing = i >= broken;
        return (
          <div key={i} className="absolute bottom-0 -translate-x-1/2" style={{ left: `${p.x}%`, height: `${p.h}%`, width: 26 }}>
            {/* Obsidian. */}
            <div
              className="absolute inset-x-0 bottom-0 top-3"
              style={{ background: 'repeating-linear-gradient(0deg, #1e1033 0 10px, #2e1a4d 10px 11px), linear-gradient(90deg, #120a20, #2e1a4d 50%, #120a20)', backgroundBlendMode: 'overlay', border: '1px solid #0b0614' }}
            />
            {/* The crystal in its cage, turning and bobbing. */}
            <AnimatePresence>
              {standing && (
                <motion.div
                  key="crystal"
                  className="absolute left-1/2"
                  style={{ top: -22, width: 26, height: 26, marginLeft: -13 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, y: [0, -6, 0] }}
                  exit={{ opacity: 0, scale: 1.8, transition: { duration: 0.2 } }}
                  transition={{ y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } }}
                >
                  <motion.div
                    className="absolute inset-[3px]"
                    style={{ border: '2px solid rgba(255,255,255,0.7)' }}
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                  <motion.div
                    className="absolute inset-[7px]"
                    style={{ background: 'linear-gradient(135deg, #fdf4ff, #f0abfc 40%, #c026d3)', boxShadow: '0 0 10px #e879f9, 0 0 22px #c026d3' }}
                    animate={{ rotate: [45, 405] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            {/* The one that's next to go: how far along you are. */}
            {standing && i === next && (
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -40, width: 44 }}>
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-black/60 bg-black/60">
                  <motion.div className="h-full bg-[#f0abfc]" animate={{ width: `${Math.min(100, (progress / of) * 100)}%` }} />
                </div>
              </div>
            )}
            {/* Breaking: an arrow into it, a pink blast, blocks flying. */}
            {blast === i && <CrystalBlast />}
          </div>
        );
      })}
    </div>
  );
}

function CrystalBlast() {
  return (
    <div className="absolute left-1/2" style={{ top: -10 }}>
      <motion.div
        className="absolute h-[3px] w-12 origin-right"
        style={{ right: 6, top: 0, background: 'linear-gradient(90deg, #a16207 0 75%, #e5e7eb 75%)' }}
        initial={{ x: -160, y: -80, rotate: 28, opacity: 1 }}
        animate={{ x: 0, y: 0, opacity: [1, 1, 0] }}
        transition={{ duration: 0.3, ease: 'easeIn' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 90, height: 90, left: -45, top: -45, background: 'radial-gradient(circle, #ffffff, #f0abfc 35%, #c026d3 60%, transparent 72%)' }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 1.8], opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, times: [0, 0.35, 1] }}
      />
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        return (
          <motion.span
            key={k}
            className="absolute block h-2.5 w-2.5"
            style={{ background: k % 2 ? '#2e1a4d' : '#f0abfc', marginLeft: -5, marginTop: -5 }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: Math.cos(a) * 70, y: Math.sin(a) * 70 + 40, opacity: [0, 1, 0], rotate: 180 }}
            transition={{ duration: 0.9, delay: 0.28, ease: 'easeOut' }}
          />
        );
      })}
      <motion.span
        className="absolute whitespace-nowrap text-xl font-black text-white"
        style={{ left: -24, top: -60, fontFamily: "'Russo One', sans-serif", WebkitTextStroke: '1px #701a75' }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.4, 0.4, 1.2, 1] }}
        transition={{ duration: 1, times: [0, 0.3, 0.45, 1] }}
      >
        БУМ!
      </motion.span>
    </div>
  );
}

/**
 * On a minion of the Ender stage: reps left before the infection takes — and once it's close,
 * the minion going green and bubbling. `left` is reps remaining, or 0 once it has taken.
 */
export function InfectionBadge({ left }: { left: number }) {
  const close = left > 0 && left <= 5;
  const taken = left <= 0;
  return (
    <>
      <div className="pointer-events-none absolute left-1 top-1 z-10">
        <motion.span
          key={taken ? 'taken' : left}
          className="rounded-full border bg-black/70 px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ color: taken || close ? '#4ade80' : '#a3e635', borderColor: '#4ade8099' }}
          initial={{ scale: close ? 1.3 : 1 }}
          animate={{ scale: 1 }}
        >
          {taken ? '☣ заражён — остаток перейдёт дальше' : `☣ заражение через ${left}`}
        </motion.span>
      </div>
      <AnimatePresence>
        {(close || taken) && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-[6%] z-10 overflow-hidden rounded-[28%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.1), rgba(22,163,74,0.4))', mixBlendMode: 'screen' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            {Array.from({ length: 7 }, (_, i) => (
              <motion.span
                key={i}
                className="absolute block rounded-full border border-[#bbf7d0] bg-[#4ade80]/50"
                style={{ left: `${10 + i * 12}%`, bottom: 0, width: 8 + (i % 3) * 4, height: 8 + (i % 3) * 4 }}
                animate={{ y: [0, -120], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6 + (i % 3) * 0.3, repeat: Infinity, delay: i * 0.25, ease: 'easeOut' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** An Enderman: tall and thin and black, long arms, glowing purple eyes. */
function Enderman({ size }: { size: number }) {
  const w = size * 0.32;
  return (
    <div className="relative" style={{ width: w * 1.8, height: size }}>
      <div className="absolute left-1/2 -translate-x-1/2 bg-[#111111]" style={{ top: 0, width: w, height: w }}>
        {[0.08, 0.56].map((x) => (
          <div key={x} className="absolute" style={{ left: `${x * 100}%`, top: '45%', width: '36%', height: '14%', background: '#e879f9', boxShadow: '0 0 6px #d946ef' }} />
        ))}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bg-[#161616]" style={{ top: w, width: w * 0.8, height: size * 0.32 }} />
      {[-1, 1].map((d) => (
        <div key={d} className="absolute bg-[#111111]" style={{ top: w, left: `calc(50% + ${d * w * 0.55}px - ${w * 0.09}px)`, width: w * 0.18, height: size * 0.58 }} />
      ))}
      {[-1, 1].map((d) => (
        <div key={`l${d}`} className="absolute bg-[#111111]" style={{ top: w + size * 0.32, left: `calc(50% + ${d * w * 0.2}px - ${w * 0.09}px)`, width: w * 0.18, height: size - w - size * 0.32 }} />
      ))}
    </div>
  );
}

/**
 * The End going on around the fight, so a long one doesn't sit still: every so often an
 * Enderman blinks in at the side of the screen in a burst of purple, stares, and blinks out; and
 * every so often the dragon breathes, a cloud of purple rolling along under him.
 */
export function EnderAmbient({ active, under, onTeleport }: { active: boolean; under: () => number | null; onTeleport: () => void }) {
  const calm = useReducedMotion();
  const [visit, setVisit] = useState<{ id: number; side: -1 | 1; top: number } | null>(null);
  const [breath, setBreath] = useState<{ id: number; dir: -1 | 1; top: number } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let a = 0;
    let b = 0;
    const nextVisit = (wait: number) => {
      a = window.setTimeout(() => {
        setVisit({ id: Date.now(), side: Math.random() < 0.5 ? -1 : 1, top: window.innerHeight * (0.22 + Math.random() * 0.3) });
        onTeleport();
        nextVisit(11000 + Math.random() * 9000);
      }, wait);
    };
    const nextBreath = (wait: number) => {
      b = window.setTimeout(() => {
        setBreath({ id: Date.now(), dir: Math.random() < 0.5 ? -1 : 1, top: (under() ?? window.innerHeight * 0.55) - 60 });
        nextBreath(16000 + Math.random() * 10000);
      }, wait);
    };
    nextVisit(5000);
    nextBreath(9000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);

  if (!active || calm) return null;
  const w = window.innerWidth;
  return createPortal(
    <>
      <AnimatePresence>
        {visit && (
          <motion.div
            key={visit.id}
            aria-hidden
            className="pointer-events-none fixed z-20"
            style={{ top: visit.top, [visit.side < 0 ? 'left' : 'right']: 8 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 1, 0], x: [0, 0, 0, 0, 0] }}
            transition={{ duration: 3.2, times: [0, 0.05, 0.5, 0.92, 1] }}
            onAnimationComplete={() => setVisit((v) => (v?.id === visit.id ? null : v))}
          >
            <motion.div animate={{ x: [0, -2, 2, 0], rotate: [0, -3, 3, 0] }} transition={{ duration: 0.4, repeat: Infinity }}>
              <Enderman size={110} />
            </motion.div>
            {/* The purple of the teleport, in and out. */}
            {[0, 2.9].map((d) => (
              <div key={d} className="absolute inset-0">
                {Array.from({ length: 10 }, (_, k) => (
                  <motion.span
                    key={k}
                    className="absolute block h-1.5 w-1.5 bg-[#d946ef]"
                    style={{ left: `${(k * 37) % 100}%`, top: `${(k * 61) % 100}%`, boxShadow: '0 0 4px #d946ef' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0], y: [0, -20] }}
                    transition={{ duration: 0.5, delay: d + (k % 5) * 0.04 }}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {breath && (
          <motion.div
            key={breath.id}
            aria-hidden
            className="pointer-events-none fixed left-0 z-20"
            style={{ top: breath.top }}
            initial={{ x: breath.dir === 1 ? -380 : w + 40, opacity: 0 }}
            animate={{ x: breath.dir === 1 ? w + 40 : -380, opacity: [0, 0.85, 0.85, 0] }}
            transition={{ duration: 5, ease: 'linear', opacity: { duration: 5, times: [0, 0.15, 0.85, 1] } }}
            onAnimationComplete={() => setBreath((v) => (v?.id === breath.id ? null : v))}
          >
            <div className="relative h-28 w-96">
              {[0, 70, 150, 230, 290].map((x, i) => (
                <motion.div
                  key={x}
                  className="absolute rounded-full blur-md"
                  style={{ left: x, top: (i % 2) * 18, width: 120, height: 84, background: `radial-gradient(circle, ${i % 2 ? '#c026d3' : '#7e22ce'}aa, transparent 70%)` }}
                  animate={{ scale: [1, 1.2, 1], y: [0, -8, 0] }}
                  transition={{ duration: 1.6 + i * 0.2, repeat: Infinity }}
                />
              ))}
              {Array.from({ length: 12 }, (_, k) => (
                <motion.span
                  key={k}
                  className="absolute block h-1.5 w-1.5 bg-[#f0abfc]"
                  style={{ left: (k * 31) % 380, top: 20 + ((k * 17) % 70) }}
                  animate={{ opacity: [0.2, 1, 0.2], y: [0, -10, 0] }}
                  transition={{ duration: 0.9 + (k % 3) * 0.3, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

/** Every blow on the dragon knocks a little shower of End particles off him. Keyed by `hitId`. */
export function EndHitParticles({ hitId }: { hitId: number | null }) {
  const bits = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * Math.PI * 2 + Math.random() * 0.5, d: 40 + Math.random() * 60 })),
    // A new spray for every blow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hitId],
  );
  if (hitId == null) return null;
  return (
    <div key={hitId} aria-hidden className="pointer-events-none absolute left-1/2 top-[42%] z-10">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute block h-2 w-2"
          style={{ background: i % 3 ? '#d8b4fe' : '#a855f7', boxShadow: '0 0 6px #a855f7' }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d - 20, opacity: 0, rotate: 180 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/**
 * The dragon near the end: below 15% he flickers, purple smoke trailing up off him — he's
 * nearly done, and it should look it.
 */
export function DragonWeak({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="absolute inset-[8%] rounded-[30%]"
            animate={{ boxShadow: ['0 0 20px rgba(168,85,247,0.3)', '0 0 50px rgba(168,85,247,0.8)', '0 0 20px rgba(168,85,247,0.3)'], opacity: [1, 0.6, 1, 0.8, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
          {Array.from({ length: 8 }, (_, i) => (
            <motion.span
              key={i}
              className="absolute block rounded-full blur-[2px]"
              style={{ left: `${20 + i * 8}%`, top: '35%', width: 14, height: 14, background: 'rgba(126,34,206,0.7)' }}
              animate={{ y: [0, -90], opacity: [0, 0.9, 0], scale: [0.6, 1.6] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: 'easeOut' }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
