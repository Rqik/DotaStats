import { RefreshCw } from 'lucide-react';
import type { CachedResult, HeroOption } from '../api/openDotaRepository';
import type { DraftFormValue, DraftTeamSide } from '../features/analysis/draftForm';
import {
  TournamentTeamSelection,
  type TournamentSelection,
} from '../features/team-picker/TournamentTeamSelection';
import { HeroPicker } from './HeroPicker';
import './DraftAnalysisForm.scss';

interface DraftAnalysisFormProps {
  value: DraftFormValue;
  catalog: CachedResult<HeroOption[]> | null;
  loadingCatalog: boolean;
  catalogError: string;
  tournamentSelection: TournamentSelection;
  onChange: (value: DraftFormValue) => void;
  onTournamentSelectionChange: (value: TournamentSelection) => void;
  onRetryCatalog: () => void;
}

function oppositeSide(side: DraftTeamSide): DraftTeamSide {
  return side === 'radiant' ? 'dire' : 'radiant';
}

function catalogSource(catalog: CachedResult<HeroOption[]> | null): string {
  if (!catalog) return '';
  if (catalog.source === 'network') return 'Каталог получен из OpenDota сейчас.';
  const ageMinutes = Math.max(0, Math.floor((Date.now() - catalog.savedAt) / 60_000));
  return catalog.source === 'stale-cache'
    ? `Используется устаревший кэш героев, возраст ${ageMinutes} мин.`
    : `Используется кэш героев, возраст ${ageMinutes} мин.`;
}

export function DraftAnalysisForm({
  value,
  catalog,
  loadingCatalog,
  catalogError,
  tournamentSelection,
  onChange,
  onTournamentSelectionChange,
  onRetryCatalog,
}: DraftAnalysisFormProps) {
  const heroes = catalog?.data ?? [];
  const teamAIds = new Set(value.teamAHeroes.map((hero) => hero.heroId));
  const teamBIds = new Set(value.teamBHeroes.map((hero) => hero.heroId));
  const disabled = loadingCatalog || Boolean(catalogError) || !catalog;
  const update = (next: Partial<DraftFormValue>) => onChange({ ...value, ...next });

  return (
    <div className="draft-form">
      <header className="draft-form__heading">
        <div><h2>Ручной драфт</h2><p>Выберите по пять разных героев. Названия команд и рыночные линии необязательны.</p></div>
        <span className={catalogError ? 'draft-form__source draft-form__source--error' : 'draft-form__source'} role={catalogError ? 'alert' : 'status'}>
          {loadingCatalog ? 'Загружаем реальный каталог героев…' : catalogError || catalogSource(catalog)}
        </span>
      </header>
      {catalogError ? (
        <button className="draft-form__retry" type="button" onClick={onRetryCatalog}>
          <RefreshCw size={15} />Повторить загрузку каталога
        </button>
      ) : null}
      <details className="draft-form__real-teams">
        <summary>Использовать реальные команды и их форму (необязательно)</summary>
        <p>Выберите выпуск турнира и обе команды. Если выбрана только одна команда, анализ не запустится.</p>
        <TournamentTeamSelection value={tournamentSelection} onChange={onTournamentSelectionChange} />
      </details>
      <div className="draft-form__teams">
        <section className="draft-form__team draft-form__team--a">
          <label>
            Название команды A <small>(необязательно)</small>
            <input value={value.teamAName} placeholder="Команда A" onChange={(event) => update({ teamAName: event.target.value })} />
          </label>
          <label>
            Сторона команды A
            <select value={value.teamASide} onChange={(event) => {
              const teamASide = event.target.value as DraftTeamSide;
              update({ teamASide, teamBSide: oppositeSide(teamASide) });
            }}>
              <option value="radiant">Radiant</option>
              <option value="dire">Dire</option>
            </select>
          </label>
          <HeroPicker
            label="Герои команды A"
            heroes={heroes}
            selected={value.teamAHeroes}
            excludedHeroIds={teamBIds}
            disabled={disabled}
            onAdd={(hero) => update({ teamAHeroes: [...value.teamAHeroes, hero] })}
            onRemove={(heroId) => update({ teamAHeroes: value.teamAHeroes.filter((hero) => hero.heroId !== heroId) })}
          />
        </section>
        <section className="draft-form__team draft-form__team--b">
          <label>
            Название команды B <small>(необязательно)</small>
            <input value={value.teamBName} placeholder="Команда B" onChange={(event) => update({ teamBName: event.target.value })} />
          </label>
          <label>
            Сторона команды B
            <select value={value.teamBSide} onChange={(event) => {
              const teamBSide = event.target.value as DraftTeamSide;
              update({ teamBSide, teamASide: oppositeSide(teamBSide) });
            }}>
              <option value="radiant">Radiant</option>
              <option value="dire">Dire</option>
            </select>
          </label>
          <HeroPicker
            label="Герои команды B"
            heroes={heroes}
            selected={value.teamBHeroes}
            excludedHeroIds={teamAIds}
            disabled={disabled}
            onAdd={(hero) => update({ teamBHeroes: [...value.teamBHeroes, hero] })}
            onRemove={(heroId) => update({ teamBHeroes: value.teamBHeroes.filter((hero) => hero.heroId !== heroId) })}
          />
        </section>
      </div>
      <fieldset className="draft-form__market">
        <legend>Необязательные рыночные данные</legend>
        <p className="draft-form__market-note">Сохраняются в запросе и экспорте как контекст, но не меняют статистическую вероятность модели драфта.</p>
        <label>Коэффициент на A<input inputMode="decimal" value={value.teamAOdds} placeholder="например, 1.80" onChange={(event) => update({ teamAOdds: event.target.value })} /></label>
        <label>Коэффициент на B<input inputMode="decimal" value={value.teamBOdds} placeholder="например, 2.05" onChange={(event) => update({ teamBOdds: event.target.value })} /></label>
        <label>Команда с форой<select value={value.handicapTeam} onChange={(event) => update({ handicapTeam: event.target.value as DraftFormValue['handicapTeam'] })}><option value="none">Фора не указана</option><option value="A">Команда A</option><option value="B">Команда B</option></select></label>
        <label>Фора по убийствам<input inputMode="decimal" disabled={value.handicapTeam === 'none'} value={value.handicapLine} placeholder="например, +5.5" onChange={(event) => update({ handicapLine: event.target.value })} /></label>
      </fieldset>
    </div>
  );
}
