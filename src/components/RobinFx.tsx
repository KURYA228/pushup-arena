import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Robin's "Командная работа", warning you: stop before the set is long enough and the Titans'
 * signal comes up — a "T" flashing in the corner and «Титаны, вперёд!», with the count to the
 * moment they move in. Make a rep in time and it goes; leave it, and the next rep finds them
 * covering him. `need` is how long the set has to be, `breakMs` the pause that ends a set.
 */
export function TitansSignal({
  lastRepAt,
  setReps,
  need,
  breakMs,
  enabled,
  onBeep,
}: {
  lastRepAt: number | null;
  setReps: number;
  need: number;
  breakMs: number;
  enabled: boolean;
  onBeep: () => void;
}) {
  const calm = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const short = enabled && lastRepAt != null && setReps > 0 && setReps < need;
  useEffect(() => {
    if (!short) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [short, lastRepAt]);

  const idle = lastRepAt == null ? 0 : now - lastRepAt;
  const showing = short && idle >= breakMs * 0.4;
  const called = showing && idle >= breakMs;
  const left = Math.max(1, Math.ceil((breakMs - idle) / 1000));

  // A beep from the communicator as each second runs out.
  const lastBeep = useRef<number | null>(null);
  useEffect(() => {
    if (!showing || called) {
      lastBeep.current = null;
      return;
    }
    if (lastBeep.current !== left) {
      lastBeep.current = left;
      onBeep();
    }
  });

  if (calm) return null;
  return createPortal(
    <AnimatePresence>
      {showing && (
        <motion.div
          key={`titans-${lastRepAt}`}
          aria-hidden
          className="pointer-events-none fixed bottom-[22%] left-2 z-40 flex items-end gap-2"
          initial={{ x: -140, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -140, opacity: 0, transition: { duration: 0.3 } }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          {/* The communicator: a yellow disc with the T on it, flashing. */}
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#1f2937] text-4xl font-black"
            style={{ background: 'radial-gradient(circle at 35% 30%, #fef9c3, #facc15 60%, #ca8a04)', color: '#dc2626', fontFamily: "'Russo One', sans-serif" }}
            animate={{ scale: called ? [1, 1.15, 1] : [1, 1.06, 1], boxShadow: called ? ['0 0 10px #ef4444', '0 0 30px #ef4444', '0 0 10px #ef4444'] : ['0 0 6px #facc15', '0 0 16px #facc15', '0 0 6px #facc15'] }}
            transition={{ duration: called ? 0.4 : 0.8, repeat: Infinity }}
          >
            T
          </motion.div>
          <motion.span
            key={called ? 'called' : left}
            className="mb-3 whitespace-nowrap rounded-xl border-2 bg-black/75 px-2 text-lg font-black"
            style={{
              fontFamily: "'Russo One', sans-serif",
              color: called ? '#fecaca' : '#fde68a',
              borderColor: called ? '#ef4444' : '#facc15',
            }}
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          >
            {called ? 'ТИТАНЫ, ВПЕРЁД!' : `ещё ${need - setReps} · ${left}`}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
