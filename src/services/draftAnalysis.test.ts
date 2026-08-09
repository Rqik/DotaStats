import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { CachedResult, HeroOption, RefreshOptions } from '../api/openDotaRepository';
import type { OpenDotaHeroDuration, OpenDotaHeroMatchup, OpenDotaTeamMatch } from '../api/schemas';
import {
  analyzeDraft,
  type DraftAnalysisInput,
  type DraftAnalysisRepository,
} from './draftAnalysis';

const baseInput: DraftAnalysisInput = {
  teamA: { name: 'Alpha', side: 'radiant', heroIds: [1, 2, 3, 4, 5] },
  teamB: { name: 'Beta', side: 'dire', heroIds: [6, 7, 8, 9, 10] },
};

function cached<T>(data: T, savedAt = 100, source: CachedResult<unknown>['source'] = 'network'): CachedResult<T> {
  return { data, source, savedAt };
}

function catalog(): HeroOption[] {
  return Array.from({ length: 10 }, (_, index) => ({
    heroId: index + 1,
    name: `Hero ${index + 1} Name`,
    internalName: `npc_dota_hero_${index + 1}`,
    roles: [],
    imageUrl: null,
    iconUrl: null,
  }));
}

function durations(wins: number, games = 100): OpenDotaHeroDuration[] {
  return [0, 1200, 1800, 2400, 3000].map((durationBin) => ({
    duration_bin: durationBin,
    games_played: games,
    wins,
  }));
}

function matchups(opponents: readonly number[] = baseInput.teamB.heroIds): OpenDotaHeroMatchup[] {
  return opponents.map((heroId) => ({ hero_id: heroId, games_played: 100, wins: 60 }));
}

function teamMatches(teamId: number, wins: number, total = 4): OpenDotaTeamMatch[] {
  return Array.from({ length: total }, (_, index) => ({
    match_id: teamId * 1000 + index + 1,
    start_time: 1_720_000_000 + index,
    duration: 1800 + index * 60,
    radiant: true,
    radiant_win: index < wins,
    radiant_score: index < wins ? 30 : 15,
    dire_score: index < wins ? 20 : 25,
    opposing_team_id: teamId + 100,
    opposing_team_name: `Opponent ${index + 1}`,
  }));
}

interface RepositoryFixture {
  repository: DraftAnalysisRepository;
  calls: {
    heroes: RefreshOptions[];
    durations: Array<{ heroId: number; options: RefreshOptions | undefined }>;
    matchups: Array<{ heroId: number; options: RefreshOptions | undefined }>;
    teams: Array<{ teamId: number; options: RefreshOptions | undefined }>;
  };
}

function repositoryFixture(options: {
  durationsFor?: (heroId: number) => OpenDotaHeroDuration[];
  matchupsFor?: (heroId: number) => OpenDotaHeroMatchup[];
  teamMatchesFor?: (teamId: number) => OpenDotaTeamMatch[];
  source?: CachedResult<unknown>['source'];
} = {}): RepositoryFixture {
  const calls: RepositoryFixture['calls'] = { heroes: [], durations: [], matchups: [], teams: [] };
  const source = options.source ?? 'network';
  return {
    calls,
    repository: {
      listHeroes: (refresh = {}) => {
        calls.heroes.push(refresh);
        return Promise.resolve(cached(catalog(), 100, source));
      },
      getHeroDurations: (heroId, refresh) => {
        calls.durations.push({ heroId, options: refresh });
        const data = options.durationsFor?.(heroId) ?? durations(heroId <= 5 ? 60 : 40);
        return Promise.resolve(cached(data, 100 + heroId, source));
      },
      getHeroMatchups: (heroId, refresh) => {
        calls.matchups.push({ heroId, options: refresh });
        return Promise.resolve(cached(options.matchupsFor?.(heroId) ?? matchups(), 200 + heroId, source));
      },
      getTeamMatches: (teamId, refresh) => {
        calls.teams.push({ teamId, options: refresh });
        const data = options.teamMatchesFor?.(teamId) ?? teamMatches(teamId, teamId === 101 ? 3 : 1);
        return Promise.resolve(cached(data, 300 + teamId, source));
      },
    },
  };
}

