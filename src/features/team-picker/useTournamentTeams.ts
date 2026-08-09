import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openDotaRepository,
  type CachedResult,
  type LeagueOption,
  type TeamOption,
} from '../../api/openDotaRepository';
import type {
  TeamPickerRepository,
} from './teamPickerTypes';

interface TournamentTeamsState {
  leagues: CachedResult<LeagueOption[]> | null;
  teams: CachedResult<TeamOption[]> | null;
  loadingLeagues: boolean;
  loadingTeams: boolean;
  error: string;
}

interface UseTournamentTeamsResult extends TournamentTeamsState {
  clearTeams: () => void;
  loadLeagueTeams: (leagueId: number) => Promise<void>;
  retryLeagues: () => Promise<void>;
}

// This is the only team-picker integration seam with the API/data layer.
const repository: TeamPickerRepository = openDotaRepository;
const HOUR_MS = 60 * 60 * 1000;

const initialState: TournamentTeamsState = {
  leagues: null,
  teams: null,
  loadingLeagues: true,
  loadingTeams: false,
  error: '',
};

export function describeDataSource<T>(result: CachedResult<T> | null, showAge: boolean): string {
  if (!result) return '';
  if (result.source === 'network') return 'Источник: OpenDota, получено сейчас.';
  const ageMinutes = Math.max(0, Math.floor((Date.now() - result.savedAt) / 60_000));
  const age = showAge ? `, возраст ${ageMinutes < 60 ? `${ageMinutes} мин` : `${Math.floor(ageMinutes / 60)} ч`}` : '';
  return result.source === 'stale-cache' ? `Источник: устаревший кэш${age}.` : `Источник: кэш${age}.`;
}

export function useTournamentTeams(autoRefresh: boolean): UseTournamentTeamsResult {
  const [state, setState] = useState<TournamentTeamsState>(initialState);
  const teamRequestId = useRef(0);

  const retryLeagues = useCallback(async () => {
    setState((current) => ({ ...current, loadingLeagues: true, error: '' }));
    try {
      const leagues = await repository.listLeagues();
      setState((current) => ({ ...current, leagues, loadingLeagues: false }));
    } catch {
      setState((current) => ({ ...current, loadingLeagues: false, error: 'Не удалось загрузить список лиг. Повторите попытку.' }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void repository.listLeagues().then(
      (leagues) => {
        if (!cancelled) setState((current) => ({ ...current, leagues, loadingLeagues: false }));
      },
      () => {
        if (!cancelled) setState((current) => ({ ...current, loadingLeagues: false, error: 'Не удалось загрузить список лиг. Повторите попытку.' }));
      },
    );
    return () => {
      cancelled = true;
      teamRequestId.current += 1;
    };
  }, []);

  const clearTeams = () => {
    teamRequestId.current += 1;
    setState((current) => ({ ...current, teams: null, loadingTeams: false }));
  };

  const loadLeagueTeams = async (leagueId: number) => {
    const requestId = teamRequestId.current + 1;
    teamRequestId.current = requestId;
    setState((current) => ({ ...current, teams: null, loadingTeams: true, error: '' }));
    try {
      let teams = await repository.listLeagueTeams(leagueId);
      if (autoRefresh && teams.source !== 'network' && Date.now() - teams.savedAt >= HOUR_MS) {
        teams = await repository.listLeagueTeams(leagueId, { forceRefresh: true });
      }
      if (requestId === teamRequestId.current) setState((current) => ({ ...current, teams, loadingTeams: false }));
    } catch {
      if (requestId === teamRequestId.current) setState((current) => ({ ...current, loadingTeams: false, error: 'Не удалось загрузить команды выбранного выпуска.' }));
    }
  };

  return { ...state, clearTeams, loadLeagueTeams, retryLeagues };
}
