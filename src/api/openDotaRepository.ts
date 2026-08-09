import type { z } from 'zod';
import { NEVER_EXPIRES_AT, type CacheRecord } from '../db';
import {
  dexieCacheStore,
  type CacheBucket,
  type CacheStore,
} from '../db/cacheRepository';
import { ApiError, OpenDotaClient } from './client';
import {
  openDotaHeroStatsListSchema,
  openDotaHeroDurationsSchema,
  openDotaHeroMatchupsSchema,
  openDotaLeagueTeamsSchema,
  openDotaLeaguesSchema,
  openDotaMatchSchema,
  openDotaTeamMatchesSchema,
  openDotaTeamsSchema,
  type OpenDotaHeroStats,
  type OpenDotaHeroDuration,
  type OpenDotaHeroMatchup,
  type OpenDotaLeague,
  type OpenDotaMatch,
  type OpenDotaTeam,
  type OpenDotaTeamMatch,
} from './schemas';
import {
  readOpenDotaSettings,
  type OpenDotaSettingsProvider,
} from './settingsProvider';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const OPEN_DOTA_CACHE_TTL = {
  leagues: DAY_MS,
  teams: DAY_MS,
  teamMatches: HOUR_MS,
  match: NEVER_EXPIRES_AT,
  heroes: 7 * DAY_MS,
  heroMatchups: DAY_MS,
  heroDurations: DAY_MS,
} as const;

export interface TeamOption {
  teamId: number;
  name: string;
  tag: string | null;
  logoUrl: string | null;
}

export interface LeagueOption {
  leagueId: number;
  name: string;
  tier: string | null;
}

export interface HeroOption {
  heroId: number;
  name: string;
  internalName: string;
  roles: string[];
  imageUrl: string | null;
  iconUrl: string | null;
}

export interface CachedResult<T> {
  data: T;
  source: 'network' | 'cache' | 'stale-cache';
  savedAt: number;
}

export interface RefreshOptions {
  forceRefresh?: boolean;
}

export interface OpenDotaApiClient {
  get: <T>(path: string, schema: z.ZodType<T>) => Promise<T>;
}

export interface OpenDotaRepositoryOptions {
  cacheStore?: CacheStore;
  client?: OpenDotaApiClient;
  settingsProvider?: OpenDotaSettingsProvider;
  now?: () => number;
  matchConcurrency?: number;
  draftConcurrency?: number;
}

interface ValidatedCache<T> {
  data: T;
  record: CacheRecord;
}

class ConcurrencyLimiter {
  private active = 0;
  private readonly limit: number;
  private readonly queue: Array<() => void> = [];

  constructor(limit: number) {
    this.limit = Math.max(1, Math.floor(limit));
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.active -= 1;
  }
}

function positiveId(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ApiError('invalid_request', `${label} must be a positive integer`);
  }
  return value;
}

function teamOption(team: OpenDotaTeam): TeamOption {
  const tag = team.tag?.trim() || null;
  return {
    teamId: team.team_id,
    name: team.name?.trim() || tag || `Team ${team.team_id}`,
    tag,
    logoUrl: team.logo_url ?? null,
  };
}

function leagueOption(league: OpenDotaLeague): LeagueOption {
  return {
    leagueId: league.leagueid,
    name: league.name,
    tier: league.tier ?? null,
  };
}

function heroOption(hero: OpenDotaHeroStats): HeroOption {
  return {
    heroId: hero.id,
    name: hero.localized_name,
    internalName: hero.name,
    roles: hero.roles ?? [],
    imageUrl: hero.img ?? null,
    iconUrl: hero.icon ?? null,
  };
}

function mapResult<T, U>(result: CachedResult<T>, map: (value: T) => U): CachedResult<U> {
  return { ...result, data: map(result.data) };
}

function deduplicate<T>(requests: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const pending = requests.get(key);
  if (pending) return pending;
  const request = load().finally(() => requests.delete(key));
  requests.set(key, request);
  return request;
}

