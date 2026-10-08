import type { ProfileRecord } from '../types.ts';
import { totalXpForLevel } from '../data/leveling.ts';
import { MAX_FREEZES, todayLocal } from './streak.ts';

/**
 * What the admin panel can change in someone's save. Every field is optional: what's left out
 * stays as it was.
 */
export interface AdminEdit {
  totalPushups?: number;
  totalXp?: number;
  /** Sets XP to the start of this level — level itself isn't stored, it follows from XP. */
  level?: number;
  streak?: number;
  streakFreezes?: number;
  rushBestReps?: number;
  clickerTaps?: number;
  resetUpgrades?: boolean;
}

const whole = (n: number) => Math.max(0, Math.round(n));

/**
 * The edited save. Always stamps a fresh `adminRev`, which is what makes the player's phone
 * take the change on its next sync even if only fields outside the progress fingerprint moved.
 */
export function applyAdminEdit(p: ProfileRecord, e: AdminEdit, now: number): ProfileRecord {
  const out: ProfileRecord = { ...p };
  if (e.totalPushups != null) out.totalPushups = whole(e.totalPushups);
  if (e.totalXp != null) out.totalXp = whole(e.totalXp);
  if (e.level != null) out.totalXp = totalXpForLevel(Math.max(1, Math.round(e.level)));
  if (e.streak != null && whole(e.streak) !== p.streak) {
    out.streak = whole(e.streak);
    // A streak given by hand should be alive today, not already broken by an old date.
    out.lastWorkoutDate = out.streak > 0 ? todayLocal(now) : null;
  }
  if (e.streakFreezes != null) out.streakFreezes = Math.min(MAX_FREEZES, whole(e.streakFreezes));
  if (e.rushBestReps != null) {
    out.rushBestReps = whole(e.rushBestReps);
    // The ghost belongs to the old record; a record typed in has no timeline to replay.
    if (out.rushBestReps !== p.rushBestReps) out.rushBestRun = undefined;
  }
  if (e.clickerTaps != null) out.clickerTaps = whole(e.clickerTaps);
  if (e.resetUpgrades) out.upgrades = {};
  out.adminRev = Math.max(now, (p.adminRev ?? 0) + 1);
  return out;
}
