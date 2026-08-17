import { z } from 'zod';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { type BetRepository, betRepository } from '../../db/betRepository';
import type { StoredBet } from '../../db';
import {
  calculateProfit,
  type BetResult,
  type StakeType,
} from '../../domain/bankroll';

export type { BetResult, StakeType } from '../../domain/bankroll';

export interface Bet {
  id: string;
  date: string;
  tournament: string;
  match: string;
  selection: string;
  odds: number;
  stake: number;
  stakeType: StakeType;
  result: BetResult;
  profit: number;
  teamA?: string;
  teamB?: string;
  market?: string;
  handicap?: number;
  bookmaker?: string;
  comment?: string;
  analysisId?: string;
}

export type BetDraft = Omit<Bet, 'id' | 'profit'>;

export interface BetStore {
  bets: Bet[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  retryHydration: () => Promise<void>;
  clearError: () => void;
  createBet: (bet: BetDraft) => Promise<void>;
  updateBet: (id: string, bet: BetDraft) => Promise<void>;
  deleteBet: (id: string) => Promise<void>;
  replaceBets: (bets: Bet[]) => Promise<void>;
  settleBet: (id: string, result: BetResult) => Promise<void>;
}

export interface LegacyBetStorage {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
}

export interface CreateBetStoreOptions {
  repository?: BetRepository;
  legacyStorage?: LegacyBetStorage;
  now?: () => number;
  createId?: () => string;
}

export interface LoadBetsResult {
  records: StoredBet[];
  error: string | null;
}

export const LEGACY_BET_STORAGE_KEY = 'dota-pulse-bets:v2';

const legacyBetSchema = z.object({
  id: z.string().trim().min(1),
  date: z.string(),
  tournament: z.string(),
  match: z.string(),
  selection: z.string(),
  odds: z.number().finite().gt(1),
  stake: z.number().finite().nonnegative(),
  stakeType: z.enum(['cash', 'freebet']).optional().default('cash'),
  result: z.enum(['pending', 'win', 'loss', 'refund']),
  profit: z.number().finite().optional(),
  teamA: z.string().optional(),
  teamB: z.string().optional(),
  market: z.string().optional(),
  handicap: z.number().finite().optional(),
  bookmaker: z.string().optional(),
  comment: z.string().optional(),
  analysisId: z.string().optional(),
}).passthrough();

const legacyStorageSchema = z.object({
  state: z.object({ bets: z.array(legacyBetSchema) }).passthrough(),
  version: z.literal(2),
}).passthrough();

const knownPrototypeSeeds: readonly Bet[] = [
  { id: 'bet-1', date: '18 июл., 21:30', tournament: 'Riyadh Masters', match: 'Team Spirit — Aurora', selection: 'Spirit −7.5 убийств', odds: 1.82, stake: 1200, stakeType: 'cash', result: 'win', profit: 1200 * (1.82 - 1) },
  { id: 'bet-2', date: '17 июл., 19:00', tournament: 'FISSURE Universe', match: 'PARIVISION — Tundra', selection: 'PARIVISION победа', odds: 1.68, stake: 1500, stakeType: 'cash', result: 'loss', profit: -1500 },
  { id: 'bet-3', date: '16 июл., 16:30', tournament: 'Elite League', match: 'Falcons — Vici Gaming', selection: 'Vici +20.5 убийств', odds: 1.65, stake: 1000, stakeType: 'cash', result: 'pending', profit: 0 },
];

const browserLegacyStorage: LegacyBetStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};

function calculatedProfit(bet: Pick<Bet, 'stake' | 'odds' | 'stakeType' | 'result'>): number {
  return calculateProfit({
    stake: bet.stake,
    odds: bet.odds,
    stakeType: bet.stakeType,
    result: bet.result,
  });
}

export function fromStoredBet(record: StoredBet): Bet {
  return {
    id: record.id,
    date: record.date,
    tournament: record.tournament,
    match: record.match,
    selection: record.selection,
    odds: record.odds,
    stake: record.stake,
    stakeType: record.stakeType,
    result: record.result,
    profit: calculatedProfit(record),
    teamA: record.teamA,
    teamB: record.teamB,
    market: record.market,
    handicap: record.handicap,
    bookmaker: record.bookmaker,
    comment: record.comment,
    analysisId: record.analysisId,
  };
}

export function toStoredBet(bet: Bet, createdAt: number, updatedAt = createdAt): StoredBet {
  return {
    ...bet,
    profit: calculatedProfit(bet),
    createdAt,
    updatedAt,
  };
}

export function parseLegacyBets(serialized: string): Bet[] | null {
  try {
    const raw: unknown = JSON.parse(serialized);
    const parsed = legacyStorageSchema.safeParse(raw);
    if (!parsed.success) return null;
    const bets = parsed.data.state.bets.map((bet) => ({
      id: bet.id,
      date: bet.date,
      tournament: bet.tournament,
      match: bet.match,
      selection: bet.selection,
      odds: bet.odds,
      stake: bet.stake,
      stakeType: bet.stakeType,
      result: bet.result,
      profit: calculatedProfit(bet),
      teamA: bet.teamA,
      teamB: bet.teamB,
      market: bet.market,
      handicap: bet.handicap,
      bookmaker: bet.bookmaker,
      comment: bet.comment,
      analysisId: bet.analysisId,
    }));
    return bets.filter((bet) => !knownPrototypeSeeds.some((seed) => sameBet(seed, bet)));
  } catch {
    return null;
  }
}

