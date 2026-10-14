import { useCallback, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PROFILE_ID } from '../db/db';
import type { ProfileRecord, RepLogEntry, RepResult, RepUndo } from '../types';
import { RUSH_XP_PER_REP, XP_PER_REP, levelFromTotalXp, streakMultiplier } from '../data/leveling';
import { rankUpsBetween, type RankUp } from '../data/ranks';
import { advanceTraining, weekRepsNow, type Training } from '../lib/training';
import { announceRankUps } from '../lib/rankEvents';
import { readIntroAbout } from '../lib/intro';
import { getRank } from '../data/ranks';
import {
  BOSSES,
  BOSS_STEP,
  encounterAt,
  firstStep,
  getBossBonusXp,
  getMinionBonusXp,
} from '../data/bosses';
import { applyIdleRegen, freshFight, resolveArenaRep } from '../data/combat';
import { checkNewAchievements } from '../data/achievements';
import { SEASON, isStale } from '../lib/season';
import { clearMark } from '../lib/syncMark';
import { MAX_FREEZES, STARTING_FREEZES, advanceStreak, freezesOf, todayLocal } from '../lib/streak';
import { packRun } from '../lib/ghost';
import { DUEL_START, canDuel, logDuel, ratingDelta, type DuelOutcome } from '../data/duel';
import { localDay } from '../lib/stats';
import { TIER_XP, hardenAbilities } from '../data/abilities';
import { DEFAULT_WEEKLY_GOAL, weekKey, weekStart, weeklyBonusXp } from '../lib/weekly';
import { CONSUMABLES, DOUBLE_REPS, FREEZE_COST, HUNTER_BONUS, RAGE_REPS, STOCK_FIELD, UPGRADES, nextCost, perksFrom, upgradeLevel, type ConsumableId, type UpgradeId } from '../data/shop';

function defaultProfile(): ProfileRecord {
  return {
    id: PROFILE_ID,
    totalPushups: 0,
    totalXp: 0,
    streak: 0,
    lastWorkoutDate: null,
    currentBossIndex: 0,
    stageStep: 0,
    enemyHp: BOSSES[0].minions[0].hp,
    fight: freshFight(BOSSES[0].minions[0].hp),
    bossesDefeated: [],
    achievementsUnlocked: [],
    rushBestReps: 0,
    rushBestCombo: 0,
    streakFreezes: STARTING_FREEZES,
    createdAt: new Date().toISOString(),
    season: SEASON,
  };
}

/**
 * Brings a save written before stages had minions up to date: such a profile has `bossHp` and no
 * `stageStep`. It's dropped straight onto the boss with the HP it had, rather than being sent
 * back through minions it never signed up for.
 */
function migrate(p: ProfileRecord): ProfileRecord {
  const hasStage = typeof p.stageStep === 'number' && typeof p.enemyHp === 'number';
  if (hasStage && p.fight) return openNewStage(p);

  const index = Math.min(p.currentBossIndex ?? 0, BOSSES.length - 1);
  const boss = BOSSES[index];
  const stageStep = hasStage ? p.stageStep : BOSS_STEP;
  const enemyHp = hasStage ? p.enemyHp : Math.min(p.bossHp ?? boss.hp, boss.hp);
  return { ...p, stageStep, enemyHp, fight: p.fight ?? freshFight(enemyHp) };
}

/**
 * A save that cleared what used to be the last stage stays parked on that boss at 0 HP — there
 * was nowhere further to go. Once a stage is added after it, the run moves on to the new one.
 */
function openNewStage(p: ProfileRecord): ProfileRecord {
  const index = p.currentBossIndex ?? 0;
  if (p.replay || index >= BOSSES.length - 1 || !p.bossesDefeated.includes(BOSSES[index].id)) return p;
  const next = BOSSES[index + 1];
  const step = firstStep(next);
  const hp = encounterAt(next, step).hp;
  return { ...p, currentBossIndex: index + 1, stageStep: step, enemyHp: hp, fight: freshFight(hp) };
}

