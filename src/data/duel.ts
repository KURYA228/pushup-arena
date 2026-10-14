/**
 * 1 на 1: a minute of push-ups against another player's recorded best Rush.
 *
 * The opponent isn't there — their record is: the moment each rep of their best minute landed,
 * replayed as a ghost on the track beside you. Beat their count and you win. Ratings are Elo,
 * everyone starting at DUEL_START; only the challenger's rating moves, since the other side never
 * actually played (and the database won't let one player write to another's row anyway).
 */

export const DUEL_START = 1000;
/** How far one duel can move a rating. 32 is the classic chess-club figure — lively but not wild. */
export const DUEL_K = 32;

export type DuelOutcome = 'win' | 'loss' | 'draw';

/** Who won: more reps than their record wins, the same is a draw. */
export function duelOutcome(mine: number, theirs: number): DuelOutcome {
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
}

/** The chance Elo gives `mine` of beating `theirs`, 0..1. */
export function expectedScore(mine: number, theirs: number): number {
  return 1 / (1 + 10 ** ((theirs - mine) / 400));
}

/** How many points a duel's outcome moves `mine` by — positive, negative, or zero. */
export function ratingDelta(mine: number, theirs: number, outcome: DuelOutcome, k = DUEL_K): number {
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  return Math.round(k * (score - expectedScore(mine, theirs)));
}

/** Someone who can be challenged: their record and their rating. */
export interface DuelCandidate {
  id: string;
  rating: number;
  rushBest: number;
}

/**
 * Picks an opponent near `rating`: one of the few closest players with a record, at random, so
 * the same person doesn't come up every time. `exclude` keeps out yourself and anyone just met.
 */
export function pickOpponent<T extends DuelCandidate>(
  candidates: readonly T[],
  rating: number,
  exclude: ReadonlySet<string> = new Set(),
  pool = 5,
  random: () => number = Math.random,
): T | null {
  const open = candidates.filter((c) => c.rushBest > 0 && !exclude.has(c.id));
  if (!open.length) return null;
  const nearest = [...open].sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating)).slice(0, pool);
  return nearest[Math.floor(random() * nearest.length)];
}

/**
 * The sparring partner, for when there's nobody to challenge yet: a record of `reps` reps spread
 * across the minute with a little unevenness, quicker at the start and tiring towards the end the
 * way a real minute goes. Unrated — beating a robot shouldn't move anyone up the table.
 */
export function sparringRun(reps: number, durationMs = 60000, random: () => number = Math.random): number[] {
  const out: number[] = [];
  for (let i = 0; i < reps; i += 1) {
    // Front-loaded: reps come faster early on.
    const t = Math.pow((i + 0.5) / reps, 1.15);
    const jitter = (random() - 0.5) * (durationMs / reps) * 0.4;
    out.push(Math.round(Math.max(0, Math.min(durationMs - 100, t * durationMs + jitter)) / 100) * 100);
  }
  return out.sort((a, b) => a - b);
}

/** Rated duels a day against any one opponent — past that, beating the same record again is farming. */
export const DUEL_DAILY_LIMIT = 5;

/** Today's rated duels, by opponent id. Kept in the save; a new day starts it again. */
export interface DuelDay {
  /** The local day (YYYY-MM-DD) the counts are for. */
  day: string;
  vs: Record<string, number>;
}

/** How many rated duels against `id` have been played on `day`. */
export function duelsToday(log: DuelDay | undefined, day: string, id: string): number {
  return log?.day === day ? (log.vs[id] ?? 0) : 0;
}

/** Whether `id` can still be challenged for rating on `day`. */
export function canDuel(log: DuelDay | undefined, day: string, id: string, limit = DUEL_DAILY_LIMIT): boolean {
  return duelsToday(log, day, id) < limit;
}

/** Everyone met `limit` times on `day` — kept out of matchmaking until tomorrow. */
export function exhaustedToday(log: DuelDay | undefined, day: string, limit = DUEL_DAILY_LIMIT): Set<string> {
  if (log?.day !== day) return new Set();
  return new Set(Object.entries(log.vs).filter(([, n]) => n >= limit).map(([id]) => id));
}

/** The log with one more duel against `id` on `day`; yesterday's counts are dropped. */
export function logDuel(log: DuelDay | undefined, day: string, id: string): DuelDay {
  const vs = log?.day === day ? { ...log.vs } : {};
  vs[id] = (vs[id] ?? 0) + 1;
  return { day, vs };
}
