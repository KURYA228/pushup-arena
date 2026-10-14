import { motion, useReducedMotion } from 'framer-motion';
import { Lock, RefreshCw, Swords, Trophy } from 'lucide-react';
import { DUEL_DAILY_LIMIT, expectedScore, ratingDelta } from '../data/duel';
import { plural } from '../lib/stats';
import { Avatar } from './PlayerBadge';
import { Burst } from './Burst';
import type { DuelSide } from './DuelHud';

/** The two corners of every 1 на 1 card: you in amber from the left, them in red from the right. */
const CORNERS =
  'radial-gradient(120% 90% at 0% 0%, rgba(245,158,11,0.16), transparent 55%), radial-gradient(120% 90% at 100% 0%, rgba(239,68,68,0.16), transparent 55%)';

function Face({ side, size = 'lg' }: { side: DuelSide; size?: 'md' | 'lg' }) {
  if (side.emoji) {
    const box = size === 'lg' ? 'h-16 w-16 text-3xl' : 'h-11 w-11 text-xl';
    return <span className={`flex items-center justify-center rounded-full bg-arena-surface-2 ${box}`}>{side.emoji}</span>;
  }
  return <Avatar name={side.name} avatar={side.avatar} level={side.level} size={size} />;
}

/**
 * The way into 1 на 1 on the Rush screen: your rating and record, and the button to find someone.
 * Locked until there's a Rush record — that record is the ghost you'd be pitting against theirs,
 * and the sparring robot is built from it too.
 */
