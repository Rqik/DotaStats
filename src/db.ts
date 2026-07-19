import Dexie, { type EntityTable } from 'dexie';

export interface SavedAnalysis {
  id: string;
  createdAt: string;
  title: string;
  mode: 'handicap' | 'draft' | 'match';
  payload: unknown;
}

export interface CachedMatch {
  matchId: string;
  savedAt: string;
  payload: unknown;
}

export const db = new Dexie('dota-pulse') as Dexie & {
  analyses: EntityTable<SavedAnalysis, 'id'>;
  cachedMatches: EntityTable<CachedMatch, 'matchId'>;
};

db.version(1).stores({
  analyses: 'id, createdAt, mode',
  cachedMatches: 'matchId, savedAt',
});
