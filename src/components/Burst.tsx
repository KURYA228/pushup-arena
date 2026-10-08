import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['#f59e0b', '#fbbf24', '#ef4444', '#fde68a', '#ffffff'];

/**
 * A one-shot spray of sparks from the centre of whatever it's placed in — a purchase, a record.
 * Remount it (change its `key`) to fire again. Positioned absolutely and click-through, so it
 * can sit over a button without getting in its way. Nothing at all under reduced motion.
 */
export function Burst({
  count = 14,
  spread = 70,
  duration = 0.7,
  confetti = false,
}: {
  count?: number;
  /** How far the sparks fly, in pixels. */
  spread?: number;
  duration?: number;
  /** Paper squares that tumble and fall, instead of sparks that streak out. */
  confetti?: boolean;
}) {
  const calm = useReducedMotion();
  // Fixed per mount, so a re-render mid-flight doesn't send every spark somewhere new.
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = spread * (0.55 + Math.random() * 0.45);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          color: COLORS[i % COLORS.length],
          spin: (Math.random() - 0.5) * 540,
          size: confetti ? 6 + Math.random() * 4 : 3 + Math.random() * 3,
        };
      }),
    [count, spread, confetti],
  );
  if (calm) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            width: p.size,
            height: confetti ? p.size * 0.6 : p.size,
            background: p.color,
            borderRadius: confetti ? 1 : 999,
            boxShadow: confetti ? undefined : `0 0 6px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{
            x: p.x,
            // Confetti carries on falling after the burst; sparks stop where they die.
            y: confetti ? [0, p.y, p.y + spread * 0.9] : p.y,
            opacity: [1, 1, 0],
            scale: confetti ? 1 : [1, 1.2, 0.3],
            rotate: confetti ? p.spin : 0,
          }}
          transition={{ duration: confetti ? duration * 2 : duration, ease: 'easeOut' }}
        />
      ))}
    </span>
  );
}
