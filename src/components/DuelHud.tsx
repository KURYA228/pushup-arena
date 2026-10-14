import { motion, useReducedMotion } from 'framer-motion';
import { Swords, Trophy } from 'lucide-react';
import { Avatar } from './PlayerBadge';
import { plural } from '../lib/stats';
import { Burst } from './Burst';

/** You in the arena's amber, them in red — the two halves of the tug-of-war bar. */
const YOU = 'var(--color-arena-amber)';
const THEM = 'var(--color-arena-red)';
/** The clock's ring: circumference of r=16 in a 36-unit box, as in the solo Rush. */
const RING = 2 * Math.PI * 16;

export interface DuelSide {
  name: string;
  avatar: string | null;
  /** Wears the frame of this level's title; none for the robot. */
  level?: number;
  /** Their 1 на 1 rating; null for the unrated sparring robot. */
  rating: number | null;
  /** Shown instead of an avatar — the robot's 🤖. */
  emoji?: string;
}

/** One fighter: face in their title's frame, name, rating, and the count punching up under it. */
function Fighter({ side, reps, color, calm, leading }: { side: DuelSide; reps: number; color: string; calm: boolean | null; leading: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <motion.div
        animate={{ scale: leading && !calm ? 1.06 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="rounded-full"
        style={{ boxShadow: leading ? `0 0 18px ${color}` : 'none' }}
      >
        {side.emoji ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-arena-surface-2 text-2xl">{side.emoji}</span>
        ) : (
          <Avatar name={side.name} avatar={side.avatar} level={side.level} size="md" className="!h-12 !w-12" />
        )}
      </motion.div>
      <p className="mt-1 max-w-full truncate text-xs font-bold text-arena-text">{side.name}</p>
      <p className="text-[10px] tabular-nums text-arena-text-dim">
        {side.rating != null ? `${side.rating} ${plural(side.rating, 'очко', 'очка', 'очков')}` : 'без рейтинга'}
      </p>
      <motion.span
        key={reps}
        initial={calm || reps === 0 ? false : { scale: 1.5, y: -3 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 16 }}
        className="mt-0.5 text-4xl font-black leading-none tabular-nums"
        style={{ color }}
      >
        {reps}
      </motion.span>
    </div>
  );
}

/**
 * The 1 на 1 scoreboard. You on the left, them on the right, each with the count under their
 * face; the clock ring between, as in the solo Rush; and along the bottom a tug-of-war bar —
 * your share of all reps so far in amber, theirs in red, crossed swords where they clash.
 */
export function DuelHud({
  you,
  rival,
  myReps,
  rivalReps,
  timeLeft,
  duration,
  final,
  rated,
  myBest,
}: {
  you: DuelSide;
  rival: DuelSide;
  myReps: number;
  rivalReps: number;
  timeLeft: number;
  duration: number;
  /** The last seconds: the clock turns red and pounds. */
  final: boolean;
  /** Whether this one counts for rating — not against the robot, nor past the daily limit. */
  rated: boolean;
  /** Your Rush record as it stood at the start — a duel is a Rush, beating it here sets a new one. */
  myBest: number;
}) {
  const calm = useReducedMotion();
  const record = myBest > 0 && myReps > myBest;
  const total = myReps + rivalReps;
  const share = total ? (myReps / total) * 100 : 50;
  const lead = myReps - rivalReps;

  return (
    <div className="sticky top-2 z-30 mb-4">
      <div
        className={`relative overflow-hidden rounded-2xl border bg-arena-surface px-3 pb-3 pt-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.55)] transition-colors ${
          final ? 'border-arena-red/70' : 'border-arena-border'
        }`}
      >
        {/* Each side lit in its own colour from its corner. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(120% 90% at 0% 0%, rgba(245,158,11,0.16), transparent 55%), radial-gradient(120% 90% at 100% 0%, rgba(239,68,68,0.16), transparent 55%)',
          }}
        />

        <div className="relative flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-arena-text-dim">
          <Swords size={12} className="text-arena-amber" />
          {rated ? '1 на 1 · на рейтинг' : rival.rating != null ? '1 на 1 · без рейтинга' : 'Спарринг'}
        </div>

        <div className="relative mt-1.5 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <Fighter side={you} reps={myReps} color={YOU} calm={calm} leading={lead > 0} />

          <div className="flex flex-col items-center pt-1">
            <motion.div
              key={final ? timeLeft : 'steady'}
              initial={final && !calm ? { scale: 1.18 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="relative h-14 w-14"
            >
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-arena-surface-2)" strokeWidth="3" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke={final ? THEM : YOU}
                  strokeDasharray={RING}
                  animate={{ strokeDashoffset: RING * (1 - timeLeft / duration) }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </svg>
              <span
                className={`absolute inset-0 flex items-center justify-center text-xl font-black tabular-nums ${
                  final ? 'text-arena-red' : 'text-arena-text'
                }`}
              >
                {timeLeft}
              </span>
            </motion.div>
            <motion.span
              key={Math.sign(lead)}
              initial={calm ? false : { scale: 1.3 }}
              animate={{ scale: 1 }}
              className={`mt-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                lead > 0 ? 'bg-arena-amber/15 text-arena-amber' : lead < 0 ? 'bg-arena-red/15 text-arena-red' : 'bg-arena-surface-2 text-arena-text-dim'
              }`}
            >
              {lead > 0 ? `впереди +${lead}` : lead < 0 ? `отстаёшь ${lead}` : 'вровень'}
            </motion.span>
          </div>

          <Fighter side={rival} reps={rivalReps} color={THEM} calm={calm} leading={lead < 0} />
        </div>

        <div className="relative mx-1 mt-3 h-2 rounded-full" style={{ background: THEM }}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: `linear-gradient(90deg, var(--color-arena-amber-dim), ${YOU})` }}
            animate={{ width: `${share}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
          />
          {/* Where the two sides clash. */}
          <motion.span
            className="absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-arena-surface bg-arena-text text-arena-bg shadow-[0_0_10px_rgba(255,255,255,0.45)]"
            animate={{ left: `${share}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
          >
            <Swords size={12} strokeWidth={2.5} />
          </motion.span>
        </div>

        {/* Your own record, racing alongside: a duel counts as a Rush, so passing it sets a new one. */}
        <div className="relative mt-2.5 flex h-5 items-center justify-center">
          {record ? (
            <motion.span
              key="record"
              initial={calm ? false : { scale: 1.6, opacity: 0 }}
              animate={calm ? { opacity: 1 } : { scale: [1, 1.06, 1], opacity: 1 }}
              transition={calm ? {} : { scale: { duration: 1.2, repeat: Infinity }, opacity: { duration: 0.2 } }}
              className="flex items-center gap-1 rounded-full bg-arena-amber/15 px-2 py-0.5 text-[11px] font-black tabular-nums text-arena-amber"
            >
              <Trophy size={11} /> Новый рекорд Rush: {myReps}
            </motion.span>
          ) : (
            <span className="text-[10px] tabular-nums text-arena-text-dim">
              Твой рекорд Rush: {myBest}
              {myBest > 0 && myReps > 0 && ` · ещё ${myBest - myReps + 1} до нового`}
            </span>
          )}
          {record && myReps === myBest + 1 && <Burst key="record-burst" count={18} spread={70} />}
        </div>
      </div>
    </div>
  );
}
