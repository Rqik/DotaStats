import { create } from 'zustand';
import {
  analysisStatus,
  breakevenProbability,
  probabilityEdge,
  smoothedFrequency,
  weightedProbability,
  type AnalysisStatus,
} from '../domain/probability';

export type HandicapSign = 'plus' | 'minus';

export interface HandicapAnalysisInput {
  teamA: string;
  teamB: string;
  selectedTeam: string;
  sign: HandicapSign;
  handicap: number;
  odds: number;
  sample: number;
}

export interface HandicapAnalysisResult {
  teamFrequency: number;
  opponentFrequency: number;
  h2hFrequency: number;
  probability: number;
  breakeven: number;
  edge: number;
  status: AnalysisStatus;
}

export const demoHandicapInput: HandicapAnalysisInput = {
  teamA: 'Team Falcons',
  teamB: 'Vici Gaming',
  selectedTeam: 'Vici Gaming',
  sign: 'plus',
  handicap: 20.5,
  odds: 1.65,
  sample: 20,
};

export function calculateDemoHandicapResult(input: HandicapAnalysisInput): HandicapAnalysisResult {
  const teamFrequency = smoothedFrequency({ wins: 17, matches: 20 });
  const opponentFrequency = smoothedFrequency({ wins: 14, matches: 20 });
  const h2hFrequency = smoothedFrequency({ wins: 2, matches: 3 });
  const weighted = weightedProbability(teamFrequency, opponentFrequency, h2hFrequency);
  const breakeven = breakevenProbability(input.odds);
  const edge = probabilityEdge(weighted.probability, input.odds);

  return {
    teamFrequency,
    opponentFrequency,
    h2hFrequency,
    probability: weighted.probability,
    breakeven,
    edge,
    status: analysisStatus(edge, 20, 20),
  };
}

interface AnalysisStore {
  handicapInput: HandicapAnalysisInput | null;
  handicapResult: HandicapAnalysisResult | null;
  runHandicap: (input: HandicapAnalysisInput) => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  handicapInput: null,
  handicapResult: null,
  runHandicap: (input) => set({ handicapInput: input, handicapResult: calculateDemoHandicapResult(input) }),
}));
