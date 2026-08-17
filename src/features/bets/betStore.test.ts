import { describe, expect, it } from 'vitest';
import type { StoredBet } from '../../db';
import type { BetRepository } from '../../db/betRepository';
import {
  LEGACY_BET_STORAGE_KEY,
  createBetStore,
  initializeBetStore,
  loadAndMigrateBets,
  type LegacyBetStorage,
} from './betStore';

class MemoryBetRepository implements BetRepository {
  records: StoredBet[];
  listCalls = 0;
  listFailuresRemaining = 0;
  replaceCalls = 0;
  failPut = false;
  failReplace = false;

  constructor(records: StoredBet[] = []) {
    this.records = records.map((record) => ({ ...record }));
  }

  async list(): Promise<StoredBet[]> {
    this.listCalls += 1;
    if (this.listFailuresRemaining > 0) {
      this.listFailuresRemaining -= 1;
      throw new Error('list failed');
    }
    return this.records.map((record) => ({ ...record }));
  }

  async get(id: string): Promise<StoredBet | undefined> {
    const record = this.records.find((bet) => bet.id === id);
    return record ? { ...record } : undefined;
  }

  async put(bet: StoredBet): Promise<void> {
    if (this.failPut) throw new Error('put failed');
    const index = this.records.findIndex((record) => record.id === bet.id);
    if (index < 0) this.records.unshift({ ...bet });
    else this.records[index] = { ...bet };
  }

  async delete(id: string): Promise<void> {
    this.records = this.records.filter((record) => record.id !== id);
  }

  async replaceAll(bets: readonly StoredBet[]): Promise<void> {
    this.replaceCalls += 1;
    if (this.failReplace) throw new Error('replace failed');
    this.records = bets.map((record) => ({ ...record }));
  }
}

class MemoryLegacyStorage implements LegacyBetStorage {
  value: string | null;
  removed = false;

  constructor(value: string | null) {
    this.value = value;
  }

  getItem(key: string): string | null {
    expect(key).toBe(LEGACY_BET_STORAGE_KEY);
    return this.value;
  }

  removeItem(key: string): void {
    expect(key).toBe(LEGACY_BET_STORAGE_KEY);
    this.removed = true;
    this.value = null;
  }
}

function legacyPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    state: {
      bets: [{
        id: 'legacy-1',
        date: '2026-08-08',
        tournament: 'Legacy Cup',
        match: 'Team A — Team B',
        selection: 'Team A победа',
        odds: 2,
        stake: 100,
        result: 'loss',
        profit: 7_777,
        ...overrides,
      }],
    },
    version: 2,
  });
}

function draft() {
  return {
    date: '2026-08-09',
    tournament: 'Test Cup',
    match: 'Radiant — Dire',
    selection: 'Radiant победа',
    odds: 2,
    stake: 100,
    stakeType: 'cash' as const,
    result: 'pending' as const,
  };
}

function storedBet(id: string): StoredBet {
  return {
    id,
    ...draft(),
    profit: 0,
    createdAt: 100,
    updatedAt: 100,
  };
}

describe('legacy bet migration', () => {
  it('validates, adds stakeType, recalculates profit, writes atomically and only then removes legacy', async () => {
    const repository = new MemoryBetRepository();
    const storage = new MemoryLegacyStorage(legacyPayload());
    const result = await loadAndMigrateBets(repository, storage, () => 1_000);

    expect(result.error).toBeNull();
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      id: 'legacy-1',
      stakeType: 'cash',
      profit: -100,
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    expect(repository.replaceCalls).toBe(1);
    expect(storage.removed).toBe(true);
  });

  it('does not write or remove invalid legacy data', async () => {
    const repository = new MemoryBetRepository();
    const storage = new MemoryLegacyStorage(legacyPayload({ odds: 1 }));
    const result = await loadAndMigrateBets(repository, storage);

    expect(result.error).toContain('неверный формат');
    expect(repository.records).toEqual([]);
    expect(repository.replaceCalls).toBe(0);
    expect(storage.removed).toBe(false);
    expect(storage.value).not.toBeNull();
  });

  it('does not import a payload with a different persistence version', async () => {
    const repository = new MemoryBetRepository();
    const storage = new MemoryLegacyStorage(legacyPayload().replace('"version":2', '"version":1'));
    const result = await loadAndMigrateBets(repository, storage);

    expect(result.error).toContain('неверный формат');
    expect(repository.replaceCalls).toBe(0);
    expect(storage.removed).toBe(false);
  });

  it('does not promote untouched prototype seed bets into IndexedDB', async () => {
    const repository = new MemoryBetRepository();
    const storage = new MemoryLegacyStorage(JSON.stringify({
      state: {
        bets: [{
          id: 'bet-1',
          date: '18 июл., 21:30',
          tournament: 'Riyadh Masters',
          match: 'Team Spirit — Aurora',
          selection: 'Spirit −7.5 убийств',
          odds: 1.82,
          stake: 1200,
          stakeType: 'cash',
          result: 'win',
          profit: 984,
        }],
      },
      version: 2,
    }));
    const result = await loadAndMigrateBets(repository, storage, () => 1_000);

    expect(result).toEqual({ records: [], error: null });
    expect(repository.records).toEqual([]);
    expect(storage.removed).toBe(true);
  });

  it('keeps valid legacy data when the IndexedDB transaction fails', async () => {
    const repository = new MemoryBetRepository();
    repository.failReplace = true;
    const storage = new MemoryLegacyStorage(legacyPayload());

    await expect(loadAndMigrateBets(repository, storage)).rejects.toThrow('replace failed');
    expect(storage.removed).toBe(false);
  });
});

