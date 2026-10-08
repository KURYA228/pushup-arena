/**
 * The Speed Rush ghost: your record run, replayed beside the current one.
 *
 * A record is stored as the moment of each rep, in milliseconds from the start. Played back, it
 * says how many reps the record had at any point in the run — a pace to beat that you can see,
 * which is more of a race than a single number in the corner.
 */

/** Reps the ghost has made `elapsedMs` into the run. */
export function ghostAt(
  run: readonly number[] | null | undefined,
  bestReps: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (run && run.length) {
    let n = 0;
    for (const t of run) if (t <= elapsedMs) n++;
    return n;
  }
  // A record set before ghosts were recorded has no timeline — spread it evenly instead.
  if (bestReps <= 0) return 0;
  return Math.min(bestReps, Math.floor((bestReps * Math.max(0, elapsedMs)) / durationMs));
}

/** Kept short so the save stays small: offsets rounded to tenths of a second. */
export const packRun = (offsets: readonly number[]) => offsets.map((t) => Math.round(t / 100) * 100);
