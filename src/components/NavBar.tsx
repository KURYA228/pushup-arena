import { BarChart3, Home, Swords, Trophy, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export type ViewId = 'home' | 'boss' | 'rush' | 'stats' | 'board';

const TABS: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Дом', icon: Home },
  { id: 'boss', label: 'Боссы', icon: Swords },
  { id: 'rush', label: 'Rush', icon: Zap },
  { id: 'stats', label: 'Статы', icon: BarChart3 },
  { id: 'board', label: 'Лидеры', icon: Trophy },
];

export function NavBar({ current, onChange }: { current: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <nav className="safe-bottom safe-x sticky bottom-0 z-40 border-t border-arena-border bg-arena-surface/95 backdrop-blur">
      <div className="arena-page flex justify-around py-1.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <motion.button
              key={id}
              onClick={() => onChange(id)}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 30 }}
              className={clsx(
                'relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium',
                active ? 'text-arena-amber' : 'text-arena-text-dim',
              )}
            >
              {/* One pill shared by every tab, so switching slides it across rather than
                  snapping it on and off. */}
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  className="absolute inset-x-1.5 inset-y-0.5 rounded-xl bg-arena-surface-2"
                />
              )}
              <motion.span
                className="relative"
                animate={{ scale: active ? 1.14 : 1, y: active ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 24 }}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              </motion.span>
              <span className="relative">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
