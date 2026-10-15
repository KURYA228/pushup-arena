/**
 * Proof that the push-ups in front of the camera are being done by the person playing.
 *
 * Pointing the camera at a video of someone else's push-ups passes every test the rep detector
 * has: they *are* real push-ups, just not yours. Nothing in a single frame tells a recording on a
 * screen from a body in the room reliably — so instead the game asks for something a recording
 * can't know is coming. At a random rep it calls out a command ("raise a hand", "freeze at the
 * top") and gives a few seconds to do it. A live player does it without thinking; a video just
 * keeps going.
 *
 * Until the command is done, reps don't count. Failing it doesn't take back reps already landed —
 * they've hit the boss by then — but nothing more counts until a fresh command is passed, so a
 * video gets a handful of reps at most and then stalls.
 *
 * Indirect hints that the picture is a screen (see `screenHints` in usePoseDetection) only make
 * the commands come sooner and more often. They never block anything on their own: they misfire
 * in dim rooms and under gym lights, and a false accusation costs an honest player more than a
 * cheat costs the board.
 *
 * Free of React and MediaPipe, like the rep detector, so it can be tested on its own.
 */

import type { Vec2 } from './repDetector';

export type ChallengeKind = 'raise-arm' | 'hold-top';

/** What a command asks for, in the words it's announced with. */
export const CHALLENGE_TEXT: Record<ChallengeKind, string> = {
  'raise-arm': 'Подними руку!',
  'hold-top': 'Замри наверху!',
};

/** One arm as the camera sees it, in aspect-corrected image space (y grows downwards). */
export interface LivenessArm {
  shoulder: Vec2;
  elbow: Vec2;
  wrist: Vec2;
}

export interface LivenessFrame {
  /** Elbow angle in degrees (the detector's, from 3D landmarks), or null when the arms are hidden. */
  angle: number | null;
  /** The arms visible confidently enough to judge; empty when none are. */
  arms: LivenessArm[];
  /** Body reference length in the same units as the points (see PoseSample.scale). */
  scale: number;
}

export type LivenessState = 'counting' | 'challenge' | 'blocked';

export interface LivenessSnapshot {
  state: LivenessState;
  /** The command being asked for, while there is one. */
  kind: ChallengeKind | null;
  /** Seconds left to do it. */
  secondsLeft: number;
  /** How far through the command is (0..1) — "freeze" fills up while you hold still. */
  progress: number;
  /** Bumped on every new command, so the UI can announce each one exactly once. */
  challengeId: number;
  /** Bumped on every passed command, for a "done" cue. */
  passedId: number;
  /** The picture looked like a screen at some point this session. */
  suspicious: boolean;
}

export interface LivenessTuning {
  /** The first command comes after a random number of reps in this range. */
  firstAfter: [number, number];
  /** Then after this many more. */
  every: [number, number];
  /** Both, when the picture looks like a screen. */
  firstAfterSuspicious: [number, number];
  everySuspicious: [number, number];
  /** Time to do a command, including the moment it takes to say it. */
  windowMs: Record<ChallengeKind, number>;
  /** After a failed command, a short breath before the next one. */
  retryPauseMs: number;
  /** A raised hand has to be held this long — a flick of a wrist mid-rep isn't one. */
  raiseHoldMs: number;
  /** Holding still at the top for this long passes "freeze". */
  holdMs: number;
  /** "At the top": elbow at least this straight. */
  holdMinAngle: number;
  /** "Still": the elbow angle varies less than this over the hold, in degrees… */
  holdMaxAngleSwing: number;
  /** …and the shoulder drifts less than this many body lengths. */
  holdMaxDrift: number;
}

export const DEFAULT_LIVENESS: LivenessTuning = {
  firstAfter: [5, 12],
  every: [10, 20],
  firstAfterSuspicious: [2, 5],
  everySuspicious: [3, 6],
  windowMs: { 'raise-arm': 5000, 'hold-top': 6500 },
  retryPauseMs: 1500,
  raiseHoldMs: 400,
  holdMs: 2000,
  holdMinAngle: 140,
  holdMaxAngleSwing: 12,
  holdMaxDrift: 0.08,
};

