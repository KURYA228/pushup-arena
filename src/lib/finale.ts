/**
 * Whether the closing scene has played. On the device, like the intro's flag: it's "have you
 * seen this", not part of the save. The dev panel can put it back.
 */

const SEEN_KEY = 'arena.finaleSeen';

export function hasSeenFinale(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // No storage — better to skip it than replay it every time the arena opens.
    return true;
  }
}

export function markFinaleSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do; it just won't be remembered.
  }
}

export function forgetFinale() {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // Same.
  }
}
