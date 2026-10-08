import { useSyncExternalStore } from 'react';

/**
 * Switches for testing, set from the dev panel. Per device, in localStorage — they describe how
 * this phone is being tested, not anyone's progress, so they never go into the save or the cloud.
 */

const PLUS_COUNTS_KEY = 'arena.dev.plusCountsReps';
const EVENT = 'arena-dev-flags';

function read(): boolean {
  try {
    return localStorage.getItem(PLUS_COUNTS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * «+» counts as a real rep instead of a clicker tap — so bosses, XP and the shop can be tested
 * without doing every push-up on camera.
 */
export function setPlusCountsReps(on: boolean) {
  try {
    if (on) localStorage.setItem(PLUS_COUNTS_KEY, '1');
    else localStorage.removeItem(PLUS_COUNTS_KEY);
  } catch {
    // No storage — the switch just won't stick.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function usePlusCountsReps(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
