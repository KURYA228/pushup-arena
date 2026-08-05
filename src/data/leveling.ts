// XP economy. Levels are derived from lifetime totalXp — never stored directly,
// so there's no risk of level/xp getting out of sync.

export const XP_PER_REP = 8;
export const RUSH_XP_PER_REP = 6;

/** XP required to go from `level` to `level + 1`. Grows superlinearly for a satisfying long curve. */
export function xpRequiredForLevel(level: number): number {
  return Math.round(70 * Math.pow(level, 1.32) + 30);
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number; // 0..1
}

export function levelFromTotalXp(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = totalXp;
  // Safety cap so a corrupted value can never spin forever.
  while (remaining >= xpRequiredForLevel(level) && level < 300) {
    remaining -= xpRequiredForLevel(level);
    level += 1;
  }
  const xpForNext = xpRequiredForLevel(level);
  return { level, xpIntoLevel: remaining, xpForNext, progress: remaining / xpForNext };
}

/**
 * Lifetime XP needed to sit at the start of `level` — the inverse of {@link levelFromTotalXp}.
 * Used by the dev panel to jump to a level, since XP is the stored value and level is derived.
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < Math.max(1, Math.min(level, 300)); l += 1) {
    total += xpRequiredForLevel(l);
  }
  return total;
}

/** Reward streaks: up to +50% XP at a 10+ day streak. */
export function streakMultiplier(streak: number): number {
  return 1 + Math.min(Math.max(streak, 0), 10) * 0.05;
}
