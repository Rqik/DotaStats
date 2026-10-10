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
  teamsLeagueId: number | null;
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

async function fetchLeagueTeams(leagueId: number, autoRefresh: boolean): Promise<CachedResult<TeamOption[]>> {
  const teams = await repository.listLeagueTeams(leagueId);
  if (autoRefresh && teams.source !== 'network' && Date.now() - teams.savedAt >= HOUR_MS) {
    return repository.listLeagueTeams(leagueId, { forceRefresh: true });
  }
  return teams;
}

const initialState: TournamentTeamsState = {
  leagues: null,
  teams: null,
  teamsLeagueId: null,
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

export function useTournamentTeams(autoRefresh: boolean, leagueId: number | null): UseTournamentTeamsResult {
  const [state, setState] = useState<TournamentTeamsState>(() => ({ ...initialState, loadingTeams: leagueId !== null }));
  const teamRequestId = useRef(0);

  const retryLeagues = useCallback(async () => {
    setState((current) => ({ ...current, loadingLeagues: true, error: '' }));
    try {
      const leagues = await repository.listLeagues({ forceRefresh: true });
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

  const clearTeams = useCallback(() => {
    teamRequestId.current += 1;
    setState((current) => ({ ...current, teams: null, teamsLeagueId: null, loadingTeams: false }));
  }, []);

  const loadLeagueTeams = useCallback(async (leagueId: number) => {
    const requestId = teamRequestId.current + 1;
    teamRequestId.current = requestId;
    setState((current) => ({ ...current, teams: null, teamsLeagueId: null, loadingTeams: true, error: '' }));
    try {
      const teams = await fetchLeagueTeams(leagueId, autoRefresh);
      if (requestId === teamRequestId.current) setState((current) => ({ ...current, teams, teamsLeagueId: leagueId, loadingTeams: false }));
    } catch {
      if (requestId === teamRequestId.current) setState((current) => ({ ...current, loadingTeams: false, error: 'Не удалось загрузить команды выбранного выпуска.' }));
    }
  }, [autoRefresh]);

  useEffect(() => {
    const requestId = ++teamRequestId.current;
    if (leagueId === null) return;
    void fetchLeagueTeams(leagueId, autoRefresh).then((teams) => {
      if (requestId === teamRequestId.current) setState((current) => ({ ...current, teams, teamsLeagueId: leagueId, loadingTeams: false, error: '' }));
    }).catch(() => {
      if (requestId === teamRequestId.current) setState((current) => ({ ...current, teams: null, teamsLeagueId: leagueId, loadingTeams: false, error: 'Не удалось загрузить команды выбранного выпуска.' }));
    });
    return () => { teamRequestId.current += 1; };
  }, [leagueId, autoRefresh]);

  const loadingTeams = leagueId !== null && (state.loadingTeams || (state.teamsLeagueId !== leagueId && !state.error));
  return { ...state, loadingTeams, clearTeams, loadLeagueTeams, retryLeagues };
}
