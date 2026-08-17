import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type {
  KillsHandicapAnalysisInput,
  KillsHandicapAnalysisResult,
  LoadedMatchAnalysis,
} from '../features/analysis/analysisClient';

const clientMocks = vi.hoisted(() => ({
  requestKillsHandicap: vi.fn<
    (input: KillsHandicapAnalysisInput) => Promise<KillsHandicapAnalysisResult>
  >(),
  requestMatchAnalysis: vi.fn<(matchId: string) => Promise<LoadedMatchAnalysis>>(),
}));

vi.mock('../features/analysis/analysisClient', () => clientMocks);

const { useAnalysisStore } = await import('./analysis');

const input = {
  leagueId: 42,
  leagueName: 'The International 2026',
  teamAId: 1,
  teamA: 'Radiant Club',
  teamBId: 2,
  teamB: 'Dire Club',
  selectedTeamId: 1,
  selectedTeam: 'Radiant Club',
  sign: 'plus' as const,
  handicap: 7.5,
  odds: 1.8,
  sample: 20 as const,
};

const sample = {
  requested: 20,
  matches: 20,
  wins: 12,
  losses: 8,
  refunds: 0,
  frequency: 13 / 22,
  rawFrequency: 12 / 20,
  included: true,
  source: 'network' as const,
  savedAt: 1_700_000_000_000,
  oldest: '2026-07-01T00:00:00.000Z',
  newest: '2026-08-01T00:00:00.000Z',
  matchIds: [],
};

const handicapResult: KillsHandicapAnalysisResult = {
  selectedTeamId: 1,
  opponentTeamId: 2,
  sign: 'plus',
  line: 7.5,
  signedHandicap: 7.5,
  odds: 1.8,
  sample: 20,
  selectedSample: { ...sample, group: 'selected-team' },
  opponentSample: { ...sample, group: 'opponent-opponents' },
  h2hSample: { ...sample, group: 'h2h' },
  probability: 0.6,
  breakeven: 1 / 1.8,
  edge: 0.6 - (1 / 1.8),
  weights: [0.4, 0.4, 0.2],
  status: 'borderline',
  savedAt: sample.savedAt,
  oldest: sample.oldest,
  newest: sample.newest,
  usedMatches: [],
  warnings: [],
  matchWinProbability: {
    probability: 0.58,
    weights: [0.5, 0.5],
    selected: { signals: 20, wins: 12, losses: 8 },
    opponent: { signals: 20, wins: 10, losses: 10 },
    h2h: { signals: 0, wins: 0, losses: 0 },
  },
};

beforeEach(() => {
  clientMocks.requestKillsHandicap.mockReset();
  clientMocks.requestMatchAnalysis.mockReset();
  useAnalysisStore.setState({ handicap: { status: 'idle' }, match: { status: 'idle' } });
});

describe('analysis store', () => {
  it('stores only the latest handicap request result', async () => {
    let resolveFirst: ((result: KillsHandicapAnalysisResult) => void) | undefined;
    const firstResponse = new Promise<KillsHandicapAnalysisResult>((resolve) => {
      resolveFirst = resolve;
    });
    clientMocks.requestKillsHandicap
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce(handicapResult);

    const firstRun = useAnalysisStore.getState().runHandicap(input);
    const secondInput = { ...input, odds: 2 };
    const secondRun = useAnalysisStore.getState().runHandicap(secondInput);

    await expect(secondRun).resolves.toBe(true);
    resolveFirst?.({ ...handicapResult, odds: input.odds });
    await expect(firstRun).resolves.toBe(false);

    const state = useAnalysisStore.getState().handicap;
    expect(state.status).toBe('success');
    if (state.status === 'success') expect(state.input.odds).toBe(2);
  });

  it('maps an API failure to a Russian error state without fake data', async () => {
    clientMocks.requestKillsHandicap.mockRejectedValue(
      new ApiError('rate_limit', 'OpenDota rate limit exceeded'),
    );

    await expect(useAnalysisStore.getState().runHandicap(input)).resolves.toBe(false);
    expect(useAnalysisStore.getState().handicap).toMatchObject({
      status: 'error',
      errorKind: 'rate_limit',
      message: 'OpenDota временно ограничила запросы. Повторите попытку позже.',
    });
  });
});
