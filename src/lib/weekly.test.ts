import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RepLogEntry } from '../types.ts';
import { daysLeftInWeek, parseGoal, repsThisWeek, weekKey, weekStart, weeklyBonusXp } from './weekly.ts';
import { ghostAt, packRun } from './ghost.ts';
import { heatLevel, heatmapWeeks } from './stats.ts';

const at = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime();
const rep = (ts: number): RepLogEntry => ({ at: ts, mode: 'arena', bossIndex: 0, stageStep: 0, damage: 1, crit: false, season: 1 });

// 2026-10-08 is a Thursday.
test('weekStart is the local Monday at midnight', () => {
  assert.equal(weekStart(at(2026, 10, 8)), new Date(2026, 9, 5).getTime());
  assert.equal(weekStart(at(2026, 10, 5, 0)), new Date(2026, 9, 5).getTime(), 'Monday itself');
  assert.equal(weekStart(at(2026, 10, 11, 23)), new Date(2026, 9, 5).getTime(), 'Sunday belongs to the same week');
  assert.equal(weekKey(at(2026, 10, 8)), '2026-10-05');
});

test('repsThisWeek counts from Monday only', () => {
  const entries = [rep(at(2026, 10, 4)), rep(at(2026, 10, 5, 1)), rep(at(2026, 10, 7)), rep(at(2026, 10, 8))];
  assert.equal(repsThisWeek(entries, at(2026, 10, 8, 20)), 3);
});

test('daysLeftInWeek', () => {
  assert.equal(daysLeftInWeek(at(2026, 10, 5)), 6);
  assert.equal(daysLeftInWeek(at(2026, 10, 8)), 3);
  assert.equal(daysLeftInWeek(at(2026, 10, 11)), 0);
});

test('bonus scales with the goal', () => {
  assert.equal(weeklyBonusXp(150), 300);
});

test('ghost replays a recorded run', () => {
  const run = [1000, 2500, 4000];
  assert.equal(ghostAt(run, 3, 0, 60000), 0);
  assert.equal(ghostAt(run, 3, 2500, 60000), 2);
  assert.equal(ghostAt(run, 3, 60000, 60000), 3);
});

test('ghost without a timeline keeps an even pace', () => {
  assert.equal(ghostAt(null, 30, 30000, 60000), 15);
  assert.equal(ghostAt(undefined, 30, 90000, 60000), 30, 'never past the record');
  assert.equal(ghostAt(null, 0, 30000, 60000), 0);
});

test('packRun rounds to tenths of a second', () => {
  assert.deepEqual(packRun([1234, 2050, 59999]), [1200, 2100, 60000]);
});

test('heatmap ends on the current week, Monday on top, future days marked', () => {
  const cols = heatmapWeeks([rep(at(2026, 10, 7)), rep(at(2026, 10, 7)), rep(at(2026, 9, 28))], 2, at(2026, 10, 8));
  assert.equal(cols.length, 2);
  assert.equal(cols[0][0].day, '2026-09-28');
  assert.equal(cols[0][0].reps, 1);
  assert.equal(cols[1][0].day, '2026-10-05');
  assert.equal(cols[1][2].reps, 2, 'Wednesday the 7th');
  assert.equal(cols[1][3].future, false, 'today is not future');
  assert.equal(cols[1][4].future, true, 'Friday is');
});

test('heatLevel splits into quarters of the busiest day', () => {
  assert.deepEqual([0, 1, 25, 26, 50, 100].map((r) => heatLevel(r, 100)), [0, 1, 1, 2, 2, 4]);
});

test('parseGoal accepts a sane number and refuses the rest', () => {
  assert.equal(parseGoal('200'), 200);
  assert.equal(parseGoal(' 120 '), 120);
  assert.equal(parseGoal('99.6'), 100);
  assert.equal(parseGoal('5'), null, 'too small');
  assert.equal(parseGoal('9000'), null, 'too big');
  assert.equal(parseGoal('abc'), null);
  assert.equal(parseGoal(''), null);
});
