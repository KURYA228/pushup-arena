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

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ y: -30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border bg-arena-surface/95 px-4 py-3 shadow-xl backdrop-blur ${RING[t.kind]}`}
            >
              <Icon size={20} className="shrink-0 text-arena-amber" />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-arena-text">{t.title}</p>
                {t.description && <p className="truncate text-xs text-arena-text-dim">{t.description}</p>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
