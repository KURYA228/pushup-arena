import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoutHints } from './scout.ts';
import { freshFight } from '../data/combat.ts';

test('Свиток разведки: сколько повторов до кражи яйца и до дани', () => {
  const fight = { ...freshFight(100), repsOnEnemy: 1, setReps: 5 };
  const hints = scoutHints(
    [
      { kind: 'piggyBank', value: 0.04 },
      { kind: 'tribute', value: 7 },
    ],
    fight,
  );
  assert.deepEqual(
    hints.map((h) => h.text),
    ['Яйцо — через 2 повт.', 'Дань — через 2 повт. подхода'],
  );
});

test('Свиток разведки: следующий повтор называется прямо, касса пропадает, когда оплачена', () => {
  const hints = scoutHints([{ kind: 'skipEvery', value: 5 }, { kind: 'entryFee', value: 3 }], { ...freshFight(10), repsOnEnemy: 4, setReps: 3 });
  assert.deepEqual(hints.map((h) => h.text), ['Мимо — следующий повтор']);
});
