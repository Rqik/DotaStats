import { useMemo } from 'react';
import type { LeagueOption } from '../../api/openDotaRepository';
import { AccessibleCombobox } from './AccessibleCombobox';

interface LeaguePickerProps {
  leagues: LeagueOption[];
  selectedLeague: LeagueOption | null;
  query: string;
  loading: boolean;
  disabled?: boolean;
  statusId: string;
  onQueryChange: (query: string) => void;
  onSelect: (league: LeagueOption) => void;
}

export function LeaguePicker({ leagues, selectedLeague, query, loading, disabled = false, statusId, onQueryChange, onSelect }: LeaguePickerProps) {
  const options = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return leagues
      .filter((league) => !normalizedQuery || league.name.toLocaleLowerCase().includes(normalizedQuery))
      .map((league) => ({
        id: league.leagueId,
        label: league.name,
        secondaryLabel: league.tier ? `Уровень: ${league.tier}` : 'Выпуск турнира',
      }));
  }, [leagues, query]);

  return <AccessibleCombobox
    label="Лига и выпуск турнира"
    placeholder={loading ? 'Загружаем лиги…' : 'Например, The International'}
    query={query}
    options={options}
    selectedId={selectedLeague?.leagueId ?? null}
    disabled={disabled || loading}
    describedBy={statusId}
    onQueryChange={onQueryChange}
    onSelect={(leagueId) => {
      const league = leagues.find((option) => option.leagueId === leagueId);
      if (league) onSelect(league);
    }}
  />;
}
