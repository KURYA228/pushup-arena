import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { ProfileRecord } from '../types';
import { useRepLog } from '../hooks/useRepLog';
import { BOSSES } from '../data/bosses';
import { dailyTotals, fightDuration, plural, stageRecords, summarize, type DayTotal } from '../lib/stats';
import { BossIcon } from './BossIcon';
import { Heatmap } from './Heatmap';

const RANGES = [
  { days: 14, label: '2 недели' },
  { days: 30, label: 'Месяц' },
] as const;

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', opts);

export function StatsView({ profile }: { profile: ProfileRecord }) {
  const log = useRepLog();
  const [range, setRange] = useState<number>(14);
  const [selected, setSelected] = useState<number | null>(null);

  const now = Date.now();
  const { summary, days, records } = useMemo(() => {
    const entries = log ?? [];
    return {
      summary: summarize(entries, now),
      days: dailyTotals(entries, range, now),
      records: stageRecords(entries),
    };
    // `now` is deliberately left out: a new rep changes `log`, and that's when it's re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, range]);

  if (!log) {
    return <div className="arena-page pt-16 text-center text-sm text-arena-text-dim">Загрузка…</div>;
  }

  const defeated = BOSSES.map((b, i) => ({ boss: b, index: i })).filter(({ boss }) =>
    profile.bossesDefeated.includes(boss.id),
  );

  return (
    <div className="arena-page pb-8 pt-6">
      <header className="mb-5 text-center">
        <h1 className="text-2xl font-bold text-arena-text">Статистика</h1>
        <p className="mt-0.5 text-xs text-arena-text-dim">
          {summary.since
            ? `история ведётся с ${new Date(summary.since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
            : 'история начнётся с первого отжимания'}
        </p>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile value={summary.today} label="сегодня" />
        <Tile value={summary.week} label="за 7 дней" />
        <Tile
          value={summary.bestDay?.reps ?? 0}
          label={summary.bestDay ? `лучший день · ${dayLabel(summary.bestDay.day, { day: 'numeric', month: 'short' })}` : 'лучший день'}
        />
        <Tile value={summary.bestSet} label="лучший подход" />
        <Tile value={summary.avgSet ? summary.avgSet.toFixed(1) : 0} label="средний подход" />
        <Tile value={summary.pace ? Math.round(summary.pace) : '—'} label="темп, повт./мин" />
      </section>

      <section className="mb-4 rounded-2xl border border-arena-border bg-arena-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-arena-text">Отжимания по дням</h2>
          <div className="flex rounded-lg bg-arena-surface-2 p-0.5 text-[11px]">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => {
                  setRange(r.days);
                  setSelected(null);
                }}
                className={clsx(
                  'rounded-md px-2.5 py-1 font-medium',
                  range === r.days ? 'bg-arena-surface text-arena-text' : 'text-arena-text-dim',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <DayChart days={days} selected={selected} onSelect={setSelected} />
      </section>

      <section className="mb-4 rounded-2xl border border-arena-border bg-arena-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-arena-text">Календарь</h2>
        <Heatmap entries={log} now={now} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-arena-text">
          Победы <span className="font-normal text-arena-text-dim">— карточки открываются в боссах на главной</span>
        </h2>
        {defeated.length === 0 ? (
          <p className="rounded-2xl border border-arena-border bg-arena-surface p-4 text-center text-xs text-arena-text-dim">
            Пока никого. Первым должен пасть {BOSSES[0].name}.
          </p>
        ) : (
          <ul className="space-y-2">
            {defeated.map(({ boss, index }) => {
              const r = records.get(index);
              return (
                <li key={boss.id}>
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-arena-border bg-arena-surface px-3 py-2.5">
                    <BossIcon boss={boss} index={index} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-arena-text">
                        {index + 1}. {boss.name}
                      </p>
                      <p className="text-[11px] tabular-nums text-arena-text-dim">
                        {r
                          ? `${r.reps}${r.complete ? '' : '+'} ${plural(r.reps, 'отжимание', 'отжимания', 'отжиманий')} · ${r.crits} ${plural(r.crits, 'крит', 'крита', 'критов')} · ${fightDuration(r)}`
                          : 'до начала истории'}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-arena-border bg-arena-surface p-3 text-center"
    >
      <p className="text-2xl font-bold tabular-nums text-arena-text">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-arena-text-dim">{label}</p>
    </motion.div>
  );
}

/**
 * One series, one hue: daily reps as bars on a shared baseline. The readout line above the plot
 * is the tooltip — on a phone there's no hover, and a floating box under a fingertip is hidden
 * by that same fingertip. Tap (or hover with a mouse) a day to read it; by default it shows today.
 */
function DayChart({
  days,
  selected,
  onSelect,
}: {
  days: DayTotal[];
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const max = Math.max(1, ...days.map((d) => d.reps));
  const active = selected ?? days.length - 1;
  const shown = days[active];
  const total = days.reduce((s, d) => s + d.reps, 0);
  const activeDays = days.filter((d) => d.reps > 0).length;
  const PLOT_H = 140;

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between text-xs">
        <span className="text-arena-text">
          <span className="font-semibold tabular-nums">{shown.reps}</span>{' '}
          <span className="text-arena-text-dim">
            {plural(shown.reps, 'отжимание', 'отжимания', 'отжиманий')} ·{' '}
            {selected == null ? 'сегодня' : dayLabel(shown.day, { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </span>
        <span className="tabular-nums text-arena-text-dim">
          всего {total} · {activeDays} {plural(activeDays, 'день', 'дня', 'дней')}
        </span>
      </div>

      <div
        role="img"
        aria-label={`Отжимания по дням: ${days.map((d) => `${dayLabel(d.day, { day: 'numeric', month: 'short' })} — ${d.reps}`).join(', ')}`}
        className="relative"
        onMouseLeave={() => onSelect(null)}
      >
        {/* Recessive guide at the top of the scale, labelled once. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-arena-border" />
        <span className="pointer-events-none absolute right-0 -top-4 text-[10px] tabular-nums text-arena-text-dim">
          {max}
        </span>

        <div className="flex items-end gap-[2px]" style={{ height: PLOT_H }}>
          {days.map((d, i) => {
            const h = d.reps ? Math.max(3, (d.reps / max) * PLOT_H) : 0;
            const isActive = i === active;
            return (
              <button
                key={d.day}
                onClick={() => onSelect(i === selected ? null : i)}
                onMouseEnter={() => onSelect(i)}
                aria-label={`${dayLabel(d.day, { day: 'numeric', month: 'long' })}: ${d.reps}`}
                // The hit target is the whole column, not just the bar — empty days are tappable too.
                className="flex h-full flex-1 items-end"
              >
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: h }}
                  transition={{ type: 'spring', stiffness: 200, damping: 26, delay: i * 0.012 }}
                  className={clsx(
                    'block w-full rounded-t-[4px]',
                    isActive ? 'bg-arena-amber' : 'bg-arena-amber/45',
                  )}
                />
              </button>
            );
          })}
        </div>
        <div className="border-t border-arena-border" />
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-arena-text-dim">
          <span>{dayLabel(days[0].day, { day: 'numeric', month: 'short' })}</span>
          <span>сегодня</span>
        </div>
      </div>
    </div>
  );
}
