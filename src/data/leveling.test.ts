import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFromTotalXp, totalXpForLevel, xpRequiredForLevel } from './leveling.ts';

// The dev panel jumps to a level by writing the XP floor for it, so this inverse has to line up
// exactly with the forward derivation — otherwise "go to level 20" lands you on 19.
test('totalXpForLevel round-trips through levelFromTotalXp', () => {
  for (let level = 1; level <= 120; level += 1) {
    const xp = totalXpForLevel(level);
    assert.equal(levelFromTotalXp(xp).level, level, `floor of level ${level}`);
    assert.equal(levelFromTotalXp(xp).xpIntoLevel, 0, `level ${level} starts empty`);
  }
});

test('one XP short of a level floor stays on the previous level', () => {
  for (const level of [2, 5, 20, 50]) {
    assert.equal(levelFromTotalXp(totalXpForLevel(level) - 1).level, level - 1);
  }
});

test('level 1 needs no XP and the curve keeps growing', () => {
  assert.equal(totalXpForLevel(1), 0);
  for (let l = 1; l < 60; l += 1) {
    assert.ok(xpRequiredForLevel(l + 1) > xpRequiredForLevel(l), `level ${l}`);
  }
});

test('level input is clamped instead of looping forever', () => {
  assert.equal(totalXpForLevel(0), 0);
  assert.equal(totalXpForLevel(-5), 0);
  assert.equal(totalXpForLevel(10_000), totalXpForLevel(300));
});
