import { describe, expect, it } from 'vitest';
import type { CachedResult } from '../api/openDotaRepository';
import type { OpenDotaTeamMatch } from '../api/schemas';
import {
  analyzeKillsHandicap,
  type KillsHandicapAnalysisInput,
  type TeamMatchesRepository,
} from './handicapAnalysis';

const baseInput: KillsHandicapAnalysisInput = {
  selectedTeamId: 1,
  opponentTeamId: 2,
  selectedTeamName: 'Selected',
  opponentTeamName: 'Opponent',
  sign: 'plus',
  line: 5,
  odds: 1.8,
  sample: 10,
};

function teamMatch(options: {
  matchId: number;
  startTime?: number;
  queriedRadiant: boolean;
  queriedKills: number | null;
  opposingKills: number | null;
  opposingTeamId: number;
  opposingTeamName?: string;
}): OpenDotaTeamMatch {
  return {
    match_id: options.matchId,
    start_time: options.startTime ?? 1_720_000_000 + options.matchId,
    radiant: options.queriedRadiant,
    radiant_score: options.queriedRadiant ? options.queriedKills : options.opposingKills,
    dire_score: options.queriedRadiant ? options.opposingKills : options.queriedKills,
    opposing_team_id: options.opposingTeamId,
    opposing_team_name: options.opposingTeamName ?? `Team ${options.opposingTeamId}`,
  };
}

function response(data: OpenDotaTeamMatch[], savedAt = 100): CachedResult<OpenDotaTeamMatch[]> {
  return { data, source: 'network', savedAt };
}

function repositoryFor(selected: OpenDotaTeamMatch[], opponent: OpenDotaTeamMatch[]): TeamMatchesRepository {
  return {
    getTeamMatches: (teamId) => Promise.resolve(teamId === 1 ? response(selected, 100) : response(opponent, 200)),
  };
}

