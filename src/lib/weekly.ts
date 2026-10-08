import { localDay } from './stats.ts';
import type { RepLogEntry } from '../types.ts';

/**
 * The weekly goal: a number of push-ups to reach between Monday and Sunday.
 *
 * The streak rewards showing up; this rewards volume. Weeks run Monday to Sunday in the device's
 * own timezone, the way a calendar on the wall does.
 */
export const DEFAULT_WEEKLY_GOAL = 150;
export const GOAL_PRESETS = [70, 150, 300, 500] as const;
/** Bounds for a goal typed in by hand: a token week at one end, a heroic one at the other. */
export const GOAL_MIN = 10;
export const GOAL_MAX = 5000;

/** Bounds for a daily norm typed by hand. */
export const DAY_MIN = 1;
export const DAY_MAX = 1000;

/** A typed daily norm, or null if it isn't a usable number. */
export function parseDailyGoal(text: string): number | null {
  const n = Math.round(Number(text.replace(',', '.').trim()));
  if (!text.trim() || !Number.isFinite(n) || n < DAY_MIN || n > DAY_MAX) return null;
  return n;
}

/** A typed goal, or null if it isn't a usable number. Rounds, doesn't clamp — out of range is an error to show. */
export function parseGoal(text: string): number | null {
  const n = Math.round(Number(text.replace(',', '.').trim()));
  if (!text.trim() || !Number.isFinite(n) || n < GOAL_MIN || n > GOAL_MAX) return null;
  return n;
}

/** XP for reaching the goal — scaled to it, so a bigger promise pays more. */
export const weeklyBonusXp = (goal: number) => goal * 2;

/** Local midnight at the start of the week (Monday) that `ts` falls in. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const sinceMonday = (d.getDay() + 6) % 7; // getDay: Sunday is 0
  d.setDate(d.getDate() - sinceMonday);
  return d.getTime();
}

/** The week's Monday as YYYY-MM-DD — the key a reward is recorded under. */
export const weekKey = (ts: number) => localDay(weekStart(ts));

export function repsThisWeek(entries: readonly RepLogEntry[], now: number): number {
  const from = weekStart(now);
  let n = 0;
  for (const e of entries) if (e.at >= from && e.at <= now) n++;
  return n;
}

/** Whole days left in the week after today: Monday → 6, Sunday → 0. */
export function daysLeftInWeek(now: number): number {
  return 6 - ((new Date(now).getDay() + 6) % 7);
}

export function repsToday(entries: readonly RepLogEntry[], now: number): number {
  const today = localDay(now);
  let n = 0;
  for (const e of entries) if (localDay(e.at) === today) n++;
  return n;
}

/**
 * Today's share of the weekly goal: what's left of it before today, spread over the days that
 * remain including today. Ahead of pace, the day asks for less; behind, for more. Once the week
 * is already won it falls back to an even seventh, so the day ring still has something to fill.
 */
export function dailyTarget(goal: number, weekBeforeToday: number, now: number): number {
  const remaining = goal - weekBeforeToday;
  if (remaining <= 0) return Math.max(1, Math.ceil(goal / 7));
  return Math.max(1, Math.ceil(remaining / (daysLeftInWeek(now) + 1)));
}
