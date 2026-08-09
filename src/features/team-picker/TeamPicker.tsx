import { useMemo } from 'react';
import type { TeamOption } from '../../api/openDotaRepository';
import { AccessibleCombobox } from './AccessibleCombobox';

interface TeamPickerProps {
  label: string;
  teams: TeamOption[];
  selectedTeam: TeamOption | null;
  excludedTeamId: number | null;
  query: string;
  loading: boolean;
  disabled?: boolean;
  statusId: string;
  onQueryChange: (query: string) => void;
  onSelect: (team: TeamOption) => void;
}

export function TeamPicker({ label, teams, selectedTeam, excludedTeamId, query, loading, disabled = false, statusId, onQueryChange, onSelect }: TeamPickerProps) {
  const options = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return teams
      .filter((team) => team.teamId !== excludedTeamId)
      .filter((team) => !normalizedQuery || `${team.name} ${team.tag ?? ''}`.toLocaleLowerCase().includes(normalizedQuery))
      .map((team) => ({
        id: team.teamId,
        label: team.name,
        secondaryLabel: team.tag ? `Тег: ${team.tag}` : `Team ID: ${team.teamId}`,
      }));
  }, [excludedTeamId, query, teams]);

  return <AccessibleCombobox
    label={label}
    placeholder={loading ? 'Загружаем команды…' : 'Найдите реальную команду'}
    query={query}
    options={options}
    selectedId={selectedTeam?.teamId ?? null}
    disabled={disabled || loading}
    describedBy={statusId}
    onQueryChange={onQueryChange}
    onSelect={(teamId) => {
      const team = teams.find((option) => option.teamId === teamId);
      if (team) onSelect(team);
    }}
  />;
}
