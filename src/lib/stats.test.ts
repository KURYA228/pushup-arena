import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RepLogEntry } from '../types.ts';
import {
  dailyTotals,
  fightDuration,
  localDay,
  plural,
  splitSets,
  stageRecords,
  summarize,
} from './stats.ts';

const at = (y: number, mo: number, d: number, h = 12, mi = 0, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s).getTime();

const rep = (ts: number, extra: Partial<RepLogEntry> = {}): RepLogEntry => ({
  at: ts,
  mode: 'arena',
  bossIndex: 0,
  stageStep: 0,
  damage: 1,
  crit: false,
  season: 1,
  ...extra,
});

/** n reps two seconds apart — one set. */
const set = (start: number, n: number, extra: Partial<RepLogEntry> = {}) =>
  Array.from({ length: n }, (_, i) => rep(start + i * 2000, extra));

test('localDay uses the local calendar, not UTC', () => {
  assert.equal(localDay(at(2026, 10, 8, 0, 30)), '2026-10-08');
  assert.equal(localDay(at(2026, 10, 8, 23, 59)), '2026-10-08');
});

test('dailyTotals fills empty days and ends on today', () => {
  const now = at(2026, 10, 8);
  const days = dailyTotals([...set(at(2026, 10, 6), 3), ...set(at(2026, 10, 8), 2)], 4, now);
  assert.deepEqual(days, [
    { day: '2026-10-05', reps: 0 },
    { day: '2026-10-06', reps: 3 },
    { day: '2026-10-07', reps: 0 },
    { day: '2026-10-08', reps: 2 },
  ]);
});

test('splitSets breaks on a pause of six seconds or more', () => {
  const t = at(2026, 10, 8);
  const sets = splitSets([rep(t), rep(t + 5999), rep(t + 5999 + 6000), rep(t + 5999 + 6000 + 100)]);
  assert.deepEqual(sets.map((s) => s.reps), [2, 2]);
});

test('summarize counts today, week, best day, sets and pace', () => {
  const now = at(2026, 10, 8, 20);
  const entries = [
    ...set(at(2026, 9, 20), 30), // outside the week
    ...set(at(2026, 10, 7), 10),
    ...set(at(2026, 10, 8, 9), 6),
    ...set(at(2026, 10, 8, 18), 4),
  ];
  const s = summarize(entries, now);
  assert.equal(s.today, 10);
  assert.equal(s.week, 20);
  assert.deepEqual(s.bestDay, { day: '2026-09-20', reps: 30 });
  assert.equal(s.activeDays, 3);
  assert.equal(s.bestSet, 30);
  assert.equal(s.avgSet, 50 / 4);
  // Every rep two seconds apart → 30 per minute; the 4-rep set is too short to count.
  assert.equal(s.pace, 30);
  assert.equal(s.since, entries[0].at);
});

test('summarize on an empty log', () => {
  const s = summarize([], at(2026, 10, 8));
  assert.equal(s.today, 0);
  assert.equal(s.bestDay, null);
  assert.equal(s.pace, null);
  assert.equal(s.since, null);
});

test('stageRecords groups arena reps by stage and ignores Rush', () => {
  const entries = [
    ...set(at(2026, 10, 6), 5, { bossIndex: 0, stageStep: 0 }),
    ...set(at(2026, 10, 7), 5, { bossIndex: 0, stageStep: 3, crit: true, damage: 2 }),
    ...set(at(2026, 10, 7, 15), 7, { mode: 'rush', bossIndex: null, stageStep: null }),
    ...set(at(2026, 10, 8), 3, { bossIndex: 1, stageStep: 2 }),
  ];
  const r = stageRecords(entries);
  assert.equal(r.size, 2);
  const first = r.get(0)!;
  assert.equal(first.reps, 10);
  assert.equal(first.crits, 5);
  assert.equal(first.damage, 15);
  assert.equal(first.days, 2);
  assert.equal(first.complete, true);
  assert.equal(r.get(1)!.complete, false, 'log started mid-stage');
});

test('plural picks Russian forms', () => {
  const f = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
  assert.deepEqual([1, 2, 5, 11, 12, 21, 22, 25, 111].map(f), [
    '1 день', '2 дня', '5 дней', '11 дней', '12 дней', '21 день', '22 дня', '25 дней', '111 дней',
  ]);
});

test('fightDuration says minutes within a day, days across several', () => {
  assert.equal(fightDuration({ firstAt: 0, lastAt: 7 * 60_000, days: 1 }), '7 мин');
  assert.equal(fightDuration({ firstAt: 0, lastAt: 10_000, days: 1 }), '1 мин');
  assert.equal(fightDuration({ firstAt: 0, lastAt: 0, days: 3 }), '3 дня');
});