function sameBet(left: Bet, right: Bet): boolean {
  return left.id === right.id
    && left.date === right.date
    && left.tournament === right.tournament
    && left.match === right.match
    && left.selection === right.selection
    && left.odds === right.odds
    && left.stake === right.stake
    && left.stakeType === right.stakeType
    && left.result === right.result
    && left.profit === right.profit
    && left.teamA === right.teamA
    && left.teamB === right.teamB
    && left.market === right.market
    && left.handicap === right.handicap
    && left.bookmaker === right.bookmaker
    && left.comment === right.comment
    && left.analysisId === right.analysisId;
}

function sameBetCollection(records: readonly StoredBet[], bets: readonly Bet[]): boolean {
  if (records.length !== bets.length) return false;
  const byId = new Map(records.map((record) => [record.id, fromStoredBet(record)]));
  return bets.every((bet) => {
    const record = byId.get(bet.id);
    return record !== undefined && sameBet(record, bet);
  });
}

export async function loadAndMigrateBets(
  repository: BetRepository,
  storage: LegacyBetStorage,
  now: () => number = Date.now,
): Promise<LoadBetsResult> {
  const existing = await repository.list();
  let serialized: string | null;
  try {
    serialized = storage.getItem(LEGACY_BET_STORAGE_KEY);
  } catch {
    return { records: existing, error: 'Не удалось прочитать старое локальное хранилище ставок.' };
  }
  if (serialized === null) return { records: existing, error: null };

  const legacyBets = parseLegacyBets(serialized);
  if (legacyBets === null) {
    return {
      records: existing,
      error: 'Старые данные ставок имеют неверный формат и оставлены без изменений.',
    };
  }

  let records = existing;
  if (existing.length === 0) {
    const migratedAt = now();
    records = legacyBets.map((bet, index) => toStoredBet(bet, migratedAt - index, migratedAt));
    await repository.replaceAll(records);
  } else if (!sameBetCollection(existing, legacyBets)) {
    return {
      records: existing,
      error: 'Обнаружены разные наборы ставок в IndexedDB и старом хранилище; автоматическая замена отменена.',
    };
  }

  try {
    storage.removeItem(LEGACY_BET_STORAGE_KEY);
  } catch {
    return { records, error: 'Ставки перенесены в IndexedDB, но старую копию не удалось удалить.' };
  }
  return { records, error: null };
}

function defaultCreateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `bet-${Date.now()}`;
}

function storageErrorMessage(): string {
  return 'Не удалось сохранить изменения в IndexedDB. Изменение отменено; попробуйте ещё раз.';
}

export type BetStoreHook = UseBoundStore<StoreApi<BetStore>>;

