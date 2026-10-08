import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Target } from 'lucide-react';
import clsx from 'clsx';
import type { ProfileRecord } from '../types';
import { useRepLog } from '../hooks/useRepLog';
import { plural } from '../lib/stats';
import {
  DEFAULT_WEEKLY_GOAL,
  GOAL_MAX,
  GOAL_MIN,
  GOAL_PRESETS,
  parseGoal,
  daysLeftInWeek,
  repsThisWeek,
  weekKey,
  weeklyBonusXp,
} from '../lib/weekly';

const R = 26;
const RING = 2 * Math.PI * R;

/**
 * This week's push-ups against a goal you pick, as a ring that fills. Reaching it pays XP once
 * per week — the payout itself happens with the rep (see commitRep); this only shows it.
 */
export function WeeklyGoal({
  profile,
  setWeeklyGoal,
}: {
  profile: ProfileRecord;
  setWeeklyGoal: (goal: number) => Promise<void>;
}) {
  const log = useRepLog();
  const calm = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const now = Date.now();
  const goal = profile.weeklyGoal ?? DEFAULT_WEEKLY_GOAL;
  const done = log ? repsThisWeek(log, now) : 0;
  const pct = Math.min(1, done / goal);
  const paid = profile.weeklyRewardWeek === weekKey(now);
  const left = daysLeftInWeek(now);

  return (
    <section className="mb-4 rounded-2xl border border-arena-border bg-arena-surface p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--color-arena-surface-2)" strokeWidth="6" />
            <motion.circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              stroke={paid ? 'var(--color-arena-amber)' : 'var(--color-arena-amber-dim)'}
              strokeDasharray={RING}
              initial={calm ? false : { strokeDashoffset: RING }}
              animate={{ strokeDashoffset: RING * (1 - pct) }}
              transition={{ type: 'spring', stiffness: 60, damping: 18 }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-arena-amber">
            {paid ? <Check size={22} strokeWidth={3} /> : <Target size={20} />}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-arena-text">Цель недели</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-arena-text">
            {done} <span className="text-sm font-medium text-arena-text-dim">/ {goal}</span>
          </p>
          <p className="text-[11px] leading-snug text-arena-text-dim">
            {paid
              ? `Выполнено! +${weeklyBonusXp(goal)} XP уже твои`
              : `ещё ${goal - done > 0 ? goal - done : 0} · ${
                  left === 0 ? 'сегодня последний день' : `${left} ${plural(left, 'день', 'дня', 'дней')} до конца недели`
                } · награда +${weeklyBonusXp(goal)} XP`}
          </p>
        </div>

        <button
          onClick={() => {
            setDraft(String(goal));
            setEditing((e) => !e);
          }}
          className="shrink-0 self-start rounded-lg px-2 py-1 text-[11px] font-medium text-arena-amber active:scale-95"
        >
          {editing ? 'отмена' : 'изменить'}
        </button>
      </div>

      {editing && (
        <GoalEditor
          draft={draft}
          setDraft={setDraft}
          current={goal}
          onSave={(g) => {
            void setWeeklyGoal(g);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}

/** Type any goal, or tap a ready one to fill it in. Saved with the button or Enter. */
function GoalEditor({
  draft,
  setDraft,
  current,
  onSave,
}: {
  draft: string;
  setDraft: (v: string) => void;
  current: number;
  onSave: (goal: number) => void;
}) {
  const parsed = parseGoal(draft);
  const invalid = draft.trim() !== '' && parsed == null;
  const save = () => parsed != null && onSave(parsed);

  return (
    <div className="mt-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Своя цель на неделю</span>
          <input
            type="number"
            inputMode="numeric"
            min={GOAL_MIN}
            max={GOAL_MAX}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={clsx(
              'w-full rounded-xl border bg-arena-surface-2 py-2 pl-3 pr-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-sm font-semibold tabular-nums text-arena-text outline-none focus:border-arena-amber',
              invalid ? 'border-arena-red' : 'border-arena-border',
            )}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-arena-text-dim">
            отжиманий
          </span>
        </label>
        <button
          type="submit"
          disabled={parsed == null || parsed === current}
          className="shrink-0 rounded-xl bg-arena-amber px-4 text-sm font-semibold text-arena-bg active:scale-95 disabled:opacity-40"
        >
          Сохранить
        </button>
      </form>
      <p className={clsx('mt-1 text-[10px]', invalid ? 'text-arena-red' : 'text-arena-text-dim')}>
        {invalid
          ? `Введи число от ${GOAL_MIN} до ${GOAL_MAX}`
          : parsed != null
            ? `Награда будет +${weeklyBonusXp(parsed)} XP · неделя с понедельника по воскресенье`
            : 'Неделя — с понедельника по воскресенье'}
      </p>
      <div className="mt-2 flex gap-1.5">
        {GOAL_PRESETS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setDraft(String(g))}
            className={clsx(
              'flex-1 rounded-lg py-1 text-[11px] font-semibold tabular-nums active:scale-95',
              parseGoal(draft) === g ? 'bg-arena-amber/20 text-arena-amber' : 'bg-arena-surface-2 text-arena-text-dim',
            )}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