export class OpenDotaRepository {
  private readonly cacheStore: CacheStore;
  private readonly fixedClient?: OpenDotaApiClient;
  private readonly settingsProvider: OpenDotaSettingsProvider;
  private readonly now: () => number;
  private readonly matchLimiter: ConcurrencyLimiter;
  private readonly draftLimiter: ConcurrencyLimiter;
  private readonly leagueRequests = new Map<string, Promise<CachedResult<OpenDotaLeague[]>>>();
  private readonly teamRequests = new Map<string, Promise<CachedResult<OpenDotaTeam[]>>>();
  private readonly teamMatchRequests = new Map<string, Promise<CachedResult<OpenDotaTeamMatch[]>>>();
  private readonly matchRequests = new Map<string, Promise<CachedResult<OpenDotaMatch>>>();
  private readonly heroRequests = new Map<string, Promise<CachedResult<OpenDotaHeroStats[]>>>();
  private readonly heroMatchupRequests = new Map<string, Promise<CachedResult<OpenDotaHeroMatchup[]>>>();
  private readonly heroDurationRequests = new Map<string, Promise<CachedResult<OpenDotaHeroDuration[]>>>();

  constructor(options: OpenDotaRepositoryOptions = {}) {
    this.cacheStore = options.cacheStore ?? dexieCacheStore;
    this.fixedClient = options.client;
    this.settingsProvider = options.settingsProvider ?? readOpenDotaSettings;
    this.now = options.now ?? Date.now;
    this.matchLimiter = new ConcurrencyLimiter(options.matchConcurrency ?? 3);
    this.draftLimiter = new ConcurrencyLimiter(options.draftConcurrency ?? 3);
  }

  async listLeagues(options: RefreshOptions = {}): Promise<CachedResult<LeagueOption[]>> {
    const result = await deduplicate(this.leagueRequests, 'leagues', () => this.loadCached({
      bucket: 'cachedTeams',
      key: 'leagues',
      path: '/leagues',
      schema: openDotaLeaguesSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.leagues,
      forceRefresh: options.forceRefresh,
    }));
    return mapResult(result, (leagues) => leagues.map(leagueOption));
  }

  async listLeagueTeams(leagueId: number, options: RefreshOptions = {}): Promise<CachedResult<TeamOption[]>> {
    const id = positiveId(leagueId, 'leagueId');
    const key = `league-teams:${id}`;
    const result = await deduplicate(this.teamRequests, key, () => this.loadCached({
      bucket: 'cachedTeams',
      key,
      path: `/leagues/${id}/teams`,
      schema: openDotaLeagueTeamsSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.teams,
      forceRefresh: options.forceRefresh,
    }));
    return mapResult(result, (teams) => teams.map(teamOption));
  }

  async searchTeams(query: string, options: RefreshOptions = {}): Promise<CachedResult<TeamOption[]>> {
    const result = await deduplicate(this.teamRequests, 'teams', () => this.loadCached({
      bucket: 'cachedTeams',
      key: 'teams',
      path: '/teams',
      schema: openDotaTeamsSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.teams,
      forceRefresh: options.forceRefresh,
    }));
    const needle = query.trim().toLocaleLowerCase();
    return mapResult(result, (teams) => teams
      .map(teamOption)
      .filter((team) => !needle
        || team.name.toLocaleLowerCase().includes(needle)
        || team.tag?.toLocaleLowerCase().includes(needle)));
  }

  async getTeamMatches(teamId: number, options: RefreshOptions = {}): Promise<CachedResult<OpenDotaTeamMatch[]>> {
    const id = positiveId(teamId, 'teamId');
    const key = `team-matches:${id}`;
    return deduplicate(this.teamMatchRequests, key, () => this.loadCached({
      bucket: 'cachedTeamMatches',
      key,
      path: `/teams/${id}/matches`,
      schema: openDotaTeamMatchesSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.teamMatches,
      forceRefresh: options.forceRefresh,
    }));
  }

  async getMatch(matchId: number, options: RefreshOptions = {}): Promise<CachedResult<OpenDotaMatch>> {
    const id = positiveId(matchId, 'matchId');
    const key = `match:${id}`;
    return deduplicate(this.matchRequests, key, () => this.loadCached({
      bucket: 'cachedMatches',
      key,
      path: `/matches/${id}`,
      schema: openDotaMatchSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.match,
      forceRefresh: options.forceRefresh,
      network: () => this.matchLimiter.run(() => this.client().get(`/matches/${id}`, openDotaMatchSchema)),
    }));
  }

