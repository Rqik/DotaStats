import { useMemo, useState } from 'react';
import type { LeagueOption } from '../../api/openDotaRepository';
import { AccessibleCombobox } from './AccessibleCombobox';
import { extractLeagueYear, formatLeagueTier, sortAndFilterLeagues } from './leagueSort';

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
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const years = useMemo(() => [...new Set(leagues.map((league) => extractLeagueYear(league.name)).filter((year): year is number => year !== null))].sort((left, right) => right - left), [leagues]);
  const tiers = useMemo(() => [...new Set(leagues.map((league) => league.tier).filter((tier): tier is string => Boolean(tier)))].sort((left, right) => formatLeagueTier(left).localeCompare(formatLeagueTier(right), 'ru')), [leagues]);
  const options = useMemo(() => sortAndFilterLeagues(leagues, query, yearFilter, tierFilter).map((league) => {
      const year = extractLeagueYear(league.name);
      return {
        id: league.leagueId,
        label: league.name,
        secondaryLabel: year === null
          ? (league.tier ? `Уровень: ${formatLeagueTier(league.tier)}` : 'Точная дата недоступна в OpenDota')
          : `${league.tier ? `Уровень: ${formatLeagueTier(league.tier)}; ` : ''}год в названии: ${year}`,
      };
    }), [leagues, query, tierFilter, yearFilter]);

  return <div className="team-picker__league-picker">
    <div className="team-picker__league-filter">
      <label>
        <span>Год в названии</span>
        <select aria-label="Фильтр по году выпуска в названии" value={yearFilter ?? ''} onChange={(event) => setYearFilter(event.target.value ? Number(event.target.value) : null)} disabled={disabled || loading}>
          <option value="">Все годы</option>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </select>
      </label>
      <label>
        <span>Уровень турнира</span>
        <select aria-label="Фильтр по уровню турнира" value={tierFilter ?? ''} onChange={(event) => setTierFilter(event.target.value || null)} disabled={disabled || loading}>
          <option value="">Все уровни</option>
          {tiers.map((tier) => <option value={tier} key={tier}>{formatLeagueTier(tier)}</option>)}
        </select>
      </label>
      <small>Год взят из названия выпуска; точная дата недоступна в OpenDota.</small>
    </div>
    <AccessibleCombobox
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
    />
  </div>;
}
