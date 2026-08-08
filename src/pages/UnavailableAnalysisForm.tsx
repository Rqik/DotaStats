import type { AnalysisMode } from './analysisMode';

interface UnavailableAnalysisFormProps { mode: Exclude<AnalysisMode, 'handicap'>; heroes: readonly string[]; selectedHeroes: readonly string[]; matchId: string; onHeroToggle: (hero: string) => void; onMatchIdChange: (value: string) => void; }

export function UnavailableAnalysisForm({ mode, heroes, selectedHeroes, matchId, onHeroToggle, onMatchIdChange }: UnavailableAnalysisFormProps) {
  if (mode === 'match') return <><h2>Загрузить матч</h2><label className="new-analysis__match-id">Match ID<input inputMode="numeric" value={matchId} onChange={(event) => onMatchIdChange(event.target.value.replace(/\D/g, ''))} /><small>Только цифры. Матч будет запрошен через OpenDota после подключения потока.</small></label></>;
  return <><h2>Ручной драфт</h2><p>Выберите десять уникальных героев. Анализ драфта станет доступен после подключения живых данных.</p><div className="new-analysis__heroes">{heroes.map((hero) => <button className={selectedHeroes.includes(hero) ? 'new-analysis__hero new-analysis__hero--selected' : 'new-analysis__hero'} type="button" key={hero} onClick={() => onHeroToggle(hero)} aria-pressed={selectedHeroes.includes(hero)}>{hero}</button>)}</div><p>Выбрано: {selectedHeroes.length} из 10.</p></>;
}
