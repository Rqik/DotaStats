export type AnalysisStatus =
  | 'insufficient_data'
  | 'no_edge'
  | 'borderline'
  | 'statistical_edge';

export interface CoverageSample {
  wins: number;
  matches: number;
}

export interface ProbabilityBreakdown {
  probability: number;
  weights: readonly number[];
}

const assertProbability = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
};

function assertSample({ wins, matches }: CoverageSample): void {
  if (!Number.isInteger(wins) || !Number.isInteger(matches) || wins < 0 || matches < 0 || wins > matches) {
    throw new RangeError('Sample must have integer wins between 0 and matches');
  }
}

/** Laplace smoothing required by the specification: (wins + 1) / (matches + 2). */
export function smoothedFrequency(sample: CoverageSample): number {
  assertSample(sample);
  return (sample.wins + 1) / (sample.matches + 2);
}

export function weightedProbability(
  teamFrequency: number,
  opponentFrequency: number,
  h2hFrequency?: number,
): ProbabilityBreakdown {
  assertProbability(teamFrequency, 'teamFrequency');
  assertProbability(opponentFrequency, 'opponentFrequency');
  if (h2hFrequency === undefined) {
    return { probability: 0.5 * teamFrequency + 0.5 * opponentFrequency, weights: [0.5, 0.5] };
  }
  assertProbability(h2hFrequency, 'h2hFrequency');
  return {
    probability: 0.4 * teamFrequency + 0.4 * opponentFrequency + 0.2 * h2hFrequency,
    weights: [0.4, 0.4, 0.2],
  };
}

/** Uses H2H only when at least three matches were available. */
export function handicapProbability(
  team: CoverageSample,
  opponent: CoverageSample,
  h2h?: CoverageSample,
): ProbabilityBreakdown {
  const teamFrequency = smoothedFrequency(team);
  const opponentFrequency = smoothedFrequency(opponent);
  return h2h !== undefined && h2h.matches >= 3
    ? weightedProbability(teamFrequency, opponentFrequency, smoothedFrequency(h2h))
    : weightedProbability(teamFrequency, opponentFrequency);
}

export function breakevenProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds <= 1) throw new RangeError('Odds must be greater than 1');
  return 1 / odds;
}

/** Difference in probability points, expressed as a fraction (0.031 = 3.1 p.p.). */
export function probabilityEdge(probability: number, odds: number): number {
  assertProbability(probability, 'probability');
  return probability - breakevenProbability(odds);
}

/** The minimum sample threshold applies to the two primary samples, not H2H. */
export function analysisStatus(edge: number, teamMatches: number, opponentMatches: number): AnalysisStatus {
  if (!Number.isFinite(edge)) throw new RangeError('edge must be finite');
  if (!Number.isInteger(teamMatches) || !Number.isInteger(opponentMatches) || teamMatches < 0 || opponentMatches < 0) {
    throw new RangeError('Match counts must be non-negative integers');
  }
  if (teamMatches < 10 || opponentMatches < 10) return 'insufficient_data';
  if (edge < 0.03) return 'no_edge';
  if (edge <= 0.08) return 'borderline';
  return 'statistical_edge';
}
