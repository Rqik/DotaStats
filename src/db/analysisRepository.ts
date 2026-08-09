import { z } from 'zod';
import { db, type DotaPulseDatabase } from '../db';

const createdAtSchema = z.union([z.number().finite().nonnegative(), z.string().min(1)])
  .transform((value, context) => {
    const timestamp = typeof value === 'number' ? value : Date.parse(value);
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid analysis timestamp' });
      return z.NEVER;
    }
    return timestamp;
  });

const metadataShape = {
  version: z.literal(2),
  state: z.literal('success'),
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  createdAt: createdAtSchema,
  summary: z.string().trim().min(1),
  source: z.string().trim().min(1),
  status: z.string().trim().min(1),
};

const handicapAnalysisSchema = z.object({
  ...metadataShape,
  mode: z.literal('handicap'),
  payload: z.object({
    input: z.union([
      z.object({ selectedTeam: z.string().trim().min(1), odds: z.number().finite().gt(1) }).passthrough(),
      z.object({ selectedTeamName: z.string().trim().min(1), odds: z.number().finite().gt(1) }).passthrough(),
    ]),
    result: z.object({ probability: z.number().finite().min(0).max(1), status: z.string().trim().min(1) }).passthrough(),
  }).strict(),
}).strict();

const draftAnalysisSchema = z.object({
  ...metadataShape,
  mode: z.literal('draft'),
  payload: z.object({
    input: z.record(z.unknown()),
    result: z.union([
      z.object({ probability: z.number().finite().min(0).max(1) }).passthrough(),
      z.object({ overallProbabilityA: z.number().finite().min(0).max(1) }).passthrough(),
    ]),
  }).strict(),
}).strict();

const matchIdentifierSchema = z.union([
  z.string().regex(/^\d+$/),
  z.number().int().positive().safe(),
]);

const matchAnalysisSchema = z.object({
  ...metadataShape,
  mode: z.literal('match'),
  payload: z.object({
    input: z.union([
      matchIdentifierSchema,
      z.object({ matchId: matchIdentifierSchema }).passthrough(),
    ]),
    result: z.union([
      z.object({ matchId: matchIdentifierSchema }).passthrough(),
      z.object({ data: z.object({ matchId: matchIdentifierSchema }).passthrough() }).passthrough(),
    ]),
  }).strict(),
}).strict();

export const savedAnalysisV2Schema = z.discriminatedUnion('mode', [
  handicapAnalysisSchema,
  draftAnalysisSchema,
  matchAnalysisSchema,
]);

const legacySavedAnalysisSchema = z.object({
  version: z.literal(1).optional(),
  id: z.string().trim().min(1),
  createdAt: createdAtSchema,
  title: z.string().trim().min(1),
  mode: z.enum(['handicap', 'draft', 'match']),
  payload: z.unknown(),
}).passthrough();

export type AnalysisMode = 'handicap' | 'draft' | 'match';
export type SavedAnalysisV2 = z.output<typeof savedAnalysisV2Schema>;
export type SavedAnalysisV2Input = z.input<typeof savedAnalysisV2Schema>;

export interface AnalysisMetadata {
  id: string;
  version: 1 | 2;
  mode: AnalysisMode;
  title: string;
  createdAt: number;
  summary: string;
  source: string;
  status: string;
}

export interface SavedAnalysisDetails extends AnalysisMetadata {
  payload: {
    input: unknown;
    result: unknown;
  };
}

export interface AnalysisListResult {
  items: AnalysisMetadata[];
  invalidCount: number;
}

export interface AnalysisGetResult {
  analysis: SavedAnalysisDetails | null;
  invalid: boolean;
}

export interface AnalysisStorage {
  listRaw: () => Promise<unknown[]>;
  getRaw: (id: string) => Promise<unknown | undefined>;
  putRaw: (record: SavedAnalysisV2) => Promise<void>;
  delete: (id: string) => Promise<void>;
}

export class InvalidSavedAnalysisError extends Error {
  constructor() {
    super('Successful analysis does not match the persisted v2 envelope');
    this.name = 'InvalidSavedAnalysisError';
  }
}

