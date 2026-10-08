import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FREEZES, STARTING_FREEZES, advanceStreak, dayDiff, streakView } from './streak.ts';

test('dayDiff counts calendar days, across months', () => {
  assert.equal(dayDiff('2026-10-08', '2026-10-08'), 0);
  assert.equal(dayDiff('2026-10-07', '2026-10-08'), 1);
  assert.equal(dayDiff('2026-09-30', '2026-10-02'), 2);
  assert.equal(dayDiff('2026-03-28', '2026-03-30'), 2, 'across a DST change');
});

test('same day leaves the streak alone', () => {
  const r = advanceStreak({ streak: 4, lastWorkoutDate: '2026-10-08', streakFreezes: 1 }, '2026-10-08');
  assert.equal(r.streak, 4);
  assert.equal(r.frozeDays, 0);
});

test('next day adds one', () => {
  const r = advanceStreak({ streak: 4, lastWorkoutDate: '2026-10-07', streakFreezes: 1 }, '2026-10-08');
  assert.equal(r.streak, 5);
  assert.equal(r.streakFreezes, 1);
});

test('first rep ever starts at one', () => {
  const r = advanceStreak({ streak: 0, lastWorkoutDate: null }, '2026-10-08');
  assert.equal(r.streak, 1);
  assert.equal(r.streakFreezes, STARTING_FREEZES);
});

test('a missed day spends a freeze and the streak goes on', () => {
  const r = advanceStreak({ streak: 4, lastWorkoutDate: '2026-10-06', streakFreezes: 1 }, '2026-10-08');
  assert.deepEqual(
    { streak: r.streak, freezes: r.streakFreezes, froze: r.frozeDays },
    { streak: 5, freezes: 0, froze: 1 },
  );
});

test('two missed days need two freezes', () => {
  const two = advanceStreak({ streak: 4, lastWorkoutDate: '2026-10-05', streakFreezes: 2 }, '2026-10-08');
  assert.equal(two.streak, 5);
  assert.equal(two.streakFreezes, 0);
  const one = advanceStreak({ streak: 4, lastWorkoutDate: '2026-10-05', streakFreezes: 1 }, '2026-10-08');
  assert.equal(one.streak, 1, 'not enough freezes — the streak breaks');
  assert.equal(one.streakFreezes, 1, 'and the freeze is kept');
});

test('old saves without the field get the starting freeze', () => {
  const r = advanceStreak({ streak: 3, lastWorkoutDate: '2026-10-06' }, '2026-10-08');
  assert.equal(r.streak, 4);
  assert.equal(r.streakFreezes, STARTING_FREEZES - 1);
});

test('every seventh day earns a freeze, up to the cap', () => {
  const r = advanceStreak({ streak: 6, lastWorkoutDate: '2026-10-07', streakFreezes: 0 }, '2026-10-08');
  assert.equal(r.streak, 7);
  assert.equal(r.earnedFreeze, true);
  assert.equal(r.streakFreezes, 1);
  const capped = advanceStreak({ streak: 13, lastWorkoutDate: '2026-10-07', streakFreezes: MAX_FREEZES }, '2026-10-08');
  assert.equal(capped.earnedFreeze, false);
  assert.equal(capped.streakFreezes, MAX_FREEZES);
  const sameDay = advanceStreak({ streak: 7, lastWorkoutDate: '2026-10-08', streakFreezes: 0 }, '2026-10-08');
  assert.equal(sameDay.earnedFreeze, false, 'only once, on the day it is reached');
});

test('streakView shows a broken streak as zero', () => {
  const v = streakView({ streak: 9, lastWorkoutDate: '2026-10-01', streakFreezes: 1 }, '2026-10-08');
  assert.equal(v.streak, 0);
});

test('streakView: trained today, alive yesterday, saved by a freeze', () => {
  assert.deepEqual(streakView({ streak: 9, lastWorkoutDate: '2026-10-08', streakFreezes: 1 }, '2026-10-08'), {
    streak: 9, freezes: 1, pendingFreezes: 0, needsToday: false,
  });
  assert.deepEqual(streakView({ streak: 9, lastWorkoutDate: '2026-10-07', streakFreezes: 1 }, '2026-10-08'), {
    streak: 9, freezes: 1, pendingFreezes: 0, needsToday: true,
  });
  assert.deepEqual(streakView({ streak: 9, lastWorkoutDate: '2026-10-06', streakFreezes: 1 }, '2026-10-08'), {
    streak: 9, freezes: 1, pendingFreezes: 1, needsToday: true,
  });
});
