import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUEL_DAILY_LIMIT, DUEL_K, canDuel, duelOutcome, duelsToday, exhaustedToday, expectedScore, logDuel, pickOpponent, ratingDelta, sparringRun } from './duel.ts';

test('1 на 1: больше повторов, чем в записи соперника, — победа; столько же — ничья', () => {
  assert.equal(duelOutcome(31, 30), 'win');
  assert.equal(duelOutcome(30, 30), 'draw');
  assert.equal(duelOutcome(12, 30), 'loss');
});

test('Рейтинг: равные соперники делят половину K', () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.equal(ratingDelta(1000, 1000, 'win'), DUEL_K / 2);
  assert.equal(ratingDelta(1000, 1000, 'loss'), -DUEL_K / 2);
  assert.equal(ratingDelta(1000, 1000, 'draw'), 0);
});

test('Рейтинг: победа над сильным даёт больше, чем над слабым', () => {
  const upset = ratingDelta(1000, 1300, 'win');
  const expected = ratingDelta(1300, 1000, 'win');
  assert.ok(upset > expected, `${upset} должно быть больше ${expected}`);
  assert.ok(ratingDelta(1300, 1000, 'loss') < ratingDelta(1000, 1300, 'loss'), 'проигрыш слабому стоит дороже');
});

test('Подбор: из ближайших по рейтингу, без себя и без тех, у кого нет рекорда', () => {
  const players = [
    { id: 'me', rating: 1000, rushBest: 30 },
    { id: 'near', rating: 1010, rushBest: 25 },
    { id: 'far', rating: 1600, rushBest: 60 },
    { id: 'empty', rating: 1000, rushBest: 0 },
  ];
  const picked = pickOpponent(players, 1000, new Set(['me']), 1);
  assert.equal(picked?.id, 'near');
  assert.equal(pickOpponent([players[3]], 1000), null, 'без рекорда вызвать некого');
});

test('Спарринг: ровно столько повторов, по возрастанию, внутри минуты', () => {
  const run = sparringRun(25, 60000, () => 0.5);
  assert.equal(run.length, 25);
  assert.deepEqual([...run].sort((a, b) => a - b), run);
  assert.ok(run[0] >= 0 && run[run.length - 1] < 60000);
  // Быстрее в начале: первая половина повторов укладывается меньше чем в половину минуты.
  assert.ok(run[12] < 30000);
});

test('Лимит: не больше DUEL_DAILY_LIMIT рейтинговых боёв в день с одним соперником', () => {
  let log = undefined as ReturnType<typeof logDuel> | undefined;
  for (let i = 0; i < DUEL_DAILY_LIMIT; i += 1) {
    assert.ok(canDuel(log, '2026-10-14', 'vasya'), `бой ${i + 1} ещё можно`);
    log = logDuel(log, '2026-10-14', 'vasya');
  }
  assert.equal(duelsToday(log, '2026-10-14', 'vasya'), DUEL_DAILY_LIMIT);
  assert.ok(!canDuel(log, '2026-10-14', 'vasya'), 'шестой — уже нет');
  assert.ok(canDuel(log, '2026-10-14', 'petya'), 'с другим можно');
  assert.deepEqual([...exhaustedToday(log, '2026-10-14')], ['vasya']);
});

test('Лимит: на следующий день счёт начинается заново', () => {
  let log = logDuel(undefined, '2026-10-14', 'vasya');
  for (let i = 1; i < DUEL_DAILY_LIMIT; i += 1) log = logDuel(log, '2026-10-14', 'vasya');
  assert.ok(canDuel(log, '2026-10-15', 'vasya'));
  assert.equal(exhaustedToday(log, '2026-10-15').size, 0);
  log = logDuel(log, '2026-10-15', 'vasya');
  assert.deepEqual(log, { day: '2026-10-15', vs: { vasya: 1 } }, 'вчерашние счёта отброшены');
});
