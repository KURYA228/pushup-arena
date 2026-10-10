import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRENGTH_PAUSE_MS, advanceTraining, weekRepsNow } from './training.ts';

const MON = new Date(2026, 9, 5, 10, 0, 0).getTime(); // понедельник
const DAY = 24 * 3600 * 1000;

test('подход растёт, пока паузы короче порога, и запоминается лучший', () => {
  let t = advanceTraining({}, MON);
  for (let i = 1; i < 12; i += 1) t = advanceTraining(t, MON + i * 2000);
  assert.equal(t.setRun.count, 12);
  assert.equal(t.bestSet, 12);
  // Пауза от 3 секунд — новый подход, лучший остаётся.
  t = advanceTraining(t, MON + 11 * 2000 + STRENGTH_PAUSE_MS);
  assert.equal(t.setRun.count, 1);
  assert.equal(t.bestSet, 12);
  // А 2,9 секунды — ещё тот же подход.
  t = advanceTraining(t, MON + 11 * 2000 + STRENGTH_PAUSE_MS + 2900);
  assert.equal(t.setRun.count, 2);
});

test('неделя считается заново с понедельника', () => {
  let t = advanceTraining({}, MON);
  t = advanceTraining(t, MON + 3 * DAY);
  assert.equal(t.weekReps.count, 2);
  t = advanceTraining(t, MON + 7 * DAY);
  assert.equal(t.weekReps.count, 1);
  // А просто прошедшая неделя без отжиманий читается как ноль.
  assert.equal(weekRepsNow(t, MON + 14 * DAY), 0);
  assert.equal(weekRepsNow(t, MON + 7 * DAY + 1000), 1);
});
