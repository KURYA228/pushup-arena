/**
 * The way into the dev panel: five quick taps on the title on the home screen.
 */

export const TAPS = 5;
const TAP_WINDOW_MS = 1500;

const listeners = new Set<() => void>();

/** Counts quick taps; calls `onDone` on the fifth within the window, then starts over. */
export function tapCounter(onDone: () => void) {
  let count = 0;
  let at = 0;
  return () => {
    const now = Date.now();
    count = now - at > TAP_WINDOW_MS ? 1 : count + 1;
    at = now;
    if (count >= TAPS) {
      count = 0;
      onDone();
    }
  };
}

/** Opens the panel — from the title taps, and the DEV button that only exists in `npm run dev`. */
export function openDevPanel() {
  listeners.forEach((l) => l());
}

export function onDevPanelOpen(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
