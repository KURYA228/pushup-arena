import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Burst } from './Burst';

/** Body outline; the two tails alternate so the hem ripples like cloth in a draught. */
const TAIL_A = 'M4 20 C4 8 13 2 20 2 C27 2 36 8 36 20 L36 40 Q32 35 28 40 Q24 45 20 40 Q16 35 12 40 Q8 45 4 40 Z';
const TAIL_B = 'M4 20 C4 8 13 2 20 2 C27 2 36 8 36 20 L36 41 Q32 45 28 41 Q24 36 20 41 Q16 45 12 41 Q8 36 4 41 Z';

/**
 * A ghost — a real one: a sheet with a rippling hem, floating and bobbing, see-through. It grins
 * while it's ahead and droops once it's been passed.
 */
function GhostSprite({ smug, calm }: { smug: boolean; calm: boolean | null }) {
  return (
    <motion.svg
      viewBox="0 0 40 46"
      className="h-11 w-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]"
      animate={calm ? {} : { y: [0, -5, 0], rotate: [-4, 4, -4] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.path
        fill="rgba(240, 244, 255, 0.82)"
        initial={{ d: TAIL_A }}
        animate={calm ? { d: TAIL_A } : { d: [TAIL_A, TAIL_B, TAIL_A] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Eyes blink now and then. */}
      <motion.g
        style={{ originY: '17px' }}
        animate={calm ? {} : { scaleY: [1, 1, 0.1, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
      >
        <ellipse cx="14.5" cy="17" rx="2.6" ry="3.4" fill="#16181d" />
        <ellipse cx="25.5" cy="17" rx="2.6" ry="3.4" fill="#16181d" />
      </motion.g>
      {smug ? (
        // A grin while it's leading.
        <path d="M14 25 Q20 30 26 25" stroke="#16181d" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        // An "o" of dismay once you're past it.
        <ellipse cx="20" cy="27" rx="2.4" ry="3" fill="#16181d" />
      )}
    </motion.svg>
  );
}

/**
 * The race against your record. One track, two runners: the ghost of your best run floats along
 * the top, you run along the bottom. Pass it and it bursts into mist.
 */
export function GhostRace({ you, ghost, best }: { you: number; ghost: number; best: number }) {
  const calm = useReducedMotion();
  const scale = Math.max(best, you, 1);
  const ahead = you - ghost;
  const pos = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;

  // The moment of passing, and the moment of being passed back, each get their beat.
  const prevAhead = useRef(ahead);
  const [passedAt, setPassedAt] = useState<number | null>(null);
  const [caughtAt, setCaughtAt] = useState<number | null>(null);
  useEffect(() => {
    const before = prevAhead.current;
    prevAhead.current = ahead;
    if (before <= 0 && ahead > 0 && you > 0) setPassedAt(Date.now());
    else if (before > 0 && ahead <= 0) setCaughtAt(Date.now());
  }, [ahead, you]);

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-arena-border bg-arena-surface px-3 pb-3 pt-2 text-left">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-arena-text-dim">Призрак рекорда · {best}</span>
        <motion.span
          key={Math.sign(ahead)}
          initial={calm ? false : { scale: 1.3 }}
          animate={{ scale: 1 }}
          className={`font-semibold tabular-nums ${
            ahead > 0 ? 'text-arena-amber' : ahead < 0 ? 'text-arena-red' : 'text-arena-text-dim'
          }`}
        >
          {ahead > 0 ? `впереди на ${ahead}` : ahead < 0 ? `отстаёшь на ${-ahead}` : 'вровень'}
        </motion.span>
      </div>

      {/* The track. Inner padding keeps both runners on it at 0% and at 100%. */}
      <div className="relative mt-1 h-[84px]">
        <div className="absolute inset-x-5 top-0 bottom-0">
          {/* Finish line at the record. */}
          <div className="absolute bottom-2 right-0 top-2 w-px border-r border-dashed border-arena-text-dim/40" />
          <div className="absolute inset-x-0 bottom-[18px] h-px bg-arena-border" />

          {/* The ghost's trail of mist, and the ghost itself. */}
          <motion.div
            className="absolute left-0 top-[22px] h-1.5 rounded-full bg-gradient-to-r from-transparent to-white/25 blur-[2px]"
            animate={{ width: pos(ghost) }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
          <motion.div
            className="absolute top-0 -translate-x-1/2"
            animate={{ left: pos(ghost), opacity: ahead > 0 ? 0.55 : 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          >
            {/* Fixed box with the ghosts stacked inside it: the one bursting into mist and the
                one carrying on share the spot, so the new one never waits for the old to leave. */}
            <div className="relative h-11 w-10">
            <AnimatePresence initial={false}>
              <motion.div
                // Re-keyed on being passed: the old ghost bursts into mist, a dimmer one carries on.
                key={passedAt ?? 'ghost'}
                className="absolute inset-0"
                initial={passedAt && !calm ? { scale: 0.4, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                exit={calm ? { opacity: 0 } : { scale: 1.8, opacity: 0, filter: 'blur(6px)', transition: { duration: 0.35 } }}
              >
                <GhostSprite smug={ahead <= 0} calm={calm} />
              </motion.div>
            </AnimatePresence>
            </div>
          </motion.div>

          {/* You: an amber runner with a glowing trail. */}
          <motion.div
            className="absolute bottom-[17px] left-0 h-[3px] rounded-full bg-gradient-to-r from-transparent to-arena-amber"
            animate={{ width: pos(you) }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          />
          <motion.div
            className="absolute bottom-[9px] -translate-x-1/2"
            animate={{ left: pos(you) }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <motion.span
              key={you}
              initial={calm ? false : { scale: 1.35 }}
              animate={{ scale: 1 }}
              className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-arena-amber px-1 text-[10px] font-black tabular-nums text-arena-bg shadow-[0_0_12px_rgba(245,158,11,0.7)]"
            >
              {you}
            </motion.span>
          </motion.div>
        </div>

        <AnimatePresence>
          {passedAt && Date.now() - passedAt < 1500 && (
            <motion.div
              key={passedAt}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1, 1] }}
              transition={{ duration: 1.4, times: [0, 0.15, 0.75, 1] }}
            >
              <span className="text-lg font-black uppercase tracking-wider text-arena-amber drop-shadow-[0_0_10px_rgba(245,158,11,0.7)]">
                Обогнал!
              </span>
              <Burst key={passedAt} count={18} spread={80} />
            </motion.div>
          )}
          {caughtAt && Date.now() - caughtAt < 1500 && (
            <motion.div
              key={caughtAt}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.2 }}
            >
              <span className="text-sm font-black uppercase tracking-wider text-arena-red">Бу! Догнал</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
