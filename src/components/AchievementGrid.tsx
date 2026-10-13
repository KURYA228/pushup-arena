import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { ACHIEVEMENTS, achievementIcon, type AchievementDef } from '../data/achievements';

/**
 * The achievement wall. Tapping a tile opens it over the page, the way a boss opens from the arena
 * grid above it — the medal at a size worth looking at, and what it takes to earn it. (That text
 * once lived in a `title` attribute, a hover tooltip, which a phone can't reach.)
 */
export function AchievementGrid({ unlockedIds }: { unlockedIds: string[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = ACHIEVEMENTS.findIndex((a) => a.id === selectedId);
  const selected = selectedIndex >= 0 ? ACHIEVEMENTS[selectedIndex] : null;
  const close = useCallback(() => setSelectedId(null), []);

  return (
    <>
      <div className="grid grid-cols-4 gap-2 md:grid-cols-8 md:gap-3 xl:grid-cols-6">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedIds.includes(a.id);
          return (
            <motion.button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              aria-haspopup="dialog"
              aria-label={`${a.title}: ${a.description}. ${unlocked ? 'Получено' : 'Ещё не получено'}`}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'flex aspect-square flex-col items-center justify-center rounded-xl border text-center transition-colors',
                unlocked ? 'border-arena-amber/40 bg-arena-surface-2' : 'border-arena-border bg-arena-surface',
              )}
            >
              <Medal a={a} unlocked={unlocked} size={40} />
              <span className="mt-1 px-1 text-[9px] leading-tight text-arena-text-dim">{a.title}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <AchievementModal
            key={selected.id}
            a={selected}
            index={selectedIndex}
            unlocked={unlockedIds.includes(selected.id)}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** One achievement, opened the way a boss is from the same screen: a card over the page. */
function AchievementModal({
  a,
  index,
  unlocked,
  onClose,
}: {
  a: AchievementDef;
  index: number;
  unlocked: boolean;
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
        aria-label={`${a.title} — ${a.description}`}
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
          Достижение {index + 1} из {ACHIEVEMENTS.length}
        </p>

        <div
          className="mx-auto mt-3 flex w-full justify-center rounded-2xl py-4"
          style={unlocked ? { background: 'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.18), transparent 70%)' } : undefined}
        >
          <Medal a={a} unlocked={unlocked} size={160} />
        </div>

        <h2 className="mt-2 text-xl font-bold text-arena-text">{a.title}</h2>
        <p className="mt-1 text-sm text-arena-text-dim">{a.description}</p>

        <p className={clsx('mt-4 text-xs font-semibold', unlocked ? 'text-arena-amber' : 'text-arena-text-dim')}>
          {unlocked ? 'Получено' : 'Ещё не получено'}
        </p>
      </motion.div>
    </motion.div>
  );
}

/**
 * An achievement's medal. One you haven't earned is shown too, drained of colour and dimmed under
 * a padlock — you can see what you're going for, and earning it is what lights it up.
 */
function Medal({ a, unlocked, size }: { a: AchievementDef; unlocked: boolean; size: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <img
        src={`${import.meta.env.BASE_URL}${achievementIcon(a)}`}
        alt=""
        draggable={false}
        className={clsx('h-full w-full select-none object-contain', !unlocked && 'opacity-35 grayscale')}
        style={unlocked ? { filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' } : undefined}
      />
      {!unlocked && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: size * 0.4 }}>
          🔒
        </span>
      )}
    </span>
  );
}
