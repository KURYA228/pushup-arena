import clsx from 'clsx';
import { motion } from 'framer-motion';
import { BOSSES, bossStatusAt } from '../data/bosses';
import { BossIcon } from './BossIcon';

/**
 * Every fight in the arena, in order.
 *
 * Anyone you haven't reached yet is a locked tile and nothing else — no face, no name, no
 * health. Showing the whole roster up front was the earlier idea, and it gave away every
 * surprise the game has: by the second stage you already knew all fifteen. A locked door is
 * worth more than a preview.
 *
 * The one you're fighting now stays visible, because the screen names him right above this
 * anyway — hiding him here would contradict that, not protect anything.
 */
export function BossGallery({
  currentIndex,
  defeatedIds,
  onSelect,
}: {
  currentIndex: number;
  defeatedIds: string[];
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-5 md:gap-3 xl:grid-cols-4">
      {BOSSES.map((boss, i) => {
        const status = bossStatusAt(i, currentIndex, defeatedIds);
        const locked = status === 'upcoming';
        return (
          <motion.button
            key={boss.id}
            onClick={() => !locked && onSelect(i)}
            disabled={locked}
            // Nothing in here may name a locked boss — a label is read aloud and copied into
            // the accessibility tree, which would leak exactly what the tile is hiding.
            aria-label={locked ? `Этап ${i + 1} — ещё не открыт` : `${boss.name} — ${boss.title}`}
            // Dealt out rather than dropped in a block: fifteen tiles appearing at once is a wall,
            // one after another is a roster.
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: Math.min(i * 0.025, 0.4), type: 'spring', stiffness: 380, damping: 28 }}
            whileTap={locked ? undefined : { scale: 0.95 }}
            className={clsx(
              'relative flex flex-col items-center rounded-2xl border px-1 pb-2 pt-2 transition-colors',
              locked
                ? 'justify-center border-arena-border bg-arena-surface opacity-40'
                : status === 'current'
                  ? 'border-arena-amber/60 bg-arena-surface-2'
                  : 'border-arena-border bg-arena-surface',
            )}
          >
            {locked ? (
              // Sized to the same height as an open tile — artwork, name and status — so the
              // grid stays a grid and the rows don't jump about as the arena opens up.
              // The same padlock the achievements use — a locked boss and a locked achievement
              // are the same statement, and drawing them two different ways made the screen
              // look like two screens.
              //
              // The caption is the one thing a locked tile can say without giving anything
              // away: where it sits in the arena. Bare, the tiles read as holes in the grid;
              // numbered, they read as doors you haven't got to yet.
              <span className="flex h-[74px] flex-col items-center justify-center gap-1.5">
                <span className="text-2xl leading-none">🔒</span>
                <span className="text-[10px] leading-none text-arena-text-dim">этап {i + 1}</span>
              </span>
            ) : (
              <>
                <span className="absolute right-1.5 top-1.5 text-[10px] leading-none text-arena-text-dim">
                  {i + 1}
                </span>
                <BossIcon boss={boss} index={i} size={38} />
                <span className="mt-1 line-clamp-2 px-0.5 text-center text-[10px] leading-tight text-arena-text">
                  {boss.name}
                </span>
                <span
                  className={clsx(
                    'mt-0.5 text-[9px] leading-none',
                    status === 'current' ? 'font-semibold text-arena-amber' : 'text-arena-amber',
                  )}
                >
                  {status === 'current' ? 'текущий' : 'повержен'}
                </span>
              </>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
