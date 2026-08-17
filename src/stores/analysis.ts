import { create } from 'zustand';
import {
  requestKillsHandicap,
  requestDraftAnalysis,
  requestMatchAnalysis,
  type DraftAnalysisInput,
  type DraftAnalysisResult,
  type KillsHandicapAnalysisResult,
  type LoadedMatchAnalysis,
} from '../features/analysis/analysisClient';
import { describeAnalysisError } from '../features/analysis/analysisErrors';
import {
  createAnalysisId,
  saveDraftHistory,
  saveHandicapHistory,
  saveMatchHistory,
} from '../features/analysis/analysisHistoryClient';

export type HandicapSign = 'plus' | 'minus';
export type AnalysisSampleSize = 10 | 20 | 30 | 50 | 100;

export interface HandicapAnalysisInput {
  leagueId: number;
  leagueName: string;
  teamAId: number;
  teamA: string;
  teamBId: number;
  teamB: string;
  selectedTeamId: number;
  selectedTeam: string;
  sign: HandicapSign;
  handicap: number;
  odds: number;
  sample: AnalysisSampleSize;
}

interface IdleAnalysisState {
  status: 'idle';
}

interface LoadingAnalysisState<TInput> {
  status: 'loading';
  requestId: number;
  input: TInput;
}

interface SuccessAnalysisState<TInput, TResult> {
  status: 'success';
  requestId: number;
  input: TInput;
  result: TResult;
}

interface ErrorAnalysisState<TInput> {
  status: 'error';
  requestId: number;
  input: TInput;
  errorKind: string;
  message: string;
}

export type AsyncAnalysisState<TInput, TResult> =
  | IdleAnalysisState
  | LoadingAnalysisState<TInput>
  | SuccessAnalysisState<TInput, TResult>
  | ErrorAnalysisState<TInput>;

export type HandicapAnalysisState = AsyncAnalysisState<
  HandicapAnalysisInput,
  KillsHandicapAnalysisResult
>;
export type MatchAnalysisState = AsyncAnalysisState<string, LoadedMatchAnalysis>;
export type DraftAnalysisState = AsyncAnalysisState<DraftAnalysisInput, DraftAnalysisResult>;

export interface AnalysisPersistenceState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  id?: string;
  message?: string;
}

type PersistedAnalysisMode = 'handicap' | 'draft' | 'match';

interface AnalysisStore {
  handicap: HandicapAnalysisState;
  draft: DraftAnalysisState;
  match: MatchAnalysisState;
  persistence: Record<PersistedAnalysisMode, AnalysisPersistenceState>;
  runHandicap: (input: HandicapAnalysisInput) => Promise<boolean>;
  runDraft: (input: DraftAnalysisInput) => Promise<boolean>;
  loadMatch: (matchId: string) => Promise<boolean>;
  retryPersistence: (mode: PersistedAnalysisMode) => Promise<void>;
  resetHandicap: () => void;
  resetDraft: () => void;
  resetMatch: () => void;
  resetAll: () => void;
}

let handicapRequestId = 0;
let draftRequestId = 0;
let matchRequestId = 0;

const idleState: IdleAnalysisState = { status: 'idle' };
const idlePersistence: AnalysisPersistenceState = { status: 'idle' };