export function DuelEntry({
  rating,
  wins,
  losses,
  draws,
  locked,
  onFind,
}: {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  locked: boolean;
  onFind: () => void;
}) {
  const calm = useReducedMotion();
  const played = wins + losses + draws;
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  return (
    <div className="relative mt-3 overflow-hidden rounded-2xl border border-arena-border bg-arena-surface p-3 text-left">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: CORNERS, opacity: locked ? 0.4 : 1 }} />

      <div className="relative flex items-center gap-3">
        <motion.span
          animate={calm || locked ? {} : { rotate: [0, -12, 12, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 2.4 }}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${locked ? 'bg-arena-surface-2 text-arena-text-dim' : 'bg-arena-amber/15 text-arena-amber'}`}
        >
          {locked ? <Lock size={20} /> : <Swords size={22} />}
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-wide text-arena-text">1 на 1</p>
          <p className="text-[11px] text-arena-text-dim">
            {locked ? 'Минута против рекорда другого игрока' : 'Минута против рекорда игрока твоего уровня'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black leading-none tabular-nums text-arena-amber">{rating}</p>
          <p className="text-[10px] text-arena-text-dim">{plural(rating, 'очко', 'очка', 'очков')}</p>
        </div>
      </div>

      {played > 0 && (
        <div className="relative mt-3">
          <div className="flex justify-between text-[10px] font-semibold tabular-nums">
            <span className="text-arena-amber">
              {wins} {plural(wins, 'победа', 'победы', 'побед')}
            </span>
            {draws > 0 && <span className="text-arena-text-dim">{draws} {plural(draws, 'ничья', 'ничьи', 'ничьих')}</span>}
            <span className="text-arena-red">
              {losses} {plural(losses, 'поражение', 'поражения', 'поражений')}
            </span>
          </div>
          <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-arena-surface-2">
            <motion.div className="bg-arena-amber" initial={calm ? false : { width: 0 }} animate={{ width: `${(wins / played) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            <motion.div className="bg-arena-text-dim/40" initial={calm ? false : { width: 0 }} animate={{ width: `${(draws / played) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            <motion.div className="flex-1 bg-arena-red" />
          </div>
          <p className="mt-1 text-center text-[10px] text-arena-text-dim">{winRate}% побед</p>
        </div>
      )}

      {locked ? (
        <p className="relative mt-3 rounded-xl bg-arena-surface-2 px-3 py-2 text-center text-xs text-arena-text-dim">
          Сначала поставь рекорд в Rush — с ним ты и выйдешь на дуэль.
        </p>
      ) : (
        // The same big button as «Начать Rush», pulsing the same way; the pulse moves a wrapper,
        // since the button's own transform is its press.
        <motion.div
          className="relative mt-3"
          animate={calm ? {} : { scale: [1, 1.03, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <button onClick={onFind} className="btn-3d flex w-full items-center justify-center gap-2">
            <Swords size={18} /> Найти соперника
          </button>
        </motion.div>
      )}
    </div>
  );
}

/** Looking for someone: your face, sonar rings going out, and a question mark spinning where theirs will be. */
export function DuelMatching({ you }: { you: DuelSide }) {
  const calm = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-arena-border bg-arena-surface px-4 py-6">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: CORNERS }} />
      <div className="relative flex items-center justify-around">
        <div className="relative flex items-center justify-center">
          {!calm &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute h-16 w-16 rounded-full border-2 border-arena-amber"
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
              />
            ))}
          <Face side={you} />
        </div>
        <motion.span
          animate={calm ? {} : { rotate: [0, -15, 15, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          className="text-arena-text-dim"
        >
          <Swords size={26} />
        </motion.span>
        <motion.span
          animate={calm ? {} : { rotateY: [0, 180, 360] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-arena-red/60 bg-arena-surface-2 text-2xl font-black text-arena-red"
        >
          ?
        </motion.span>
      </div>
      <motion.p
        className="relative mt-5 text-center text-sm text-arena-text-dim"
        animate={calm ? {} : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        Ищем соперника твоего уровня…
      </motion.p>
    </div>
  );
}

/**
 * Who you've drawn: the two of you charging in from the sides, VS slamming down between, then
 * the tale of the tape — both records side by side — and what the fight is worth either way.
 */
export function DuelVersus({
  you,
  rival,
  myBest,
  rivalBest,
  today,
  spent,
  note,
  onFight,
  onAnother,
  onBack,
}: {
  you: DuelSide & { rating: number };
  rival: DuelSide;
  myBest: number;
  rivalBest: number;
  /** Rated duels against them today, and whether that's the limit — null for the robot. */
  today: number | null;
  spent: boolean;
  /** A line under the card, for the robot: why it's the robot. */
  note?: string;
  onFight: () => void;
  onAnother: () => void;
  onBack: () => void;
}) {
  const calm = useReducedMotion();
  const rated = rival.rating != null && !spent;
  const top = Math.max(myBest, rivalBest, 1);
  const chance = rival.rating != null ? Math.round(expectedScore(you.rating, rival.rating) * 100) : null;
  const gain = rival.rating != null ? ratingDelta(you.rating, rival.rating, 'win') : 0;
  const lose = rival.rating != null ? ratingDelta(you.rating, rival.rating, 'loss') : 0;

  const Row = ({ label, mine, theirs }: { label: string; mine: number; theirs: number }) => (
    <div>
      <div className="flex items-baseline justify-between text-xs font-black tabular-nums">
        <span className="text-arena-amber">{mine}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-arena-text-dim">{label}</span>
        <span className="text-arena-red">{theirs}</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-arena-surface-2">
          <motion.div className="rounded-full bg-arena-amber" initial={calm ? false : { width: 0 }} animate={{ width: `${(mine / top) * 100}%` }} transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }} />
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-arena-surface-2">
          <motion.div className="rounded-full bg-arena-red" initial={calm ? false : { width: 0 }} animate={{ width: `${(theirs / top) * 100}%` }} transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-arena-border bg-arena-surface">
        {/* A diagonal split: your half amber, theirs red, sliding together. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[60%] bg-gradient-to-br from-arena-amber/25 to-transparent"
          style={{ clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)' }}
          initial={calm ? false : { x: '-100%' }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-[60%] bg-gradient-to-bl from-arena-red/25 to-transparent"
          style={{ clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0 100%)' }}
          initial={calm ? false : { x: '100%' }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        />

        <div className="relative flex items-center justify-center gap-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-arena-text-dim">
          <Swords size={12} className="text-arena-amber" />
          {rated ? '1 на 1 · на рейтинг' : rival.rating != null ? '1 на 1 · без рейтинга' : 'Спарринг'}
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-3">
          <motion.div
            className="flex min-w-0 flex-col items-center gap-1"
            initial={calm ? false : { x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
          >
            <Face side={you} />
            <p className="max-w-full truncate text-sm font-bold text-arena-text">{you.name}</p>
            <p className="text-[10px] tabular-nums text-arena-text-dim">
              {you.rating} {plural(you.rating, 'очко', 'очка', 'очков')}
            </p>
          </motion.div>

          <div className="relative flex items-center justify-center">
            <motion.span
              initial={calm ? false : { scale: 3, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 460, damping: 13, delay: 0.3 }}
              className="text-3xl font-black italic text-arena-text"
              style={{ textShadow: '0 0 18px rgba(245,158,11,0.7), 3px 3px 0 rgba(239,68,68,0.6)' }}
            >
              VS
            </motion.span>
            {!calm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }} className="absolute inset-0">
                <Burst count={14} spread={60} />
              </motion.div>
            )}
          </div>

          <motion.div
            className="flex min-w-0 flex-col items-center gap-1"
            initial={calm ? false : { x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.12 }}
          >
            <Face side={rival} />
            <p className="max-w-full truncate text-sm font-bold text-arena-text">{rival.name}</p>
            <p className="text-[10px] tabular-nums text-arena-text-dim">
              {rival.rating != null ? `${rival.rating} ${plural(rival.rating, 'очко', 'очка', 'очков')}` : 'без рейтинга'}
            </p>
          </motion.div>
        </div>

        {/* The tale of the tape. */}
        <motion.div
          className="relative mx-3 mt-4 space-y-2 rounded-xl bg-arena-bg/50 p-2.5"
          initial={calm ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Row label="рекорд Rush" mine={myBest} theirs={rivalBest} />
          <p className="text-center text-[11px] text-arena-text-dim">
            Сделай больше <span className="font-bold text-arena-text">{rivalBest}</span> за минуту — и победа твоя
          </p>
        </motion.div>

        {/* What it's worth. */}
        <motion.div
          className="relative flex items-center justify-center gap-2 px-3 pb-3 pt-2.5 text-[11px]"
          initial={calm ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {rated ? (
            <>
              <span className="rounded-full bg-arena-amber/15 px-2 py-0.5 font-bold tabular-nums text-arena-amber">
                <Trophy size={10} className="mr-1 inline align-[-1px]" />+{gain}
              </span>
              <span className="rounded-full bg-arena-red/15 px-2 py-0.5 font-bold tabular-nums text-arena-red">{lose}</span>
              {chance != null && <span className="text-arena-text-dim">шанс по рейтингу {chance}%</span>}
            </>
          ) : (
            <span className="text-arena-text-dim">{spent ? `Лимит ${DUEL_DAILY_LIMIT} боёв с ним на сегодня — без рейтинга` : 'На рейтинг не влияет'}</span>
          )}
        </motion.div>

        {today != null && (
          <div className="relative flex justify-center gap-1 pb-3" title="Боёв с ним сегодня">
            {Array.from({ length: DUEL_DAILY_LIMIT }, (_, i) => (
              <span key={i} className={`h-1.5 w-5 rounded-full ${i < today ? 'bg-arena-text-dim/50' : i === today ? 'bg-arena-amber' : 'bg-arena-surface-2'}`} />
            ))}
          </div>
        )}
      </div>

      {note && <p className="text-xs text-arena-text-dim">{note}</p>}

      <motion.div animate={calm ? {} : { scale: [1, 1.03, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
        <button onClick={onFight} className="btn-3d flex w-full items-center justify-center gap-2">
          <Swords size={18} /> В бой
        </button>
      </motion.div>
      <div className="flex gap-2">
        <button
          onClick={onAnother}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-arena-surface-2 py-2.5 text-xs font-medium text-arena-text active:scale-[0.98]"
        >
          <RefreshCw size={13} /> Другой соперник
        </button>
        <button onClick={onBack} className="flex-1 rounded-xl bg-arena-surface-2 py-2.5 text-xs font-medium text-white active:scale-[0.98]">
          Назад
        </button>
      </div>
    </div>
  );
}
