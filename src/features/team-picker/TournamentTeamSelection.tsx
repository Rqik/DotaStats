import { useEffect, useId } from 'react';
import type { LeagueOption, TeamOption } from '../../api/openDotaRepository';
import { useSettingsStore } from '../settings/settingsStore';
import { LeaguePicker } from './LeaguePicker';
import { TeamPicker } from './TeamPicker';
import {
  updateTournamentPickerState,
  type TournamentPickerAction,
  type TournamentPickerState,
} from './tournamentPickerState';
import { describeDataSource, useTournamentTeams } from './useTournamentTeams';

interface TournamentTeamSelectionProps {
  value: TournamentPickerState;
  onChange: (value: TournamentPickerState) => void;
}

export function TournamentTeamSelection({ value, onChange }: TournamentTeamSelectionProps) {
  const autoRefresh = useSettingsStore((state) => state.autoRefresh);
  const showCacheAge = useSettingsStore((state) => state.showCacheAge);
  const { selection } = value;
  const leagueId = selection.league?.leagueId ?? null;
  const { leagues, teams, teamsLeagueId, loadingLeagues, loadingTeams, error, clearTeams, loadLeagueTeams, retryLeagues } = useTournamentTeams(autoRefresh, leagueId);
  const statusIdPrefix = useId();
  const leagueStatusId = `${statusIdPrefix}-league-status`;
  const teamsStatusId = `${statusIdPrefix}-teams-status`;

  useEffect(() => {
    if (loadingTeams || !teams || teamsLeagueId !== leagueId) return;
    const reconciled = updateTournamentPickerState(value, { type: 'reconcile-teams', teams: teams.data });
    if (reconciled !== value) onChange(reconciled);
  }, [leagueId, loadingTeams, onChange, teams, teamsLeagueId, value]);

  const dispatch = (action: TournamentPickerAction) => {
    onChange(updateTournamentPickerState(value, action));
  };

  const changeLeagueQuery = (query: string) => {
    dispatch({ type: 'change-league-query', query });
    if (selection.league && query !== selection.league.name) {
      clearTeams();
    }
  };

  const selectLeague = (league: LeagueOption) => {
    dispatch({ type: 'select-league', league });
  };

  const changeTeamQuery = (side: 'a' | 'b', query: string) => {
    dispatch({ type: 'change-team-query', side, query });
  };

  const selectTeam = (side: 'a' | 'b', team: TeamOption) => {
    dispatch({ type: 'select-team', side, team });
  };

  const leagueItems = leagues?.data ?? [];
  const teamItems = teamsLeagueId === leagueId ? teams?.data ?? [] : [];
  const leagueStatus = error || (leagues && leagueItems.length === 0 ? 'Список лиг пуст.' : describeDataSource(leagues, showCacheAge));
  const teamsStatus = selection.league
    ? (loadingTeams ? `Загружаем команды только из выбранного выпуска «${selection.league.name}»…` : teams && teamItems.length === 0 ? `Для выпуска «${selection.league.name}» команды не найдены.` : `Команды только из выпуска «${selection.league.name}». ${describeDataSource(teams, showCacheAge)}`)
    : 'Сначала найдите лигу и выберите конкретный выпуск турнира.';

  return <div className="team-picker">
    <LeaguePicker
      leagues={leagueItems}
      selectedLeague={selection.league}
      query={value.leagueQuery}
      loading={loadingLeagues}
      statusId={leagueStatusId}
      yearFilter={value.yearFilter}
      tierFilter={value.tierFilter}
      onQueryChange={changeLeagueQuery}
      onYearFilterChange={(year) => dispatch({ type: 'set-year-filter', year })}
      onTierFilterChange={(tier) => dispatch({ type: 'set-tier-filter', tier })}
      onResetFilters={() => dispatch({ type: 'reset-league-filters' })}
      onSelect={selectLeague}
    />
    <p className={error ? 'team-picker__status team-picker__status--error' : 'team-picker__status'} id={leagueStatusId} role={error ? 'alert' : 'status'}>{leagueStatus || (loadingLeagues ? 'Загружаем список лиг…' : 'Введите название лиги.')}</p>
    <button className="team-picker__retry" type="button" disabled={loadingLeagues || loadingTeams} onClick={() => void retryLeagues()}>{loadingLeagues ? 'Обновляем список лиг…' : 'Обновить список лиг'}</button>
    {error ? <button className="team-picker__retry" type="button" onClick={() => void (selection.league ? loadLeagueTeams(selection.league.leagueId) : retryLeagues())}>Повторить загрузку</button> : null}
    <div className="team-picker__teams">
      <TeamPicker label="Команда 1" teams={teamItems} selectedTeam={selection.teamA} excludedTeamId={selection.teamB?.teamId ?? null} query={value.teamAQuery} loading={loadingTeams} disabled={!selection.league || Boolean(error)} statusId={teamsStatusId} onQueryChange={(query) => changeTeamQuery('a', query)} onSelect={(team) => selectTeam('a', team)} />
      <TeamPicker label="Команда 2" teams={teamItems} selectedTeam={selection.teamB} excludedTeamId={selection.teamA?.teamId ?? null} query={value.teamBQuery} loading={loadingTeams} disabled={!selection.league || Boolean(error)} statusId={teamsStatusId} onQueryChange={(query) => changeTeamQuery('b', query)} onSelect={(team) => selectTeam('b', team)} />
    </div>
    <p className="team-picker__status" id={teamsStatusId} role="status">{teamsStatus}</p>
  </div>;
}
