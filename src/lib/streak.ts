import { localDay } from './stats.ts';

/**
 * Streak with freezes.
 *
 * A plain streak punishes rest: one missed day and a month of work is gone, which pushes people
 * to train through soreness or illness just to keep a number alive. A freeze covers one missed
 * day. They're earned by consistency — one for every week of streak — and capped, so they buy a
 * rest day now and then, not a holiday.
 *
 * Freezes are spent lazily, when the next rep comes in: nothing runs while you're away, so the
 * gap is measured at the moment you're back. Days covered by a freeze don't add to the count —
 * the streak is still the number of days you trained, it just didn't break.
 */
export const MAX_FREEZES = 2;
/** Streak days per freeze earned. */
export const FREEZE_EVERY = 7;
/** What a new player — or a save from before freezes existed — starts with. */
export const STARTING_FREEZES = 1;

export interface StreakFields {
  streak: number;
  /** Local calendar day (YYYY-MM-DD) of the last rep. */
  lastWorkoutDate: string | null;
  /** Absent on saves written before freezes existed. */
  streakFreezes?: number;
}

export const freezesOf = (s: StreakFields) => s.streakFreezes ?? STARTING_FREEZES;

export const todayLocal = (now: number = Date.now()) => localDay(now);

/** Whole calendar days from `a` to `b`. Parsed at noon so a DST shift can't round it off by one. */
export function dayDiff(a: string, b: string): number {
  const ta = new Date(`${a}T12:00:00`).getTime();
  const tb = new Date(`${b}T12:00:00`).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

export interface StreakAdvance {
  streak: number;
  lastWorkoutDate: string;
  streakFreezes: number;
  /** Missed days a freeze just covered. */
  frozeDays: number;
  /** A freeze was earned by this day's rep. */
  earnedFreeze: boolean;
}

/** The streak after a rep on `today`. */
export function advanceStreak(s: StreakFields, today: string): StreakAdvance {
  let freezes = freezesOf(s);
  if (s.lastWorkoutDate === today) {
    return { streak: s.streak, lastWorkoutDate: today, streakFreezes: freezes, frozeDays: 0, earnedFreeze: false };
  }

  const gap = s.lastWorkoutDate ? dayDiff(s.lastWorkoutDate, today) : Infinity;
  const missed = gap - 1;
  let streak: number;
  let frozeDays = 0;
  if (gap === 1) streak = s.streak + 1;
  else if (missed >= 1 && missed <= freezes && s.streak > 0) {
    freezes -= missed;
    frozeDays = missed;
    streak = s.streak + 1;
  } else {
    // Too long a gap: the streak restarts and the freezes are kept — spending them on a streak
    // that breaks anyway would just punish twice.
    streak = 1;
  }

  const earnedFreeze = streak > s.streak && streak % FREEZE_EVERY === 0 && freezes < MAX_FREEZES;
  if (earnedFreeze) freezes++;

  return { streak, lastWorkoutDate: today, streakFreezes: freezes, frozeDays, earnedFreeze };
}

export interface StreakView {
  /** What the streak is right now — zero if it has already broken. */
  streak: number;
  freezes: number;
  /** Missed days the next rep will cover with freezes. */
  pendingFreezes: number;
  /** Alive, but today hasn't been trained yet. */
  needsToday: boolean;
}

/**
 * The streak as it stands on `today`, before any rep. The stored number goes stale while you're
 * away — it's only rewritten by the next rep — so the screen must not show it raw: a streak that
 * broke three days ago would still be glowing.
 */
export function streakView(s: StreakFields, today: string): StreakView {
  const freezes = freezesOf(s);
  if (!s.lastWorkoutDate || s.streak <= 0) {
    return { streak: 0, freezes, pendingFreezes: 0, needsToday: false };
  }
  const gap = dayDiff(s.lastWorkoutDate, today);
  if (gap <= 0) return { streak: s.streak, freezes, pendingFreezes: 0, needsToday: false };
  const missed = gap - 1;
  if (missed > freezes) return { streak: 0, freezes, pendingFreezes: 0, needsToday: false };
  return { streak: s.streak, freezes, pendingFreezes: missed, needsToday: true };
}

/** Toasts for what a rep did to the streak — shared by the arena and Speed Rush. */
export function streakNotices(r: { frozeDays: number; earnedFreeze: boolean }): [string, string][] {
  const out: [string, string][] = [];
  if (r.frozeDays > 0) {
    out.push([
      'Стрик спасён',
      r.frozeDays === 1 ? 'Пропущенный день закрыла заморозка' : `Заморозки закрыли ${r.frozeDays} пропущенных дня`,
    ]);
  }
  if (r.earnedFreeze) out.push(['Заморозка стрика +1', 'Неделя без пропусков — один день отдыха в запасе']);
  return out;
}
