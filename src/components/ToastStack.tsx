import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Star, Swords, Medal, Info } from 'lucide-react';
import type { ToastItem, ToastKind } from '../types';

const ICONS: Record<ToastKind, React.ComponentType<{ size?: number; className?: string }>> = {
  'level-up': Star,
  achievement: Medal,
  'boss-defeat': Swords,
  record: Trophy,
  info: Info,
};

const RING: Record<ToastKind, string> = {
  'level-up': 'border-arena-amber/60',
  achievement: 'border-arena-amber/60',
  'boss-defeat': 'border-arena-red/60',
  record: 'border-arena-amber/60',
  info: 'border-arena-border',
};

/**
 * Compact pills along the top edge. They never take a tap — the whole layer is click-through —
 * and stay small enough to leave the fight visible under them: a toast confirms a moment, it
 * shouldn't be the thing you have to look past to keep going.
 */
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-1.5 px-4 pt-[calc(env(safe-area-inset-top)+8px)]">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ y: -20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -12, opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={`flex max-w-[min(22rem,100%)] items-center gap-2 rounded-full border bg-arena-surface/90 py-1.5 pl-2.5 pr-3.5 shadow-lg backdrop-blur ${RING[t.kind]}`}
            >
              <Icon size={15} className="shrink-0 text-arena-amber" />
              <p className="min-w-0 truncate text-xs text-arena-text">
                <span className="font-semibold">{t.title}</span>
                {t.description && <span className="text-arena-text-dim"> · {t.description}</span>}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
