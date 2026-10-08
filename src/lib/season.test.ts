import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASON, isStale } from './season.ts';

test('the current season is never stale', () => {
  assert.equal(isStale(SEASON), false);
});

test('a save from a finished season is stale', () => {
  assert.equal(isStale(SEASON - 1), true);
  assert.equal(isStale(SEASON - 7), true);
});

test('a save from the future is left alone', () => {
  // Rolling the app back to an older build must not read as a second wipe: the player's save
  // is newer than this copy of the code, not older, and throwing it away would destroy
  // progress the player legitimately made.
  assert.equal(isStale(SEASON + 1), false);
});

test('a save written before seasons existed counts as season zero', () => {
  // Every save on a phone right now has no season field at all. Whatever this says decides
  // whether the next release silently wipes them, so it is pinned rather than assumed.
  assert.equal(isStale(undefined), SEASON > 0);
  assert.equal(isStale(null), SEASON > 0);
  assert.equal(isStale(undefined), isStale(0));
});
