import { db, PROFILE_ID } from '../db/db';

/**
 * Whether the cold open has already played. Kept on the device: it's a "have you seen this"
 * flag, not part of the save, and it shouldn't follow the account onto someone else's phone.
 */

const SEEN_KEY = 'arena.introSeen';

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // No storage — better to skip the intro than replay it on every single launch.
    return true;
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do; the intro simply won't be remembered.
  }
}

export function forgetIntro() {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // Same.
  }
}


/* -------------------------- who you said you were -------------------------- */

const ABOUT_KEY = 'arena.introAbout';

export interface IntroAbout {
  nickname: string;
  age?: number;
}

/** Nicknames: the same rule the board holds names to. */
export const NICK_MIN = 2;
export const NICK_MAX = 24;
export const AGE_MIN = 5;
export const AGE_MAX = 100;

/**
 * What you told the host. Into the profile, so it travels with the save, and into local storage
 * too: the sign-up form reads it to fill in the board name, and on the very first launch the
 * profile row may not exist yet when the intro is answered.
 */
export async function saveIntroAbout(about: IntroAbout) {
  try {
    localStorage.setItem(ABOUT_KEY, JSON.stringify(about));
  } catch {
    // Private mode — the profile still gets it below.
  }
  try {
    await db.profile.update(PROFILE_ID, { nickname: about.nickname, age: about.age });
  } catch {
    // No profile row yet; local storage has it, and the sign-up form reads it from there.
  }
}

export function readIntroAbout(): IntroAbout | null {
  try {
    const raw = localStorage.getItem(ABOUT_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object' && typeof (v as IntroAbout).nickname === 'string') return v as IntroAbout;
  } catch {
    // Unreadable — as good as none.
  }
  return null;
}
