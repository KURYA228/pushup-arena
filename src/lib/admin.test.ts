import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProfileRecord } from '../types.ts';
import { applyAdminEdit } from './admin.ts';
import { fingerprint } from './syncMark.ts';
import { levelFromTotalXp } from '../data/leveling.ts';

const base = (): ProfileRecord => ({
  id: 1,
  totalPushups: 100,
  totalXp: 900,
  streak: 3,
  lastWorkoutDate: '2026-09-01',
  currentBossIndex: 0,
  stageStep: 0,
  enemyHp: 10,
  fight: {
    lastRepAt: null, setReps: 0, hpAtSetStart: 10, damageThisSet: 0, repsOnEnemy: 0,
    enemyMaxHp: 10, carriedHp: 0, revivedIds: [], lastStandReps: 0, regenAt: null,
  },
  bossesDefeated: [],
  achievementsUnlocked: [],
  rushBestReps: 20,
  rushBestCombo: 5,
  rushBestRun: [1000, 2000],
  createdAt: '2026-09-30T00:00:00.000Z',
  upgrades: { power: 2 },
  streakFreezes: 1,
});
const NOW = new Date(2026, 9, 9, 12).getTime();

test('an untouched save keeps its old fingerprint', () => {
  assert.equal(fingerprint(base()).includes('|a'), false);
});

test('any admin edit changes the fingerprint, even one outside it', () => {
  const p = base();
  const edited = applyAdminEdit(p, { streakFreezes: 2 }, NOW);
  assert.notEqual(fingerprint(edited), fingerprint(p));
  const again = applyAdminEdit(edited, { streakFreezes: 0 }, NOW);
  assert.notEqual(fingerprint(again), fingerprint(edited), 'two edits in the same millisecond still differ');
});

test('level sets XP to the start of that level', () => {
  const e = applyAdminEdit(base(), { level: 7 }, NOW);
  assert.equal(levelFromTotalXp(e.totalXp).level, 7);
  assert.equal(levelFromTotalXp(e.totalXp).xpIntoLevel, 0);
});

test('a streak given by hand is alive today; zero clears the date', () => {
  assert.equal(applyAdminEdit(base(), { streak: 10 }, NOW).lastWorkoutDate, '2026-10-09');
  assert.equal(applyAdminEdit(base(), { streak: 0 }, NOW).lastWorkoutDate, null);
  assert.equal(applyAdminEdit(base(), { streak: 3 }, NOW).lastWorkoutDate, '2026-09-01', 'unchanged streak keeps its date');
});

test('numbers are clamped and rounded; freezes capped', () => {
  const e = applyAdminEdit(base(), { totalPushups: -5, clickerTaps: 2.6, streakFreezes: 9 }, NOW);
  assert.equal(e.totalPushups, 0);
  assert.equal(e.clickerTaps, 3);
  assert.equal(e.streakFreezes, 2);
});

test('a new Rush record drops the old ghost; reset clears upgrades', () => {
  const e = applyAdminEdit(base(), { rushBestReps: 50, resetUpgrades: true }, NOW);
  assert.equal(e.rushBestRun, undefined);
  assert.deepEqual(e.upgrades, {});
  assert.deepEqual(applyAdminEdit(base(), { rushBestReps: 20 }, NOW).rushBestRun, [1000, 2000]);
});