async function ensureProfile(): Promise<ProfileRecord> {
  const existing = await db.profile.get(PROFILE_ID);
  if (existing && !isStale(existing.season)) {
    const migrated = migrate(existing);
    if (migrated !== existing) await db.profile.put(migrated);
    return migrated;
  }
  // A save from a season that's over is not migrated, it's replaced — that's what a reset is.
  // The sync mark goes with it: it records an agreement with the server about numbers that no
  // longer exist, and leaving it behind would make the next sync draw conclusions from it.
  if (existing) clearMark();
  // What the intro learned may have been said before this row existed.
  const about = readIntroAbout();
  const fresh: ProfileRecord = about ? { ...defaultProfile(), nickname: about.nickname, age: about.age } : defaultProfile();
  await db.transaction('rw', db.profile, db.reps, async () => {
    await db.profile.put(fresh);
    await db.reps.clear();
  });
  return fresh;
}

/**
 * Saves the profile and appends the rep to the log in one transaction, so the stats can never
 * disagree with the totals. Returns the log row's id for undo.
 */
async function commitRep(
  before: ProfileRecord,
  updatedIn: ProfileRecord,
  entry: Omit<RepLogEntry, 'id' | 'season'>,
): Promise<{ logId: number; weeklyBonus: number; totalXp: number; rankUps: RankUp[] }> {
  return db.transaction('rw', db.profile, db.reps, async () => {
    const logId = (await db.reps.add({ ...entry, season: SEASON })) as number;
    // The running numbers the league and strength ranks read: this week's count, the current
    // set, the best set ever.
    const updated: ProfileRecord = { ...updatedIn, ...advanceTraining(before, entry.at) };
    // The weekly goal pays once per week, on the rep that reaches it. Counted from the log,
    // which already holds this rep.
    let weeklyBonus = 0;
    let saved = updated;
    const key = weekKey(entry.at);
    if (updated.weeklyRewardWeek !== key) {
      const goal = updated.weeklyGoal ?? DEFAULT_WEEKLY_GOAL;
      const done = await db.reps
        .where('at')
        .between(weekStart(entry.at), entry.at, true, true)
        .filter((r) => r.season === SEASON)
        .count();
      if (done >= goal) {
        weeklyBonus = weeklyBonusXp(goal);
        saved = { ...updated, totalXp: updated.totalXp + weeklyBonus, weeklyRewardWeek: key };
      }
    }
    await db.profile.put(saved);
    const rankUps = rankUpsBetween(
      { level: levelFromTotalXp(before.totalXp).level, weekReps: weekRepsNow(before, entry.at), bestSet: before.bestSet ?? 0 },
      { level: levelFromTotalXp(saved.totalXp).level, weekReps: weekRepsNow(saved, entry.at), bestSet: saved.bestSet ?? 0 },
    );
    return { logId, weeklyBonus, totalXp: saved.totalXp, rankUps };
  });
}

const trainingSnapshot = (p: ProfileRecord): Training => ({
  weekReps: p.weekReps,
  setRun: p.setRun,
  bestSet: p.bestSet,
});

/**
 * One press of «+» (or −1 to take one back). Only the clicker moves — see `clickerTaps`.
 * A plain function rather than part of the hook: the counter panel calls it directly.
 */
export async function bumpClicker(delta: 1 | -1): Promise<void> {
  const p = await ensureProfile();
  await db.profile.put({ ...p, clickerTaps: Math.max(0, (p.clickerTaps ?? 0) + delta) });
}

const streakSnapshot = (p: ProfileRecord): RepUndo['streakBefore'] => ({
  streak: p.streak,
  lastWorkoutDate: p.lastWorkoutDate,
  streakFreezes: p.streakFreezes,
});

