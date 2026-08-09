import { describe, expect, it } from 'vitest';
import {
  DRAFT_DURATION_BINS,
  aggregateHeroDurations,
  calculateDraftConfidence,
  calculateDraftModel,
  calculateDurationComponents,
  calculateMatchupComponent,
  draftWeights,
  summarizeTeamForm,
  type DraftDurationComponent,
} from './draftAnalysis';

function durationComponents(advantages: readonly (number | null)[]): DraftDurationComponent[] {
  return DRAFT_DURATION_BINS.map((bin, index) => ({
    bin,
    teamA: { heroesRequested: 5, heroesWithData: advantages[index] === null ? 0 : 5, games: 100, winRate: 0.5 },
    teamB: { heroesRequested: 5, heroesWithData: advantages[index] === null ? 0 : 5, games: 100, winRate: 0.5 },
    advantage: advantages[index] ?? null,
  }));
}

describe('draft duration components', () => {
  it('aggregates OpenDota lower-bound duration rows into the five specification bins', () => {
    const result = aggregateHeroDurations(1, [
      { durationBinSeconds: 0, gamesPlayed: 10, wins: 4 },
      { durationBinSeconds: 600, gamesPlayed: 10, wins: 6 },
      { durationBinSeconds: 1200, gamesPlayed: 20, wins: 11 },
      { durationBinSeconds: 1800, gamesPlayed: 30, wins: 18 },
      { durationBinSeconds: 2400, gamesPlayed: 40, wins: 20 },
      { durationBinSeconds: 3000, gamesPlayed: 50, wins: 35 },
    ]);

    expect(result.bins).toEqual([
      { bin: 'lt20', games: 20, wins: 10, winRate: 0.5 },
      { bin: '20-30', games: 20, wins: 11, winRate: 0.55 },
      { bin: '30-40', games: 30, wins: 18, winRate: 0.6 },
      { bin: '40-50', games: 40, wins: 20, winRate: 0.5 },
      { bin: '50+', games: 50, wins: 35, winRate: 0.7 },
    ]);
  });

  it('averages hero win rates per team instead of letting large samples dominate a hero', () => {
    const teamA = [
      aggregateHeroDurations(1, [{ durationBinSeconds: 1200, gamesPlayed: 100, wins: 80 }]),
      aggregateHeroDurations(2, [{ durationBinSeconds: 1200, gamesPlayed: 10, wins: 4 }]),
    ];
    const teamB = [
      aggregateHeroDurations(3, [{ durationBinSeconds: 1200, gamesPlayed: 20, wins: 10 }]),
    ];

    const result = calculateDurationComponents(teamA, teamB).find((row) => row.bin === '20-30');
    expect(result).toMatchObject({
      teamA: { heroesWithData: 2 },
      teamB: { heroesWithData: 1 },
    });
    expect(result?.teamA.winRate).toBeCloseTo(0.6, 10);
    expect(result?.teamB.winRate).toBeCloseTo(0.5, 10);
    expect(result?.advantage).toBeCloseTo(0.1, 10);
  });
});

describe('draft matchup and model formula', () => {
  it('calculates the exact unweighted average of all 25 hero pairs relative to 50%', () => {
    const requested = Array.from({ length: 5 }, (_, a) => (
      Array.from({ length: 5 }, (_, b) => ({ heroAId: a + 1, heroBId: b + 6 }))
    )).flat();
    const available = requested.map((pair, index) => ({
      ...pair,
      gamesPlayed: 100,
      winsA: index < 13 ? 60 : 40,
    }));

    const result = calculateMatchupComponent(requested, available);

    expect(result.availablePairs).toBe(25);
    expect(result.games).toBe(2500);
    expect(result.advantage).toBeCloseTo(0.004, 10);
  });

  it('uses the exact 70/30 and 55/25/20 formula modes', () => {
    expect(draftWeights(false)).toEqual({ duration: 0.7, matchup: 0.3, form: 0, mode: 'draft-only' });
    expect(draftWeights(true)).toEqual({ duration: 0.55, matchup: 0.25, form: 0.2, mode: 'with-team-form' });
    expect(calculateDraftModel(durationComponents([0.1, 0.1, 0.1, 0.1, 0.1]), 0.2, null, false)
      .bins[0].probabilityA).toBeCloseTo(0.63, 10);
    expect(calculateDraftModel(durationComponents([0.1, 0.1, 0.1, 0.1, 0.1]), 0.2, 0.3, true)
      .bins[0].probabilityA).toBeCloseTo(0.665, 10);
  });

  it('clamps every bin to 15–85 percent', () => {
    expect(calculateDraftModel(durationComponents([1, 1, 1, 1, 1]), 1, null, false)
      .bins.every((bin) => bin.probabilityA === 0.85)).toBe(true);
    expect(calculateDraftModel(durationComponents([-1, -1, -1, -1, -1]), -1, null, false)
      .bins.every((bin) => bin.probabilityA === 0.15)).toBe(true);
  });

  it('linearly interpolates control points and excludes the under-20 bin from the overall value', () => {
    const result = calculateDraftModel(durationComponents([0, 0.1, 0.2, 0.3, 0.4]), 0, null, false);

    expect(result.timeSeries.find((point) => point.minute === 20)?.probabilityA).toBeCloseTo(0.535, 10);
    expect(result.timeSeries.find((point) => point.minute === 30)?.probabilityA).toBeCloseTo(0.605, 10);
    expect(result.timeSeries.find((point) => point.minute === 50)?.probabilityA).toBeCloseTo(0.7333333333, 9);
    expect(result.overallProbabilityA).toBeCloseTo((0.57 + 0.64 + 0.71 + 0.78) / 4, 10);
    expect(result.peak).toMatchObject({ minute: 60, team: 'A', advantage: 0.28 });
  });

  it('keeps probabilities absent when a required component is missing and lowers confidence by coverage', () => {
    const result = calculateDraftModel(durationComponents([null, 0.1, null, 0.1, null]), null, null, false);
    const confidence = calculateDraftConfidence({
      durationAvailableCells: 25,
      durationRequestedCells: 50,
      matchupAvailablePairs: 5,
      matchupRequestedPairs: 25,
      withTeamForm: false,
    });

    expect(result.bins.every((bin) => bin.probabilityA === null)).toBe(true);
    expect(confidence).toMatchObject({ level: 'low', durations: 0.5, matchups: 0.2, teamForm: null });
    expect(confidence.coverage).toBeCloseTo(0.41, 10);
  });
});

describe('team form', () => {
  it('reports win rate, kill margin and duration from the actual bounded sample', () => {
    expect(summarizeTeamForm([
      { won: true, killMargin: 10, durationSeconds: 1800 },
      { won: false, killMargin: -4, durationSeconds: 2400 },
      { won: null, killMargin: 0, durationSeconds: null },
    ])).toEqual({
      requestedMatches: 20,
      matches: 3,
      decidedMatches: 2,
      wins: 1,
      losses: 1,
      winRate: 0.5,
      averageKillMargin: 2,
      averageDurationMinutes: 35,
    });
  });
});
