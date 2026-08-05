import Dexie, { type EntityTable } from 'dexie';
import type { ProfileRecord } from '../types';

class ArenaDB extends Dexie {
  profile!: EntityTable<ProfileRecord, 'id'>;

  constructor() {
    super('pushup-arena-db');
    this.version(1).stores({
      // Single-row table: we only ever store one profile locally (id = PROFILE_ID).
      profile: 'id',
    });
  }
}

export const db = new ArenaDB();
export const PROFILE_ID = 1;
