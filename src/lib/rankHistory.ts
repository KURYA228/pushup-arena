/**
 * Remembers where everyone stood the last time the board was opened, so it can show who climbed
 * and who slipped. Kept on the device on purpose: "since you last looked" is a per-device notion,
 * and it costs the server nothing.
 */

const KEY = 'arena.lastRanks';

type Ranks = Record<string, number>;

export function readRanks(): Ranks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Ranks) : {};
  } catch {
    return {};
  }
}

export function saveRanks(idsInOrder: string[]) {
  try {
    const next: Ranks = {};
    idsInOrder.forEach((id, i) => {
      next[id] = i + 1;
    });
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // No storage: the board simply shows no movement arrows.
  }
}

/**
 * Positive means the player moved up. `null` covers both newcomers and an unchanged position —
 * neither deserves an arrow.
 */
export function movement(previous: Ranks, id: string, rank: number): number | null {
  const before = previous[id];
  if (!before || before === rank) return null;
  return before - rank;
}
