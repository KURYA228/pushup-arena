import { useEffect, useState } from 'react';
import type { RankUp } from '../data/ranks';

/**
 * Promotions are earned deep inside the rep handlers — the arena's and Rush's alike — but shown
 * once, over everything, by the app. A window event carries them across without threading a
 * callback through every screen that can register a rep.
 */
const EVENT = 'arena:rankup';

export function announceRankUps(ups: RankUp[]) {
  if (!ups.length || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<RankUp[]>(EVENT, { detail: ups }));
}

/** The promotions waiting to be shown, oldest first, and a way to dismiss the one on screen. */
export function useRankUpQueue(): { current: RankUp | null; next: () => void } {
  const [queue, setQueue] = useState<RankUp[]>([]);
  useEffect(() => {
    const on = (e: Event) => setQueue((q) => [...q, ...(e as CustomEvent<RankUp[]>).detail]);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return { current: queue[0] ?? null, next: () => setQueue((q) => q.slice(1)) };
}
