import { Search, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { HeroOption } from '../api/openDotaRepository';
import './HeroPicker.scss';

interface HeroPickerProps {
  label: string;
  heroes: readonly HeroOption[];
  selected: readonly HeroOption[];
  excludedHeroIds: ReadonlySet<number>;
  disabled: boolean;
  onAdd: (hero: HeroOption) => void;
  onRemove: (heroId: number) => void;
}

const maxHeroes = 5;

export function HeroPicker({
  label,
  heroes,
  selected,
  excludedHeroIds,
  disabled,
  onAdd,
  onRemove,
}: HeroPickerProps) {
  const inputId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const selectedIds = new Set(selected.map((hero) => hero.heroId));
  const results = normalizedQuery
    ? heroes.filter((hero) => (
      !selectedIds.has(hero.heroId)
      && !excludedHeroIds.has(hero.heroId)
      && hero.name.toLocaleLowerCase('ru-RU').includes(normalizedQuery)
    )).slice(0, 12)
    : [];

  const addHero = (hero: HeroOption) => {
    onAdd(hero);
    setQuery('');
  };

  return (
    <section className="hero-picker" aria-labelledby={`${inputId}-label`}>
      <header className="hero-picker__header">
        <strong id={`${inputId}-label`}>{label}</strong>
        <span>{selected.length} / {maxHeroes}</span>
      </header>
      <div className="hero-picker__selected" aria-label={`Выбранные герои: ${label}`}>
        {selected.length > 0 ? selected.map((hero) => (
          <span className="hero-picker__chip" key={hero.heroId}>
            {hero.name}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Убрать героя ${hero.name}`}
              onClick={() => onRemove(hero.heroId)}
            >
              <X size={13} />
            </button>
          </span>
        )) : <small>Герои не выбраны.</small>}
      </div>
      <label className="hero-picker__search" htmlFor={inputId}>
        <span>Поиск героя</span>
        <Search size={16} />
        <input
          id={inputId}
          type="search"
          value={query}
          disabled={disabled || selected.length >= maxHeroes}
          aria-controls={normalizedQuery ? resultsId : undefined}
          autoComplete="off"
          placeholder={selected.length >= maxHeroes ? 'Выбрано 5 героев' : 'Начните вводить имя'}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {normalizedQuery ? (
        <div className="hero-picker__results" id={resultsId} aria-live="polite">
          {results.length > 0 ? results.map((hero) => (
            <button type="button" key={hero.heroId} onClick={() => addHero(hero)}>
              <strong>{hero.name}</strong>
              <small>{hero.roles.join(', ') || 'Роль не указана'}</small>
            </button>
          )) : <p>Подходящих доступных героев не найдено.</p>}
        </div>
      ) : <p className="hero-picker__hint">Один герой может быть выбран только за одну команду.</p>}
    </section>
  );
}
