import {
  analysisRepository,
  type AnalysisGetResult,
  type AnalysisListResult,
  type SavedAnalysisV2Input,
} from '../../db/analysisRepository';
import type {
  DraftAnalysisInput,
  DraftAnalysisResult,
  KillsHandicapAnalysisResult,
  LoadedMatchAnalysis,
} from './analysisClient';
import type { HandicapAnalysisInput } from '../../stores/analysis';

export type {
  AnalysisMetadata,
  SavedAnalysisDetails,
  SavedAnalysisV2Input,
} from '../../db/analysisRepository';

export function listAnalysisHistory(limit = 6): Promise<AnalysisListResult> {
  return analysisRepository.list(limit);
}

export function loadSavedAnalysis(id: string): Promise<AnalysisGetResult> {
  return analysisRepository.get(id);
}

export function saveAnalysis(record: SavedAnalysisV2Input): Promise<void> {
  return analysisRepository.put(record);
}

export function createAnalysisId(mode: 'handicap' | 'draft' | 'match'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${mode}-${crypto.randomUUID()}`;
  return `${mode}-${Date.now()}`;
}

export function saveHandicapHistory(
  id: string,
  input: HandicapAnalysisInput,
  result: KillsHandicapAnalysisResult,
): Promise<void> {
  if (result.probability === null) {
    return Promise.reject(new Error('Analysis without probability cannot be persisted'));
  }
  const record: Extract<SavedAnalysisV2Input, { mode: 'handicap' }> = {
    version: 2,
    state: 'success',
    id,
    mode: 'handicap',
    title: `${input.selectedTeam} ${input.sign === 'plus' ? '+' : '−'}${input.handicap}`,
    createdAt: Date.now(),
    summary: `${input.teamA} — ${input.teamB}, ${result.usedMatches.length} карт`,
    source: [...new Set([
      result.selectedSample.source,
      result.opponentSample.source,
      result.h2hSample.source,
    ])].join(', '),
    status: result.status,
    payload: { input: { ...input }, result: { ...result, probability: result.probability } },
  };
  return saveAnalysis(record);
}

export function saveDraftHistory(
  id: string,
  input: DraftAnalysisInput,
  result: DraftAnalysisResult,
): Promise<void> {
  if (result.overallProbabilityA === null) {
    return Promise.reject(new Error('Analysis without probability cannot be persisted'));
  }
  const record: Extract<SavedAnalysisV2Input, { mode: 'draft' }> = {
    version: 2,
    state: 'success',
    id,
    mode: 'draft',
    title: `${result.teamA.name} — ${result.teamB.name}`,
    createdAt: Date.now(),
    summary: `Уверенность: ${result.confidence.level}; покрытие ${(result.confidence.coverage * 100).toFixed(0)}%`,
    source: [...new Set(result.sources.map((source) => source.source))].join(', '),
    status: result.favorite,
    payload: { input: { ...input }, result: { ...result, probability: result.overallProbabilityA } },
  };
  return saveAnalysis(record);
}

export function saveMatchHistory(
  id: string,
  matchId: string,
  result: LoadedMatchAnalysis,
): Promise<void> {
  const record: Extract<SavedAnalysisV2Input, { mode: 'match' }> = {
    version: 2,
    state: 'success',
    id,
    mode: 'match',
    title: `Матч #${result.data.matchId}`,
    createdAt: Date.now(),
    summary: `${result.data.radiant.name} — ${result.data.dire.name}`,
    source: result.source,
    status: result.data.parsed ? 'parsed' : 'unparsed',
    payload: { input: matchId, result: { ...result, data: { ...result.data } } },
  };
  return saveAnalysis(record);
}
