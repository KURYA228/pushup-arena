import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { RepLogEntry } from '../types';
import { heatLevel, heatmapWeeks, plural } from '../lib/stats';
import { useMediaQuery } from '../hooks/useMediaQuery';

/** One hue, light to strong: how much was done that day. Level 0 is an empty day. */
const SHADES = [
  'bg-arena-surface-2',
  'bg-arena-amber/25',
  'bg-arena-amber/50',
  'bg-arena-amber/75',
  'bg-arena-amber',
];

const DAY_LABELS = ['пн', '', 'ср', '', 'пт', '', ''];

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', opts);

/**
 * Days as squares, weeks as columns — the GitHub-style calendar. A phone gets the last twenty
 * weeks, a wide screen the full year. Tap a square (or hover it) to read the day.
 */
export function Heatmap({ entries, now }: { entries: readonly RepLogEntry[]; now: number }) {
  const wide = useMediaQuery('(min-width: 768px)');
  const weeks = wide ? 52 : 20;
  const cols = useMemo(() => heatmapWeeks(entries, weeks, now), [entries, weeks, now]);
  const max = Math.max(0, ...cols.flat().map((c) => c.reps));
  const [picked, setPicked] = useState<{ day: string; reps: number } | null>(null);
  const activeDays = cols.flat().filter((c) => c.reps > 0).length;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2 whitespace-nowrap text-xs">
        <span className="text-arena-text">
          {picked ? (
            <>
              <span className="font-semibold tabular-nums">{picked.reps}</span>{' '}
              <span className="text-arena-text-dim">
                {plural(picked.reps, 'отжимание', 'отжимания', 'отжиманий')} ·{' '}
                {fmt(picked.day, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </>
          ) : (
            <span className="text-arena-text-dim">нажми на день</span>
          )}
        </span>
        <span className="tabular-nums text-arena-text-dim">
          {activeDays} {plural(activeDays, 'активный день', 'активных дня', 'активных дней')}
        </span>
      </div>

      <div className="flex gap-1.5" onMouseLeave={() => setPicked(null)}>
        <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-4 text-[9px] leading-none text-arena-text-dim">
          {DAY_LABELS.map((l, i) => (
            <span key={i} className="flex h-full items-center">
              {l}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          {/* Month names over the column where a month begins. */}
          <div className="mb-1 grid h-3 gap-[3px] text-[9px] leading-none text-arena-text-dim" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
            {cols.map((col, i) => {
              const first = col.find((c) => c.day.endsWith('-01'));
              return (
                <span key={i} className="overflow-visible whitespace-nowrap">
                  {first ? fmt(first.day, { month: 'short' }).replace('.', '') : ''}
                </span>
              );
            })}
          </div>
          <div
            role="img"
            aria-label={`Календарь отжиманий за ${weeks} недель: ${activeDays} активных дней`}
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}
          >
            {cols.map((col, i) => (
              <div key={i} className="grid grid-rows-7 gap-[3px]">
                {col.map((c) => (
                  <button
                    key={c.day}
                    disabled={c.future}
                    onClick={() => setPicked(c)}
                    onMouseEnter={() => !c.future && setPicked(c)}
                    aria-label={`${fmt(c.day, { day: 'numeric', month: 'long' })}: ${c.reps}`}
                    className={clsx(
                      'aspect-square w-full rounded-[3px]',
                      c.future ? 'bg-transparent' : SHADES[heatLevel(c.reps, max)],
                      picked?.day === c.day && 'ring-1 ring-arena-text',
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-arena-text-dim">
        меньше
        {SHADES.map((s) => (
          <span key={s} className={clsx('h-2.5 w-2.5 rounded-[2px]', s)} />
        ))}
        больше
      </div>
    </div>
  );
}
