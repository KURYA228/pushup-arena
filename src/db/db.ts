import Dexie, { type EntityTable } from 'dexie';
import type { ProfileRecord, RepLogEntry } from '../types';

class ArenaDB extends Dexie {
  profile!: EntityTable<ProfileRecord, 'id'>;
  reps!: EntityTable<RepLogEntry, 'id'>;

  constructor() {
    super('pushup-arena-db');
    this.version(1).stores({
      // Single-row table: we only ever store one profile locally (id = PROFILE_ID).
      profile: 'id',
    });
    // One row per counted rep, for the stats screen and the victory card. The profile only
    // keeps running totals, which can't answer "how many yesterday" or "how long did Мясник
    // take". Adding a table leaves existing data alone, so no upgrade function is needed.
    this.version(2).stores({
      profile: 'id',
      reps: '++id, at',
    });
  }
}

export const db = new ArenaDB();
export const PROFILE_ID = 1;
