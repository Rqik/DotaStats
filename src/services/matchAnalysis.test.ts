import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiErrorKind } from '../api/client';
import type { CachedResult } from '../api/openDotaRepository';
import type { OpenDotaMatch, OpenDotaPickBan, OpenDotaPlayer } from '../api/schemas';
import {
  loadMatchAnalysis,
  normalizeMatchAnalysis,
  type MatchAnalysisRepository,
} from './matchAnalysis';

function players(): OpenDotaPlayer[] {
  return Array.from({ length: 10 }, (_, index) => ({
    account_id: 1000 + index,
    player_slot: index < 5 ? index : 128 + index - 5,
    hero_id: index + 1,
    personaname: `Player ${index + 1}`,
    kills: index,
    deaths: 10 - index,
    assists: index + 2,
  }));
}

function draft(): OpenDotaPickBan[] {
  const picks = Array.from({ length: 10 }, (_, index) => ({
    is_pick: true,
    hero_id: index + 1,
    team: index < 5 ? 0 : 1,
    order: index,
  }));
  return [
    { is_pick: false, hero_id: 20, team: 0, order: 10 },
    ...picks,
    { is_pick: false, hero_id: 21, team: 1, order: 11 },
  ];
}

function completeMatch(): OpenDotaMatch {
  return {
    match_id: 8_000_000_001,
    version: 21,
    start_time: 1_720_000_000,
    duration: 2400,
    radiant_score: 31,
    dire_score: 25,
    radiant_win: true,
    radiant_team: { team_id: 1, name: 'Radiant Pros', tag: 'RAD', logo_url: null },
    dire_team: { team_id: 2, name: 'Dire Pros', tag: 'DIRE', logo_url: null },
    players: players(),
    picks_bans: draft(),
    radiant_gold_adv: [0, 100, -50],
    radiant_xp_adv: [0, 80, 160],
  };
}

function cached(data: OpenDotaMatch, source: CachedResult<unknown>['source'] = 'network'): CachedResult<OpenDotaMatch> {
  return { data, source, savedAt: 1000 };
}

describe('normalizeMatchAnalysis', () => {
  it('normalizes a complete parsed match, lineups, draft, winner and advantage series', () => {
    const result = normalizeMatchAnalysis(completeMatch());

    expect(result).toMatchObject({
      matchId: 8_000_000_001,
      parsed: true,
      durationSeconds: 2400,
      durationMinutes: 40,
      winnerSide: 'radiant',
      winnerTeamId: 1,
      winnerTeamName: 'Radiant Pros',
    });
    expect(result.radiant).toMatchObject({ teamId: 1, name: 'Radiant Pros', score: 31, winner: true });
    expect(result.dire).toMatchObject({ teamId: 2, name: 'Dire Pros', score: 25, winner: false });
    expect(result.radiant.players).toHaveLength(5);
    expect(result.dire.players).toHaveLength(5);
    expect(result.radiant.picks.map((pick) => pick.heroId)).toEqual([1, 2, 3, 4, 5]);
    expect(result.dire.picks.map((pick) => pick.heroId)).toEqual([6, 7, 8, 9, 10]);
    expect(result.bans.map((ban) => ban.heroId)).toEqual([20, 21]);
    expect(result.radiantGoldAdvantage).toEqual([
      { minute: 0, value: 0 },
      { minute: 1, value: 100 },
      { minute: 2, value: -50 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('restores missing draft picks from player hero IDs without claiming draft order', () => {
    const result = normalizeMatchAnalysis({ ...completeMatch(), picks_bans: null });

    expect(result.radiant.picks).toHaveLength(5);
    expect(result.dire.picks).toHaveLength(5);
    expect(result.radiant.picks.every((pick) => pick.source === 'players' && pick.order === null)).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'picks_from_players', side: 'radiant' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'picks_from_players', side: 'dire' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'missing_bans' }));
  });

  it('reports missing picks when neither draft nor player fallback is available', () => {
    const result = normalizeMatchAnalysis({ ...completeMatch(), picks_bans: null, players: undefined });

    expect(result.radiant.picks).toEqual([]);
    expect(result.dire.picks).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'missing_players' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'picks_incomplete', side: 'radiant' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'picks_incomplete', side: 'dire' }));
  });

  it('keeps absent advantage arrays empty and exposes explicit warnings', () => {
    const result = normalizeMatchAnalysis({
      ...completeMatch(),
      radiant_gold_adv: [],
      radiant_xp_adv: null,
    });

    expect(result.radiantGoldAdvantage).toEqual([]);
    expect(result.radiantXpAdvantage).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'missing_gold_advantage' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'missing_xp_advantage' }));
  });

  it('uses Radiant and Dire fallbacks without inferring a winner from kill scores', () => {
    const result = normalizeMatchAnalysis({
      ...completeMatch(),
      version: null,
      radiant_team: null,
      dire_team: null,
      radiant_win: null,
    });

    expect(result.radiant.name).toBe('Radiant');
    expect(result.dire.name).toBe('Dire');
    expect(result.winnerSide).toBeNull();
    expect(result.parsed).toBe(false);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'match_not_parsed' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'missing_winner' }));
  });

  it('maps malformed match data to invalid_schema', () => {
    expect(() => normalizeMatchAnalysis({ match_id: 'bad' })).toThrow(expect.objectContaining({ kind: 'invalid_schema' }));
  });
});

describe('loadMatchAnalysis', () => {
  it('loads through the repository and preserves cache source and age', async () => {
    const getMatch = vi.fn(() => Promise.resolve(cached(completeMatch(), 'cache')));
    const repository: MatchAnalysisRepository = { getMatch };

    await expect(loadMatchAnalysis('8000000001', { repository, now: () => 1600 })).resolves.toMatchObject({
      source: 'cache',
      savedAt: 1000,
      ageMs: 600,
      data: { matchId: 8_000_000_001 },
    });
    expect(getMatch).toHaveBeenCalledWith(8_000_000_001, undefined);
  });

  it('rejects invalid IDs before touching the repository', async () => {
    const getMatch = vi.fn(() => Promise.resolve(cached(completeMatch())));
    const repository: MatchAnalysisRepository = { getMatch };

    await expect(loadMatchAnalysis('12x', { repository })).rejects.toMatchObject({ kind: 'invalid_request' });
    await expect(loadMatchAnalysis(0, { repository })).rejects.toMatchObject({ kind: 'invalid_request' });
    expect(getMatch).not.toHaveBeenCalled();
  });

  it('forwards force refresh to the match repository', async () => {
    const getMatch = vi.fn(() => Promise.resolve(cached(completeMatch())));
    const repository: MatchAnalysisRepository = { getMatch };

    await loadMatchAnalysis(123, { forceRefresh: true, repository });

    expect(getMatch).toHaveBeenCalledWith(123, { forceRefresh: true });
  });

  it.each([
    'not_found',
    'invalid_schema',
    'timeout',
    'rate_limit',
  ] satisfies ApiErrorKind[])('does not collapse the %s repository error', async (kind) => {
    const repositoryError = new ApiError(kind, kind);
    const repository: MatchAnalysisRepository = { getMatch: () => Promise.reject(repositoryError) };

    await expect(loadMatchAnalysis(123, { repository })).rejects.toBe(repositoryError);
  });
});
