import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Laughing gas, drifting through the Joker's fight: every so often a purple-and-green cloud rolls
 * across the screen just under his feet, from one side to the other, a faint "ха" or two in it. It does
 * nothing to the rules — it's his room, and this is what it smells like.
 */
export function LaughGas({ active, under }: { active: boolean; under: () => number | null }) {
  const calm = useReducedMotion();
  const [cloud, setCloud] = useState<{ id: number; dir: 1 | -1; top: number } | null>(null);
  useEffect(() => {
    if (!active || calm) return;
    let id = 0;
    const next = (wait: number) => {
      id = window.setTimeout(() => {
        // Rolling along just under where he stands, taken fresh each time in case the screen moved.
        const below = under() ?? window.innerHeight * 0.55;
        setCloud({ id: Date.now(), dir: Math.random() < 0.5 ? 1 : -1, top: below - 70 + Math.random() * 20 });
        next(7000 + Math.random() * 6000);
      }, wait);
    };
    next(2500);
    return () => window.clearTimeout(id);
  }, [active, calm]);

  if (!active || calm) return null;
  const w = window.innerWidth;
  return createPortal(
    <AnimatePresence>
      {cloud && (
        <motion.div
          key={cloud.id}
          aria-hidden
          className="pointer-events-none fixed left-0 z-20"
          style={{ top: cloud.top }}
          initial={{ x: cloud.dir === 1 ? -360 : w + 40, opacity: 0 }}
          animate={{ x: cloud.dir === 1 ? w + 40 : -360, opacity: [0, 0.75, 0.75, 0] }}
          transition={{ duration: 6, ease: 'linear', opacity: { duration: 6, times: [0, 0.15, 0.85, 1] } }}
          onAnimationComplete={() => setCloud((c) => (c?.id === cloud.id ? null : c))}
        >
          <div className="relative h-28 w-80">
            {[
              [0, 30, 110, '#7b3fb5'],
              [60, 10, 130, '#4ade80'],
              [140, 26, 120, '#a855f7'],
              [210, 8, 110, '#22c55e'],
            ].map(([x, y, s, c], i) => (
              <motion.div
                key={i}
                className="absolute rounded-full blur-md"
                style={{ left: x as number, top: y as number, width: s as number, height: (s as number) * 0.7, background: `radial-gradient(circle, ${c}99, ${c}00 70%)` }}
                animate={{ scale: [1, 1.15, 1], y: [0, -6, 0] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
              />
            ))}
            {['ха', 'ха-ха'].map((t, i) => (
              <motion.span
                key={t}
                className="absolute text-lg font-black"
                style={{ left: 70 + i * 120, top: 30 + i * 12, color: i ? '#4ade80' : '#c084fc', opacity: 0.8 }}
                animate={{ y: [0, -10, 0], rotate: [-8, 8, -8] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                {t}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
