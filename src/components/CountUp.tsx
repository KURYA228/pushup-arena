import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

/**
 * A number that rolls to its new value instead of jumping.
 *
 * The duration follows the size of the jump: a single rep ticks over almost instantly, while a
 * board loading three hundred reps gets a run worth watching. A fixed duration would make either
 * the small change feel laggy or the big one feel like nothing happened.
 */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const controls = animate(from, value, {
      duration: Math.min(0.9, 0.18 + Math.abs(value - from) * 0.012),
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
    // Chasing `shown` here would restart the animation on every frame it produces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{shown}</>;
}
