import { describe, expect, it } from 'vitest';
import {
  clearAllData,
  clearCache,
  inspectLocalData,
  localDataTables,
  type DeletedTableCounts,
  type LocalDataDatabase,
  type LocalDataStorage,
  type LocalDataTable,
  type TableDataInspections,
} from './dataAdministration';

function emptyRecords(): Record<LocalDataTable, unknown[]> {
  return {
    bets: [],
    analyses: [],
    cachedMatches: [],
    cachedTeamMatches: [],
    cachedTeams: [],
    cachedHeroes: [],
    cachedHeroMatchups: [],
    cachedHeroDurations: [],
  };
}

function emptyDeletedCounts(): DeletedTableCounts {
  return {
    bets: 0,
    analyses: 0,
    cachedMatches: 0,
    cachedTeamMatches: 0,
    cachedTeams: 0,
    cachedHeroes: 0,
    cachedHeroMatchups: 0,
    cachedHeroDurations: 0,
  };
}

class MemoryLocalDataDatabase implements LocalDataDatabase {
  readonly records = emptyRecords();
  failClear = false;

  async inspectTables(): Promise<TableDataInspections> {
    return {
      bets: { count: this.records.bets.length, estimatedBytes: JSON.stringify(this.records.bets).length * 2 },
      analyses: { count: this.records.analyses.length, estimatedBytes: JSON.stringify(this.records.analyses).length * 2 },
      cachedMatches: { count: this.records.cachedMatches.length, estimatedBytes: JSON.stringify(this.records.cachedMatches).length * 2 },
      cachedTeamMatches: { count: this.records.cachedTeamMatches.length, estimatedBytes: JSON.stringify(this.records.cachedTeamMatches).length * 2 },
      cachedTeams: { count: this.records.cachedTeams.length, estimatedBytes: JSON.stringify(this.records.cachedTeams).length * 2 },
      cachedHeroes: { count: this.records.cachedHeroes.length, estimatedBytes: JSON.stringify(this.records.cachedHeroes).length * 2 },
      cachedHeroMatchups: { count: this.records.cachedHeroMatchups.length, estimatedBytes: JSON.stringify(this.records.cachedHeroMatchups).length * 2 },
      cachedHeroDurations: { count: this.records.cachedHeroDurations.length, estimatedBytes: JSON.stringify(this.records.cachedHeroDurations).length * 2 },
    };
  }

  async clearTables(tables: readonly LocalDataTable[]): Promise<DeletedTableCounts> {
    if (this.failClear) throw new Error('transaction failed');
    const deleted = emptyDeletedCounts();
    tables.forEach((table) => {
      deleted[table] = this.records[table].length;
      this.records[table] = [];
    });
    return deleted;
  }
}

class MemoryLocalDataStorage implements LocalDataStorage {
  readonly values = new Map<string, string>();
  readonly removed: string[] = [];

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.removed.push(key);
    this.values.delete(key);
  }
}

function populatedDatabase(): MemoryLocalDataDatabase {
  const database = new MemoryLocalDataDatabase();
  database.records.bets.push({ id: 'bet-1' }, { id: 'bet-2' });
  database.records.analyses.push({ id: 'analysis-1' });
  database.records.cachedTeams.push({ key: 'teams' });
  database.records.cachedMatches.push({ key: 'match:1' }, { key: 'match:2' });
  return database;
}

describe('local data administration', () => {
  it('reports exact table/category counts without exposing the API key or unrelated storage', async () => {
    const database = populatedDatabase();
    const storage = new MemoryLocalDataStorage();
    storage.values.set('dota-pulse-settings:v1', JSON.stringify({ state: { apiKey: 'top-secret' } }));
    storage.values.set('dota-pulse-bets:v2', JSON.stringify({ state: { bets: [] } }));
    storage.values.set('unrelated-app', 'must-stay-private');

    const inspection = await inspectLocalData({ database, storage });
    expect(inspection.tables.bets.count).toBe(2);
    expect(inspection.tables.analyses.count).toBe(1);
    expect(inspection.categories.cache.count).toBe(3);
    expect(inspection.categories.settings.count).toBe(1);
    expect(inspection.categories.legacyBets.count).toBe(1);
    expect(inspection.total.count).toBe(8);
    expect(inspection.total.estimatedBytes).toBeGreaterThan(0);
    expect(inspection.localStorage.presentKeys).toEqual([
      'dota-pulse-settings:v1',
      'dota-pulse-bets:v2',
    ]);
    expect(JSON.stringify(inspection)).not.toContain('top-secret');
    expect(JSON.stringify(inspection)).not.toContain('must-stay-private');
  });

  it('clears every explicit Dexie table before removing exact owned localStorage keys', async () => {
    const database = populatedDatabase();
    const storage = new MemoryLocalDataStorage();
    storage.values.set('dota-pulse-settings:v1', 'settings');
    storage.values.set('dota-pulse-bets:v1', 'legacy-v1');
    storage.values.set('dota-pulse-bets:v2', 'legacy-v2');
    storage.values.set('unrelated-app', 'keep');

    const result = await clearAllData({ database, storage });
    expect(result.deletedTables).toMatchObject({ bets: 2, analyses: 1, cachedMatches: 2, cachedTeams: 1 });
    expect(result.totalDeletedRecords).toBe(6);
    expect(result.deletedLocalStorageKeys).toEqual([
      'dota-pulse-settings:v1',
      'dota-pulse-bets:v1',
      'dota-pulse-bets:v2',
    ]);
    expect(storage.values.get('unrelated-app')).toBe('keep');
    expect(localDataTables.every((table) => database.records[table].length === 0)).toBe(true);
  });

  it('does not remove settings or claim success when the database transaction fails', async () => {
    const database = populatedDatabase();
    database.failClear = true;
    const storage = new MemoryLocalDataStorage();
    storage.values.set('dota-pulse-settings:v1', 'settings');

    await expect(clearAllData({ database, storage })).rejects.toThrow('transaction failed');
    expect(storage.removed).toEqual([]);
    expect(storage.values.get('dota-pulse-settings:v1')).toBe('settings');
    expect(database.records.bets).toHaveLength(2);
  });

  it('clears cache only and preserves bets, analyses and settings', async () => {
    const database = populatedDatabase();
    const storage = new MemoryLocalDataStorage();
    storage.values.set('dota-pulse-settings:v1', 'settings');

    const deleted = await clearCache({ database });
    expect(deleted).toMatchObject({ cachedMatches: 2, cachedTeams: 1, bets: 0, analyses: 0 });
    expect(database.records.bets).toHaveLength(2);
    expect(database.records.analyses).toHaveLength(1);
    expect(database.records.cachedMatches).toEqual([]);
    expect(database.records.cachedTeams).toEqual([]);
    expect(storage.values.get('dota-pulse-settings:v1')).toBe('settings');
  });
});
