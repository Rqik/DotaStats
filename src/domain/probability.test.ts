import { describe, expect, it } from 'vitest';
import {
  analysisStatus,
  breakevenProbability,
  handicapProbability,
  probabilityEdge,
  smoothedFrequency,
  weightedProbability,
} from './probability';

describe('probability domain', () => {
  it('uses Laplace smoothing for a small sample', () => {
    expect(smoothedFrequency({ wins: 10, matches: 10 })).toBeCloseTo(11 / 12);
    expect(smoothedFrequency({ wins: 0, matches: 0 })).toBe(0.5);
  });

  it('combines two samples with equal 50/50 weights', () => {
    expect(weightedProbability(0.8, 0.6)).toMatchObject({ probability: 0.7, weights: [0.5, 0.5] });
  });

  it('combines H2H with 40/40/20 weights', () => {
    expect(weightedProbability(0.8, 0.6, 0.5)).toMatchObject({ probability: 0.66, weights: [0.4, 0.4, 0.2] });
  });

  it('does not include H2H until three maps exist', () => {
    expect(handicapProbability({ wins: 8, matches: 10 }, { wins: 6, matches: 10 }, { wins: 2, matches: 2 }).weights).toEqual([0.5, 0.5]);
    expect(handicapProbability({ wins: 8, matches: 10 }, { wins: 6, matches: 10 }, { wins: 2, matches: 3 }).weights).toEqual([0.4, 0.4, 0.2]);
  });

  it('calculates breakeven probability and edge', () => {
    expect(breakevenProbability(1.65)).toBeCloseTo(0.6060606);
    expect(probabilityEdge(0.757, 1.65)).toBeCloseTo(0.1509394);
  });

  it('regresses the specification example to 72.0% and +11.394 p.p.', () => {
    const result = handicapProbability(
      { wins: 17, matches: 20 },
      { wins: 14, matches: 20 },
      { wins: 2, matches: 3 },
    );
    expect(result.probability).toBeCloseTo(0.72);
    expect(probabilityEdge(result.probability, 1.65) * 100).toBeCloseTo(11.393939);
  });

  it('applies every analysis status boundary', () => {
    expect(analysisStatus(0.2, 9, 20)).toBe('insufficient_data');
    expect(analysisStatus(0.0299, 10, 10)).toBe('no_edge');
    expect(analysisStatus(0.03, 10, 10)).toBe('borderline');
    expect(analysisStatus(0.08, 10, 10)).toBe('borderline');
    expect(analysisStatus(0.0801, 10, 10)).toBe('statistical_edge');
  });
});
