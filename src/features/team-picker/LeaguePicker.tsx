import { useMemo } from 'react';
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
  yearFilter: number | null;
  tierFilter: string | null;
  onQueryChange: (query: string) => void;
  onYearFilterChange: (year: number | null) => void;
  onTierFilterChange: (tier: string | null) => void;
  onResetFilters: () => void;
  onSelect: (league: LeagueOption) => void;
}

export function LeaguePicker({
  leagues,
  selectedLeague,
  query,
  loading,
  disabled = false,
  statusId,
  yearFilter,
  tierFilter,
  onQueryChange,
  onYearFilterChange,
  onTierFilterChange,
  onResetFilters,
  onSelect,
}: LeaguePickerProps) {
  const years = useMemo(() => [...new Set(leagues.map((league) => extractLeagueYear(league.name)).filter((year): year is number => year !== null))].sort((left, right) => right - left), [leagues]);
  const tiers = useMemo(() => [...new Set(leagues.map((league) => league.tier).filter((tier): tier is string => Boolean(tier)))].sort((left, right) => formatLeagueTier(left).localeCompare(formatLeagueTier(right), 'ru')), [leagues]);
  const matches = useMemo(() => sortAndFilterLeagues(leagues, query, null), [leagues, query]);
  const options = useMemo(() => sortAndFilterLeagues(matches, '', yearFilter, tierFilter).map((league) => {
      const year = extractLeagueYear(league.name);
      return {
        id: league.leagueId,
        label: league.name,
        secondaryLabel: year === null
          ? `Год в названии не указан${league.tier ? `; уровень: ${formatLeagueTier(league.tier)}` : ''}`
          : `${league.tier ? `Уровень: ${formatLeagueTier(league.tier)}; ` : ''}год в названии: ${year}`,
      };
    }), [matches, tierFilter, yearFilter]);
  const hiddenMatches = matches.length - options.length;
  const hasFilters = yearFilter !== null || tierFilter !== null;
  const searchStatusId = `${statusId}-search`;

  return <div className="team-picker__league-picker">
    <div className="team-picker__league-filter">
      <label>
        <span>Год в названии</span>
        <select aria-label="Фильтр по году выпуска в названии" value={yearFilter ?? ''} onChange={(event) => onYearFilterChange(event.target.value ? Number(event.target.value) : null)} disabled={disabled || loading}>
          <option value="">Все годы</option>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </select>
      </label>
      <label>
        <span>Уровень турнира</span>
        <select aria-label="Фильтр по уровню турнира" value={tierFilter ?? ''} onChange={(event) => onTierFilterChange(event.target.value || null)} disabled={disabled || loading}>
          <option value="">Все уровни</option>
          {tiers.map((tier) => <option value={tier} key={tier}>{formatLeagueTier(tier)}</option>)}
        </select>
      </label>
      <small>Год взят из названия. Фильтр года скрывает выпуски без года в названии, например BLAST SLAM VIII.</small>
    </div>
    <AccessibleCombobox
      label="Лига и выпуск турнира"
      placeholder={loading ? 'Загружаем лиги…' : 'Например, BLAST или The International'}
      query={query}
      options={options}
      selectedId={selectedLeague?.leagueId ?? null}
      disabled={disabled || loading}
      describedBy={`${statusId} ${searchStatusId}`}
      onQueryChange={onQueryChange}
      onSelect={(leagueId) => {
        const league = leagues.find((option) => option.leagueId === leagueId);
        if (league) onSelect(league);
      }}
    />
    {!loading ? <p className="team-picker__status" id={searchStatusId} role="status">
      {options.length > 0 ? `Найдено: ${options.length}.` : 'По запросу ничего не найдено.'}
      {hiddenMatches > 0 ? ` Фильтрами скрыто: ${hiddenMatches}. Сбросьте фильтры, чтобы увидеть эти выпуски.` : ''}
      {options.length > 40 ? ' Показаны первые 40; уточните название.' : ''}
      {matches.length === 0 ? ' Попробуйте другое название или обновите список лиг.' : ''}
    </p> : null}
    {hasFilters ? <button className="team-picker__retry" type="button" disabled={disabled || loading} onClick={onResetFilters}>Сбросить фильтры</button> : null}
  </div>;
}
