import { useState } from 'react';
import type { LeagueOption, TeamOption } from '../../api/openDotaRepository';
import { useSettingsStore } from '../settings/settingsStore';
import { LeaguePicker } from './LeaguePicker';
import { TeamPicker } from './TeamPicker';
import { describeDataSource, useTournamentTeams } from './useTournamentTeams';

export interface TournamentSelection {
  league: LeagueOption | null;
  teamA: TeamOption | null;
  teamB: TeamOption | null;
}

interface TournamentTeamSelectionProps {
  value: TournamentSelection;
  onChange: (value: TournamentSelection) => void;
}

export function TournamentTeamSelection({ value, onChange }: TournamentTeamSelectionProps) {
  const autoRefresh = useSettingsStore((state) => state.autoRefresh);
  const showCacheAge = useSettingsStore((state) => state.showCacheAge);
  const { leagues, teams, loadingLeagues, loadingTeams, error, clearTeams, loadLeagueTeams, retryLeagues } = useTournamentTeams(autoRefresh);
  const [leagueQuery, setLeagueQuery] = useState('');
  const [teamAQuery, setTeamAQuery] = useState('');
  const [teamBQuery, setTeamBQuery] = useState('');
  const leagueStatusId = 'team-picker-league-status';
  const teamsStatusId = 'team-picker-teams-status';

  const changeLeagueQuery = (query: string) => {
    setLeagueQuery(query);
    if (value.league && query !== value.league.name) {
      clearTeams();
      onChange({ league: null, teamA: null, teamB: null });
      setTeamAQuery('');
      setTeamBQuery('');
    }
  };

  const selectLeague = (league: LeagueOption) => {
    setLeagueQuery(league.name);
    setTeamAQuery('');
    setTeamBQuery('');
    onChange({ league, teamA: null, teamB: null });
    void loadLeagueTeams(league.leagueId);
  };

  const changeTeamQuery = (side: 'a' | 'b', query: string) => {
    if (side === 'a') setTeamAQuery(query);
    else setTeamBQuery(query);
    const selectedTeam = side === 'a' ? value.teamA : value.teamB;
    if (selectedTeam && query !== selectedTeam.name) {
      onChange(side === 'a' ? { ...value, teamA: null } : { ...value, teamB: null });
    }
  };

  const selectTeam = (side: 'a' | 'b', team: TeamOption) => {
    if (side === 'a') {
      setTeamAQuery(team.name);
      onChange({ ...value, teamA: team, teamB: value.teamB?.teamId === team.teamId ? null : value.teamB });
      if (value.teamB?.teamId === team.teamId) setTeamBQuery('');
    } else {
      setTeamBQuery(team.name);
      onChange({ ...value, teamB: team, teamA: value.teamA?.teamId === team.teamId ? null : value.teamA });
      if (value.teamA?.teamId === team.teamId) setTeamAQuery('');
    }
  };

  const leagueItems = leagues?.data ?? [];
  const teamItems = teams?.data ?? [];
  const leagueStatus = error || (leagues && leagueItems.length === 0 ? 'Список лиг пуст.' : describeDataSource(leagues, showCacheAge));
  const teamsStatus = value.league
    ? (loadingTeams ? `Загружаем команды только из выбранного выпуска «${value.league.name}»…` : teams && teamItems.length === 0 ? `Для выпуска «${value.league.name}» команды не найдены.` : `Команды только из выпуска «${value.league.name}». ${describeDataSource(teams, showCacheAge)}`)
    : 'Сначала найдите лигу и выберите конкретный выпуск турнира.';

  return <div className="team-picker">
    <LeaguePicker
      leagues={leagueItems}
      selectedLeague={value.league}
      query={leagueQuery}
      loading={loadingLeagues}
      statusId={leagueStatusId}
      onQueryChange={changeLeagueQuery}
      onSelect={selectLeague}
    />
    <p className={error ? 'team-picker__status team-picker__status--error' : 'team-picker__status'} id={leagueStatusId} role={error ? 'alert' : 'status'}>{leagueStatus || (loadingLeagues ? 'Загружаем список лиг…' : 'Введите название лиги.')}</p>
    {error ? <button className="team-picker__retry" type="button" onClick={() => void (value.league ? loadLeagueTeams(value.league.leagueId) : retryLeagues())}>Повторить загрузку</button> : null}
    <div className="team-picker__teams">
      <TeamPicker label="Команда 1" teams={teamItems} selectedTeam={value.teamA} excludedTeamId={value.teamB?.teamId ?? null} query={teamAQuery} loading={loadingTeams} disabled={!value.league || Boolean(error)} statusId={teamsStatusId} onQueryChange={(query) => changeTeamQuery('a', query)} onSelect={(team) => selectTeam('a', team)} />
      <TeamPicker label="Команда 2" teams={teamItems} selectedTeam={value.teamB} excludedTeamId={value.teamA?.teamId ?? null} query={teamBQuery} loading={loadingTeams} disabled={!value.league || Boolean(error)} statusId={teamsStatusId} onQueryChange={(query) => changeTeamQuery('b', query)} onSelect={(team) => selectTeam('b', team)} />
    </div>
    <p className="team-picker__status" id={teamsStatusId} role="status">{teamsStatus}</p>
  </div>;
}
