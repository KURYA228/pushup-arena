/**
 * The way into the dev panel, in two steps so it can't be stumbled on: five quick taps on the
 * title on the home screen, then — within a minute — five quick taps on an invisible patch under
 * "Начать Rush". The first step gives nothing away; only the second opens anything.
 *
 * Kept in memory, not storage: a reload forgets a half-done unlock, which is the point.
 */

export const TAPS = 5;
const TAP_WINDOW_MS = 1500;
const ARM_WINDOW_MS = 60_000;

let armedAt = 0;
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

/** Step one. */
export function armDevGate() {
  armedAt = Date.now();
}

/** Step two: opens the panel only if step one happened recently. */
export function tryOpenDevPanel() {
  if (Date.now() - armedAt > ARM_WINDOW_MS) return;
  armedAt = 0;
  openDevPanel();
}

/** Opens it outright — for the DEV button that only exists in `npm run dev`. */
export function openDevPanel() {
  listeners.forEach((l) => l());
}

export function onDevPanelOpen(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
