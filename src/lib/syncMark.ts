import type { ProfileRecord } from '../types';

/**
 * The common ancestor for syncing.
 *
 * Making an account mean one shared result needs the cloud copy pulled down automatically, and
 * that direction can destroy work: two devices both did reps, and whichever you adopt, the other
 * one's set is gone. Deciding safely needs a third point of reference — what this device last
 * agreed with the server about.
 *
 * With that, every case is answerable:
 *
 *   local == mark, cloud != mark   → this device is simply behind. Adopt; nothing is lost.
 *   local != mark, cloud == mark   → this device is ahead. Push.
 *   local != mark, cloud != mark   → both moved on. Only the user can say which to keep.
 *   local == cloud                 → nothing to do.
 *
 * The mark is per device, so it lives in localStorage rather than in the save.
 */

const KEY = 'arena.syncMark';

/**
 * Everything that counts as progress, in a fixed order. Deliberately not the whole record:
 * `createdAt` differs per device and `achievementsUnlocked` follows from the rest, so including
 * them would report a difference where there is none.
 */
export function fingerprint(p: ProfileRecord): string {
  return [
    p.totalPushups,
    p.totalXp,
    p.streak,
    p.currentBossIndex,
    p.stageStep,
    p.enemyHp,
    p.bossesDefeated.length,
    p.rushBestReps,
    p.rushBestCombo,
  ].join('|');
}

export function readMark(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeMark(mark: string) {
  try {
    localStorage.setItem(KEY, mark);
  } catch {
    // Without storage every launch looks like a conflict; the user gets asked instead of
    // anything being thrown away, which is the right way to fail.
  }
}

export function clearMark() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

export type Verdict = 'same' | 'behind' | 'ahead' | 'diverged';

export function compare(local: ProfileRecord, cloud: ProfileRecord, mark: string | null): Verdict {
  const here = fingerprint(local);
  const there = fingerprint(cloud);
  if (here === there) return 'same';
  // No mark means this device has never agreed with the server — a fresh install, or storage
  // that was wiped. There's no ancestor to reason from, so it's a question for the user.
  if (mark === null) return 'diverged';
  if (here === mark) return 'behind';
  if (there === mark) return 'ahead';
  return 'diverged';
}
