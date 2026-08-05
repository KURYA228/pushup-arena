import clsx from 'clsx';
import { BOSSES, bossStatusAt } from '../data/bosses';
import { BossIcon } from './BossIcon';

/**
 * Every boss in the arena, tappable. Deliberately shows the ones you haven't reached yet rather
 * than hiding them behind silhouettes — the full roster is the point.
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
    <div className="grid grid-cols-3 gap-2">
      {BOSSES.map((boss, i) => {
        const status = bossStatusAt(i, currentIndex, defeatedIds);
        return (
          <button
            key={boss.id}
            onClick={() => onSelect(i)}
            aria-label={`${boss.name} — ${boss.title}`}
            className={clsx(
              'relative flex flex-col items-center rounded-2xl border px-1 pb-2 pt-2 transition-colors active:scale-[0.97]',
              status === 'current'
                ? 'border-arena-amber/60 bg-arena-surface-2'
                : 'border-arena-border bg-arena-surface',
              status === 'upcoming' && 'opacity-65',
            )}
          >
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
                status === 'defeated' && 'text-arena-amber',
                status === 'current' && 'font-semibold text-arena-amber',
                status === 'upcoming' && 'text-arena-text-dim',
              )}
            >
              {status === 'defeated' ? 'повержен' : status === 'current' ? 'текущий' : `${boss.hp} HP`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
