import { useEffect, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { Crown, Swords, Trophy } from 'lucide-react';
import type { DuelOutcome } from '../data/duel';
import { Avatar } from './PlayerBadge';
import { Burst } from './Burst';
import type { DuelSide } from './DuelHud';

const YOU = 'var(--color-arena-amber)';
const THEM = 'var(--color-arena-red)';

/** The beats of the reveal, in seconds: fighters walk on, counts run up, then the verdict lands. */
const T_COUNT = 0.45;
const COUNT_FOR = 1.3;
const T_VERDICT = T_COUNT + COUNT_FOR + 0.15;
const T_RATING = T_VERDICT + 0.45;

/** A number that runs up from `from` to `to` after `delay` — straight to `to` under reduced motion. */
function useCountUp(to: number, { from = 0, delay = 0, duration = COUNT_FOR, calm = false }: { from?: number; delay?: number; duration?: number; calm?: boolean | null }) {
  const [value, setValue] = useState(calm ? to : from);
  useEffect(() => {
    if (calm) {
      setValue(to);
      return;
    }
    const controls = animate(from, to, { delay, duration, ease: [0.2, 0.7, 0.3, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [to, from, delay, duration, calm]);
  return value;
}

/** Fires `true` once `delay` seconds have passed — at once under reduced motion. */
function useAfter(delay: number, calm: boolean | null) {
  const [done, setDone] = useState(!!calm);
  useEffect(() => {
    if (calm) return;
    const id = window.setTimeout(() => setDone(true), delay * 1000);
    return () => window.clearTimeout(id);
  }, [delay, calm]);
  return done;
}

/** One side of the result: walks on from its edge, its count runs up, then wins its crown or greys out. */
function Corner({
  side,
  reps,
  color,
  from,
  won,
  lost,
  calm,
}: {
  side: DuelSide;
  reps: number;
  color: string;
  from: 'left' | 'right';
  won: boolean;
  lost: boolean;
  calm: boolean | null;
}) {
  const shown = useCountUp(reps, { delay: T_COUNT, calm });
  const settled = useAfter(T_VERDICT, calm);
  const dir = from === 'left' ? -1 : 1;
  return (
    <motion.div
      initial={calm ? false : { x: 70 * dir, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
      className="flex min-w-0 flex-col items-center"
    >
      {/* The face stays where it is; the win and the loss are drawn on and around it. */}
      <div className="relative">
        {settled && won && (
          <>
            <motion.span
              aria-hidden
              className="absolute -inset-[6px] rounded-full"
              style={{ background: `conic-gradient(from 0deg, transparent, ${color} 25%, transparent 50%, ${color} 75%, transparent)` }}
              initial={{ opacity: 0 }}
              animate={calm ? { opacity: 1 } : { opacity: 1, rotate: 360 }}
              transition={calm ? { duration: 0.2 } : { opacity: { duration: 0.3 }, rotate: { duration: 2, repeat: Infinity, ease: 'linear' } }}
            />
            <motion.span
              aria-hidden
              className="absolute -inset-1.5 rounded-full"
              style={{ boxShadow: `0 0 28px ${color}` }}
              animate={calm ? {} : { opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {!calm && <Burst count={16} spread={60} />}
          </>
        )}
        {/* The crown drops onto the winner. */}
        {settled && won && (
          <motion.span
            initial={calm ? false : { y: -26, opacity: 0, rotate: -25 }}
            animate={calm ? { y: 0, opacity: 1, rotate: -12 } : { y: [0, -3, 0], opacity: 1, rotate: -12 }}
            transition={calm ? {} : { y: { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }, default: { type: 'spring', stiffness: 420, damping: 12 } }}
            className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 text-arena-amber drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]"
          >
            <Crown size={22} fill="currentColor" />
          </motion.span>
        )}
        <motion.div
          className="relative rounded-full bg-arena-surface"
          animate={{ filter: settled && lost ? 'grayscale(0.85) brightness(0.7)' : 'grayscale(0) brightness(1)' }}
          transition={{ duration: 0.5 }}
        >
          {side.emoji ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-arena-surface-2 text-3xl">{side.emoji}</span>
          ) : (
            <Avatar name={side.name} avatar={side.avatar} level={side.level} size="lg" />
          )}
        </motion.div>
      </div>
      <p className="mt-1.5 max-w-full truncate text-sm font-bold text-arena-text">{side.name}</p>
      <motion.span
        animate={settled && won && !calm ? { scale: [1, 1.35, 1] } : {}}
        transition={{ duration: 0.45 }}
        className="text-5xl font-black leading-none tabular-nums"
        style={{ color, opacity: settled && lost ? 0.55 : 1 }}
      >
        {shown}
      </motion.span>
    </motion.div>
  );
}

/**
 * How a 1 на 1 ended, as a reveal: the two fighters walk on, both counts run up together while
 * the tug-of-war bar is pulled to where it finished, then the verdict slams down — the winner
 * takes a crown and confetti, the loser greys out, the card shakes on a loss — and last the
 * rating ticks over to its new value.
 */
export function DuelResult({
  you,
  rival,
  myReps,
  rivalReps,
  outcome,
  rating,
  newRecord,
  bestCombo,
  onVerdict,
}: {
  you: DuelSide;
  rival: DuelSide;
  myReps: number;
  rivalReps: number;
  outcome: DuelOutcome;
  /** Rating before and after; null while it's being saved. `rated` false: it didn't count. */
  rating: { before: number; after: number; rated: boolean } | null;
  newRecord: boolean;
  bestCombo: number;
  /** The moment the verdict lands — for its sound. */
  onVerdict?: () => void;
}) {
  const calm = useReducedMotion();
  const verdict = useAfter(T_VERDICT, calm);
  useEffect(() => {
    if (verdict) onVerdict?.();
    // Once, as it lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict]);
  const showRating = useAfter(T_RATING, calm);
  const total = myReps + rivalReps;
  const share = total ? (myReps / total) * 100 : 50;

  const word = outcome === 'win' ? 'Победа' : outcome === 'loss' ? 'Поражение' : 'Ничья';
  const wordColor = outcome === 'win' ? 'text-arena-amber' : outcome === 'loss' ? 'text-arena-red' : 'text-arena-text';
  const glow = outcome === 'win' ? 'rgba(245,158,11,0.75)' : outcome === 'loss' ? 'rgba(239,68,68,0.7)' : 'rgba(230,231,235,0.5)';

  return (
    <motion.div
      initial={calm ? false : { opacity: 0, scale: 0.94, y: 12 }}
      animate={
        verdict && !calm && outcome === 'loss'
          ? { opacity: 1, scale: 1, y: 0, x: [0, -9, 8, -6, 4, 0] }
          : verdict && !calm && outcome === 'win'
            ? { opacity: 1, scale: [1, 1.03, 1], y: 0 }
            : { opacity: 1, scale: 1, y: 0 }
      }
      transition={{ duration: verdict ? 0.45 : 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-arena-border bg-arena-surface px-3 pb-4 pt-3"
    >
      {/* The corners lit in each side's colour; the winner's flares once the verdict lands. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{
          background: `radial-gradient(130% 90% at 0% 0%, rgba(245,158,11,${verdict && outcome === 'win' ? 0.32 : 0.14}), transparent 55%), radial-gradient(130% 90% at 100% 0%, rgba(239,68,68,${verdict && outcome === 'loss' ? 0.32 : 0.14}), transparent 55%)`,
        }}
        transition={{ duration: 0.6 }}
      />

      <div className="relative flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-arena-text-dim">
        <Swords size={12} className="text-arena-amber" />
        {rating?.rated ? '1 на 1 · на рейтинг' : rival.rating != null ? '1 на 1 · без рейтинга' : 'Спарринг'}
      </div>

      {/* The verdict: a stamp that slams down over the top of the card. */}
      <div className="relative flex h-14 items-center justify-center">
        {/* A win gets sunrays turning slowly behind the word. */}
        {verdict && outcome === 'win' && !calm && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: 'repeating-conic-gradient(rgba(245,158,11,0.22) 0deg 10deg, transparent 10deg 24deg)',
              maskImage: 'radial-gradient(circle, black 15%, transparent 65%)',
              WebkitMaskImage: 'radial-gradient(circle, black 15%, transparent 65%)',
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1, rotate: 360 }}
            transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.5 }, rotate: { duration: 18, repeat: Infinity, ease: 'linear' } }}
          />
        )}
        {verdict && (
          <motion.span
            initial={calm ? false : { scale: 3.2, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 15 }}
            className={`text-[34px] font-black uppercase leading-none tracking-wide ${wordColor}`}
            style={{ textShadow: `0 0 24px ${glow}` }}
          >
            {word}
          </motion.span>
        )}
        {/* A loss gets a slash torn through it. */}
        {verdict && outcome === 'loss' && !calm && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-56 -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-full bg-white shadow-[0_0_12px_rgba(239,68,68,0.9)]"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
            transition={{ duration: 0.7, times: [0, 0.35, 1], delay: 0.15, ease: 'easeOut' }}
          />
        )}
        {verdict && outcome === 'win' && <Burst count={34} spread={140} duration={1.1} confetti />}
        {verdict && outcome !== 'loss' && <Burst count={16} spread={90} />}
      </div>

      <div className="relative mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Corner side={you} reps={myReps} color={YOU} from="left" won={outcome === 'win'} lost={outcome === 'loss'} calm={calm} />
        <motion.span
          initial={calm ? false : { scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.25 }}
          className="text-xl font-black italic text-arena-text-dim"
        >
          VS
        </motion.span>
        <Corner side={rival} reps={rivalReps} color={THEM} from="right" won={outcome === 'loss'} lost={outcome === 'win'} calm={calm} />
      </div>

      {/* The tug-of-war bar, pulled from the middle to where the minute left it. */}
      <div className="relative mx-1 mt-4 h-2.5 rounded-full" style={{ background: THEM }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `linear-gradient(90deg, var(--color-arena-amber-dim), ${YOU})` }}
          initial={calm ? false : { width: '50%' }}
          animate={{ width: `${share}%` }}
          transition={{ delay: T_COUNT, duration: COUNT_FOR, ease: [0.2, 0.7, 0.3, 1] }}
        />
        <motion.span
          className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-arena-surface bg-arena-text text-arena-bg shadow-[0_0_12px_rgba(255,255,255,0.5)]"
          initial={calm ? false : { left: '50%' }}
          animate={{ left: `${share}%`, rotate: verdict && !calm ? [0, -25, 25, 0] : 0 }}
          transition={{ left: { delay: T_COUNT, duration: COUNT_FOR, ease: [0.2, 0.7, 0.3, 1] }, rotate: { duration: 0.5 } }}
        >
          <Swords size={13} strokeWidth={2.5} />
        </motion.span>
      </div>

      {/* What it did to the rating, and the minute's own highlights. */}
      <div className="relative mt-4 flex min-h-[52px] flex-col items-center justify-center gap-2">
        {showRating && <RatingLine rating={rating} calm={calm} />}
        {showRating && (newRecord || bestCombo > 1) && (
          <motion.div
            initial={calm ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap justify-center gap-1.5"
          >
            {newRecord && (
              <span className="flex items-center gap-1 rounded-full bg-arena-amber/15 px-2 py-0.5 text-[11px] font-bold text-arena-amber">
                <Trophy size={11} /> Новый рекорд
              </span>
            )}
            {bestCombo > 1 && (
              <span className="rounded-full bg-arena-surface-2 px-2 py-0.5 text-[11px] font-semibold text-arena-text-dim">
                лучшее комбо x{bestCombo}
              </span>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/** Before → after with the delta ticking over; a note instead when the duel wasn't rated. */
function RatingLine({ rating, calm }: { rating: { before: number; after: number; rated: boolean } | null; calm: boolean | null }) {
  const before = rating?.before ?? 0;
  const after = rating?.after ?? 0;
  const delta = after - before;
  const shown = useCountUp(after, { from: before, duration: 0.9, calm });
  const shownDelta = useCountUp(delta, { duration: 0.9, calm });
  if (!rating) return <p className="text-xs text-arena-text-dim">Записываем результат…</p>;
  if (!rating.rated) {
    return (
      <motion.p initial={calm ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-arena-text-dim">
        На рейтинг не повлияло
      </motion.p>
    );
  }
  const tone = delta > 0 ? 'text-arena-amber' : delta < 0 ? 'text-arena-red' : 'text-arena-text-dim';
  return (
    <motion.div
      initial={calm ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-baseline gap-2 rounded-xl bg-arena-surface-2 px-3 py-1.5"
    >
      <span className="text-[11px] text-arena-text-dim">Рейтинг</span>
      <span className="text-lg font-black tabular-nums text-arena-text">{shown}</span>
      <motion.span
        key={delta}
        initial={calm ? false : { scale: 1.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 12, delay: 0.9 }}
        className={`text-sm font-black tabular-nums ${tone}`}
      >
        {shownDelta > 0 ? `+${shownDelta}` : shownDelta}
      </motion.span>
    </motion.div>
  );
}
