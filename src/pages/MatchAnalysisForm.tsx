interface MatchAnalysisFormProps {
  matchId: string;
  error?: string;
  onMatchIdChange: (value: string) => void;
}

export function MatchAnalysisForm({
  matchId,
  error,
  onMatchIdChange,
}: MatchAnalysisFormProps) {
  const errorId = 'match-analysis-id-error';

  return (
    <>
      <h2>Загрузить матч</h2>
      <p>
        Укажите идентификатор завершённого матча. Покажем только факты, которые
        вернула OpenDota; отсутствующие пики или временные ряды не достраиваются.
      </p>
      <label className="new-analysis__match-id">
        Match ID
        <input
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
