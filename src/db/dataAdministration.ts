import { OPEN_DOTA_SETTINGS_STORAGE_KEY } from '../api/settingsProvider';
import { db, type DotaPulseDatabase } from '../db';
import { cacheBuckets } from './cacheRepository';

export const localDataTables = [
  'bets',
  'analyses',
  ...cacheBuckets,
] as const;

export type LocalDataTable = (typeof localDataTables)[number];

export const ownedLocalStorageKeys = [
  OPEN_DOTA_SETTINGS_STORAGE_KEY,
  'dota-pulse-bets:v1',
  'dota-pulse-bets:v2',
] as const;

export interface TableDataInspection {
  count: number;
  estimatedBytes: number;
}

export type TableDataInspections = Record<LocalDataTable, TableDataInspection>;
export type DeletedTableCounts = Record<LocalDataTable, number>;

export interface DataCategoryInspection {
  count: number;
  estimatedBytes: number;
}

export interface LocalDataInspection {
  tables: TableDataInspections;
  categories: {
    bets: DataCategoryInspection;
    analyses: DataCategoryInspection;
    cache: DataCategoryInspection;
    settings: DataCategoryInspection;
    legacyBets: DataCategoryInspection;
  };
  localStorage: {
    presentKeys: string[];
    estimatedBytes: number;
  };
  total: DataCategoryInspection;
}

export interface ClearDataResult {
  deletedTables: DeletedTableCounts;
  deletedLocalStorageKeys: string[];
  totalDeletedRecords: number;
}

export interface LocalDataDatabase {
  inspectTables: (tables: readonly LocalDataTable[]) => Promise<TableDataInspections>;
  clearTables: (tables: readonly LocalDataTable[]) => Promise<DeletedTableCounts>;
}

export interface LocalDataStorage {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
}

export interface DataAdministrationOptions {
  database?: LocalDataDatabase;
  storage?: LocalDataStorage;
}

function emptyCounts(): DeletedTableCounts {
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

function emptyInspections(): TableDataInspections {
  return {
    bets: { count: 0, estimatedBytes: 0 },
    analyses: { count: 0, estimatedBytes: 0 },
    cachedMatches: { count: 0, estimatedBytes: 0 },
    cachedTeamMatches: { count: 0, estimatedBytes: 0 },
    cachedTeams: { count: 0, estimatedBytes: 0 },
    cachedHeroes: { count: 0, estimatedBytes: 0 },
    cachedHeroMatchups: { count: 0, estimatedBytes: 0 },
    cachedHeroDurations: { count: 0, estimatedBytes: 0 },
  };
}

function estimatedBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return serialized ? serialized.length * 2 : 0;
  } catch {
    return 0;
  }
}

function sumCategories(items: readonly DataCategoryInspection[]): DataCategoryInspection {
  return items.reduce((total, item) => ({
    count: total.count + item.count,
    estimatedBytes: total.estimatedBytes + item.estimatedBytes,
  }), { count: 0, estimatedBytes: 0 });
}

function browserStorage(): LocalDataStorage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

export class DexieLocalDataDatabase implements LocalDataDatabase {
  private readonly database: DotaPulseDatabase;

  constructor(database: DotaPulseDatabase = db) {
    this.database = database;
  }

  async inspectTables(tables: readonly LocalDataTable[]): Promise<TableDataInspections> {
    const result = emptyInspections();
    for (const tableName of tables) {
      const records = await this.database.table(tableName).toArray();
      result[tableName] = {
        count: records.length,
        estimatedBytes: estimatedBytes(records),
      };
    }
    return result;
  }

  async clearTables(tables: readonly LocalDataTable[]): Promise<DeletedTableCounts> {
    const result = emptyCounts();
    const dexieTables = tables.map((tableName) => this.database.table(tableName));
    await this.database.transaction('rw', dexieTables, async () => {
      for (const tableName of tables) {
        const table = this.database.table(tableName);
        result[tableName] = await table.count();
        await table.clear();
      }
    });
    return result;
  }
}

function inspectStorage(storage: LocalDataStorage | undefined): {
  presentKeys: string[];
  bytesByKey: Map<string, number>;
} {
  const presentKeys: string[] = [];
  const bytesByKey = new Map<string, number>();
  if (!storage) return { presentKeys, bytesByKey };
  ownedLocalStorageKeys.forEach((key) => {
    const value = storage.getItem(key);
    if (value !== null) {
      presentKeys.push(key);
      bytesByKey.set(key, (key.length + value.length) * 2);
    }
  });
  return { presentKeys, bytesByKey };
}

export async function inspectLocalData(options: DataAdministrationOptions = {}): Promise<LocalDataInspection> {
  const database = options.database ?? new DexieLocalDataDatabase();
  const storage = options.storage ?? browserStorage();
  const tables = await database.inspectTables(localDataTables);
  const local = inspectStorage(storage);
  const cache = sumCategories(cacheBuckets.map((table) => tables[table]));
  const settings: DataCategoryInspection = {
    count: local.presentKeys.includes(OPEN_DOTA_SETTINGS_STORAGE_KEY) ? 1 : 0,
    estimatedBytes: local.bytesByKey.get(OPEN_DOTA_SETTINGS_STORAGE_KEY) ?? 0,
  };
  const legacyBetKeys = ['dota-pulse-bets:v1', 'dota-pulse-bets:v2'];
  const legacyBets: DataCategoryInspection = {
    count: legacyBetKeys.filter((key) => local.presentKeys.includes(key)).length,
    estimatedBytes: legacyBetKeys.reduce((total, key) => total + (local.bytesByKey.get(key) ?? 0), 0),
  };
  const categories = {
    bets: tables.bets,
    analyses: tables.analyses,
    cache,
    settings,
    legacyBets,
  };
  return {
    tables,
    categories,
    localStorage: {
      presentKeys: local.presentKeys,
      estimatedBytes: settings.estimatedBytes + legacyBets.estimatedBytes,
    },
    total: sumCategories(Object.values(categories)),
  };
}

export async function clearAllData(options: DataAdministrationOptions = {}): Promise<ClearDataResult> {
  const database = options.database ?? new DexieLocalDataDatabase();
  const storage = options.storage ?? browserStorage();
  const deletedTables = await database.clearTables(localDataTables);
  const deletedLocalStorageKeys: string[] = [];
  if (storage) {
    for (const key of ownedLocalStorageKeys) {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        deletedLocalStorageKeys.push(key);
      }
    }
  }
  return {
    deletedTables,
    deletedLocalStorageKeys,
    totalDeletedRecords: Object.values(deletedTables).reduce((sum, count) => sum + count, 0),
  };
}

export async function clearCache(options: Pick<DataAdministrationOptions, 'database'> = {}): Promise<DeletedTableCounts> {
  const database = options.database ?? new DexieLocalDataDatabase();
  return database.clearTables(cacheBuckets);
}
