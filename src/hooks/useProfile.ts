import { useCallback, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PROFILE_ID } from '../db/db';
import type { ProfileRecord, RepResult, RepUndo } from '../types';
import { RUSH_XP_PER_REP, XP_PER_REP, levelFromTotalXp, streakMultiplier } from '../data/leveling';
import { getRank } from '../data/ranks';
import {
  BOSSES,
  BOSS_STEP,
  encounterAt,
  getBossBonusXp,
  getMinionBonusXp,
} from '../data/bosses';
import { applyIdleRegen, freshFight, resolveArenaRep } from '../data/combat';
import { checkNewAchievements } from '../data/achievements';

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

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
    createdAt: new Date().toISOString(),
  };
}

/**
 * Brings a save written before stages had minions up to date: such a profile has `bossHp` and no
 * `stageStep`. It's dropped straight onto the boss with the HP it had, rather than being sent
 * back through minions it never signed up for.
 */
function migrate(p: ProfileRecord): ProfileRecord {
  const hasStage = typeof p.stageStep === 'number' && typeof p.enemyHp === 'number';
  if (hasStage && p.fight) return p;

  const index = Math.min(p.currentBossIndex ?? 0, BOSSES.length - 1);
  const boss = BOSSES[index];
  const stageStep = hasStage ? p.stageStep : BOSS_STEP;
  const enemyHp = hasStage ? p.enemyHp : Math.min(p.bossHp ?? boss.hp, boss.hp);
  return { ...p, stageStep, enemyHp, fight: p.fight ?? freshFight(enemyHp) };
}

async function ensureProfile(): Promise<ProfileRecord> {
  const existing = await db.profile.get(PROFILE_ID);
  if (existing) {
    const migrated = migrate(existing);
    if (migrated !== existing) await db.profile.put(migrated);
    return migrated;
  }
  const fresh = defaultProfile();
  await db.profile.put(fresh);
  return fresh;
}

