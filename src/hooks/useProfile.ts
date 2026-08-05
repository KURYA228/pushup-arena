import { useCallback, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PROFILE_ID } from '../db/db';
import type { ProfileRecord, RepResult } from '../types';
import { RUSH_XP_PER_REP, XP_PER_REP, levelFromTotalXp, streakMultiplier } from '../data/leveling';
import { getRank } from '../data/ranks';
import { BOSSES, getBossBonusXp } from '../data/bosses';
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
    bossHp: BOSSES[0].hp,
    bossesDefeated: [],
    achievementsUnlocked: [],
    rushBestReps: 0,
    rushBestCombo: 0,
    createdAt: new Date().toISOString(),
  };
}

async function ensureProfile(): Promise<ProfileRecord> {
  const existing = await db.profile.get(PROFILE_ID);
  if (existing) return existing;
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
    const allBossesDefeated = profile.bossesDefeated.length >= BOSSES.length;
    return { ...levelInfo, rank, boss, bossIndex, allBossesDefeated };
  }, [profile]);

  /** One rep in Boss mode: adds XP + pushup count, deals damage to the current boss, handles boss defeat. */
  const registerBossRep = useCallback(async (): Promise<RepResult> => {
    const p = await ensureProfile();
    const bossIndex = Math.min(p.currentBossIndex, BOSSES.length - 1);
    const boss = BOSSES[bossIndex];
    const isCrit = Math.random() < boss.critChance;
    const damage = Math.round(boss.baseDamage * (isCrit ? boss.critMultiplier : 1));
    const streak = nextStreak(p);
    const xpGained = Math.round(XP_PER_REP * streakMultiplier(streak));
    const beforeLevel = levelFromTotalXp(p.totalXp).level;

    let bossHp = p.bossHp - damage;
    let currentBossIndex = p.currentBossIndex;
    let bossesDefeated = p.bossesDefeated;
    let bonusXp = 0;
    let bossDefeated = false;

    if (bossHp <= 0 && !bossesDefeated.includes(boss.id)) {
      bossDefeated = true;
      bonusXp = getBossBonusXp(boss);
      bossesDefeated = [...p.bossesDefeated, boss.id];
      const isLastBoss = bossIndex >= BOSSES.length - 1;
      currentBossIndex = isLastBoss ? bossIndex : bossIndex + 1;
      bossHp = isLastBoss ? 0 : BOSSES[currentBossIndex].hp;
    }

    const totalXp = p.totalXp + xpGained + bonusXp;
    const updated: ProfileRecord = {
      ...p,
      totalPushups: p.totalPushups + 1,
      totalXp,
      streak,
      lastWorkoutDate: todayStr(),
      bossHp: Math.max(bossHp, 0),
      currentBossIndex,
      bossesDefeated,
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
      isCrit,
      damage,
      bossDefeated,
      newAchievements,
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
      newAchievements,
    };
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
   * Best-effort undo for the manual "-1" correction button. Reverses XP/pushup count and,
   * if the boss wasn't defeated on that rep, restores its HP. Boss-defeat transitions are not
   * reversed (rare edge case) to avoid corrupting the "bosses defeated" history.
   */
  const revertBossRep = useCallback(async (result: RepResult) => {
    if (result.bossDefeated) return;
    const p = await ensureProfile();
    const bossIndex = Math.min(p.currentBossIndex, BOSSES.length - 1);
    const updated: ProfileRecord = {
      ...p,
      totalPushups: Math.max(0, p.totalPushups - 1),
      totalXp: Math.max(0, p.totalXp - result.xpGained),
      bossHp: Math.min(BOSSES[bossIndex].hp, p.bossHp + result.damage),
    };
    await db.profile.put(updated);
  }, []);

  const revertRushRep = useCallback(async (result: RepResult) => {
    const p = await ensureProfile();
    const updated: ProfileRecord = {
      ...p,
      totalPushups: Math.max(0, p.totalPushups - 1),
      totalXp: Math.max(0, p.totalXp - result.xpGained),
    };
    await db.profile.put(updated);
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
    revertBossRep,
    revertRushRep,
    devPatchProfile,
    devResetProfile,
  };
}
