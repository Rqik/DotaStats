import { db, type CacheRecord, type CachedMatchRecord, type DotaPulseDatabase } from '../db';

export const cacheBuckets = [
  'cachedMatches',
  'cachedTeamMatches',
  'cachedTeams',
  'cachedHeroes',
  'cachedHeroMatchups',
  'cachedHeroDurations',
] as const;

export type CacheBucket = (typeof cacheBuckets)[number];

export interface CacheStore {
  get: (bucket: CacheBucket, key: string) => Promise<CacheRecord | undefined>;
  put: (bucket: CacheBucket, record: CacheRecord) => Promise<void>;
  delete: (bucket: CacheBucket, key: string) => Promise<void>;
  clear: () => Promise<number>;
}

function matchIdFromCacheKey(key: string): string {
  return key.startsWith('match:') ? key.slice('match:'.length) : key;
}

export class DexieCacheStore implements CacheStore {
  private readonly database: DotaPulseDatabase;

  constructor(database: DotaPulseDatabase = db) {
    this.database = database;
  }

  async get(bucket: CacheBucket, key: string): Promise<CacheRecord | undefined> {
    if (bucket === 'cachedMatches') return this.database.cachedMatches.where('key').equals(key).first();
    return this.database.table<CacheRecord, string>(bucket).get(key);
  }

  async put(bucket: CacheBucket, record: CacheRecord): Promise<void> {
    if (bucket === 'cachedMatches') {
      const matchRecord: CachedMatchRecord = { ...record, matchId: matchIdFromCacheKey(record.key) };
      await this.database.cachedMatches.put(matchRecord);
      return;
    }
    await this.database.table<CacheRecord, string>(bucket).put(record);
  }

  async delete(bucket: CacheBucket, key: string): Promise<void> {
    if (bucket === 'cachedMatches') {
      const record = await this.database.cachedMatches.where('key').equals(key).first();
      if (record) await this.database.cachedMatches.delete(record.matchId);
      return;
    }
    await this.database.table<CacheRecord, string>(bucket).delete(key);
  }

  async clear(): Promise<number> {
    let deleted = 0;
    for (const bucket of cacheBuckets) {
      const table = this.database.table(bucket);
      deleted += await table.count();
      await table.clear();
    }
    return deleted;
  }
}

export class MemoryCacheStore implements CacheStore {
  private readonly buckets = new Map<CacheBucket, Map<string, CacheRecord>>();

  async get(bucket: CacheBucket, key: string): Promise<CacheRecord | undefined> {
    return this.buckets.get(bucket)?.get(key);
  }

  async put(bucket: CacheBucket, record: CacheRecord): Promise<void> {
    const records = this.buckets.get(bucket) ?? new Map<string, CacheRecord>();
    records.set(record.key, record);
    this.buckets.set(bucket, records);
  }

  async delete(bucket: CacheBucket, key: string): Promise<void> {
    this.buckets.get(bucket)?.delete(key);
  }

  async clear(): Promise<number> {
    let deleted = 0;
    for (const records of this.buckets.values()) deleted += records.size;
    this.buckets.clear();
    return deleted;
  }
}

export const dexieCacheStore = new DexieCacheStore();
