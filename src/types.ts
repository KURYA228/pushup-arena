import type { AbilityEvent, BlockedReason, FightState } from './data/combat';
import type { Upgrades } from './data/shop';
import type { RankUp } from './data/ranks';
import type { Training } from './lib/training';

// Central persisted profile shape stored in IndexedDB (see src/db/db.ts).
/** Weekly push-ups, the current set and the best set — see src/lib/training.ts. */
export interface ProfileRecord extends Training {
  id: number;
  totalPushups: number;
  /** Lifetime cumulative XP. Level/rank are always derived from this — single source of truth. */
  totalXp: number;
  streak: number;
  /**
   * Calendar day (YYYY-MM-DD) of the last rep, in the device's timezone. Saves from before
   * freezes existed wrote it in UTC; the one-day skew that leaves is what a freeze absorbs.
   */
  lastWorkoutDate: string | null;
  /** Streak freezes in stock — see src/lib/streak.ts. Absent on older saves. */
  streakFreezes?: number;
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
  /** When each rep of the record Rush landed, ms from the start — the ghost replays it. */
  rushBestRun?: number[];
  /** Push-ups to reach Monday to Sunday; absent means the default. See src/lib/weekly.ts. */
  weeklyGoal?: number;
  /** A daily norm set by hand; absent means it's worked out from the weekly goal. */
  dailyGoal?: number;
  /** Monday (YYYY-MM-DD) of the last week whose goal paid out, so it pays once. */
  weeklyRewardWeek?: string;
  /**
   * Presses of the «+» button. Kept apart from `totalPushups` on purpose: a tap isn't a counted
   * rep, so it touches nothing in the game — no damage, XP, streak or leaderboard. Absent on
   * older saves.
   */
  clickerTaps?: number;
  /**
   * Bumped by the admin panel whenever it edits this save, so the player's phone sees the
   * change even when only fields outside the sync fingerprint moved. See syncMark.ts.
   */
  adminRev?: number;
  /** Levels bought in the shop — see src/data/shop.ts. Absent on older saves. */
  upgrades?: Upgrades;
  createdAt: string;
  /**
   * Which run of the game this progress belongs to — see src/lib/season.ts. Absent on saves
   * written before seasons existed, which count as season 0.
   */
  season?: number;
  /**
   * A replay of beaten stages, if one is under way: the stage it began from, when, and where the
   * real progress stood — restored as it was once the run catches up with it or you walk away.
   */
  replay?: ReplayState | null;
  /** The name given to the host in the intro — also the default name on the board. */
  nickname?: string;
  /** Age, as told to the host in the intro. */
  age?: number;
}

export interface ReplayState {
  bossIndex: number;
  startedAt: number;
  returnTo: { currentBossIndex: number; stageStep: number; enemyHp: number; fight: FightState };
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
  /** Streak fields from before the rep — it may have spent or earned a freeze. */
  streakBefore: { streak: number; lastWorkoutDate: string | null; streakFreezes?: number };
  /** Row this rep wrote to the rep log, removed again on undo. */
  logId: number | null;
  /** The weekly-goal marker from before the rep, in case this rep is the one that paid it. */
  weeklyRewardWeekBefore?: string;
  /** The rematch from before the rep, in case this rep is the one that won it. */
  replayBefore?: ReplayState | null;
  /** Weekly count, current set and best set from before the rep. */
  trainingBefore?: Training;
}

/**
 * One counted rep, as remembered by the rep log (src/db/db.ts). Local only — the cloud mirrors
 * the profile, not the history, so a restored profile starts its log from scratch.
 */
export interface RepLogEntry {
  id?: number;
  /** Epoch milliseconds. */
  at: number;
  mode: 'arena' | 'rush';
  /** Stage the rep was fought on; null for Speed Rush. */
  bossIndex: number | null;
  /** Position in the stage, 0..2 minions and 3 the boss; null for Speed Rush. */
  stageStep: number | null;
  damage: number;
  crit: boolean;
  /** Season the rep belongs to — a reset leaves older rows behind, and they're ignored. */
  season: number;
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
  /** A boss already beaten went down again on a replay; the run goes on to the next stage. */
  bossRebeaten: boolean;
  /** The replay caught up with the real progress, which is back as it was left. */
  replayWon: boolean;
  /** Promotions this rep earned — a new title, league division or strength rank. */
  rankUps: RankUp[];
  /** Set when an ability swallowed the rep, so the UI can explain the missing damage. */
  blocked: BlockedReason;
  /** Ability moments the rep set off — a crystal breaking, a scream, a freeze. */
  events: AbilityEvent[];
  /** HP the enemy regained from the pause before this rep. */
  healed: number;
  /** Who the rep was aimed at, for damage popups and toasts. */
  enemyName: string;
  newAchievements: string[];
  /** Missed days a streak freeze just covered. */
  frozeDays: number;
  /** The rep completed a week of streak and earned a freeze. */
  earnedFreeze: boolean;
  /** XP paid out because this rep reached the weekly goal; 0 otherwise. */
  weeklyBonus: number;
  undo: RepUndo;
}

export type ToastKind = 'level-up' | 'achievement' | 'boss-defeat' | 'record' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}
