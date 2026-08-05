import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ACHIEVEMENTS } from '../data/achievements';

/**
 * The achievement wall. Tapping a tile explains what it takes to earn it — that text used to live
 * in a `title` attribute, which is a hover tooltip and therefore unreachable on a phone.
 */
export function AchievementGrid({ unlockedIds }: { unlockedIds: string[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = ACHIEVEMENTS.find((a) => a.id === selectedId) ?? null;
  const selectedUnlocked = selected != null && unlockedIds.includes(selected.id);

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedIds.includes(a.id);
          const active = a.id === selectedId;
          return (
            <button
              key={a.id}
              onClick={() => setSelectedId(active ? null : a.id)}
              aria-pressed={active}
              aria-label={`${a.title}: ${a.description}. ${unlocked ? 'Получено' : 'Ещё не получено'}`}
              className={clsx(
                'flex aspect-square flex-col items-center justify-center rounded-xl border text-center transition-colors active:scale-95',
                active && 'border-arena-amber bg-arena-surface-2',
                !active && unlocked && 'border-arena-amber/40 bg-arena-surface-2',
                !active && !unlocked && 'border-arena-border bg-arena-surface opacity-40',
              )}
            >
              <span className="text-xl">{unlocked ? a.emoji : '🔒'}</span>
              <span className="mt-1 px-1 text-[9px] leading-tight text-arena-text-dim">{a.title}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {selected && (
          // No key on purpose: switching selection swaps the text in place. Keying by id would
          // mount a second card while the old one animates out, jumping the page height each tap.
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-2 flex items-start gap-3 rounded-2xl border border-arena-border bg-arena-surface p-3"
          >
            <span className={clsx('text-2xl leading-none', !selectedUnlocked && 'opacity-40')}>
              {selectedUnlocked ? selected.emoji : '🔒'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-arena-text">{selected.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-arena-text-dim">{selected.description}</p>
              <p
                className={clsx(
                  'mt-1.5 text-[11px] font-medium',
                  selectedUnlocked ? 'text-arena-amber' : 'text-arena-text-dim',
                )}
              >
                {selectedUnlocked ? 'Получено' : 'Ещё не получено'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
