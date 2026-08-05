import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { BossDef, BossStatus } from '../data/bosses';
import { BOSSES } from '../data/bosses';
import { BossIcon } from './BossIcon';

/** Full-height card for a single boss: the figure at a size worth looking at, plus its line. */
export function BossProfileModal({
  boss,
  index,
  hpLeft,
  status,
  onClose,
}: {
  boss: BossDef;
  index: number;
  /** Remaining HP — only meaningful for the boss you're currently fighting. */
  hpLeft: number;
  status: BossStatus;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hpPct = Math.max(0, Math.min(100, (hpLeft / boss.hp) * 100));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${boss.name} — ${boss.title}`}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border border-arena-border bg-arena-surface p-5 text-center"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <X size={16} />
        </button>

        <p className="text-[11px] uppercase tracking-widest text-arena-text-dim">
          Босс {index + 1} из {BOSSES.length}
        </p>

        <div
          className="mx-auto mt-3 flex w-full justify-center rounded-2xl py-4"
          style={{ background: `radial-gradient(circle at 50% 55%, ${boss.color}26, transparent 70%)` }}
        >
          <BossIcon boss={boss} index={index} size={150} />
        </div>

        <h2 className="mt-2 text-xl font-bold text-arena-text">{boss.name}</h2>
        <p className="text-xs text-arena-text-dim">{boss.title}</p>

        <blockquote
          className="mt-4 rounded-2xl border-l-2 bg-arena-surface-2 px-4 py-3 text-left text-sm italic leading-snug text-arena-text"
          style={{ borderColor: boss.color }}
        >
          «{boss.phrase}»
        </blockquote>

        <div className="mt-4 grid grid-cols-2 gap-2 text-left">
          <Stat label="здоровье" value={`${boss.hp} HP`} />
          <Stat label="шанс крита" value={`${Math.round(boss.critChance * 100)}%`} />
        </div>

        {status === 'defeated' && <p className="mt-4 text-xs font-semibold text-arena-amber">Повержен</p>}

        {status === 'current' && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-arena-surface-2">
              <div className="h-full rounded-full bg-arena-red" style={{ width: `${hpPct}%` }} />
            </div>
            <p className="mt-1 text-[11px] tabular-nums text-arena-text-dim">
              осталось {hpLeft} из {boss.hp} HP — это ещё {Math.ceil(hpLeft / boss.baseDamage)} отжиманий
            </p>
          </div>
        )}

        {status === 'upcoming' && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-arena-surface-2">
              <div className="h-full w-full rounded-full bg-arena-red/40" />
            </div>
            <p className="mt-1 text-[11px] tabular-nums text-arena-text-dim">
              ещё не открыт — на него уйдёт {Math.ceil(boss.hp / boss.baseDamage)} отжиманий
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-arena-border bg-arena-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase text-arena-text-dim">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-arena-text">{value}</p>
    </div>
  );
}
