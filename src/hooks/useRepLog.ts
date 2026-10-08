import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { RepLogEntry } from '../types';
import { SEASON } from '../lib/season';

const EMPTY: RepLogEntry[] = [];

/**
 * The rep log for the current season, oldest first. Live, so the stats screen and the victory
 * card follow undo and new reps without a reload. `undefined` while it's loading.
 */
export function useRepLog(): RepLogEntry[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.reps.orderBy('at').toArray();
    const current = rows.filter((r) => r.season === SEASON);
    return current.length ? current : EMPTY;
  }, []);
}
