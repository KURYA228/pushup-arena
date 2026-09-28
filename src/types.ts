import type { FightState } from './data/combat';

// Central persisted profile shape stored in IndexedDB (see src/db/db.ts).
export interface ProfileRecord {
  id: number;
  totalPushups: number;
  /** Lifetime cumulative XP. Level/rank are always derived from this — single source of truth. */
  totalXp: number;
  streak: number;
  /** ISO date (YYYY-MM-DD) of the last day the user logged at least one rep. */
  lastWorkoutDate: string | null;
  /** Which stage of the arena you're on — index into BOSSES. */
  currentBossIndex: number;
  /** Position inside the stage: 0..2 are the minions, 3 is the boss itself. */
  stageStep: number;
  /** Remaining HP of whoever you're currently fighting — minion or boss. */
  enemyHp: number;
  /**
   * How the current fight is going — pauses, reps in the set, damage landed. Stateful boss
   * abilities read it; see src/data/combat.ts.
   */
  fight: FightState;
  /**
   * Legacy field from before stages had minions. Kept so old saves can be migrated on load and
   * nothing silently resets; nothing reads it after that.
   */
  bossHp?: number;
  bossesDefeated: string[];
  achievementsUnlocked: string[];
  rushBestReps: number;
  rushBestCombo: number;
  createdAt: string;
}

/**
 * Everything needed to take one rep back. Captured at the moment the rep is registered rather
 * than reconstructed later, because a rep that kills a boss also advances the boss index and
 * refills HP — state the profile no longer remembers once the transition has happened.
 */
export interface RepUndo {
  /** Total XP this rep granted, including any boss-defeat bonus. */
  xp: number;
  /** Enemy HP before the hit landed. Null for Speed Rush reps, which don't touch the arena. */
  enemyHpBefore: number | null;
  bossIndexBefore: number | null;
  /** Where in the stage the rep happened, so a minion kill can be stepped back too. */
  stageStepBefore: number | null;
  /**
   * Whole fight state from before the rep. Snapshotted rather than recomputed: the stateful
   * abilities aren't invertible one rule at a time, but the object is tiny, so keeping a copy
   * is both simpler and exactly correct.
   */
  fightBefore: FightState | null;
  /** Set when this rep finished a boss off, so the win can be rolled back too. */
  bossIdDefeated: string | null;
  achievementsGranted: string[];
}

/** Result of registering a single rep, used to drive UI feedback (damage numbers, toasts, undo). */
export interface RepResult {
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
  isCrit: boolean;
  damage: number;
  bossDefeated: boolean;
  /** True when the rep cleared a minion rather than the boss. */
  minionDefeated: boolean;
  /** A minion came back from the dead under "Зеркало". */
  revived: boolean;
  /** The rep cleared the last minion — the boss himself is next. */
  bossReached: boolean;
  /** Set when an ability swallowed the rep, so the UI can explain the missing damage. */
  blocked: 'blind-spot' | 'odd-rep' | 'last-stand' | null;
  /** HP the enemy regained from the pause before this rep. */
  healed: number;
  /** Who the rep was aimed at, for damage popups and toasts. */
  enemyName: string;
  newAchievements: string[];
  undo: RepUndo;
}

export type ToastKind = 'level-up' | 'achievement' | 'boss-defeat' | 'record' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}
