import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import type { ProfileRecord } from '../types';
import {
  LEAGUES,
  RANKS,
  STRENGTH,
  getRank,
  leagueFor,
  nextRank,
  nextStrength,
  strengthFor,
} from '../data/ranks';
import { weekRepsNow } from '../lib/training';

/**
 * The three ranks side by side on the home screen — title, league of the week, strength — each
 * with how far it is to the next step. A tile opens the ladders on its own one; the header on
 * the first.
 */

type LadderId = 'level' | 'league' | 'strength';
export function RanksCard({ profile, level }: { profile: ProfileRecord; level: number }) {
  /** Which ladder the sheet opens on; null while it's closed. */
  const [open, setOpen] = useState<LadderId | null>(null);
  const rank = getRank(level);
  const upRank = nextRank(level);
  const weekReps = weekRepsNow(profile, Date.now());
  const league = leagueFor(weekReps);
  const best = profile.bestSet ?? 0;
  const strength = strengthFor(best);
  const upStrength = nextStrength(best);

  return (
    <>
      <div className="mb-4 w-full rounded-2xl border border-arena-border bg-arena-surface p-3 text-left">
        <button onClick={() => setOpen('level')} className="mb-2 flex w-full items-center justify-between px-1">
          <span className="text-sm font-semibold text-arena-text">Ранги</span>
          <span className="flex items-center text-[11px] text-arena-text-dim">
            все ступени <ChevronRight size={13} />
          </span>
        </button>
        <div className="grid grid-cols-3 gap-2">
          <Tile
            onOpen={() => setOpen('level')}
            label="Звание"
            icon={rank.icon}
            name={rank.name}
            color={rank.color}
            note={upRank ? `«${upRank.name}» на ур. ${upRank.minLevel}` : 'высшее'}
            progress={upRank ? (level - rank.minLevel) / (upRank.minLevel - rank.minLevel) : 1}
          />
          <Tile
            onOpen={() => setOpen('league')}
            label="Лига недели"
            icon={league.tier.icon}
            name={league.name}
            color={league.tier.color}
            note={league.to != null ? `${weekReps} / ${league.to} отж.` : `${weekReps} отж.`}
            progress={league.to != null ? (weekReps - league.from) / (league.to - league.from) : 1}
          />
          <Tile
            onOpen={() => setOpen('strength')}
            label="Сила"
            icon={strength.icon}
            name={strength.name}
            color={strength.color}
            note={upStrength ? `подход ${best} / ${upStrength.min}` : `подход ${best}`}
            progress={upStrength ? (best - strength.min) / (upStrength.min - strength.min) : 1}
          />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <RanksSheet level={level} weekReps={weekReps} best={best} focus={open} onClose={() => setOpen(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function Tile({
  onOpen,
  label,
  icon,
  name,
  color,
  note,
  progress,
}: {
  label: string;
  icon: string;
  name: string;
  color: string;
  note: string;
  progress: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex min-w-0 flex-col items-center rounded-xl bg-arena-surface-2 px-1.5 py-2 text-center active:scale-95"
    >
      <span className="text-[9px] uppercase tracking-wider text-arena-text-dim">{label}</span>
      {/* Still: a badge, not a notification. */}
      <span className="mt-1 text-2xl leading-none" style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}>
        {icon}
      </span>
      <span className="mt-1 w-full truncate text-xs font-bold" style={{ color }}>
        {name}
      </span>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-arena-bg">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="mt-1 w-full truncate text-[9px] tabular-nums text-arena-text-dim">{note}</span>
    </button>
  );
}

/** Every step of all three ladders, with where you are on each. */
function RanksSheet({
  level,
  weekReps,
  best,
  focus,
  onClose,
}: {
  level: number;
  weekReps: number;
  best: number;
  /** The ladder to open on. */
  focus: LadderId;
  onClose: () => void;
}) {
  /** The ladder on show — the one that was tapped, switchable from the tabs. */
  const [tab, setTab] = useState<LadderId>(focus);
  const TABS: { id: LadderId; label: string }[] = [
    { id: 'level', label: 'Звание' },
    { id: 'league', label: 'Лига недели' },
    { id: 'strength', label: 'Сила' },
  ];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const rank = getRank(level);
  const league = leagueFor(weekReps);
  const strength = strengthFor(best);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Ранги"
        initial={{ y: 30, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-arena-border bg-arena-surface p-5"
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <X size={16} />
        </button>
        <h2 className="text-xl font-bold text-arena-text">Ранги</h2>
        <p className="mt-1 text-xs leading-snug text-arena-text-dim">
          Три лестницы, каждая про своё. Награда — значок и цвет: в профиле, в таблице лидеров,
          рамка аватара и цифры урона в бою.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-arena-border bg-arena-bg/40 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative rounded-lg px-1 py-1.5 text-[11px] font-semibold"
            >
              {tab === t.id && (
                <motion.span
                  layoutId="ranks-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-arena-surface-2 ring-1 ring-arena-amber/40"
                />
              )}
              <span className={clsx('relative', tab === t.id ? 'text-arena-amber' : 'text-arena-text-dim')}>
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {tab === 'level' && (
        <Ladder
          title="Звание"
          about="За уровень — всё, что ты вложил в игру. Растёт навсегда. Даёт рамку аватара, цвет имени в таблице и цвет цифр урона."
          steps={RANKS.map((r) => ({
            key: r.name,
            icon: r.icon,
            name: r.name,
            color: r.color,
            need: `уровень ${r.minLevel}`,
            extra: r.perk,
            current: r === rank,
            reached: level >= r.minLevel,
          }))}
        />
        )}
        {tab === 'league' && (
        <Ladder
          title="Лига недели"
          about="За отжимания с понедельника по воскресенье. В понедельник всё с нуля — это то, где ты сейчас. Внутри каждой лиги ступени III → II → I."
          steps={LEAGUES.map((l) => ({
            key: l.name,
            icon: l.icon,
            name: l.name,
            color: l.color,
            need: `${l.min}+ за неделю`,
            current: l === league.tier,
            reached: weekReps >= l.min,
            extra: l === league.tier ? `ты: ${league.name}, ${weekReps} отж.` : undefined,
          }))}
        />
        )}
        {tab === 'strength' && (
        <Ladder
          title="Сила"
          about="За лучший подход без паузы: пауза от 3 секунд — новый подход. Это про то, что ты можешь, а не сколько играешь."
          steps={STRENGTH.slice(1).map((s) => ({
            key: s.name,
            icon: s.icon,
            name: s.name,
            color: s.color,
            need: `${s.min} подряд`,
            current: s === strength,
            reached: best >= s.min,
            extra: s === strength ? `твой лучший: ${best}` : undefined,
          }))}
        />
        )}
      </motion.div>
    </motion.div>
  );
}

function Ladder({
  title,
  about,
  steps,
}: {
  title: string;
  about: string;
  steps: { key: string; icon: string; name: string; color: string; need: string; extra?: string; current: boolean; reached: boolean }[];
}) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="mt-4"
    >
      <h3 className="text-sm font-bold text-arena-text">{title}</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-arena-text-dim">{about}</p>
      <ol className="mt-2 space-y-1.5">
        {steps.map((s) => (
          <li
            key={s.key}
            className={clsx(
              'flex items-center gap-3 rounded-xl border px-3 py-2',
              s.current ? 'bg-arena-surface-2' : 'border-transparent bg-arena-bg/40',
              !s.reached && 'opacity-45',
            )}
            style={s.current ? { borderColor: s.color, boxShadow: `0 0 14px ${s.color}44` } : undefined}
          >
            <span className={clsx('text-xl leading-none', !s.reached && 'grayscale')}>{s.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold" style={{ color: s.reached ? s.color : undefined }}>
                {s.name}
                {s.current && <span className="ml-1.5 text-[10px] font-bold uppercase text-arena-amber">ты здесь</span>}
              </span>
              {s.extra && <span className="block text-[11px] text-arena-text-dim">{s.extra}</span>}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-arena-text-dim">{s.need}</span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