export function useProfile() {
  useEffect(() => {
    void ensureProfile();
  }, []);

  const profile = useLiveQuery(() => db.profile.get(PROFILE_ID), []);

  const derived = useMemo(() => {
    if (!profile) return null;
    const levelInfo = levelFromTotalXp(profile.totalXp);
    const rank = getRank(levelInfo.level);
    const bossIndex = Math.min(profile.currentBossIndex, BOSSES.length - 1);
    const boss = BOSSES[bossIndex];
    const stageStep = profile.stageStep ?? BOSS_STEP;
    const enemy = encounterAt(boss, stageStep);
    // A rematch reopens the arena even once every boss is down.
    const replaying = Boolean(profile.replay);
    const allBossesDefeated = profile.bossesDefeated.length >= BOSSES.length && !replaying;
    // In a later round the boss on screen is the sharpened one, so what he says he does is true.
    const tier = profile.replay?.tier ?? 0;
    const shown = tier > 0 ? { ...boss, abilities: hardenAbilities(boss.abilities, tier) } : boss;
    return { ...levelInfo, rank, boss: shown, bossIndex, stageStep, enemy, allBossesDefeated, replaying, tier };
  }, [profile]);

  /**
   * One rep in Arena mode. All the rules live in {@link resolveArenaRep}; this only supplies the
   * clock and the crit roll, then folds the outcome into the profile.
   */
  const registerBossRep = useCallback(async (): Promise<RepResult> => {
    const p = await ensureProfile();
    const bossIndex = Math.min(p.currentBossIndex, BOSSES.length - 1);
    const boss = BOSSES[bossIndex];
    const tier = p.replay?.tier ?? 0;

    const outcome = resolveArenaRep(
      {
        bossIndex,
        stageStep: p.stageStep,
        enemyHp: p.enemyHp,
        bossesDefeated: p.bossesDefeated,
        fight: p.fight,
      },
      Date.now(),
      Math.random(),
      { ...perksFrom(p.upgrades), rage: (p.rageLeft ?? 0) > 0, ward: (p.wards ?? 0) > 0, double: (p.doubleLeft ?? 0) > 0, tier },
    );

    const st = advanceStreak(p, todayLocal());
    // A later round pays more for the harder fight.
    const xpGained = Math.round(XP_PER_REP * streakMultiplier(st.streak) * outcome.xpFactor * (1 + TIER_XP * tier));
    const beforeLevel = levelFromTotalXp(p.totalXp).level;

    let bonusXp = 0;
    if (outcome.bossDefeated) bonusXp = getBossBonusXp(boss);
    else if (outcome.minionDefeated) bonusXp = getMinionBonusXp(boss.minions[p.stageStep]);
    // «Метка охотника»: a kill pays more.
    bonusXp = Math.round(bonusXp * (1 + HUNTER_BONUS * upgradeLevel(p.upgrades, 'hunter')));
    /** The rep was at a minion — what «Двойной удар» counts down on. */
    const atMinion = encounterAt(boss, p.stageStep).isBoss === false;

    const totalXp = p.totalXp + xpGained + bonusXp;
    const updated: ProfileRecord = {
      ...p,
      totalPushups: p.totalPushups + 1,
      totalXp,
      streak: st.streak,
      lastWorkoutDate: st.lastWorkoutDate,
      streakFreezes: st.streakFreezes,
      currentBossIndex: outcome.next.bossIndex,
      stageStep: outcome.next.stageStep,
      enemyHp: Math.max(0, outcome.next.enemyHp),
      bossesDefeated: outcome.next.bossesDefeated,
      fight: outcome.next.fight,
      // The potion runs down rep by rep; a charm that worked is gone.
      rageLeft: Math.max(0, (p.rageLeft ?? 0) - 1),
      doubleLeft: atMinion ? Math.max(0, (p.doubleLeft ?? 0) - 1) : p.doubleLeft,
      wards: Math.max(0, (p.wards ?? 0) - (outcome.warded ? 1 : 0)),
    };
    // A replay walks the stages again from the one chosen — minions, boss, next stage — and ends
    // when it catches up: the moment it reaches the stage the real progress was on, that progress
    // comes back exactly as it was left (the same minion, the same HP). Beating the last boss
    // again ends it too, there being nowhere further to walk.
    // A new round isn't a catch-up: it runs the whole arena, to the last boss.
    const replayWon =
      Boolean(p.replay) &&
      outcome.bossRebeaten &&
      (tier > 0
        ? bossIndex >= BOSSES.length - 1
        : outcome.next.bossIndex === p.replay?.returnTo.currentBossIndex || bossIndex >= BOSSES.length - 1);
    if (replayWon && p.replay) {
      if (tier > 0) updated.cycle = Math.max(p.cycle ?? 0, tier);
      Object.assign(updated, {
        currentBossIndex: p.replay.returnTo.currentBossIndex,
        stageStep: p.replay.returnTo.stageStep,
        enemyHp: p.replay.returnTo.enemyHp,
        fight: p.replay.returnTo.fight,
        replay: null,
      });
    }
    const newAchievements = checkNewAchievements(updated);
    if (newAchievements.length) {
      updated.achievementsUnlocked = [...updated.achievementsUnlocked, ...newAchievements];
    }
    const { logId, weeklyBonus, totalXp: finalXp, rankUps } = await commitRep(p, updated, {
      at: Date.now(),
      mode: 'arena',
      bossIndex,
      stageStep: p.stageStep,
      damage: outcome.damage,
      crit: outcome.isCrit,
    });
    announceRankUps(rankUps);

    const afterLevel = levelFromTotalXp(finalXp).level;
    return {
      xpGained: xpGained + bonusXp + weeklyBonus,
      leveledUp: afterLevel > beforeLevel,
      newLevel: afterLevel,
      isCrit: outcome.isCrit,
      damage: outcome.damage,
      bossDefeated: outcome.bossDefeated,
      minionDefeated: outcome.minionDefeated,
      revived: outcome.revived,
      bossReached: outcome.bossReached,
      bossRebeaten: outcome.bossRebeaten,
      replayWon,
      rankUps,
      blocked: outcome.blocked,
      events: outcome.events,
      warded: outcome.warded,
      healed: outcome.healed,
      enemyName: outcome.enemyName,
      newAchievements,
      frozeDays: st.frozeDays,
      earnedFreeze: st.earnedFreeze,
      weeklyBonus,
      undo: {
        xp: xpGained + bonusXp + weeklyBonus,
        weeklyRewardWeekBefore: p.weeklyRewardWeek,
        enemyHpBefore: p.enemyHp,
        bossIndexBefore: p.currentBossIndex,
        stageStepBefore: p.stageStep,
        fightBefore: p.fight,
        bossIdDefeated: outcome.bossDefeated ? boss.id : null,
        replayBefore: p.replay ?? null,
        achievementsGranted: newAchievements,
        streakBefore: streakSnapshot(p),
        trainingBefore: trainingSnapshot(p),
        itemsSpent: {
          rageReps: (p.rageLeft ?? 0) > 0 ? 1 : 0,
          wards: outcome.warded ? 1 : 0,
          doubleReps: atMinion && (p.doubleLeft ?? 0) > 0 ? 1 : 0,
        },
        logId,
      },
    };
  }, []);

  /** One rep in Speed Rush mode: adds XP + pushup count only, no boss interaction. */
  const registerRushRep = useCallback(async (): Promise<RepResult> => {
    const p = await ensureProfile();
    const st = advanceStreak(p, todayLocal());
    const xpGained = Math.round(RUSH_XP_PER_REP * streakMultiplier(st.streak));
    const beforeLevel = levelFromTotalXp(p.totalXp).level;
    const totalXp = p.totalXp + xpGained;
    const updated: ProfileRecord = {
      ...p,
      totalPushups: p.totalPushups + 1,
      totalXp,
      streak: st.streak,
      lastWorkoutDate: st.lastWorkoutDate,
      streakFreezes: st.streakFreezes,
    };
    const newAchievements = checkNewAchievements(updated);
    if (newAchievements.length) {
      updated.achievementsUnlocked = [...updated.achievementsUnlocked, ...newAchievements];
    }
    const { logId, weeklyBonus, totalXp: finalXp, rankUps } = await commitRep(p, updated, {
      at: Date.now(),
      mode: 'rush',
      bossIndex: null,
      stageStep: null,
      damage: 0,
      crit: false,
    });
    announceRankUps(rankUps);
    const afterLevel = levelFromTotalXp(finalXp).level;
    return {
      xpGained: xpGained + weeklyBonus,
      leveledUp: afterLevel > beforeLevel,
      newLevel: afterLevel,
      isCrit: false,
      damage: 0,
      bossDefeated: false,
      minionDefeated: false,
      revived: false,
      bossReached: false,
      bossRebeaten: false,
      replayWon: false,
      rankUps,
      blocked: null,
      events: [],
      healed: 0,
      enemyName: '',
      newAchievements,
      frozeDays: st.frozeDays,
      earnedFreeze: st.earnedFreeze,
      weeklyBonus,
      undo: {
        xp: xpGained + weeklyBonus,
        weeklyRewardWeekBefore: p.weeklyRewardWeek,
        enemyHpBefore: null,
        bossIndexBefore: null,
        stageStepBefore: null,
        fightBefore: null,
        bossIdDefeated: null,
        achievementsGranted: newAchievements,
        streakBefore: streakSnapshot(p),
        trainingBefore: trainingSnapshot(p),
        logId,
      },
    };
  }, []);

  /**
   * Lets a regenerating boss heal while you rest, without waiting for your next rep.
   * Returns how much HP it clawed back, so the UI can show it happening.
   */
  const tickArena = useCallback(async (): Promise<number> => {
    const p = await ensureProfile();
    const { state, healed } = applyIdleRegen(
      {
        bossIndex: Math.min(p.currentBossIndex, BOSSES.length - 1),
        stageStep: p.stageStep,
        enemyHp: p.enemyHp,
        bossesDefeated: p.bossesDefeated,
        fight: p.fight,
      },
      Date.now(),
      { ...perksFrom(p.upgrades), tier: p.replay?.tier ?? 0 },
    );
    if (healed <= 0) return 0;
    await db.profile.put({ ...p, enemyHp: state.enemyHp, fight: state.fight });
    return healed;
  }, []);

  /** Called once when a Speed Rush session ends, to persist personal records. */
  const finishRush = useCallback(async (reps: number, bestCombo: number, run: number[]) => {
    const p = await ensureProfile();
    const isNewRecord = reps > p.rushBestReps;
    const updated: ProfileRecord = {
      ...p,
      rushBestReps: Math.max(p.rushBestReps, reps),
      rushBestCombo: Math.max(p.rushBestCombo, bestCombo),
      // The record's timeline becomes the next ghost.
      rushBestRun: isNewRecord ? packRun(run) : p.rushBestRun,
    };
    const newAchievements = checkNewAchievements(updated);
    if (newAchievements.length) {
      updated.achievementsUnlocked = [...updated.achievementsUnlocked, ...newAchievements];
    }
    await db.profile.put(updated);
    return { isNewRecord, newAchievements };
  }, []);

  /**
   * Records the result of a 1 на 1 against `opponent`: the rating moves by Elo and the win, loss
   * or draw is counted. A sparring robot (null) moves nothing, and neither does a duel past
   * today's DUEL_DAILY_LIMIT against the same player. Returns the rating before and after.
   */
  const recordDuel = useCallback(async (outcome: DuelOutcome, opponent: { id: string; rating: number } | null) => {
    const p = await ensureProfile();
    const before = p.duelRating ?? DUEL_START;
    const day = localDay(Date.now());
    if (!opponent || !canDuel(p.duelDay, day, opponent.id)) return { before, after: before };
    const after = Math.max(0, before + ratingDelta(before, opponent.rating, outcome));
    await db.profile.put({
      ...p,
      duelDay: logDuel(p.duelDay, day, opponent.id),
      duelRating: after,
      duelWins: (p.duelWins ?? 0) + (outcome === 'win' ? 1 : 0),
      duelLosses: (p.duelLosses ?? 0) + (outcome === 'loss' ? 1 : 0),
      duelDraws: (p.duelDraws ?? 0) + (outcome === 'draw' ? 1 : 0),
    });
    return { before, after };
  }, []);

  /**
   * Takes one rep back, in either mode. Reverses the pushup count, the XP it granted and any
   * achievements it unlocked, and — when the rep was the one that finished a boss — puts the boss
   * back together: previous stage, step inside it, the HP the enemy had before the hit, and
   * removal from the defeated list. The earlier version bailed out of boss-defeat reps entirely, which made the minus button
   * silently stop working right after a win.
   */
  const revertRep = useCallback(async (undo: RepUndo) => {
    const p = await ensureProfile();
    const updated: ProfileRecord = {
      ...p,
      totalPushups: Math.max(0, p.totalPushups - 1),
      totalXp: Math.max(0, p.totalXp - undo.xp),
      // Undo pops in reverse order, so the snapshot from this rep is exactly the state before it
      // — including a freeze it spent or earned.
      ...undo.streakBefore,
      // The week's count and the sets go back too, so a mis-counted rep doesn't keep its credit.
      ...(undo.trainingBefore ?? {}),
      // If this rep paid the weekly goal, taking it back un-pays it (its XP is in `undo.xp`).
      weeklyRewardWeek: undo.weeklyRewardWeekBefore,
      achievementsUnlocked: undo.achievementsGranted.length
        ? p.achievementsUnlocked.filter((id) => !undo.achievementsGranted.includes(id))
        : p.achievementsUnlocked,
    };
    // The potion's rep and a charm the rep spent come back with it.
    if (undo.itemsSpent?.rageReps) updated.rageLeft = Math.min(RAGE_REPS, (p.rageLeft ?? 0) + undo.itemsSpent.rageReps);
    if (undo.itemsSpent?.wards) updated.wards = (p.wards ?? 0) + undo.itemsSpent.wards;
    if (undo.itemsSpent?.doubleReps) updated.doubleLeft = Math.min(DOUBLE_REPS, (p.doubleLeft ?? 0) + undo.itemsSpent.doubleReps);
    if (undo.bossIndexBefore != null && undo.enemyHpBefore != null && undo.stageStepBefore != null) {
      updated.currentBossIndex = undo.bossIndexBefore;
      updated.stageStep = undo.stageStepBefore;
      updated.enemyHp = undo.enemyHpBefore;
      if (undo.fightBefore) updated.fight = undo.fightBefore;
      if (undo.bossIdDefeated) {
        updated.bossesDefeated = p.bossesDefeated.filter((id) => id !== undo.bossIdDefeated);
      }
      // Taking back the rep that won a rematch puts you back in it.
      if (undo.replayBefore !== undefined) updated.replay = undo.replayBefore;
    }
    await db.transaction('rw', db.profile, db.reps, async () => {
      await db.profile.put(updated);
      if (undo.logId != null) await db.reps.delete(undo.logId);
    });
  }, []);

  /**
   * Plays a beaten stage again, from its first minion, and on through the stages after it in
   * order. The real progress is put aside and comes back when the run catches up with it, or
   * when you leave (see `endReplay`). Refused while another replay is on, or for a boss not yet
   * beaten.
   */
  const startReplay = useCallback(async (bossIndex: number, tier = 0): Promise<boolean> => {
    return db.transaction('rw', db.profile, async () => {
      const p = await ensureProfile();
      const boss = BOSSES[bossIndex];
      if (!boss || p.replay || !p.bossesDefeated.includes(boss.id)) return false;
      const step = firstStep(boss);
      const hp = encounterAt(boss, step).hp;
      await db.profile.put({
        ...p,
        replay: {
          bossIndex,
          startedAt: Date.now(),
          ...(tier > 0 ? { tier } : {}),
          returnTo: { currentBossIndex: p.currentBossIndex, stageStep: p.stageStep, enemyHp: p.enemyHp, fight: p.fight },
        },
        currentBossIndex: bossIndex,
        stageStep: step,
        enemyHp: hp,
        fight: freshFight(hp),
      });
      return true;
    });
  }, []);

  /** Walks out of a rematch: the real progress comes back as it was left. */
  const endReplay = useCallback(async () => {
    await db.transaction('rw', db.profile, async () => {
      const p = await ensureProfile();
      if (!p.replay) return;
      const back = p.replay.returnTo;
      await db.profile.put({
        ...p,
        currentBossIndex: back.currentBossIndex,
        stageStep: back.stageStep,
        enemyHp: back.enemyHp,
        fight: back.fight,
        replay: null,
      });
    });
  }, []);

  /**
   * Buys the next level of an upgrade. XP comes straight off the total, so the level can drop.
   * Re-checked against the saved profile rather than trusting the button: two quick taps must
   * not buy twice on one balance.
   */
  const buyUpgrade = useCallback(async (id: UpgradeId): Promise<boolean> => {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    return db.transaction('rw', db.profile, db.reps, async () => {
      const p = await ensureProfile();
      const cost = nextCost(p.upgrades, def);
      if (cost == null || p.totalXp < cost) return false;
      await db.profile.put({
        ...p,
        totalXp: p.totalXp - cost,
        upgrades: { ...p.upgrades, [id]: upgradeLevel(p.upgrades, id) + 1 },
      });
      return true;
    });
  }, []);

  const buyFreeze = useCallback(async (): Promise<boolean> => {
    return db.transaction('rw', db.profile, db.reps, async () => {
      const p = await ensureProfile();
      const have = freezesOf(p);
      if (have >= MAX_FREEZES || p.totalXp < FREEZE_COST) return false;
      await db.profile.put({ ...p, totalXp: p.totalXp - FREEZE_COST, streakFreezes: have + 1 });
      return true;
    });
  }, []);

  /** Buys one potion or charm, up to what can be held. */
  const buyConsumable = useCallback(async (id: ConsumableId): Promise<boolean> => {
    const def = CONSUMABLES[id];
    return db.transaction('rw', db.profile, db.reps, async () => {
      const p = await ensureProfile();
      const field = STOCK_FIELD[id];
      const have = p[field] ?? 0;
      if (have >= def.max || p.totalXp < def.cost) return false;
      await db.profile.put({ ...p, totalXp: p.totalXp - def.cost, [field]: have + 1 });
      return true;
    });
  }, []);

  /** Drinks a «Зелье ярости»: the next RAGE_REPS arena reps hit twice as hard. Not while one is working. */
  const drinkRage = useCallback(async (): Promise<boolean> => {
    return db.transaction('rw', db.profile, async () => {
      const p = await ensureProfile();
      if (!(p.rage ?? 0) || (p.rageLeft ?? 0) > 0) return false;
      await db.profile.put({ ...p, rage: (p.rage ?? 0) - 1, rageLeft: RAGE_REPS });
      return true;
    });
  }, []);

  /** Switches a «Двойной удар» on: the next DOUBLE_REPS minion reps land twice. Not while one is on. */
  const activateDouble = useCallback(async (): Promise<boolean> => {
    return db.transaction('rw', db.profile, async () => {
      const p = await ensureProfile();
      if (!(p.doubles ?? 0) || (p.doubleLeft ?? 0) > 0) return false;
      await db.profile.put({ ...p, doubles: (p.doubles ?? 0) - 1, doubleLeft: DOUBLE_REPS });
      return true;
    });
  }, []);

  /** Spends one «Песочные часы» on the rest about to start; false when there are none. */
  const spendHourglass = useCallback(async (): Promise<boolean> => {
    return db.transaction('rw', db.profile, async () => {
      const p = await ensureProfile();
      if (!(p.hourglasses ?? 0)) return false;
      await db.profile.put({ ...p, hourglasses: (p.hourglasses ?? 0) - 1 });
      return true;
    });
  }, []);

  /**
   * Replaces the whole local profile with one pulled from the cloud. Kept separate from the dev
   * backdoor because this is a real user action, and the id must stay ours no matter what the
   * cloud copy carried.
   */
  const restoreProfile = useCallback(async (incoming: ProfileRecord) => {
    const safe = migrate({ ...incoming, id: PROFILE_ID });
    await db.profile.put(safe);
  }, []);

  /**
   * Deliberate backdoor for the dev panel: writes arbitrary fields straight into the profile,
   * bypassing every game rule. Nothing in normal play may use this.
   */
  const devPatchProfile = useCallback(async (patch: Partial<ProfileRecord>) => {
    const p = await ensureProfile();
    await db.profile.put({ ...p, ...patch, id: PROFILE_ID });
  }, []);

  /**
   * Sets the weekly goal and the daily norm (null puts the day back on automatic). Changing them
   * mid-week is allowed; the weekly payout still happens once.
   */
  const setWeeklyGoal = useCallback(async (goal: number, daily: number | null) => {
    const p = await ensureProfile();
    const next: ProfileRecord = { ...p, weeklyGoal: goal, dailyGoal: daily ?? undefined };
    if (daily == null) delete next.dailyGoal;
    await db.profile.put(next);
  }, []);

  const devResetProfile = useCallback(async () => {
    await db.transaction('rw', db.profile, db.reps, async () => {
      await db.profile.put(defaultProfile());
      await db.reps.clear();
    });
  }, []);

  return {
    profile,
    derived,
    registerBossRep,
    registerRushRep,
    startReplay,
    endReplay,
    finishRush,
    recordDuel,
    tickArena,
    revertRep,
    buyUpgrade,
    buyFreeze,
    buyConsumable,
    drinkRage,
    activateDouble,
    spendHourglass,
    setWeeklyGoal,
    restoreProfile,
    devPatchProfile,
    devResetProfile,
  };
}
