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
