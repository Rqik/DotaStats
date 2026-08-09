import {
  analyzeKillsHandicap,
  type HandicapSampleResult,
  type HandicapUsedMatch,
  type KillsHandicapAnalysisInput,
  type KillsHandicapAnalysisResult,
} from '../../services/handicapAnalysis';
import {
  loadMatchAnalysis,
  type LoadedMatchAnalysis,
  type MatchAdvantagePoint,
  type MatchAnalysisResult,
  type MatchDraftBan,
  type MatchDraftPick,
  type MatchPlayerAnalysis,
  type MatchTeamAnalysis,
} from '../../services/matchAnalysis';
import {
  analyzeDraft,
  type DraftAnalysisInput,
  type DraftAnalysisResult,
} from '../../services/draftAnalysis';

export type {
  HandicapSampleResult,
  HandicapUsedMatch,
  KillsHandicapAnalysisInput,
  KillsHandicapAnalysisResult,
  LoadedMatchAnalysis,
  MatchAdvantagePoint,
  MatchAnalysisResult,
  MatchDraftBan,
  MatchDraftPick,
  MatchPlayerAnalysis,
  MatchTeamAnalysis,
  DraftAnalysisInput,
  DraftAnalysisResult,
};

export function requestKillsHandicap(
  input: KillsHandicapAnalysisInput,
): Promise<KillsHandicapAnalysisResult> {
  return analyzeKillsHandicap(input);
}

export function requestMatchAnalysis(matchId: string): Promise<LoadedMatchAnalysis> {
  return loadMatchAnalysis(matchId);
}

export function requestDraftAnalysis(input: DraftAnalysisInput): Promise<DraftAnalysisResult> {
  return analyzeDraft(input);
}
