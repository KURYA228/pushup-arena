import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * "Строгая мама", watching you rest: stop, and half way to the limit Nicole's eyes come up in the
 * corner — narrowing, the brows drawing down, a count running out beside them. At the limit
 * they go red: "Я ВСЁ ВИЖУ!", and the rep you make next is the one she won't count. Move before
 * that and they close, satisfied, and go. The same shape as Gru's freeze-ray warning, in the
 * opposite corner.
 */
export function MomWatch({ lastRepAt, limitMs, enabled }: { lastRepAt: number | null; limitMs: number; enabled: boolean }) {
  const calm = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || lastRepAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [enabled, lastRepAt]);

  const idle = lastRepAt == null ? 0 : now - lastRepAt;
  const watching = enabled && lastRepAt != null && idle >= limitMs * 0.5;
  const caught = watching && idle >= limitMs;
  const left = Math.max(1, Math.ceil((limitMs - idle) / 1000));
  const anger = Math.min(1, Math.max(0, (idle - limitMs * 0.5) / (limitMs * 0.5)));

  // A rep in time: the eyes close, pleased, on their way out. Recorded after each render so the
  // render that brings the rep still sees what was showing before it.
  const wasWatching = useRef(false);
  const lastSeen = useRef(lastRepAt);
  const [pleased, setPleased] = useState<number | null>(null);
  useEffect(() => {
    if (lastRepAt !== lastSeen.current) {
      if (wasWatching.current) {
        const id = Date.now();
        setPleased(id);
        window.setTimeout(() => setPleased((cur) => (cur === id ? null : cur)), 700);
      }
      lastSeen.current = lastRepAt;
    }
    wasWatching.current = watching && !caught;
  });

  if (calm) return null;
  return createPortal(
    <AnimatePresence>
      {(watching || pleased) && (
        <motion.div
          key={`mom-${pleased ?? lastRepAt}`}
          aria-hidden
          className="pointer-events-none fixed bottom-[22%] right-2 z-40 flex items-end gap-2"
          initial={{ x: 140, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 140, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          {!pleased && (
            <motion.span
              key={caught ? 'caught' : left}
              className="mb-4 whitespace-nowrap rounded-xl border-2 bg-black/75 px-2 text-xl font-black"
              style={{
                fontFamily: "'Russo One', sans-serif",
                color: caught ? '#fecaca' : '#bae6fd',
                borderColor: caught ? '#ef4444' : '#3fa9e0',
                textShadow: caught ? '0 0 10px #ef4444' : '0 0 10px #3fa9e0',
              }}
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              {caught ? 'Я ВСЁ ВИЖУ!' : left}
            </motion.span>
          )}
          <Eyes anger={pleased ? 0 : anger} caught={!pleased && caught} closed={!!pleased} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Nicole's eyes: a blue cat's, on a strip of her face — brows dropping as she gets angrier. */
function Eyes({ anger, caught, closed }: { anger: number; caught: boolean; closed: boolean }) {
  const white = caught ? 'radial-gradient(circle, #fee2e2, #fca5a5)' : '#ffffff';
  return (
    <motion.div
      className="relative rounded-[40%] border-2 border-[#0c4a6e]"
      style={{ width: 130, height: 64, background: 'linear-gradient(180deg, #5bbbe8, #3fa9e0)', boxShadow: caught ? '0 0 20px #ef4444' : '0 4px 12px rgba(0,0,0,0.5)' }}
      animate={caught ? { x: [0, -3, 3, -2, 2, 0] } : { x: 0 }}
      transition={caught ? { duration: 0.4, repeat: Infinity } : undefined}
    >
      {[0, 1].map((i) => (
        <div key={i} className="absolute" style={{ left: i ? 72 : 14, top: 18, width: 44, height: 30 }}>
          {closed ? (
            // Pleased: a happy upturned arc.
            <div className="absolute inset-x-1 top-2 h-5 rounded-t-full border-t-[4px] border-[#0c4a6e]" />
          ) : (
            <>
              <div
                className="absolute inset-0 overflow-hidden rounded-[50%] border-2 border-[#0c4a6e]"
                style={{ background: white, clipPath: `inset(${Math.round(anger * 38)}% 0 0 0)` }}
              >
                {/* A cat's pupil: a slit that narrows as she gets angrier. */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
                  style={{ width: 10 - anger * 6, height: 24 }}
                />
              </div>
              {/* The brow. */}
              <div
                className="absolute bg-[#0c4a6e]"
                style={{
                  left: -2,
                  top: -8 + anger * 10,
                  width: 48,
                  height: 6,
                  borderRadius: 3,
                  rotate: `${(i ? -1 : 1) * (6 + anger * 22)}deg`,
                }}
              />
            </>
          )}
        </div>
      ))}
    </motion.div>
  );
}
