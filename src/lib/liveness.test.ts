import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Liveness, armRaised, DEFAULT_LIVENESS, type LivenessArm, type LivenessFrame } from './liveness.ts';

const DT = 1000 / 30;

/** Side view of a plank: shoulder above the hand, arm straight down. */
const PLANTED: LivenessArm = { shoulder: { x: 0.5, y: 0.5 }, elbow: { x: 0.5, y: 0.6 }, wrist: { x: 0.5, y: 0.7 } };
/** The bottom of a deep push-up: shoulder sunk towards the hand, elbow bent out. */
const BOTTOM: LivenessArm = { shoulder: { x: 0.5, y: 0.62 }, elbow: { x: 0.6, y: 0.64 }, wrist: { x: 0.52, y: 0.7 } };
/** A hand raised forward, level with the shoulder. */
const RAISED: LivenessArm = { shoulder: { x: 0.5, y: 0.5 }, elbow: { x: 0.4, y: 0.5 }, wrist: { x: 0.3, y: 0.51 } };

const frame = (arm: LivenessArm, angle: number, dy = 0): LivenessFrame => ({
  angle,
  arms: [{ ...arm, shoulder: { x: arm.shoulder.x, y: arm.shoulder.y + dy } }],
  scale: 0.3,
});

/** A random source that always picks the low end and the first kind ("raise-arm"). */
const low = () => 0;

function liveness() {
  return new Liveness(DEFAULT_LIVENESS, low);
}

/** Count reps until a command comes up; returns the time it did. */
function repUntilChallenge(l: Liveness, t0 = 0): number {
  let t = t0;
  for (let i = 0; i < 100; i++) {
    t += 1000;
    assert.equal(l.rep(t), true);
    if (l.snapshot(t).state === 'challenge') return t;
  }
  throw new Error('no challenge');
}

test('arm geometry: planted and the bottom of a push-up are not raised, a raised hand is', () => {
  assert.equal(armRaised(PLANTED), false);
  assert.equal(armRaised(BOTTOM), false);
  assert.equal(armRaised(RAISED), true);
});

test('the first command comes after the first few reps, and reps stop counting during it', () => {
  const l = liveness();
  const t = repUntilChallenge(l);
  assert.equal(l.snapshot(t).challengeId, 1);
  assert.equal(l.snapshot(t).kind, 'raise-arm');
  assert.equal(l.rep(t + 100), false, 'reps during a command do not count');
});

test('raising a hand and holding it passes the command; counting resumes', () => {
  const l = liveness();
  let t = repUntilChallenge(l);
  for (let i = 0; i < 20; i++) {
    t += DT;
    l.push(frame(RAISED, 160), t);
  }
  const s = l.snapshot(t);
  assert.equal(s.state, 'counting');
  assert.equal(s.passedId, 1);
  assert.equal(l.rep(t + 100), true);
});

test('a recording that keeps doing push-ups fails the command and stays blocked', () => {
  const l = liveness();
  let t = repUntilChallenge(l);
  const end = t + DEFAULT_LIVENESS.windowMs['raise-arm'] + 3000;
  while (t < end) {
    t += DT;
    const phase = Math.sin(t / 300);
    l.push(frame(phase > 0 ? PLANTED : BOTTOM, phase > 0 ? 165 : 80), t);
    l.rep(t);
  }
  const s = l.snapshot(t);
  assert.notEqual(s.state, 'counting');
  assert.equal(s.passedId, 0);
  assert.ok(s.challengeId >= 2, 'a fresh command follows a failed one');
  assert.equal(l.rep(t + 1), false);
});

test('freeze at the top: holding still passes, push-ups through it do not', () => {
  // Second command is the other kind: pass the first (raise), then face "hold-top".
  const l = liveness();
  let t = repUntilChallenge(l);
  for (let i = 0; i < 20; i++) l.push(frame(RAISED, 160), (t += DT));
  for (let i = 0; i < 100 && l.snapshot(t).state !== 'challenge'; i++) l.rep((t += 1000));
  assert.equal(l.snapshot(t).kind, 'hold-top');

  // Moving through the top doesn't fill it.
  for (let i = 0; i < 90; i++) {
    t += DT;
    const phase = Math.sin(t / 300);
    l.push(frame(PLANTED, 120 + 45 * phase, 0.05 * phase), t);
  }
  assert.equal(l.snapshot(t).passedId, 1, 'still the first pass only');

  // Holding still at the top does.
  for (let i = 0; i < 70; i++) l.push(frame(PLANTED, 165), (t += DT));
  assert.equal(l.snapshot(t).passedId, 2);
  assert.equal(l.snapshot(t).state, 'counting');
});

test('nobody in view during a command: the clock still runs out', () => {
  const l = liveness();
  let t = repUntilChallenge(l);
  const end = t + DEFAULT_LIVENESS.windowMs['raise-arm'] + 100;
  while (t < end) l.push(null, (t += DT));
  assert.equal(l.snapshot(t).state, 'blocked');
});

test('a suspicious picture brings the first command sooner', () => {
  const plain = new Liveness(DEFAULT_LIVENESS, () => 0.99);
  const flagged = new Liveness(DEFAULT_LIVENESS, () => 0.99);
  flagged.markSuspicious();
  let a = 0;
  let b = 0;
  while (plain.snapshot(0).state === 'counting') {
    plain.rep(0);
    a++;
  }
  while (flagged.snapshot(0).state === 'counting') {
    flagged.rep(0);
    b++;
  }
  assert.ok(b < a, `suspicious ${b} reps vs plain ${a}`);
  assert.ok(b <= DEFAULT_LIVENESS.firstAfterSuspicious[1]);
});
