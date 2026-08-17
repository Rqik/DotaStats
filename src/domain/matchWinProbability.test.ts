import { describe, expect, it } from 'vitest';
import { matchWinProbability } from './matchWinProbability';

describe('match win probability', () => {
  it('uses selected wins and opponent losses with 50/50 weights', () => {
    const result = matchWinProbability(
      { signals: 10, wins: 7, losses: 3 },
      { signals: 10, wins: 4, losses: 6 },
    );
    expect(result.probability).toBeCloseTo(0.625);
    expect(result.weights).toEqual([0.5, 0.5]);
  });

  it('uses valid H2H signals with 40/40/20 weights', () => {
    const result = matchWinProbability(
      { signals: 10, wins: 7, losses: 3 },
      { signals: 10, wins: 4, losses: 6 },
      { signals: 3, wins: 2, losses: 1 },
    );
    expect(result.weights).toEqual([0.4, 0.4, 0.2]);
    expect(result.probability).toBeCloseTo(0.62, 5);
  });

  it('returns null when either primary sample has fewer than ten winner signals', () => {
    expect(matchWinProbability({ signals: 9, wins: 9, losses: 0 }, { signals: 10, wins: 0, losses: 10 }).probability).toBeNull();
  });
});