describe('IndexedDB-backed bet store', () => {
  it('hydrates an empty journal without adding seed bets and initializes once', async () => {
    const repository = new MemoryBetRepository();
    const store = createBetStore({ repository, legacyStorage: new MemoryLegacyStorage(null) });
    const first = initializeBetStore(store);
    const second = initializeBetStore(store);
    expect(first).toBe(second);
    await first;

    expect(store.getState()).toMatchObject({ bets: [], hydrated: true, loading: false, error: null });
  });

  it('writes create, update, settle and delete operations through to the repository', async () => {
    const repository = new MemoryBetRepository();
    let currentTime = 100;
    const store = createBetStore({
      repository,
      legacyStorage: new MemoryLegacyStorage(null),
      createId: () => 'created-1',
      now: () => currentTime,
    });
    await initializeBetStore(store);

    const creating = store.getState().createBet(draft());
    expect(store.getState().bets[0]?.id).toBe('created-1');
    await creating;
    expect(repository.records[0]).toMatchObject({ id: 'created-1', createdAt: 100, updatedAt: 100 });

    currentTime = 200;
    await store.getState().updateBet('created-1', { ...draft(), stake: 250, result: 'win' });
    expect(repository.records[0]).toMatchObject({ stake: 250, profit: 250, createdAt: 100, updatedAt: 200 });

    currentTime = 300;
    await store.getState().settleBet('created-1', 'loss');
    expect(repository.records[0]).toMatchObject({ result: 'loss', profit: -250, createdAt: 100, updatedAt: 300 });

    await store.getState().deleteBet('created-1');
    expect(repository.records).toEqual([]);
    expect(store.getState().bets).toEqual([]);
  });

  it('migrates optional metadata without dropping it', async () => {
    const repository = new MemoryBetRepository();
    const storage = new MemoryLegacyStorage(legacyPayload({
      teamA: 'Team A', teamB: 'Team B', market: 'kills', handicap: 5.5,
      bookmaker: 'Example', comment: 'note', analysisId: 'analysis-1',
    }));
    const result = await loadAndMigrateBets(repository, storage, () => 1_000);

    expect(result.error).toBeNull();
    expect(result.records[0]).toMatchObject({
      teamA: 'Team A', teamB: 'Team B', market: 'kills', handicap: 5.5,
      bookmaker: 'Example', comment: 'note', analysisId: 'analysis-1',
    });
  });

  it('preserves metadata through create, reload and settlement', async () => {
    const repository = new MemoryBetRepository();
    const store = createBetStore({
      repository,
      legacyStorage: new MemoryLegacyStorage(null),
      createId: () => 'metadata-1',
      now: () => 100,
    });
    await initializeBetStore(store);
    const metadata = {
      teamA: 'Team A', teamB: 'Team B', market: 'kills', handicap: 5.5,
      bookmaker: 'Example', comment: 'note', analysisId: 'analysis-1',
    };
    await store.getState().createBet({ ...draft(), ...metadata });
    expect(repository.records[0]).toMatchObject(metadata);
    await store.getState().settleBet('metadata-1', 'win');
    expect(repository.records[0]).toMatchObject({ ...metadata, result: 'win' });

    const reloaded = createBetStore({ repository, legacyStorage: new MemoryLegacyStorage(null) });
    await initializeBetStore(reloaded);
    expect(reloaded.getState().bets[0]).toMatchObject(metadata);
  });

  it('atomically replaces persisted bets and recalculates imported profit', async () => {
    const repository = new MemoryBetRepository();
    const store = createBetStore({
      repository,
      legacyStorage: new MemoryLegacyStorage(null),
      now: () => 450,
    });
    await initializeBetStore(store);
    await store.getState().replaceBets([{
      id: 'imported-1',
      ...draft(),
      result: 'win',
      profit: 99_999,
    }]);

    expect(repository.replaceCalls).toBe(1);
    expect(repository.records[0]).toMatchObject({
      id: 'imported-1',
      profit: 100,
      createdAt: 450,
      updatedAt: 450,
    });
    expect(store.getState().bets[0]?.profit).toBe(100);
  });

  it('keeps immediate optimistic feedback when a write starts during hydration', async () => {
    let releaseList: ((records: StoredBet[]) => void) | undefined;
    const repository = new MemoryBetRepository();
    repository.list = () => new Promise<StoredBet[]>((resolve) => {
      releaseList = resolve;
    });
    const store = createBetStore({
      repository,
      legacyStorage: new MemoryLegacyStorage(null),
      createId: () => 'during-hydration',
      now: () => 700,
    });
    const hydration = initializeBetStore(store);
    const write = store.getState().createBet(draft());
    expect(store.getState().bets[0]?.id).toBe('during-hydration');

    releaseList?.([]);
    await hydration;
    await write;
    expect(store.getState().bets[0]?.id).toBe('during-hydration');
    expect(repository.records[0]?.id).toBe('during-hydration');
  });

  it('rolls back optimistic state and exposes a retryable error when persistence fails', async () => {
    const repository = new MemoryBetRepository();
    repository.failPut = true;
    const store = createBetStore({
      repository,
      legacyStorage: new MemoryLegacyStorage(null),
      createId: () => 'failed-1',
    });
    await initializeBetStore(store);

    const write = store.getState().createBet(draft());
    expect(store.getState().bets).toHaveLength(1);
    await expect(write).resolves.toBeUndefined();
    expect(store.getState().bets).toEqual([]);
    expect(store.getState().error).toContain('попробуйте ещё раз');
  });

  it('hydrates persisted records after a simulated reload', async () => {
    const repository = new MemoryBetRepository();
    const firstStore = createBetStore({
      repository,
      legacyStorage: new MemoryLegacyStorage(null),
      createId: () => 'reload-1',
      now: () => 500,
    });
    await initializeBetStore(firstStore);
    await firstStore.getState().createBet({ ...draft(), stakeType: 'freebet', result: 'win' });

    const reloadedStore = createBetStore({ repository, legacyStorage: new MemoryLegacyStorage(null) });
    await initializeBetStore(reloadedStore);
    expect(reloadedStore.getState().bets).toEqual(firstStore.getState().bets);
    expect(reloadedStore.getState()).toMatchObject({ hydrated: true, loading: false, error: null });
  });

  it('retries failed hydration, clears the error and deduplicates concurrent retries', async () => {
    const repository = new MemoryBetRepository([storedBet('durable-1')]);
    repository.listFailuresRemaining = 1;
    const store = createBetStore({
      repository,
      legacyStorage: new MemoryLegacyStorage(null),
      createId: () => 'memory-1',
    });
    await initializeBetStore(store);
    expect(store.getState()).toMatchObject({ bets: [], hydrated: true, loading: false });
    expect(store.getState().error).toContain('Не удалось загрузить');
    await store.getState().createBet(draft());
    expect(store.getState().bets.map((bet) => bet.id)).toEqual(['memory-1']);

    const firstRetry = store.getState().retryHydration();
    const secondRetry = store.getState().retryHydration();
    expect(firstRetry).toBe(secondRetry);
    expect(store.getState()).toMatchObject({ hydrated: false, loading: true, error: null });
    await firstRetry;

    expect(repository.listCalls).toBe(2);
    expect(store.getState().bets.map((bet) => bet.id)).toEqual(['memory-1', 'durable-1']);
    expect(store.getState()).toMatchObject({ hydrated: true, loading: false, error: null });
  });

  it('reconciles from durable records on retry without reviving a stale in-memory deletion', async () => {
    const repository = new MemoryBetRepository([storedBet('still-durable')]);
    repository.listFailuresRemaining = 1;
    const store = createBetStore({ repository, legacyStorage: new MemoryLegacyStorage(null) });
    await initializeBetStore(store);
    store.setState({
      bets: [
        { id: 'stale-deleted', ...draft(), profit: 0 },
        { id: 'still-durable', ...draft(), profit: 0 },
      ],
    });

    await store.getState().retryHydration();
    expect(store.getState().bets.map((bet) => bet.id)).toEqual(['still-durable']);
  });
});