/** Interior angle at `b`, in degrees, from 2D points. */
function angle2d(a: Vec2, b: Vec2, c: Vec2): number {
  const v1 = Math.atan2(a.y - b.y, a.x - b.x);
  const v2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(((v1 - v2) * 180) / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A hand off the floor. In a plank the wrist sits an arm's length below the shoulder; raised —
 * forward, up or out to the side — it comes up level with the shoulder or higher, with the arm
 * straight. The straight-arm part is what keeps the bottom of a deep push-up, where the shoulder
 * sinks down towards the hands, from passing for a raised hand.
 */
export function armRaised(arm: LivenessArm): boolean {
  const len = dist(arm.shoulder, arm.elbow) + dist(arm.elbow, arm.wrist);
  if (len === 0) return false;
  const straight = angle2d(arm.shoulder, arm.elbow, arm.wrist) >= 130;
  const up = arm.wrist.y - arm.shoulder.y < 0.35 * len;
  return straight && up;
}

interface HoldPoint {
  t: number;
  angle: number;
  x: number;
  y: number;
}

export class Liveness {
  private tuning: LivenessTuning;
  private random: () => number;

  private state: LivenessState = 'counting';
  private kind: ChallengeKind | null = null;
  private deadline = 0;
  private blockedUntil = 0;
  private repsUntilNext: number;
  private first = true;
  private suspicious = false;
  private lastKind: ChallengeKind | null = null;
  private challengeId = 0;
  private passedId = 0;
  private progress = 0;

  private raisedSince: number | null = null;
  private hold: HoldPoint[] = [];

  constructor(tuning: LivenessTuning = DEFAULT_LIVENESS, random: () => number = Math.random) {
    this.tuning = tuning;
    this.random = random;
    this.repsUntilNext = this.draw(tuning.firstAfter);
  }

  private draw([lo, hi]: [number, number]): number {
    return lo + Math.floor(this.random() * (hi - lo + 1));
  }

  /** Back to the start, as for a new session: the camera was turned off and on. */
  reset() {
    this.state = 'counting';
    this.kind = null;
    this.first = true;
    this.suspicious = false;
    this.progress = 0;
    this.raisedSince = null;
    this.hold = [];
    this.repsUntilNext = this.draw(this.tuning.firstAfter);
  }

  /**
   * The picture looks like a screen. Latches for the session, and pulls the next command closer
   * if it was further off than a suspicious schedule would put it.
   */
  markSuspicious() {
    if (this.suspicious) return;
    this.suspicious = true;
    const range = this.first ? this.tuning.firstAfterSuspicious : this.tuning.everySuspicious;
    this.repsUntilNext = Math.min(this.repsUntilNext, this.draw(range));
  }

  /**
   * The detector counted a rep. Returns whether it counts; may start a command, which then holds
   * every rep after it until it's done.
   */
  rep(now: number): boolean {
    if (this.state !== 'counting') return false;
    this.repsUntilNext -= 1;
    if (this.repsUntilNext <= 0) this.start(now);
    return true;
  }

  private start(now: number) {
    // Alternate, with a random first pick — a recording can't learn the order.
    const kind: ChallengeKind =
      this.lastKind == null ? (this.random() < 0.5 ? 'raise-arm' : 'hold-top') : this.lastKind === 'raise-arm' ? 'hold-top' : 'raise-arm';
    this.lastKind = kind;
    this.kind = kind;
    this.state = 'challenge';
    this.deadline = now + this.tuning.windowMs[kind];
    this.progress = 0;
    this.raisedSince = null;
    this.hold = [];
    this.challengeId += 1;
  }

  /** One camera frame, or null when nobody is in view. */
  push(frame: LivenessFrame | null, now: number) {
    if (this.state === 'blocked') {
      if (now >= this.blockedUntil) this.start(now);
      return;
    }
    if (this.state !== 'challenge' || !this.kind) return;

    if (frame) {
      if (this.kind === 'raise-arm') this.checkRaise(frame, now);
      else this.checkHold(frame, now);
    } else {
      this.raisedSince = null;
      this.hold = [];
      if (this.kind === 'hold-top') this.progress = 0;
    }
    if (this.state !== 'challenge') return;

    if (now >= this.deadline) {
      this.state = 'blocked';
      this.kind = null;
      this.progress = 0;
      this.blockedUntil = now + this.tuning.retryPauseMs;
    }
  }

  private checkRaise(frame: LivenessFrame, now: number) {
    if (frame.arms.some(armRaised)) {
      this.raisedSince ??= now;
      this.progress = Math.min(1, (now - this.raisedSince) / this.tuning.raiseHoldMs);
      if (now - this.raisedSince >= this.tuning.raiseHoldMs) this.pass();
    } else {
      this.raisedSince = null;
      this.progress = 0;
    }
  }

  private checkHold(frame: LivenessFrame, now: number) {
    const arm = frame.arms[0];
    if (frame.angle == null || frame.angle < this.tuning.holdMinAngle || !arm) {
      this.hold = [];
      this.progress = 0;
      return;
    }
    this.hold.push({ t: now, angle: frame.angle, x: arm.shoulder.x, y: arm.shoulder.y });
    // Still means still over the whole hold: any wobble starts it over.
    const first = this.hold[0];
    const angles = this.hold.map((p) => p.angle);
    const swing = Math.max(...angles) - Math.min(...angles);
    const drift = Math.max(...this.hold.map((p) => Math.hypot(p.x - first.x, p.y - first.y))) / Math.max(frame.scale, 1e-6);
    if (swing > this.tuning.holdMaxAngleSwing || drift > this.tuning.holdMaxDrift) {
      this.hold = [this.hold[this.hold.length - 1]];
      this.progress = 0;
      return;
    }
    const held = now - first.t;
    this.progress = Math.min(1, held / this.tuning.holdMs);
    if (held >= this.tuning.holdMs) this.pass();
  }

  private pass() {
    this.state = 'counting';
    this.kind = null;
    this.progress = 0;
    this.first = false;
    this.passedId += 1;
    this.repsUntilNext = this.draw(this.suspicious ? this.tuning.everySuspicious : this.tuning.every);
  }

  snapshot(now: number): LivenessSnapshot {
    return {
      state: this.state,
      kind: this.kind,
      secondsLeft: this.state === 'challenge' ? Math.max(0, Math.ceil((this.deadline - now) / 1000)) : 0,
      progress: this.progress,
      challengeId: this.challengeId,
      passedId: this.passedId,
      suspicious: this.suspicious,
    };
  }
}