export function createBetStore(options: CreateBetStoreOptions = {}): BetStoreHook {
  const repository = options.repository ?? betRepository;
  const legacyStorage = options.legacyStorage ?? browserLegacyStorage;
  const now = options.now ?? Date.now;
  const createId = options.createId ?? defaultCreateId;
  const timestamps = new Map<string, { createdAt: number; updatedAt: number }>();
  let hydrationPromise: Promise<void> | null = null;
  let retryPromise: Promise<void> | null = null;
  let writeQueue = Promise.resolve();
  let preHydrationMode: 'none' | 'merge' | 'replace' = 'none';

  const store = create<BetStore>()((set, get) => {
    const enqueueWrite = (
      write: () => Promise<void>,
      rollback: () => void,
    ): Promise<void> => {
      const operation = writeQueue.then(async () => {
        try {
          await get().hydrate();
          await write();
        } catch {
          rollback();
          set({ error: storageErrorMessage() });
        }
      });
      writeQueue = operation;
      return operation;
    };

    const rememberTimestamps = (records: readonly StoredBet[], clear = true): void => {
      if (clear) timestamps.clear();
      records.forEach((record) => timestamps.set(record.id, {
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    };

    return {
      bets: [],
      hydrated: false,
      loading: false,
      error: null,
      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (hydrationPromise) return hydrationPromise;
        set({ loading: true, error: null });
        hydrationPromise = loadAndMigrateBets(repository, legacyStorage, now)
          .then(({ records, error }) => {
            const storedBets = records.map(fromStoredBet);
            if (preHydrationMode === 'merge') {
              rememberTimestamps(records, false);
              const currentBets = get().bets;
              const currentIds = new Set(currentBets.map((bet) => bet.id));
              set({
                bets: [...currentBets, ...storedBets.filter((bet) => !currentIds.has(bet.id))],
                hydrated: true,
                loading: false,
                error,
              });
            } else if (preHydrationMode === 'replace') {
              set({ hydrated: true, loading: false, error });
            } else {
              rememberTimestamps(records);
              set({ bets: storedBets, hydrated: true, loading: false, error });
            }
            preHydrationMode = 'none';
          })
          .catch(() => {
            set({ hydrated: true, loading: false, error: 'Не удалось загрузить ставки из IndexedDB.' });
          });
        return hydrationPromise;
      },
      retryHydration: () => {
        if (retryPromise) return retryPromise;
        set({ hydrated: false, loading: true, error: null });
        retryPromise = writeQueue
          .then(() => {
            hydrationPromise = null;
            preHydrationMode = 'none';
            return get().hydrate();
          })
          .finally(() => {
            retryPromise = null;
          });
        return retryPromise;
      },
      clearError: () => set({ error: null }),
      createBet: (draft) => {
        if (!get().hydrated && preHydrationMode !== 'replace') preHydrationMode = 'merge';
        const createdAt = now();
        const bet: Bet = { id: createId(), ...draft, profit: calculatedProfit(draft) };
        const record = toStoredBet(bet, createdAt);
        set((state) => ({ bets: [bet, ...state.bets], error: null }));
        timestamps.set(bet.id, { createdAt, updatedAt: createdAt });
        return enqueueWrite(
          () => repository.put(record),
          () => {
            timestamps.delete(bet.id);
            set((state) => ({ bets: state.bets.filter((item) => item.id !== bet.id) }));
          },
        );
      },
      updateBet: (id, draft) => {
        const previous = get().bets.find((bet) => bet.id === id);
        if (!previous) return Promise.resolve();
        if (!get().hydrated && preHydrationMode !== 'replace') preHydrationMode = 'merge';
        const previousTimestamps = timestamps.get(id) ?? { createdAt: now(), updatedAt: now() };
        const updatedAt = now();
        const updated: Bet = { id, ...draft, profit: calculatedProfit(draft) };
        set((state) => ({
          bets: state.bets.map((bet) => (bet.id === id ? updated : bet)),
          error: null,
        }));
        timestamps.set(id, { createdAt: previousTimestamps.createdAt, updatedAt });
        return enqueueWrite(
          () => repository.put(toStoredBet(updated, previousTimestamps.createdAt, updatedAt)),
          () => {
            timestamps.set(id, previousTimestamps);
            set((state) => ({ bets: state.bets.map((bet) => (bet.id === id ? previous : bet)) }));
          },
        );
      },
      deleteBet: (id) => {
        const previousIndex = get().bets.findIndex((bet) => bet.id === id);
        if (previousIndex < 0) return Promise.resolve();
        if (!get().hydrated && preHydrationMode !== 'replace') preHydrationMode = 'merge';
        const previous = get().bets[previousIndex];
        const previousTimestamps = timestamps.get(id);
        set((state) => ({ bets: state.bets.filter((bet) => bet.id !== id), error: null }));
        timestamps.delete(id);
        return enqueueWrite(
          () => repository.delete(id),
          () => {
            if (previousTimestamps) timestamps.set(id, previousTimestamps);
            set((state) => {
              const bets = [...state.bets];
              bets.splice(Math.min(previousIndex, bets.length), 0, previous);
              return { bets };
            });
          },
        );
      },
      replaceBets: (bets) => {
        if (!get().hydrated) preHydrationMode = 'replace';
        const previous = get().bets;
        const previousTimestamps = new Map(timestamps);
        const replacedAt = now();
        const normalized = bets.map((bet) => ({ ...bet, profit: calculatedProfit(bet) }));
        const records = normalized.map((bet, index) => toStoredBet(bet, replacedAt - index, replacedAt));
        rememberTimestamps(records);
        set({ bets: normalized, error: null });
        return enqueueWrite(
          () => repository.replaceAll(records),
          () => {
            timestamps.clear();
            previousTimestamps.forEach((value, key) => timestamps.set(key, value));
            set({ bets: previous });
          },
        );
      },
      settleBet: (id, result) => {
        const previous = get().bets.find((bet) => bet.id === id);
        if (!previous) return Promise.resolve();
        return get().updateBet(id, {
          date: previous.date,
          tournament: previous.tournament,
          match: previous.match,
          selection: previous.selection,
          odds: previous.odds,
          stake: previous.stake,
          stakeType: previous.stakeType,
          result,
          teamA: previous.teamA,
          teamB: previous.teamB,
          market: previous.market,
          handicap: previous.handicap,
          bookmaker: previous.bookmaker,
          comment: previous.comment,
          analysisId: previous.analysisId,
        });
      },
    };
  });

  return store;
}

const initializedStores = new WeakMap<BetStoreHook, Promise<void>>();

export function initializeBetStore(store: BetStoreHook): Promise<void> {
  const current = initializedStores.get(store);
  if (current) return current;
  const initialization = store.getState().hydrate().catch(() => {
    // hydrate records its own error state; keep module initialization rejection-safe.
  });
  initializedStores.set(store, initialization);
  return initialization;
}

export const useBetStore = createBetStore();
export const betStoreHydration = initializeBetStore(useBetStore);

export const formatMoney = (value: number): string => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