function legacyPayload(payload: unknown): SavedAnalysisDetails['payload'] {
  const envelope = z.object({ input: z.unknown(), result: z.unknown() }).passthrough().safeParse(payload);
  if (envelope.success) return { input: envelope.data.input, result: envelope.data.result };
  return { input: null, result: payload };
}

export function normalizeSavedAnalysis(value: unknown): SavedAnalysisDetails | null {
  const current = savedAnalysisV2Schema.safeParse(value);
  if (current.success) {
    return {
      id: current.data.id,
      version: 2,
      mode: current.data.mode,
      title: current.data.title,
      createdAt: current.data.createdAt,
      summary: current.data.summary,
      source: current.data.source,
      status: current.data.status,
      payload: current.data.payload,
    };
  }

  const legacy = legacySavedAnalysisSchema.safeParse(value);
  if (!legacy.success) return null;
  return {
    id: legacy.data.id,
    version: 1,
    mode: legacy.data.mode,
    title: legacy.data.title,
    createdAt: legacy.data.createdAt,
    summary: legacy.data.title,
    source: 'legacy',
    status: 'legacy',
    payload: legacyPayload(legacy.data.payload),
  };
}

function metadata(analysis: SavedAnalysisDetails): AnalysisMetadata {
  return {
    id: analysis.id,
    version: analysis.version,
    mode: analysis.mode,
    title: analysis.title,
    createdAt: analysis.createdAt,
    summary: analysis.summary,
    source: analysis.source,
    status: analysis.status,
  };
}

export class DexieAnalysisStorage implements AnalysisStorage {
  private readonly database: DotaPulseDatabase;

  constructor(database: DotaPulseDatabase = db) {
    this.database = database;
  }

  listRaw(): Promise<unknown[]> {
    return this.database.table<unknown, string>('analyses').toArray();
  }

  getRaw(id: string): Promise<unknown | undefined> {
    return this.database.table<unknown, string>('analyses').get(id);
  }

  async putRaw(record: SavedAnalysisV2): Promise<void> {
    await this.database.table<SavedAnalysisV2, string>('analyses').put(record);
  }

  async delete(id: string): Promise<void> {
    await this.database.table('analyses').delete(id);
  }
}

export class MemoryAnalysisStorage implements AnalysisStorage {
  private readonly records = new Map<string, unknown>();

  constructor(records: readonly unknown[] = []) {
    records.forEach((record) => {
      if (typeof record === 'object' && record !== null && 'id' in record && typeof record.id === 'string') {
        this.records.set(record.id, record);
      }
    });
  }

  async listRaw(): Promise<unknown[]> {
    return [...this.records.values()];
  }

  async getRaw(id: string): Promise<unknown | undefined> {
    return this.records.get(id);
  }

  async putRaw(record: SavedAnalysisV2): Promise<void> {
    this.records.set(record.id, record);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

export class AnalysisRepository {
  private readonly storage: AnalysisStorage;

  constructor(storage: AnalysisStorage = new DexieAnalysisStorage()) {
    this.storage = storage;
  }

  async list(limit = 20): Promise<AnalysisListResult> {
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Analysis list limit must be a non-negative integer');
    const raw = await this.storage.listRaw();
    const valid: SavedAnalysisDetails[] = [];
    let invalidCount = 0;
    raw.forEach((record) => {
      const normalized = normalizeSavedAnalysis(record);
      if (normalized) valid.push(normalized);
      else invalidCount += 1;
    });
    valid.sort((left, right) => right.createdAt - left.createdAt);
    return { items: valid.slice(0, limit).map(metadata), invalidCount };
  }

  async get(id: string): Promise<AnalysisGetResult> {
    const raw = await this.storage.getRaw(id);
    if (raw === undefined) return { analysis: null, invalid: false };
    const analysis = normalizeSavedAnalysis(raw);
    return analysis ? { analysis, invalid: false } : { analysis: null, invalid: true };
  }

  async put(analysis: SavedAnalysisV2Input): Promise<void> {
    const parsed = savedAnalysisV2Schema.safeParse(analysis);
    if (!parsed.success) throw new InvalidSavedAnalysisError();
    await this.storage.putRaw(parsed.data);
  }

  delete(id: string): Promise<void> {
    return this.storage.delete(id);
  }
}

export const analysisRepository = new AnalysisRepository();
