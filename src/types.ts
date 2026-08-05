// Central persisted profile shape stored in IndexedDB (see src/db/db.ts).
export interface ProfileRecord {
  id: number;
  totalPushups: number;
  /** Lifetime cumulative XP. Level/rank are always derived from this — single source of truth. */
  totalXp: number;
  streak: number;
  /** ISO date (YYYY-MM-DD) of the last day the user logged at least one rep. */
  lastWorkoutDate: string | null;
  currentBossIndex: number;
  /** Remaining HP of the boss at currentBossIndex. */
  bossHp: number;
  bossesDefeated: string[];
  achievementsUnlocked: string[];
  rushBestReps: number;
  rushBestCombo: number;
  createdAt: string;
}

/** Result of registering a single rep, used to drive UI feedback (damage numbers, toasts, undo). */
export interface RepResult {
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
  isCrit: boolean;
  damage: number;
  bossDefeated: boolean;
  newAchievements: string[];
}

export type ToastKind = 'level-up' | 'achievement' | 'boss-defeat' | 'record' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}
