import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProfileRecord } from '../types.ts';
import { compare, fingerprint } from './syncMark.ts';

/**
 * The sync decision is the one place in the app that can silently destroy a workout, so every
 * branch is pinned here. `compare` is pure — the storage helpers around it are not exercised.
 */

function profile(over: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: 1,
    totalPushups: 100,
    totalXp: 1000,
    streak: 3,
    lastWorkoutDate: '2026-09-30',
    currentBossIndex: 2,
    stageStep: 1,
    enemyHp: 40,
    fight: {
      lastRepAt: null,
      setReps: 0,
      hpAtSetStart: 40,
      damageThisSet: 0,
      repsOnEnemy: 0,
      enemyMaxHp: 40,
      carriedHp: 0,
      revivedIds: [],
      lastStandReps: 0,
      regenAt: null,
    },
    bossesDefeated: ['grunt', 'brawler'],
    achievementsUnlocked: [],
    rushBestReps: 12,
    rushBestCombo: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

test('identical progress needs no decision', () => {
  const local = profile();
  const cloud = profile();
  assert.equal(compare(local, cloud, fingerprint(local)), 'same');
});

test('device untouched since the last sync is simply behind', () => {
  const local = profile();
  const mark = fingerprint(local);
  const cloud = profile({ totalPushups: 160, totalXp: 1600 });
  assert.equal(compare(local, cloud, mark), 'behind');
});

test('device that did reps while the account stood still is ahead', () => {
  const base = profile();
  const mark = fingerprint(base);
  const local = profile({ totalPushups: 140, totalXp: 1400 });
  assert.equal(compare(local, base, mark), 'ahead');
});

test('both sides moved on — nobody may decide but the user', () => {
  const mark = fingerprint(profile());
  const local = profile({ totalPushups: 140 });
  const cloud = profile({ totalPushups: 160 });
  assert.equal(compare(local, cloud, mark), 'diverged');
});

test('a device that has never synced is treated as diverged, not as behind', () => {
  // No ancestor means no way to know whether the local numbers are new work or leftovers.
  // Guessing "behind" here would wipe a fresh install that had already been played offline.
  const local = profile({ totalPushups: 30 });
  const cloud = profile({ totalPushups: 300 });
  assert.equal(compare(local, cloud, null), 'diverged');
});

test('no ancestor still resolves silently when the two already agree', () => {
  const local = profile();
  assert.equal(compare(local, profile(), null), 'same');
});

test('a device behind on a smaller number is still just behind', () => {
  // Being behind is about the ancestor, not about who has more: an undo on the other device
  // legitimately lowers the count, and this device must follow it down.
  const local = profile();
  const mark = fingerprint(local);
  const cloud = profile({ totalPushups: 99, totalXp: 990 });
  assert.equal(compare(local, cloud, mark), 'behind');
});

test('the fingerprint ignores fields that differ per device', () => {
  const a = profile({ createdAt: '2020-01-01T00:00:00.000Z', achievementsUnlocked: ['first'] });
  const b = profile({ createdAt: '2026-06-06T00:00:00.000Z', achievementsUnlocked: [] });
  assert.equal(fingerprint(a), fingerprint(b));
});

test('the fingerprint notices every kind of progress', () => {
  const base = fingerprint(profile());
  const changes: Partial<ProfileRecord>[] = [
    { totalPushups: 101 },
    { totalXp: 1001 },
    { streak: 4 },
    { currentBossIndex: 3 },
    { stageStep: 2 },
    { enemyHp: 39 },
    { bossesDefeated: ['grunt'] },
    { rushBestReps: 13 },
    { rushBestCombo: 6 },
  ];
  for (const change of changes) {
    assert.notEqual(fingerprint(profile(change)), base, `не заметил: ${Object.keys(change)[0]}`);
  }
});
