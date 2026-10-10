import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { RankUp } from '../data/ranks';
import { Burst } from './Burst';

const HEADLINE: Record<RankUp['kind'], string> = {
  level: 'Новое звание',
  league: 'Новая лига недели',
  strength: 'Новый ранг силы',
};

/** How long a promotion stays up on its own; a tap dismisses it sooner. */
const SHOW_MS = 3800;

/**
 * A promotion, played as a ceremony: the screen dims, rays turn behind a big badge that drops in
 * and bounces, confetti, the rank's name in its colour. Several in one rep come one after
 * another. It never blocks a set — the camera keeps counting underneath — and taps through.
 */
export function RankUpOverlay({
  current,
  onDone,
  onShow,
}: {
  current: RankUp | null;
  onDone: () => void;
  /** Plays the fanfare; called once per promotion as it appears. */
  onShow: () => void;
}) {
  const calm = useReducedMotion();

  useEffect(() => {
    if (!current) return;
    onShow();
    const id = window.setTimeout(onDone, SHOW_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <AnimatePresence mode="wait">
      {current && (
        <motion.div
          key={`${current.kind}-${current.name}`}
          role="status"
          aria-live="polite"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/75 px-6 text-center backdrop-blur-sm"
        >
          {/* Rays turning slowly behind the badge. */}
          {!calm && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute h-[520px] w-[520px] rounded-full opacity-60"
              style={{
                background: `repeating-conic-gradient(${current.color}55 0deg 8deg, transparent 8deg 24deg)`,
                maskImage: 'radial-gradient(circle, #000 20%, transparent 65%)',
                WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 65%)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
          )}

          <motion.p
            className="relative text-xs font-bold uppercase tracking-[0.35em] text-arena-text-dim"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {HEADLINE[current.kind]}
          </motion.p>

          <motion.div
            className="relative mt-4 flex h-36 w-36 items-center justify-center rounded-full border-4 text-7xl"
            style={{
              borderColor: current.color,
              background: `radial-gradient(circle, ${current.color}44, ${current.color}11 70%)`,
              boxShadow: `0 0 40px ${current.color}aa, inset 0 0 30px ${current.color}55`,
            }}
            initial={calm ? { opacity: 0 } : { scale: 0, rotate: -30 }}
            animate={calm ? { opacity: 1 } : { scale: [0, 1.25, 0.95, 1], rotate: [-30, 8, -4, 0] }}
            transition={{ duration: 0.8, times: [0, 0.55, 0.8, 1] }}
          >
            <span>{current.icon}</span>
            <Burst count={26} spread={150} confetti />
          </motion.div>

          <motion.h2
            className="relative mt-5 text-4xl font-black uppercase"
            style={{ color: current.color, textShadow: `0 0 18px ${current.color}aa` }}
            initial={{ opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 300, damping: 18 }}
          >
            {current.name}
          </motion.h2>
          <motion.p
            className="relative mt-3 text-[11px] text-arena-text-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            нажми, чтобы продолжить
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