export const useAnalysisStore = create<AnalysisStore>((set, get) => {
  const persist = async (mode: PersistedAnalysisMode, id: string): Promise<void> => {
    const state = get();
    set((current) => ({
      persistence: { ...current.persistence, [mode]: { status: 'saving', id } },
    }));
    try {
      if (mode === 'handicap' && state.handicap.status === 'success') {
        await saveHandicapHistory(id, state.handicap.input, state.handicap.result);
      } else if (mode === 'draft' && state.draft.status === 'success') {
        await saveDraftHistory(id, state.draft.input, state.draft.result);
      } else if (mode === 'match' && state.match.status === 'success') {
        await saveMatchHistory(id, state.match.input, state.match.result);
      } else {
        return;
      }
      if (get().persistence[mode].id === id) {
        set((current) => ({
          persistence: { ...current.persistence, [mode]: { status: 'saved', id } },
        }));
      }
    } catch {
      if (get().persistence[mode].id === id) {
        set((current) => ({
          persistence: {
            ...current.persistence,
            [mode]: {
              status: 'error',
              id,
              message: 'Результат показан, но не сохранён в истории IndexedDB.',
            },
          },
        }));
      }
    }
  };

  return {
  handicap: idleState,
  draft: idleState,
  match: idleState,
  persistence: { handicap: idlePersistence, draft: idlePersistence, match: idlePersistence },
  runHandicap: async (input) => {
    const requestId = ++handicapRequestId;
    set((state) => ({
      handicap: { status: 'loading', requestId, input },
      persistence: { ...state.persistence, handicap: idlePersistence },
    }));

    const opponentIsTeamA = input.selectedTeamId === input.teamBId;
    const opponentTeamId = opponentIsTeamA ? input.teamAId : input.teamBId;
    const opponentTeamName = opponentIsTeamA ? input.teamA : input.teamB;

    try {
      const result = await requestKillsHandicap({
        selectedTeamId: input.selectedTeamId,
        opponentTeamId,
        selectedTeamName: input.selectedTeam,
        opponentTeamName,
        sign: input.sign,
        line: input.handicap,
        odds: input.odds,
        sample: input.sample,
      });
      const active = get().handicap;
      if (active.status !== 'loading' || active.requestId !== requestId) return false;
      set({ handicap: { status: 'success', requestId, input, result } });
      void persist('handicap', createAnalysisId('handicap'));
      return true;
    } catch (error) {
      const active = get().handicap;
      if (active.status !== 'loading' || active.requestId !== requestId) return false;
      const details = describeAnalysisError(error);
      set({
        handicap: {
          status: 'error',
          requestId,
          input,
          errorKind: details.kind,
          message: details.message,
        },
      });
      return false;
    }
  },
  runDraft: async (input) => {
    const requestId = ++draftRequestId;
    set((state) => ({
      draft: { status: 'loading', requestId, input },
      persistence: { ...state.persistence, draft: idlePersistence },
    }));
    try {
      const result = await requestDraftAnalysis(input);
      const active = get().draft;
      if (active.status !== 'loading' || active.requestId !== requestId) return false;
      set({ draft: { status: 'success', requestId, input, result } });
      void persist('draft', createAnalysisId('draft'));
      return true;
    } catch (error) {
      const active = get().draft;
      if (active.status !== 'loading' || active.requestId !== requestId) return false;
      const details = describeAnalysisError(error);
      set({
        draft: {
          status: 'error',
          requestId,
          input,
          errorKind: details.kind,
          message: details.message,
        },
      });
      return false;
    }
  },
  loadMatch: async (matchId) => {
    const requestId = ++matchRequestId;
    set((state) => ({
      match: { status: 'loading', requestId, input: matchId },
      persistence: { ...state.persistence, match: idlePersistence },
    }));

    try {
      const result = await requestMatchAnalysis(matchId);
      const active = get().match;
      if (active.status !== 'loading' || active.requestId !== requestId) return false;
      set({ match: { status: 'success', requestId, input: matchId, result } });
      void persist('match', createAnalysisId('match'));
      return true;
    } catch (error) {
      const active = get().match;
      if (active.status !== 'loading' || active.requestId !== requestId) return false;
      const details = describeAnalysisError(error);
      set({
        match: {
          status: 'error',
          requestId,
          input: matchId,
          errorKind: details.kind,
          message: details.message,
        },
      });
      return false;
    }
  },
  retryPersistence: async (mode) => {
    const current = get().persistence[mode];
    await persist(mode, current.id ?? createAnalysisId(mode));
  },
  resetHandicap: () => {
    handicapRequestId += 1;
    set((state) => ({
      handicap: idleState,
      persistence: { ...state.persistence, handicap: idlePersistence },
    }));
  },
  resetDraft: () => {
    draftRequestId += 1;
    set((state) => ({
      draft: idleState,
      persistence: { ...state.persistence, draft: idlePersistence },
    }));
  },
  resetMatch: () => {
    matchRequestId += 1;
    set((state) => ({
      match: idleState,
      persistence: { ...state.persistence, match: idlePersistence },
    }));
  },
  resetAll: () => {
    handicapRequestId += 1;
    draftRequestId += 1;
    matchRequestId += 1;
    set({
      handicap: idleState,
      draft: idleState,
      match: idleState,
      persistence: { handicap: idlePersistence, draft: idlePersistence, match: idlePersistence },
    });
  },
  };
});
