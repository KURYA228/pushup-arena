import { SET_BREAK_MS } from '../data/abilities.ts';
import type { RepLogEntry } from '../types.ts';

/**
 * Everything the stats screen and the victory card say, computed from the rep log.
 *
 * Pure functions over a plain array, so they're testable without IndexedDB. The log is small —
 * the whole arena is a few thousand rows — so recomputing it all on every change is cheaper than
 * keeping running aggregates honest through undo and resets.
 */

/**
 * Calendar day in the device's own timezone. Not `toISOString()`: that's UTC, and in Moscow a
 * set done at half past midnight would land on the previous day.
 */
export function localDay(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface DayTotal {
  day: string;
  reps: number;
}

/** Reps per day for the last `days` days, oldest first, today included — empty days as zero. */
export function dailyTotals(entries: readonly RepLogEntry[], days: number, now: number): DayTotal[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const k = localDay(e.at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: DayTotal[] = [];
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0); // noon, so a DST shift can't skip or repeat a day
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const k = localDay(cursor.getTime());
    out.push({ day: k, reps: counts.get(k) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface WorkoutSet {
  reps: number;
  startAt: number;
  endAt: number;
}

/**
 * Splits the log into sets — runs of reps with gaps shorter than {@link SET_BREAK_MS}, the same
 * line the boss abilities draw. Expects entries in time order.
 */
export function splitSets(entries: readonly RepLogEntry[]): WorkoutSet[] {
  const sets: WorkoutSet[] = [];
  let cur: WorkoutSet | null = null;
  for (const e of entries) {
    if (cur && e.at - cur.endAt < SET_BREAK_MS) {
      cur.reps++;
      cur.endAt = e.at;
    } else {
      cur = { reps: 1, startAt: e.at, endAt: e.at };
      sets.push(cur);
    }
  }
  return sets;
}

/** Sets shorter than this don't say anything about pace — two reps is just a twitch. */
const PACE_MIN_REPS = 5;

export interface StatsSummary {
  today: number;
  week: number;
  bestDay: DayTotal | null;
  activeDays: number;
  bestSet: number;
  avgSet: number;
  /** Reps per minute inside sets, averaged over sets long enough to measure; null if none. */
  pace: number | null;
  /** When the log starts — reps before the log existed aren't in any of the above. */
  since: number | null;
}

export function summarize(entries: readonly RepLogEntry[], now: number): StatsSummary {
  const today = localDay(now);
  const week = new Set(dailyTotals([], 7, now).map((d) => d.day));
  const perDay = new Map<string, number>();
  let todayCount = 0;
  let weekCount = 0;
  for (const e of entries) {
    const k = localDay(e.at);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
    if (k === today) todayCount++;
    if (week.has(k)) weekCount++;
  }

  let bestDay: DayTotal | null = null;
  for (const [day, reps] of perDay) {
    if (!bestDay || reps > bestDay.reps) bestDay = { day, reps };
  }

  const sets = splitSets(entries);
  const bestSet = sets.reduce((m, s) => Math.max(m, s.reps), 0);
  const avgSet = sets.length ? entries.length / sets.length : 0;

  // Pace as reps per minute: n reps span n − 1 intervals.
  const timed = sets.filter((s) => s.reps >= PACE_MIN_REPS && s.endAt > s.startAt);
  const pace = timed.length
    ? timed.reduce((sum, s) => sum + ((s.reps - 1) / (s.endAt - s.startAt)) * 60_000, 0) / timed.length
    : null;

  return {
    today: todayCount,
    week: weekCount,
    bestDay,
    activeDays: perDay.size,
    bestSet,
    avgSet,
    pace,
    since: entries.length ? entries[0].at : null,
  };
}

export interface StageRecord {
  bossIndex: number;
  /** Every rep on the stage — minions and the boss. */
  reps: number;
  crits: number;
  damage: number;
  firstAt: number;
  lastAt: number;
  /** Distinct calendar days the stage was fought on. */
  days: number;
  /** Did the log see the stage from its first rep? If not, the numbers are a lower bound. */
  complete: boolean;
}

/**
 * Per-stage totals from the arena reps. A stage counts as fully logged when its first logged
 * rep was against the first minion — otherwise the log started mid-stage and part of the fight
 * happened before anything was recorded.
 */
export function stageRecords(entries: readonly RepLogEntry[]): Map<number, StageRecord> {
  const out = new Map<number, StageRecord>();
  const dayKeys = new Map<number, Set<string>>();
  for (const e of entries) {
    if (e.mode !== 'arena' || e.bossIndex == null) continue;
    let r = out.get(e.bossIndex);
    if (!r) {
      r = {
        bossIndex: e.bossIndex,
        reps: 0,
        crits: 0,
        damage: 0,
        firstAt: e.at,
        lastAt: e.at,
        days: 0,
        complete: e.stageStep === 0,
      };
      out.set(e.bossIndex, r);
      dayKeys.set(e.bossIndex, new Set());
    }
    r.reps++;
    if (e.crit) r.crits++;
    r.damage += e.damage;
    r.lastAt = e.at;
    dayKeys.get(e.bossIndex)!.add(localDay(e.at));
  }
  for (const [i, r] of out) r.days = dayKeys.get(i)!.size;
  return out;
}

/** "3 дня", "1 день", "5 дней" — Russian plural forms. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Human span for a fight: minutes within one day, days otherwise. */
export function fightDuration(r: Pick<StageRecord, 'firstAt' | 'lastAt' | 'days'>): string {
  if (r.days > 1) return `${r.days} ${plural(r.days, 'день', 'дня', 'дней')}`;
  const min = Math.max(1, Math.round((r.lastAt - r.firstAt) / 60_000));
  return `${min} мин`;
}
