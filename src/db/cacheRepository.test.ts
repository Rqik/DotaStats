import { describe, expect, it } from 'vitest';
import { migrateLegacyCachedMatch, NEVER_EXPIRES_AT } from '../db';
import { MemoryCacheStore } from './cacheRepository';

describe('Dexie v2 cache contract', () => {
  it('normalizes a v1 cached match without changing its primary identifier or payload', () => {
    const payload = { match_id: 123, radiant_win: true };
    const migrated = migrateLegacyCachedMatch({
      matchId: '123',
      savedAt: '2026-08-08T12:00:00.000Z',
      payload,
    });

    expect(migrated).toEqual({
      matchId: '123',
      key: 'match:123',
      savedAt: Date.parse('2026-08-08T12:00:00.000Z'),
      expiresAt: NEVER_EXPIRES_AT,
      payload,
    });
  });

  it('preserves existing v2 cache metadata during an idempotent migration', () => {
    const migrated = migrateLegacyCachedMatch({
      matchId: '456',
      key: 'match:456',
      savedAt: 100,
      expiresAt: 200,
      payload: { match_id: 456 },
    });

    expect(migrated.savedAt).toBe(100);
    expect(migrated.expiresAt).toBe(200);
    expect(migrated.key).toBe('match:456');
  });

  it('clears every cache bucket and returns the number of removed records', async () => {
    const store = new MemoryCacheStore();
    await store.put('cachedTeams', { key: 'teams', payload: [], savedAt: 1, expiresAt: 2 });
    await store.put('cachedHeroes', { key: 'heroes', payload: [], savedAt: 1, expiresAt: 2 });
    await store.put('cachedMatches', { key: 'match:1', payload: {}, savedAt: 1, expiresAt: 2 });

    await expect(store.clear()).resolves.toBe(3);
    await expect(store.get('cachedTeams', 'teams')).resolves.toBeUndefined();
    await expect(store.get('cachedHeroes', 'heroes')).resolves.toBeUndefined();
    await expect(store.get('cachedMatches', 'match:1')).resolves.toBeUndefined();
  });
});
