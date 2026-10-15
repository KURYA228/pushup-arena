/**
 * What the game does when the camera seems to be filming a screen (lib/screenTells.ts) instead of
 * a person: stops counting, and takes back what it counted just before it noticed.
 *
 * Always on — there is no switch. Strict on purpose: a video of someone else's push-ups is the
 * one way to fill the leaderboard without doing anything, and the price is that an honest player
 * in an odd setting (far from the phone, a bright window behind) can trip it too. They see why on
 * the screen and can move; a cheat can't make a video stop looking like a video.
 *
 * Free of React and the DOM, so it can be tested on its own.
 */

export interface GuardTuning {
  /** Screen score (lib/screenTells.ts `screenScore`) in one look that makes it a "screen" look. */
  tellsPerLook: number;
  /** This many screen looks among the last `window` looks: stop counting. */
  engageLooks: number;
  window: number;
  /** Clean looks in a row before counting resumes… */
  releaseLooks: number;
  /** …and never sooner than this after it stopped. */
  minBlockMs: number;
  /** Reps counted this long before the stop are taken back — the video was playing then too. */
  revokeMs: number;
}

export const DEFAULT_GUARD: GuardTuning = {
  tellsPerLook: 2,
  engageLooks: 2,
  window: 3,
  releaseLooks: 6,
  minBlockMs: 5000,
  revokeMs: 20_000,
};

export interface GuardSnapshot {
  blocked: boolean;
  /** Bumped every time counting stops; `revoked` reps are to be taken back, once per bump. */
  blockId: number;
  /** How many counted reps the last stop takes back. */
  revoked: number;
}

export class ScreenGuard {
  private tuning: GuardTuning;
  private looks: boolean[] = [];
  private blocked = false;
  private blockedAt = 0;
  private clean = 0;
  private reps: number[] = [];
  private blockId = 0;
  private revoked = 0;

  constructor(tuning: GuardTuning = DEFAULT_GUARD) {
    this.tuning = tuning;
  }

  /** One look at the frame: its screen score (`screenScore`). */
  look(tells: number, now: number) {
    const screen = tells >= this.tuning.tellsPerLook;
    this.looks.push(screen);
    if (this.looks.length > this.tuning.window) this.looks.shift();

    if (this.blocked) {
      this.clean = screen ? 0 : this.clean + 1;
      if (this.clean >= this.tuning.releaseLooks && now - this.blockedAt >= this.tuning.minBlockMs) {
        this.blocked = false;
        this.looks = [];
      }
      return;
    }

    if (this.looks.filter(Boolean).length >= this.tuning.engageLooks) {
      this.blocked = true;
      this.blockedAt = now;
      this.clean = 0;
      this.reps = this.reps.filter((t) => now - t <= this.tuning.revokeMs);
      this.revoked = this.reps.length;
      this.reps = [];
      this.blockId += 1;
    }
  }

  /** The detector counted a rep: does it count? */
  rep(now: number): boolean {
    if (this.blocked) return false;
    this.reps.push(now);
    // Only the recent ones can ever be taken back.
    while (this.reps.length && now - this.reps[0] > this.tuning.revokeMs) this.reps.shift();
    return true;
  }

  snapshot(): GuardSnapshot {
    return { blocked: this.blocked, blockId: this.blockId, revoked: this.revoked };
  }
}
