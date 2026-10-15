import { useSyncExternalStore } from 'react';

/**
 * Switches for testing, set from the dev panel. Per device, in localStorage — they describe how
 * this phone is being tested, not anyone's progress, so they never go into the save or the cloud.
 */

const PLUS_COUNTS_KEY = 'arena.dev.plusCountsReps';
const SCREEN_METER_KEY = 'arena.dev.screenMeter';
const EVENT = 'arena-dev-flags';

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // No storage — the switch just won't stick.
  }
  window.dispatchEvent(new Event(EVENT));
}

const read = () => flag(PLUS_COUNTS_KEY);
const readScreenMeter = () => flag(SCREEN_METER_KEY);

/**
 * «+» counts as a real rep instead of a clicker tap — so bosses, XP and the shop can be tested
 * without doing every push-up on camera.
 */
export function setPlusCountsReps(on: boolean) {
  setFlag(PLUS_COUNTS_KEY, on);
}

/**
 * The screen detector's numbers under the camera (lib/screenTells.ts) — for setting its
 * thresholds from real runs. Only the readout: the detector itself is always on.
 */
export function setScreenMeter(on: boolean) {
  setFlag(SCREEN_METER_KEY, on);
}

export function useScreenMeter(): boolean {
  return useSyncExternalStore(subscribe, readScreenMeter, () => false);
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