/** Streak logic: same day = unchanged, consecutive day = +1, gap = reset to 1. */
function nextStreak(p: ProfileRecord): number {
  const today = todayStr();
  if (p.lastWorkoutDate === today) return p.streak;
  if (p.lastWorkoutDate === yesterdayStr()) return p.streak + 1;
  return 1;
}

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
    const allBossesDefeated = profile.bossesDefeated.length >= BOSSES.length;
    return { ...levelInfo, rank, boss, bossIndex, stageStep, enemy, allBossesDefeated };
  }, [profile]);

  /**
   * One rep in Arena mode. All the rules live in {@link resolveArenaRep}; this only supplies the
   * clock and the crit roll, then folds the outcome into the profile.
   */
  const registerBossRep = useCallback(async (): Promise<RepResult> => {
    const p = await ensureProfile();
    const bossIndex = Math.min(p.currentBossIndex, BOSSES.length - 1);
    const boss = BOSSES[bossIndex];

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
    );

    const streak = nextStreak(p);
    const xpGained = Math.round(XP_PER_REP * streakMultiplier(streak) * outcome.xpFactor);
    const beforeLevel = levelFromTotalXp(p.totalXp).level;

    let bonusXp = 0;
    if (outcome.bossDefeated) bonusXp = getBossBonusXp(boss);
    else if (outcome.minionDefeated) bonusXp = getMinionBonusXp(boss.minions[p.stageStep]);

    const totalXp = p.totalXp + xpGained + bonusXp;
    const updated: ProfileRecord = {
      ...p,
      totalPushups: p.totalPushups + 1,
      totalXp,
      streak,
      lastWorkoutDate: todayStr(),
      currentBossIndex: outcome.next.bossIndex,
      stageStep: outcome.next.stageStep,
      enemyHp: Math.max(0, outcome.next.enemyHp),
      bossesDefeated: outcome.next.bossesDefeated,
      fight: outcome.next.fight,
    };
    const newAchievements = checkNewAchievements(updated);
    if (newAchievements.length) {
      updated.achievementsUnlocked = [...updated.achievementsUnlocked, ...newAchievements];
    }
    await db.profile.put(updated);

    const afterLevel = levelFromTotalXp(totalXp).level;
    return {
      xpGained: xpGained + bonusXp,
      leveledUp: afterLevel > beforeLevel,
      newLevel: afterLevel,
      isCrit: outcome.isCrit,
      damage: outcome.damage,
      bossDefeated: outcome.bossDefeated,
      minionDefeated: outcome.minionDefeated,
      revived: outcome.revived,
      bossReached: outcome.bossReached,
      blocked: outcome.blocked,
      healed: outcome.healed,
      enemyName: outcome.enemyName,
      newAchievements,
      undo: {
        xp: xpGained + bonusXp,
        enemyHpBefore: p.enemyHp,
        bossIndexBefore: p.currentBossIndex,
        stageStepBefore: p.stageStep,
        fightBefore: p.fight,
        bossIdDefeated: outcome.bossDefeated ? boss.id : null,
        achievementsGranted: newAchievements,
      },
    };
  }, []);

  /** One rep in Speed Rush mode: adds XP + pushup count only, no boss interaction. */
  const registerRushRep = useCallback(async (): Promise<RepResult> => {
    const p = await ensureProfile();
    const streak = nextStreak(p);
    const xpGained = Math.round(RUSH_XP_PER_REP * streakMultiplier(streak));
    const beforeLevel = levelFromTotalXp(p.totalXp).level;
    const totalXp = p.totalXp + xpGained;
    const updated: ProfileRecord = {
      ...p,
      totalPushups: p.totalPushups + 1,
      totalXp,
      streak,
      lastWorkoutDate: todayStr(),
    };
    const newAchievements = checkNewAchievements(updated);
    if (newAchievements.length) {
      updated.achievementsUnlocked = [...updated.achievementsUnlocked, ...newAchievements];
    }
    await db.profile.put(updated);
    const afterLevel = levelFromTotalXp(totalXp).level;
    return {
      xpGained,
      leveledUp: afterLevel > beforeLevel,
      newLevel: afterLevel,
      isCrit: false,
      damage: 0,
      bossDefeated: false,
      minionDefeated: false,
      revived: false,
      bossReached: false,
      blocked: null,
      healed: 0,
      enemyName: '',
      newAchievements,
      undo: {
        xp: xpGained,
        enemyHpBefore: null,
        bossIndexBefore: null,
        stageStepBefore: null,
        fightBefore: null,
        bossIdDefeated: null,
        achievementsGranted: newAchievements,
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
    );
    if (healed <= 0) return 0;
    await db.profile.put({ ...p, enemyHp: state.enemyHp, fight: state.fight });
    return healed;
  }, []);

  /** Called once when a Speed Rush session ends, to persist personal records. */
  const finishRush = useCallback(async (reps: number, bestCombo: number) => {
    const p = await ensureProfile();
    const isNewRecord = reps > p.rushBestReps;
    const updated: ProfileRecord = {
      ...p,
      rushBestReps: Math.max(p.rushBestReps, reps),
      rushBestCombo: Math.max(p.rushBestCombo, bestCombo),
    };
    const newAchievements = checkNewAchievements(updated);
    if (newAchievements.length) {
      updated.achievementsUnlocked = [...updated.achievementsUnlocked, ...newAchievements];
    }
    await db.profile.put(updated);
    return { isNewRecord, newAchievements };
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
      achievementsUnlocked: undo.achievementsGranted.length
        ? p.achievementsUnlocked.filter((id) => !undo.achievementsGranted.includes(id))
        : p.achievementsUnlocked,
    };
    if (undo.bossIndexBefore != null && undo.enemyHpBefore != null && undo.stageStepBefore != null) {
      updated.currentBossIndex = undo.bossIndexBefore;
      updated.stageStep = undo.stageStepBefore;
      updated.enemyHp = undo.enemyHpBefore;
      if (undo.fightBefore) updated.fight = undo.fightBefore;
      if (undo.bossIdDefeated) {
        updated.bossesDefeated = p.bossesDefeated.filter((id) => id !== undo.bossIdDefeated);
      }
    }
    await db.profile.put(updated);
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

  const devResetProfile = useCallback(async () => {
    await db.profile.put(defaultProfile());
  }, []);

  return {
    profile,
    derived,
    registerBossRep,
    registerRushRep,
    finishRush,
    tickArena,
    revertRep,
    restoreProfile,
    devPatchProfile,
    devResetProfile,
  };
}
