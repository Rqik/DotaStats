import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { MemoryCacheStore } from '../db/cacheRepository';
import { ApiError } from './client';
import {
  OPEN_DOTA_CACHE_TTL,
  createOpenDotaRepository,
  type OpenDotaApiClient,
} from './openDotaRepository';

function stubClient(load: (path: string) => unknown | Promise<unknown>) {
  const calls: string[] = [];
  const client: OpenDotaApiClient = {
    async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
      calls.push(path);
      return schema.parse(await load(path));
    },
  };
  return { client, calls };
}

const team = {
  team_id: 2163,
  name: 'Team Liquid',
  tag: 'Liquid',
  logo_url: null,
};

describe('OpenDotaRepository', () => {
  it('normalizes leagues and the real array shape of league teams', async () => {
    const { client, calls } = stubClient((path) => {
      if (path === '/leagues') return [{ leagueid: 16935, name: 'The International 2024', tier: 'premium' }];
      if (path === '/leagues/16935/teams') return [team];
      throw new Error(`Unexpected path: ${path}`);
    });
    const repository = createOpenDotaRepository({ client, cacheStore: new MemoryCacheStore(), now: () => 100 });

    await expect(repository.listLeagues()).resolves.toEqual({
      data: [{ leagueId: 16935, name: 'The International 2024', tier: 'premium' }],
      source: 'network',
      savedAt: 100,
    });
    await expect(repository.listLeagueTeams(16935)).resolves.toEqual({
      data: [{ teamId: 2163, name: 'Team Liquid', tag: 'Liquid', logoUrl: null }],
      source: 'network',
      savedAt: 100,
    });
    expect(calls).toEqual(['/leagues', '/leagues/16935/teams']);
  });

  it('uses fresh cache and force refresh bypasses it', async () => {
    let version = 0;
    const { client, calls } = stubClient(() => [{ ...team, name: `Team Liquid ${version += 1}` }]);
    const repository = createOpenDotaRepository({ client, cacheStore: new MemoryCacheStore(), now: () => 1_000 });

    await expect(repository.searchTeams('liquid')).resolves.toMatchObject({ source: 'network' });
    await expect(repository.searchTeams('liquid')).resolves.toMatchObject({
      source: 'cache',
      data: [{ name: 'Team Liquid 1' }],
    });
    await expect(repository.searchTeams('liquid', { forceRefresh: true })).resolves.toMatchObject({
      source: 'network',
      data: [{ name: 'Team Liquid 2' }],
    });
    expect(calls).toHaveLength(2);
  });

  it('loads hero matchups and durations through their dedicated caches', async () => {
    const { client, calls } = stubClient((path) => path.endsWith('/matchups')
      ? [{ hero_id: 2, games_played: 10, wins: 6 }]
      : [{ duration_bin: '1800', games_played: 20, wins: 11 }]);
    const cacheStore = new MemoryCacheStore();
    const repository = createOpenDotaRepository({ client, cacheStore, now: () => 1_000 });

    await expect(repository.getHeroMatchups(1)).resolves.toMatchObject({ source: 'network' });
    await expect(repository.getHeroDurations(1)).resolves.toMatchObject({ source: 'network' });
    await expect(repository.getHeroMatchups(1)).resolves.toMatchObject({ source: 'cache' });
    await expect(repository.getHeroDurations(1)).resolves.toMatchObject({ source: 'cache' });
    await expect(repository.getHeroMatchups(1, { forceRefresh: true })).resolves.toMatchObject({ source: 'network' });
    await expect(repository.getHeroDurations(1, { forceRefresh: true })).resolves.toMatchObject({ source: 'network' });
    expect(calls).toEqual([
      '/heroes/1/matchups',
      '/heroes/1/durations',
      '/heroes/1/matchups',
      '/heroes/1/durations',
    ]);
    await expect(cacheStore.get('cachedHeroMatchups', 'hero-matchups:1')).resolves.toMatchObject({
      savedAt: 1_000,
      expiresAt: 1_000 + OPEN_DOTA_CACHE_TTL.heroMatchups,
    });
    await expect(cacheStore.get('cachedHeroDurations', 'hero-durations:1')).resolves.toMatchObject({
      savedAt: 1_000,
      expiresAt: 1_000 + OPEN_DOTA_CACHE_TTL.heroDurations,
    });
  });

  it('returns validated stale cache when OpenDota is unavailable', async () => {
    const cacheStore = new MemoryCacheStore();
    await cacheStore.put('cachedTeams', {
      key: 'teams',
      payload: [team],
      savedAt: 100,
      expiresAt: 200,
    });
    const { client } = stubClient(() => Promise.reject(new ApiError('network', 'offline')));
    const repository = createOpenDotaRepository({ client, cacheStore, now: () => 300 });

    await expect(repository.searchTeams('liquid')).resolves.toEqual({
      data: [{ teamId: 2163, name: 'Team Liquid', tag: 'Liquid', logoUrl: null }],
      source: 'stale-cache',
      savedAt: 100,
    });
  });

  it('returns stale validated hero statistics when refresh fails', async () => {
    const cacheStore = new MemoryCacheStore();
    await cacheStore.put('cachedHeroMatchups', {
      key: 'hero-matchups:1',
      payload: [{ hero_id: 2, games_played: 10, wins: 6 }],
      savedAt: 100,
      expiresAt: 200,
    });
    await cacheStore.put('cachedHeroDurations', {
      key: 'hero-durations:1',
      payload: [{ duration_bin: '1800', games_played: 20, wins: 11 }],
      savedAt: 100,
      expiresAt: 200,
    });
    const { client } = stubClient(() => Promise.reject(new ApiError('network', 'offline')));
    const repository = createOpenDotaRepository({ client, cacheStore, now: () => 300 });

    await expect(repository.getHeroMatchups(1)).resolves.toMatchObject({ source: 'stale-cache', savedAt: 100 });
    await expect(repository.getHeroDurations(1)).resolves.toMatchObject({ source: 'stale-cache', savedAt: 100 });
  });

  it('deduplicates concurrent requests for the same resource', async () => {
    const load = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [{ leagueid: 16935, name: 'The International 2024', tier: 'premium' }];
    });
    const { client } = stubClient(load);
    const repository = createOpenDotaRepository({ client, cacheStore: new MemoryCacheStore() });

    await Promise.all([repository.listLeagues(), repository.listLeagues(), repository.listLeagues()]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('limits parallel match requests to three', async () => {
    let active = 0;
    let maximumActive = 0;
    const { client } = stubClient(async (path) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { match_id: Number(path.split('/').at(-1)), duration: 2400 };
    });
    const repository = createOpenDotaRepository({
      client,
      cacheStore: new MemoryCacheStore(),
      matchConcurrency: 3,
    });

    await Promise.all([1, 2, 3, 4, 5, 6].map((matchId) => repository.getMatch(matchId)));
    expect(maximumActive).toBe(3);
  });

  it('deduplicates identical draft requests and limits mixed hero calls to three', async () => {
    let active = 0;
    let maximumActive = 0;
    const load = vi.fn(async (path: string) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return path.endsWith('/matchups')
        ? [{ hero_id: 99, games_played: 10, wins: 6 }]
        : [{ duration_bin: '1800', games_played: 20, wins: 11 }];
    });
    const { client } = stubClient(load);
    const repository = createOpenDotaRepository({
      client,
      cacheStore: new MemoryCacheStore(),
      draftConcurrency: 3,
    });

    await Promise.all([
      repository.getHeroMatchups(1),
      repository.getHeroMatchups(1),
      ...Array.from({ length: 10 }, (_, index) => repository.getHeroDurations(index + 1)),
      ...Array.from({ length: 5 }, (_, index) => repository.getHeroMatchups(index + 2)),
    ]);

    expect(maximumActive).toBe(3);
    expect(load).toHaveBeenCalledTimes(16);
  });

  it('rejects invalid numeric identifiers before a network request', async () => {
    const { client, calls } = stubClient(() => []);
    const repository = createOpenDotaRepository({ client, cacheStore: new MemoryCacheStore() });

    await expect(repository.listLeagueTeams(Number.NaN)).rejects.toMatchObject({ kind: 'invalid_request' });
    await expect(repository.getMatch(0)).rejects.toMatchObject({ kind: 'invalid_request' });
    await expect(repository.getHeroMatchups(-1)).rejects.toMatchObject({ kind: 'invalid_request' });
    await expect(repository.getHeroDurations(0)).rejects.toMatchObject({ kind: 'invalid_request' });
    expect(calls).toHaveLength(0);
  });

  it('preserves hero endpoint error identity when no cache exists', async () => {
    const rateLimit = new ApiError('rate_limit', 'limited', { status: 429 });
    const { client } = stubClient(() => Promise.reject(rateLimit));
    const repository = createOpenDotaRepository({ client, cacheStore: new MemoryCacheStore() });

    await expect(repository.getHeroMatchups(1)).rejects.toBe(rateLimit);
    await expect(repository.getHeroDurations(1)).rejects.toBe(rateLimit);
  });

  it('removes every cache record through the public clear API', async () => {
    const cacheStore = new MemoryCacheStore();
    await cacheStore.put('cachedHeroes', { key: 'heroes', payload: [], savedAt: 1, expiresAt: 2 });
    const { client } = stubClient(() => []);
    const repository = createOpenDotaRepository({ client, cacheStore });

    await expect(repository.clearCache()).resolves.toEqual({ deleted: 1 });
  });
});
