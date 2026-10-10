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
  parseDailyGoal,
  DAY_MAX,
  DAY_MIN,
  daysLeftInWeek,
  dailyTarget,
  repsThisWeek,
  repsToday,
  weekKey,
  weeklyBonusXp,
} from '../lib/weekly';

/** Outer ring: the week. Inner ring: today. */
const R_WEEK = 33;
const R_DAY = 23;
const STROKE = 7;

/**
 * This week's push-ups against a goal you pick, as a ring that fills. Reaching it pays XP once
 * per week — the payout itself happens with the rep (see commitRep); this only shows it.
 */
export function WeeklyGoal({
  profile,
  setWeeklyGoal,
}: {
  profile: ProfileRecord;
  setWeeklyGoal: (goal: number, daily: number | null) => Promise<void>;
}) {
  const log = useRepLog();
  const calm = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dayDraft, setDayDraft] = useState('');
  const now = Date.now();
  const goal = profile.weeklyGoal ?? DEFAULT_WEEKLY_GOAL;
  const done = log ? repsThisWeek(log, now) : 0;
  const pct = Math.min(1, done / goal);
  const paid = profile.weeklyRewardWeek === weekKey(now);
  // "Done" is about the goal as it stands now. Raising it after the week's reward was paid makes
  // the week unfinished again — the reward stays paid, but the card mustn't claim the new goal
  // is met.
  const met = done >= goal;
  const left = daysLeftInWeek(now);
  const today = log ? repsToday(log, now) : 0;
  const autoDay = dailyTarget(goal, done - today, now);
  const dayGoal = profile.dailyGoal ?? autoDay;
  const dayPct = Math.min(1, today / dayGoal);
  const dayDone = today >= dayGoal;

  return (
    <section className="mb-4 rounded-2xl border border-arena-border bg-arena-surface p-4">
      <div className="flex items-center gap-4">
        <div className="relative h-[84px] w-[84px] shrink-0">
          <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
            <Ring r={R_WEEK} pct={pct} color={met ? 'var(--color-arena-amber)' : 'var(--color-arena-amber-dim)'} calm={calm} />
            <Ring r={R_DAY} pct={dayPct} color={dayDone ? '#fb7185' : '#e11d48'} calm={calm} delay={0.15} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-arena-amber">
            {met ? <Check size={20} strokeWidth={3} /> : <Target size={18} />}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {/* The edit button shares the title's row, so the numbers below get the full width. */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-arena-text">Цель недели</p>
            <button
              onClick={() => {
                setDraft(String(goal));
                setDayDraft(profile.dailyGoal != null ? String(profile.dailyGoal) : '');
                setEditing((e) => !e);
              }}
              className="-mr-1 shrink-0 rounded-lg px-1 py-0.5 text-[11px] font-medium text-arena-amber active:scale-95"
            >
              {editing ? 'отмена' : 'изменить'}
            </button>
          </div>
          <div className="mt-1 space-y-0.5 whitespace-nowrap text-sm tabular-nums">
            <p className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#e11d48]" />
              <span className="text-arena-text-dim">Сегодня</span>
              <span className="font-bold text-arena-text">{today}</span>
              <span className="text-arena-text-dim">/ {dayGoal}</span>
              {profile.dailyGoal == null && <span className="text-[10px] text-arena-text-dim">авто</span>}
              {dayDone && <Check size={13} strokeWidth={3} className="text-[#fb7185]" />}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-arena-amber" />
              <span className="text-arena-text-dim">Неделя</span>
              <span className="font-bold text-arena-text">{done}</span>
              <span className="text-arena-text-dim">/ {goal}</span>
            </p>
          </div>
          <p className="text-[11px] leading-snug text-arena-text-dim">
            {met && paid
              ? `Выполнено! Награда недели уже твоя`
              : met
                ? 'Выполнено!'
                : `ещё ${goal - done} · ${
                  left === 0 ? 'сегодня последний день' : `${left} ${plural(left, 'день', 'дня', 'дней')} до конца недели`
                }${paid ? ' · награда этой недели уже получена' : ` · награда +${weeklyBonusXp(goal)} XP`}`}
          </p>
        </div>
      </div>

      {editing && (
        <GoalEditor
          draft={draft}
          setDraft={setDraft}
          dayDraft={dayDraft}
          setDayDraft={setDayDraft}
          autoDay={autoDay}
          current={goal}
          currentDay={profile.dailyGoal ?? null}
          onSave={(g, d) => {
            void setWeeklyGoal(g, d);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}

/**
 * Both goals in one form: the week (any number, or a ready one) and the day — a number of your
 * own, or empty for automatic, worked out from what the week still needs.
 */
function GoalEditor({
  draft,
  setDraft,
  dayDraft,
  setDayDraft,
  autoDay,
  current,
  currentDay,
  onSave,
}: {
  draft: string;
  setDraft: (v: string) => void;
  dayDraft: string;
  setDayDraft: (v: string) => void;
  autoDay: number;
  current: number;
  currentDay: number | null;
  onSave: (goal: number, daily: number | null) => void;
}) {
  const week = parseGoal(draft);
  const weekInvalid = draft.trim() !== '' && week == null;
  const dayAuto = dayDraft.trim() === '';
  const day = dayAuto ? null : parseDailyGoal(dayDraft);
  const dayInvalid = !dayAuto && day == null;
  const valid = week != null && !dayInvalid;
  const changed = week !== current || day !== currentDay;

  const field =
    'w-full rounded-xl border bg-arena-surface-2 py-2 pl-3 pr-24 text-sm font-semibold tabular-nums text-arena-text outline-none focus:border-arena-amber [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && changed) onSave(week!, day);
      }}
    >
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-arena-text">
          <span className="h-2 w-2 rounded-full bg-arena-amber" /> Неделя
        </p>
        <label className="relative block">
          <span className="sr-only">Цель на неделю</span>
          <input
            type="number"
            inputMode="numeric"
            min={GOAL_MIN}
            max={GOAL_MAX}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={clsx(field, weekInvalid ? 'border-arena-red' : 'border-arena-border')}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-arena-text-dim">
            отжиманий
          </span>
        </label>
        <div className="mt-1.5 flex gap-1.5">
          {GOAL_PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setDraft(String(g))}
              className={clsx(
                'flex-1 rounded-lg py-1 text-[11px] font-semibold tabular-nums active:scale-95',
                week === g ? 'bg-arena-amber/20 text-arena-amber' : 'bg-arena-surface-2 text-arena-text-dim',
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <p className={clsx('mt-1 text-[10px]', weekInvalid ? 'text-arena-red' : 'text-arena-text-dim')}>
          {weekInvalid
            ? `Введи число от ${GOAL_MIN} до ${GOAL_MAX}`
            : week != null
              ? `Награда +${weeklyBonusXp(week)} XP · с понедельника по воскресенье`
              : 'С понедельника по воскресенье'}
        </p>
      </div>

      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-arena-text">
          <span className="h-2 w-2 rounded-full bg-[#e11d48]" /> День
        </p>
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Норма на день</span>
            <input
              type="number"
              inputMode="numeric"
              min={DAY_MIN}
              max={DAY_MAX}
              placeholder={`авто · ${autoDay}`}
              value={dayDraft}
              onChange={(e) => setDayDraft(e.target.value)}
              className={clsx(field, 'placeholder:font-normal placeholder:text-arena-text-dim', dayInvalid ? 'border-arena-red' : 'border-arena-border')}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-arena-text-dim">
              отжиманий
            </span>
          </label>
          <button
            type="button"
            onClick={() => setDayDraft('')}
            disabled={dayAuto}
            className="shrink-0 rounded-xl border border-arena-border bg-arena-surface-2 px-3 text-xs font-semibold text-arena-text active:scale-95 disabled:border-arena-amber disabled:text-arena-amber"
          >
            авто
          </button>
        </div>
        <p className={clsx('mt-1 text-[10px]', dayInvalid ? 'text-arena-red' : 'text-arena-text-dim')}>
          {dayInvalid
            ? `Введи число от ${DAY_MIN} до ${DAY_MAX} или оставь пустым`
            : dayAuto
              ? `Авто: столько в день, чтобы успеть закрыть неделю — сейчас ${autoDay}`
              : 'Своя норма — на награду за неделю не влияет'}
        </p>
      </div>

      <button
        type="submit"
        disabled={!valid || !changed}
        className="w-full rounded-xl bg-arena-amber py-2.5 text-sm font-semibold text-arena-bg active:scale-[0.98] disabled:opacity-40"
      >
        Сохранить
      </button>
    </form>
  );
}

/** One progress ring; starts empty and springs to its value. */
function Ring({
  r,
  pct,
  color,
  calm,
  delay = 0,
}: {
  r: number;
  pct: number;
  color: string;
  calm: boolean | null;
  delay?: number;
}) {
  const len = 2 * Math.PI * r;
  return (
    <>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--color-arena-surface-2)" strokeWidth={STROKE} />
      <motion.circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        strokeWidth={STROKE}
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={len}
        initial={calm ? false : { strokeDashoffset: len }}
        animate={{ strokeDashoffset: len * (1 - pct) }}
        transition={{ type: 'spring', stiffness: 60, damping: 18, delay }}
      />
    </>
  );
}
