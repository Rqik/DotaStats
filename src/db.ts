import Dexie, { type EntityTable, type Transaction } from 'dexie';

export const NEVER_EXPIRES_AT = Number.MAX_SAFE_INTEGER;

export interface SavedAnalysis {
  id: string;
  createdAt: string;
  title: string;
  mode: 'handicap' | 'draft' | 'match';
  payload: unknown;
}

export type StoredBetResult = 'pending' | 'win' | 'loss' | 'refund';
export type StoredStakeType = 'cash' | 'freebet';

export interface StoredBet {
  id: string;
  date: string;
  tournament: string;
  match: string;
  selection: string;
  odds: number;
  stake: number;
  stakeType: StoredStakeType;
  result: StoredBetResult;
  profit: number;
  createdAt: number;
  updatedAt: number;
}

export interface CacheRecord<T = unknown> {
  key: string;
  payload: T;
  savedAt: number;
  expiresAt: number;
}

export interface CachedMatchRecord<T = unknown> extends CacheRecord<T> {
  matchId: string;
}

export interface LegacyCachedMatch {
  matchId: string;
  savedAt: string | number;
  payload: unknown;
  key?: string;
  expiresAt?: number;
}

function timestamp(value: string | number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function migrateLegacyCachedMatch(record: LegacyCachedMatch): CachedMatchRecord {
  return {
    matchId: record.matchId,
    key: record.key ?? `match:${record.matchId}`,
    payload: record.payload,
    savedAt: timestamp(record.savedAt),
    expiresAt: record.expiresAt ?? NEVER_EXPIRES_AT,
  };
}

async function upgradeToVersion2(transaction: Transaction): Promise<void> {
  await transaction.table<LegacyCachedMatch, string>('cachedMatches').toCollection().modify((record) => {
    Object.assign(record, migrateLegacyCachedMatch(record));
  });
}

export class DotaPulseDatabase extends Dexie {
  bets!: EntityTable<StoredBet, 'id'>;
  analyses!: EntityTable<SavedAnalysis, 'id'>;
  cachedMatches!: EntityTable<CachedMatchRecord, 'matchId'>;
  cachedTeamMatches!: EntityTable<CacheRecord, 'key'>;
  cachedTeams!: EntityTable<CacheRecord, 'key'>;
  cachedHeroes!: EntityTable<CacheRecord, 'key'>;
  cachedHeroMatchups!: EntityTable<CacheRecord, 'key'>;
  cachedHeroDurations!: EntityTable<CacheRecord, 'key'>;

  constructor(name = 'dota-pulse') {
    super(name);

    this.version(1).stores({
      analyses: 'id, createdAt, mode',
      cachedMatches: 'matchId, savedAt',
    });

    this.version(2).stores({
      bets: 'id, createdAt, updatedAt, result, stakeType',
      analyses: 'id, createdAt, mode',
      cachedMatches: 'matchId,&key,savedAt,expiresAt',
      cachedTeamMatches: 'key,savedAt,expiresAt',
      cachedTeams: 'key,savedAt,expiresAt',
      cachedHeroes: 'key,savedAt,expiresAt',
      cachedHeroMatchups: 'key,savedAt,expiresAt',
      cachedHeroDurations: 'key,savedAt,expiresAt',
    }).upgrade(upgradeToVersion2);
  }
}

export const db = new DotaPulseDatabase();
