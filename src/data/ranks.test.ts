import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leagueFor, rankUpsBetween, strengthFor } from './ranks.ts';

test('лиги: подразделения III → I внутри уровня, Мастер без подразделений', () => {
  assert.equal(leagueFor(0).name, 'Бронза III');
  assert.equal(leagueFor(40).name, 'Бронза II');
  assert.equal(leagueFor(99).name, 'Бронза I');
  assert.equal(leagueFor(100).name, 'Серебро III');
  assert.equal(leagueFor(1199).name, 'Алмаз I');
  assert.equal(leagueFor(1200).name, 'Мастер');
  assert.equal(leagueFor(5000).to, null);
  // Ступени идут подряд, без дыр.
  let prev = -1;
  for (let r = 0; r <= 1300; r += 1) {
    const s = leagueFor(r).step;
    assert.ok(s === prev || s === prev + 1, `скачок на ${r}`);
    prev = s;
  }
});

test('сила: по лучшему подходу', () => {
  assert.equal(strengthFor(9).name, 'Без разряда');
  assert.equal(strengthFor(10).name, 'Крепыш');
  assert.equal(strengthFor(100).name, 'Колосс');
});

test('повышения: по каждой лестнице отдельно', () => {
  const ups = rankUpsBetween({ level: 4, weekReps: 99, bestSet: 9 }, { level: 5, weekReps: 100, bestSet: 10 });
  assert.deepEqual(ups.map((u) => [u.kind, u.name]), [
    ['level', 'Боец'],
    ['league', 'Серебро III'],
    ['strength', 'Крепыш'],
  ]);
  assert.deepEqual(rankUpsBetween({ level: 6, weekReps: 10, bestSet: 11 }, { level: 7, weekReps: 11, bestSet: 12 }), []);
});
