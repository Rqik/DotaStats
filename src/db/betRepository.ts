import { z } from 'zod';
import { calculateProfit } from '../domain/bankroll';
import { db, type DotaPulseDatabase, type StoredBet } from '../db';

const storedBetSchema = z.object({
  id: z.string().trim().min(1),
  date: z.string(),
  tournament: z.string(),
  match: z.string(),
  selection: z.string(),
  odds: z.number().finite().gt(1),
  stake: z.number().finite().nonnegative(),
  stakeType: z.enum(['cash', 'freebet']),
  result: z.enum(['pending', 'win', 'loss', 'refund']),
  profit: z.number().finite(),
  createdAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
}).strict();

export interface BetRepository {
  list: () => Promise<StoredBet[]>;
  get: (id: string) => Promise<StoredBet | undefined>;
  put: (bet: StoredBet) => Promise<void>;
  delete: (id: string) => Promise<void>;
  replaceAll: (bets: readonly StoredBet[]) => Promise<void>;
}

export class InvalidStoredBetError extends Error {
  constructor() {
    super('Bet record has an invalid shape');
    this.name = 'InvalidStoredBetError';
  }
}

export function normalizeStoredBet(value: unknown): StoredBet | null {
  const parsed = storedBetSchema.safeParse(value);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    profit: calculateProfit({
      stake: parsed.data.stake,
      odds: parsed.data.odds,
      stakeType: parsed.data.stakeType,
      result: parsed.data.result,
    }),
  };
}

function requireStoredBet(value: unknown): StoredBet {
  const normalized = normalizeStoredBet(value);
  if (!normalized) throw new InvalidStoredBetError();
  return normalized;
}

export class DexieBetRepository implements BetRepository {
  private readonly database: DotaPulseDatabase;

  constructor(database: DotaPulseDatabase = db) {
    this.database = database;
  }

  async list(): Promise<StoredBet[]> {
    const records = await this.database.bets.orderBy('createdAt').reverse().toArray();
    return records.flatMap((record) => {
      const normalized = normalizeStoredBet(record);
      return normalized ? [normalized] : [];
    });
  }

  async get(id: string): Promise<StoredBet | undefined> {
    const record = await this.database.bets.get(id);
    if (!record) return undefined;
    return normalizeStoredBet(record) ?? undefined;
  }

  async put(bet: StoredBet): Promise<void> {
    await this.database.bets.put(requireStoredBet(bet));
  }

  async delete(id: string): Promise<void> {
    await this.database.bets.delete(id);
  }

  async replaceAll(bets: readonly StoredBet[]): Promise<void> {
    const normalized = bets.map(requireStoredBet);
    await this.database.transaction('rw', this.database.bets, async () => {
      await this.database.bets.clear();
      if (normalized.length > 0) await this.database.bets.bulkPut(normalized);
    });
  }
}

export const betRepository = new DexieBetRepository();
