import { Home, Swords, Zap } from 'lucide-react';
import clsx from 'clsx';

export type ViewId = 'home' | 'boss' | 'rush';

const TABS: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Дом', icon: Home },
  { id: 'boss', label: 'Боссы', icon: Swords },
  { id: 'rush', label: 'Rush', icon: Zap },
];

export function NavBar({ current, onChange }: { current: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <nav className="safe-bottom safe-x sticky bottom-0 z-40 border-t border-arena-border bg-arena-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-md justify-around py-1.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={clsx(
                'flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors',
                active ? 'text-arena-amber' : 'text-arena-text-dim hover:text-arena-text',
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