  async listHeroes(options: RefreshOptions = {}): Promise<CachedResult<HeroOption[]>> {
    const result = await deduplicate(this.heroRequests, 'heroes', () => this.loadCached({
      bucket: 'cachedHeroes',
      key: 'heroes',
      path: '/heroStats',
      schema: openDotaHeroStatsListSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.heroes,
      forceRefresh: options.forceRefresh,
    }));
    return mapResult(result, (heroes) => heroes.map(heroOption));
  }

  async getHeroMatchups(heroId: number, options: RefreshOptions = {}): Promise<CachedResult<OpenDotaHeroMatchup[]>> {
    const id = positiveId(heroId, 'heroId');
    const key = `hero-matchups:${id}`;
    return deduplicate(this.heroMatchupRequests, key, () => this.loadCached({
      bucket: 'cachedHeroMatchups',
      key,
      path: `/heroes/${id}/matchups`,
      schema: openDotaHeroMatchupsSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.heroMatchups,
      forceRefresh: options.forceRefresh,
      network: () => this.draftLimiter.run(() => this.client().get(`/heroes/${id}/matchups`, openDotaHeroMatchupsSchema)),
    }));
  }

  async getHeroDurations(heroId: number, options: RefreshOptions = {}): Promise<CachedResult<OpenDotaHeroDuration[]>> {
    const id = positiveId(heroId, 'heroId');
    const key = `hero-durations:${id}`;
    return deduplicate(this.heroDurationRequests, key, () => this.loadCached({
      bucket: 'cachedHeroDurations',
      key,
      path: `/heroes/${id}/durations`,
      schema: openDotaHeroDurationsSchema,
      ttlMs: OPEN_DOTA_CACHE_TTL.heroDurations,
      forceRefresh: options.forceRefresh,
      network: () => this.draftLimiter.run(() => this.client().get(`/heroes/${id}/durations`, openDotaHeroDurationsSchema)),
    }));
  }

  async clearCache(): Promise<{ deleted: number }> {
    return { deleted: await this.cacheStore.clear() };
  }

  private client(): OpenDotaApiClient {
    if (this.fixedClient) return this.fixedClient;
    return new OpenDotaClient({ apiKey: this.settingsProvider().apiKey });
  }

  private async validatedCache<T>(bucket: CacheBucket, key: string, schema: z.ZodType<T>): Promise<ValidatedCache<T> | undefined> {
    let record: CacheRecord | undefined;
    try {
      record = await this.cacheStore.get(bucket, key);
    } catch {
      return undefined;
    }
    if (!record) return undefined;

    const parsed = schema.safeParse(record.payload);
    if (parsed.success) return { data: parsed.data, record };
    try {
      await this.cacheStore.delete(bucket, key);
    } catch {
      // A corrupt cache entry is ignored even if storage is unavailable for cleanup.
    }
    return undefined;
  }

  private async loadCached<T>(options: {
    bucket: CacheBucket;
    key: string;
    path: string;
    schema: z.ZodType<T>;
    ttlMs: number;
    forceRefresh?: boolean;
    network?: () => Promise<T>;
  }): Promise<CachedResult<T>> {
    const cached = await this.validatedCache(options.bucket, options.key, options.schema);
    const now = this.now();
    if (cached && !options.forceRefresh && cached.record.expiresAt > now) {
      return { data: cached.data, source: 'cache', savedAt: cached.record.savedAt };
    }

    try {
      const data = await (options.network?.() ?? this.client().get(options.path, options.schema));
      const savedAt = this.now();
      const expiresAt = options.ttlMs === NEVER_EXPIRES_AT
        ? NEVER_EXPIRES_AT
        : savedAt + options.ttlMs;
      try {
        await this.cacheStore.put(options.bucket, { key: options.key, payload: data, savedAt, expiresAt });
      } catch {
        // Network data remains usable when IndexedDB is blocked or unavailable.
      }
      return { data, source: 'network', savedAt };
    } catch (error) {
      if (cached) {
        return {
          data: cached.data,
          source: cached.record.expiresAt > now ? 'cache' : 'stale-cache',
          savedAt: cached.record.savedAt,
        };
      }
      throw error;
    }
  }
}

export function createOpenDotaRepository(options: OpenDotaRepositoryOptions = {}): OpenDotaRepository {
  return new OpenDotaRepository(options);
}

export const openDotaRepository = createOpenDotaRepository();
