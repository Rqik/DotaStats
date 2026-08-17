export interface MatchWinSample {
  signals: number;
  wins: number;
  losses: number;
}

export interface MatchWinProbabilityResult {
  probability: number | null;
  weights: readonly number[];
  selected: MatchWinSample;
  opponent: MatchWinSample;
  h2h: MatchWinSample;
}

function validSample(sample: MatchWinSample): void {
  if (!Number.isInteger(sample.signals) || !Number.isInteger(sample.wins) || !Number.isInteger(sample.losses)
    || sample.signals < 0 || sample.wins < 0 || sample.losses < 0
    || sample.wins + sample.losses !== sample.signals) {
    throw new RangeError('Match win sample must contain valid winner signals');
  }
}

function smoothedWins(sample: MatchWinSample, wins = sample.wins): number {
  return (wins + 1) / (sample.signals + 2);
}

export function matchWinProbability(
  selected: MatchWinSample,
  opponent: MatchWinSample,
  h2h: MatchWinSample = { signals: 0, wins: 0, losses: 0 },
): MatchWinProbabilityResult {
  validSample(selected);
  validSample(opponent);
  validSample(h2h);
  const h2hIncluded = h2h.signals >= 3;
  const weights = h2hIncluded ? [0.4, 0.4, 0.2] : [0.5, 0.5];
  const probability = selected.signals < 10 || opponent.signals < 10
    ? null
    : h2hIncluded
      ? 0.4 * smoothedWins(selected)
        + 0.4 * smoothedWins(opponent, opponent.losses)
        + 0.2 * smoothedWins(h2h)
      : 0.5 * smoothedWins(selected) + 0.5 * smoothedWins(opponent, opponent.losses);
  return { probability, weights, selected, opponent, h2h };
}
