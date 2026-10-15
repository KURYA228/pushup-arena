import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScreenGuard, DEFAULT_GUARD } from './screenGuard.ts';

const LOOK = 500;

test('a clean picture never blocks', () => {
  const g = new ScreenGuard();
  let t = 0;
  for (let i = 0; i < 100; i++) {
    g.look(i % 7 === 0 ? 2 : 0, (t += LOOK)); // the odd stray look doesn't do it
    assert.equal(g.rep(t), true);
  }
  assert.equal(g.snapshot().blockId, 0);
});

test('a screen stops counting and takes back the reps of the last 20 seconds', () => {
  const g = new ScreenGuard();
  let t = 0;
  for (let i = 0; i < 30; i++) {
    g.look(0, (t += 1000));
    g.rep(t); // one rep a second, 30 of them
  }
  g.look(3, (t += LOOK));
  g.look(2, (t += LOOK));
  const s = g.snapshot();
  assert.equal(s.blocked, true);
  assert.equal(s.blockId, 1);
  assert.equal(s.revoked, 20);
  assert.equal(g.rep(t), false);
});

test('counting resumes after the picture has been clean for a while, not at once', () => {
  const g = new ScreenGuard();
  let t = 0;
  g.look(3, (t += LOOK));
  g.look(3, (t += LOOK));
  assert.equal(g.snapshot().blocked, true);
  for (let i = 0; i < DEFAULT_GUARD.releaseLooks; i++) g.look(0, (t += LOOK));
  assert.equal(g.snapshot().blocked, true, 'minimum block time not over yet');
  for (let i = 0; i < 10; i++) g.look(0, (t += LOOK));
  assert.equal(g.snapshot().blocked, false);
  assert.equal(g.rep(t), true);
});

test('the screen coming back stops it again, with a fresh take-back', () => {
  const g = new ScreenGuard();
  let t = 0;
  g.look(3, (t += LOOK));
  g.look(3, (t += LOOK));
  for (let i = 0; i < 20; i++) g.look(0, (t += LOOK));
  for (let i = 0; i < 4; i++) g.rep((t += 1000));
  g.look(2, (t += LOOK));
  g.look(2, (t += LOOK));
  assert.equal(g.snapshot().blockId, 2);
  assert.equal(g.snapshot().revoked, 4);
});
