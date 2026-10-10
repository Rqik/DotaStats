interface MatchAnalysisFormProps {
  matchId: string;
  error?: string;
  source: 'live' | 'completed';
  onMatchIdChange: (value: string) => void;
  onSourceChange: (value: 'live' | 'completed') => void;
}

export function MatchAnalysisForm({
  matchId,
  error,
  source,
  onMatchIdChange,
  onSourceChange,
}: MatchAnalysisFormProps) {
  const errorId = 'match-analysis-id-error';

  return (
    <>
      <h2>{source === 'live' ? 'Загрузить текущий матч и драфт' : 'Загрузить завершённый матч'}</h2>
      <label className="new-analysis__match-id">Источник матча
        <select className="new-analysis__control" value={source} onChange={(event) => onSourceChange(event.target.value === 'live' ? 'live' : 'completed')}>
          <option value="live">Идущий сейчас — команды и драфт</option>
          <option value="completed">Завершённый — факты и графики</option>
        </select>
      </label>
      <p>
        {source === 'live'
          ? 'Введите Match ID из Dota 2. Найдём игру в live-списке OpenDota и загрузим переданные источником команды и пики. Не все игры доступны; данные могут приходить с задержкой.'
          : 'Укажите идентификатор завершённого матча. Покажем только факты, которые вернула OpenDota; отсутствующие пики или временные ряды не достраиваются.'}
      </p>
      <label className="new-analysis__match-id">
        Match ID
        <input
          className="new-analysis__control"
          aria-describedby={error ? errorId : 'match-analysis-id-hint'}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          inputMode="numeric"
          pattern="[0-9]+"
          value={matchId}
          onChange={(event) => onMatchIdChange(event.target.value.replace(/\D/g, ''))}
        />
        <small id="match-analysis-id-hint">
          Только цифры, без пробелов и ссылок.
        </small>
      </label>
      {error ? (
        <p className="new-analysis__field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