describe('analyzeKillsHandicap', () => {
  it('uses selected-team, opponent-opponents and H2H directionality exactly', async () => {
    const selected = [
      teamMatch({ matchId: 101, queriedRadiant: true, queriedKills: 10, opposingKills: 14, opposingTeamId: 2, opposingTeamName: 'Opponent' }),
      teamMatch({ matchId: 102, queriedRadiant: false, queriedKills: 8, opposingKills: 14, opposingTeamId: 2, opposingTeamName: 'Opponent' }),
      teamMatch({ matchId: 103, queriedRadiant: true, queriedKills: 10, opposingKills: 15, opposingTeamId: 2, opposingTeamName: 'Opponent' }),
    ];
    const opponent = [
      teamMatch({ matchId: 101, queriedRadiant: false, queriedKills: 14, opposingKills: 10, opposingTeamId: 1, opposingTeamName: 'Selected' }),
      teamMatch({ matchId: 102, queriedRadiant: true, queriedKills: 14, opposingKills: 8, opposingTeamId: 1, opposingTeamName: 'Selected' }),
      teamMatch({ matchId: 103, queriedRadiant: false, queriedKills: 15, opposingKills: 10, opposingTeamId: 1, opposingTeamName: 'Selected' }),
      teamMatch({ matchId: 104, queriedRadiant: true, queriedKills: 20, opposingKills: 16, opposingTeamId: 3, opposingTeamName: 'Third Team' }),
    ];

    const result = await analyzeKillsHandicap(baseInput, repositoryFor(selected, opponent));

    expect(result.selectedSample).toMatchObject({ matches: 3, wins: 1, losses: 1, refunds: 1, rawFrequency: 1 / 3 });
    // Opponent sample settles each actual opponent against team 2: 10/8/10/16 +5 versus 14/14/15/20.
    // Margins are +1/-1/0/+1, therefore two wins, one loss and one refund.
    expect(result.opponentSample).toMatchObject({ matches: 4, wins: 2, losses: 1, refunds: 1 });
    expect(result.h2hSample).toMatchObject({ matches: 3, wins: 1, losses: 1, refunds: 1, included: true });
    expect(result.weights).toEqual([0.4, 0.4, 0.2]);
    expect(result.selectedSample).toMatchObject({ source: 'network', savedAt: 100 });
    expect(result.opponentSample).toMatchObject({ source: 'network', savedAt: 200 });
    expect(result.savedAt).toBe(100);
    expect(result.oldest).not.toBeNull();
    expect(result.newest).not.toBeNull();
    expect(result.usedMatches.map((row) => row.matchId)).toHaveLength(4);
    expect(result.usedMatches.find((row) => row.matchId === 101)?.groups).toEqual([
      'selected-team',
      'opponent-opponents',
      'h2h',
    ]);
  });

  it('applies minus handicap and keeps an integer refund out of wins', async () => {
    const selected = [
      teamMatch({ matchId: 201, queriedRadiant: true, queriedKills: 20, opposingKills: 15, opposingTeamId: 9 }),
      teamMatch({ matchId: 202, queriedRadiant: true, queriedKills: 21, opposingKills: 15, opposingTeamId: 9 }),
    ];
    const opponent = [
      teamMatch({ matchId: 203, queriedRadiant: true, queriedKills: 15, opposingKills: 20, opposingTeamId: 8 }),
    ];

    const result = await analyzeKillsHandicap(
      { ...baseInput, sign: 'minus', line: 5 },
      repositoryFor(selected, opponent),
    );

    expect(result.signedHandicap).toBe(-5);
    expect(result.selectedSample).toMatchObject({ wins: 1, refunds: 1, losses: 0 });
    expect(result.selectedSample.frequency).toBeCloseTo(2 / 4);
    expect(result.usedMatches.find((row) => row.matchId === 201)).toMatchObject({ outcome: 'refund', margin: 0 });
  });

  it('skips missing scores instead of fabricating rows', async () => {
    const selected = [
      teamMatch({ matchId: 301, queriedRadiant: true, queriedKills: null, opposingKills: 15, opposingTeamId: 9 }),
      teamMatch({ matchId: 302, queriedRadiant: true, queriedKills: 12, opposingKills: 15, opposingTeamId: 9 }),
    ];
    const result = await analyzeKillsHandicap(
      baseInput,
      repositoryFor(selected, [teamMatch({ matchId: 303, queriedRadiant: false, queriedKills: 20, opposingKills: 15, opposingTeamId: 8 })]),
    );

    expect(result.selectedSample.matches).toBe(1);
    expect(result.usedMatches.some((row) => row.matchId === 301)).toBe(false);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'selected_matches_skipped', count: 1 }));
  });

  it('deduplicates and slices the newest requested sample', async () => {
    const matches = Array.from({ length: 12 }, (_, index) => teamMatch({
      matchId: 400 + index,
      startTime: 1_720_000_000 + index,
      queriedRadiant: true,
      queriedKills: 20,
      opposingKills: 19,
      opposingTeamId: 100 + index,
    }));
    matches.push(matches[11]);

    const result = await analyzeKillsHandicap(baseInput, repositoryFor(matches, matches));

    expect(result.selectedSample.matches).toBe(10);
    expect(result.selectedSample.matchIds).toEqual([411, 410, 409, 408, 407, 406, 405, 404, 403, 402]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'selected_matches_skipped', count: 1 }));
  });

  it('starts both repository loads in parallel', async () => {
    const calls: number[] = [];
    let resolveSelected: ((value: CachedResult<OpenDotaTeamMatch[]>) => void) | undefined;
    let resolveOpponent: ((value: CachedResult<OpenDotaTeamMatch[]>) => void) | undefined;
    const selectedPromise = new Promise<CachedResult<OpenDotaTeamMatch[]>>((resolve) => { resolveSelected = resolve; });
    const opponentPromise = new Promise<CachedResult<OpenDotaTeamMatch[]>>((resolve) => { resolveOpponent = resolve; });
    const repository: TeamMatchesRepository = {
      getTeamMatches: (teamId) => {
        calls.push(teamId);
        return teamId === 1 ? selectedPromise : opponentPromise;
      },
    };

    const pending = analyzeKillsHandicap(baseInput, repository);
    await Promise.resolve();
    expect(calls).toEqual([1, 2]);
    resolveSelected?.(response([]));
    resolveOpponent?.(response([]));
    await pending;
  });

  it('forwards force refresh to both team match loads', async () => {
    const calls: Array<{ teamId: number; forceRefresh: boolean | undefined }> = [];
    const repository: TeamMatchesRepository = {
      getTeamMatches: (teamId, options) => {
        calls.push({ teamId, forceRefresh: options?.forceRefresh });
        return Promise.resolve(response([]));
      },
    };

    await analyzeKillsHandicap({ ...baseInput, forceRefresh: true }, repository);

    expect(calls).toEqual([
      { teamId: 1, forceRefresh: true },
      { teamId: 2, forceRefresh: true },
    ]);
  });

  it('maps invalid input to a distinguishable invalid_request error', async () => {
    await expect(analyzeKillsHandicap(
      { ...baseInput, selectedTeamId: 1, opponentTeamId: 1 },
      repositoryFor([], []),
    )).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});
