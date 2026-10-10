import { SET_BREAK_MS } from '../data/abilities.ts';
import { weekKey } from './weekly.ts';

/**
 * The two running numbers the league and strength ranks are read from, kept on the profile so
 * they travel with the save and can be published to the board — the rep log they could be
 * worked out from stays on the device.
 */
export interface Training {
  /** Push-ups in the current week ("YYYY-Www", see weekKey). */
  weekReps?: { week: string; count: number };
  /** The set going on right now: reps so far, and when the last one landed. */
  setRun?: { count: number; lastAt: number };
  /** Most push-ups ever done in one set without a pause. */
  bestSet?: number;
}

/** The pause that ends a set for the strength rank — the game's one pause, SET_BREAK_MS. */
export const STRENGTH_PAUSE_MS = SET_BREAK_MS;

/**
 * One more push-up at `at`. A pause of STRENGTH_PAUSE_MS or more starts a new set, and a new
 * week starts the weekly count again.
 */
export function advanceTraining(t: Training, at: number): Required<Training> {
  const week = weekKey(at);
  const weekReps = t.weekReps?.week === week ? { week, count: t.weekReps.count + 1 } : { week, count: 1 };
  const sameSet = t.setRun != null && at - t.setRun.lastAt < STRENGTH_PAUSE_MS && at >= t.setRun.lastAt;
  const setRun = { count: sameSet && t.setRun ? t.setRun.count + 1 : 1, lastAt: at };
  return { weekReps, setRun, bestSet: Math.max(t.bestSet ?? 0, setRun.count) };
}

/** This week's push-ups as of `now` — zero once the week the count belongs to is over. */
export function weekRepsNow(t: Training, now: number): number {
  return t.weekReps?.week === weekKey(now) ? t.weekReps.count : 0;
}