describe('analyzeDraft', () => {
  it('loads ten duration lists and five matchup lists, then wires all 25 pairs into the 70/30 model', async () => {
    const fixture = repositoryFixture();

    const result = await analyzeDraft(baseInput, fixture.repository);

    expect(fixture.calls.heroes).toHaveLength(1);
    expect(fixture.calls.durations.map((call) => call.heroId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(fixture.calls.matchups.map((call) => call.heroId)).toEqual([1, 2, 3, 4, 5]);
    expect(fixture.calls.teams).toEqual([]);
    expect(result.matchups).toMatchObject({ requestedPairs: 25, availablePairs: 25, games: 2500 });
    expect(result.matchups.advantage).toBeCloseTo(0.1, 10);
    expect(result.durationBins.every((bin) => Math.abs((bin.advantage ?? 0) - 0.2) < 1e-10)).toBe(true);
    expect(result.weights).toEqual({ duration: 0.7, matchup: 0.3, form: 0, mode: 'draft-only' });
    expect(result.overallProbabilityA).toBeCloseTo(0.67, 10);
    expect(result.favorite).toBe('A');
    expect(result.teamA.heroes[0]).toEqual({ heroId: 1, name: 'Hero 1 Name' });
    expect(result.sources).toHaveLength(16);
  });

  it('adds actual last-20 team form and switches to 55/25/20 weights', async () => {
    const fixture = repositoryFixture();
    const input: DraftAnalysisInput = {
      ...baseInput,
      teamA: { ...baseInput.teamA, teamId: 101 },
      teamB: { ...baseInput.teamB, teamId: 202 },
    };

    const result = await analyzeDraft(input, fixture.repository);

    expect(fixture.calls.teams.map((call) => call.teamId)).toEqual([101, 202]);
    expect(result.teamForm).toMatchObject({ requested: true, included: true, advantage: 0.5 });
    expect(result.teamForm.teamA).toMatchObject({ matches: 4, wins: 3, losses: 1, winRate: 0.75 });
    expect(result.teamForm.teamB).toMatchObject({ matches: 4, wins: 1, losses: 3, winRate: 0.25 });
    expect(result.weights).toEqual({ duration: 0.55, matchup: 0.25, form: 0.2, mode: 'with-team-form' });
    expect(result.overallProbabilityA).toBeCloseTo(0.735, 10);
  });

  it('bounds team form to 20 maps and falls back to draft-only weights when form is empty', async () => {
    const fullFixture = repositoryFixture({ teamMatchesFor: (teamId) => teamMatches(teamId, 25, 25) });
    const emptyFixture = repositoryFixture({ teamMatchesFor: (teamId) => teamId === 101 ? teamMatches(teamId, 3) : [] });
    const input: DraftAnalysisInput = {
      ...baseInput,
      teamA: { ...baseInput.teamA, teamId: 101 },
      teamB: { ...baseInput.teamB, teamId: 202 },
    };

    const fullResult = await analyzeDraft(input, fullFixture.repository);
    const emptyResult = await analyzeDraft(input, emptyFixture.repository);

    expect(fullResult.teamForm.teamA).toMatchObject({ requestedMatches: 20, matches: 20 });
    expect(fullResult.teamForm.teamB).toMatchObject({ requestedMatches: 20, matches: 20 });
    expect(emptyResult.teamForm).toMatchObject({ requested: true, included: false, advantage: null });
    expect(emptyResult.weights.mode).toBe('draft-only');
    expect(emptyResult.confidence.teamForm).toBeCloseTo(0.1, 10);
    expect(emptyResult.confidence.level).toBe('medium');
    expect(emptyResult.warnings).toContainEqual(expect.objectContaining({ code: 'team_form_incomplete' }));
  });

  it('reduces confidence and leaves probability absent instead of inventing neutral matchup data', async () => {
    const fixture = repositoryFixture({
      durationsFor: (heroId) => heroId === 1 ? [] : durations(heroId <= 5 ? 60 : 40),
      matchupsFor: () => [],
      source: 'stale-cache',
    });

    const result = await analyzeDraft(baseInput, fixture.repository);

    expect(result.matchups).toMatchObject({ availablePairs: 0, advantage: null });
    expect(result.overallProbabilityA).toBeNull();
    expect(result.favorite).toBe('unknown');
    expect(result.confidence.level).toBe('medium');
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'duration_data_missing', heroId: 1 }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'matchup_data_missing' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'probability_incomplete' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'stale_data', count: 16 }));
  });

  it('forwards force refresh to all repository calls without making 25 matchup requests', async () => {
    const fixture = repositoryFixture();

    await analyzeDraft({ ...baseInput, forceRefresh: true }, fixture.repository);

    expect(fixture.calls.heroes).toEqual([{ forceRefresh: true }]);
    expect(fixture.calls.durations).toHaveLength(10);
    expect(fixture.calls.matchups).toHaveLength(5);
    expect([...fixture.calls.durations, ...fixture.calls.matchups]
      .every((call) => call.options?.forceRefresh === true)).toBe(true);
  });

  it.each([
    { patch: { teamB: { ...baseInput.teamB, side: 'radiant' as const } }, label: 'same sides' },
    { patch: { teamB: { ...baseInput.teamB, heroIds: [5, 7, 8, 9, 10] } }, label: 'duplicate across teams' },
    { patch: { teamA: { ...baseInput.teamA, heroIds: [1, 2, 3, 4] } }, label: 'not ten heroes' },
    { patch: { odds: { teamA: 1 } }, label: 'invalid odds' },
    { patch: { teamA: { ...baseInput.teamA, teamId: 101 } }, label: 'partial real teams' },
  ])('rejects $label before loading data', async ({ patch }) => {
    const fixture = repositoryFixture();

    await expect(analyzeDraft({ ...baseInput, ...patch }, fixture.repository)).rejects.toMatchObject({
      kind: 'invalid_request',
    });
    expect(fixture.calls).toEqual({ heroes: [], durations: [], matchups: [], teams: [] });
  });

  it('preserves repository error identity', async () => {
    const rateLimit = new ApiError('rate_limit', 'limited', { status: 429 });
    const fixture = repositoryFixture();
    fixture.repository.listHeroes = vi.fn(() => Promise.reject(rateLimit));

    await expect(analyzeDraft(baseInput, fixture.repository)).rejects.toBe(rateLimit);
  });
});
