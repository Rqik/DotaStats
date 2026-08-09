import type { DraftAnalysisResult } from '../features/analysis/analysisClient';
import './DraftResultOverview.scss';

interface DraftResultOverviewProps {
  result: DraftAnalysisResult;
}

const confidenceLabels: Record<DraftAnalysisResult['confidence']['level'], string> = {
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
};

function probability(value: number | null): string {
  return value === null ? 'нет оценки' : `${(value * 100).toFixed(1)}%`;
}

export function DraftResultOverview({ result }: DraftResultOverviewProps) {
  const favorite = result.favorite === 'A'
    ? result.teamA.name
    : result.favorite === 'B' ? result.teamB.name
      : result.favorite === 'even' ? 'составы близки' : 'не определён';

  return (
    <>
      <section className="draft-result-overview__metrics" aria-label="Итог анализа драфта">
        <article><span>Фаворит модели</span><strong>{favorite}</strong></article>
        <article><span>Вероятность команды A</span><strong>{probability(result.overallProbabilityA)}</strong></article>
        <article><span>Уверенность</span><strong>{confidenceLabels[result.confidence.level]}</strong><small>покрытие {(result.confidence.coverage * 100).toFixed(0)}%</small></article>
        <article><span>Пик преимущества</span><strong>{result.peak?.teamName ?? 'нет данных'}</strong><small>{result.peak?.rangeLabel ?? 'диапазон не определён'}</small></article>
      </section>
      <section className="draft-result-overview__teams">
        {[result.teamA, result.teamB].map((team, index) => (
          <article className={`draft-result-overview__team draft-result-overview__team--${index === 0 ? 'a' : 'b'}`} key={team.name}>
            <span>Команда {index === 0 ? 'A' : 'B'} · {team.side === 'radiant' ? 'Radiant' : 'Dire'}</span>
            <h2>{team.name}</h2>
            <ul>{team.heroes.map((hero) => <li key={hero.heroId}>{hero.name}</li>)}</ul>
          </article>
        ))}
      </section>
      <section className="draft-result-overview__formula">
        <h2>Прозрачная модель</h2>
        <p>
          Тайминги {(result.weights.duration * 100).toFixed(0)}% · матчапы {(result.weights.matchup * 100).toFixed(0)}%
          {result.weights.form > 0 ? ` · форма команд ${(result.weights.form * 100).toFixed(0)}%` : ''}.
        </p>
        <dl>
          <div><dt>Данные длительности</dt><dd>{result.heroDurations.length} героев</dd></div>
          <div><dt>Матчапы</dt><dd>{result.matchups.availablePairs} из {result.matchups.requestedPairs} пар · {result.matchups.games} игр</dd></div>
          <div><dt>Форма реальных команд</dt><dd>{result.teamForm.included ? `${result.teamForm.teamA?.matches ?? 0} + ${result.teamForm.teamB?.matches ?? 0} матчей` : 'не включена'}</dd></div>
          <div><dt>Режим весов</dt><dd>{result.weights.mode === 'with-team-form' ? 'с формой команд' : 'только драфт'}</dd></div>
        </dl>
        {result.input.odds || result.input.handicap ? (
          <p>
            Рыночный контекст (не входит в вероятность):
            {result.input.odds?.teamA ? ` коэффициент A ${result.input.odds.teamA}` : ''}
            {result.input.odds?.teamB ? `; коэффициент B ${result.input.odds.teamB}` : ''}
            {result.input.handicap ? `; фора ${result.input.handicap.team} ${result.input.handicap.signedLine > 0 ? '+' : ''}${result.input.handicap.signedLine}` : ''}.
          </p>
        ) : null}
      </section>
      <section className="draft-result-overview__ranges">
        <h2>Сила по диапазонам</h2>
        <div>{result.summaries.map((summary) => (
          <article key={summary.range}>
            <span>{summary.endMinute === null ? `после ${summary.startMinute} мин.` : `${summary.startMinute}–${summary.endMinute} мин.`}</span>
            <strong>{probability(summary.probabilityA)} для {result.teamA.name}</strong>
            <p>{summary.text}</p>
          </article>
        ))}</div>
      </section>
    </>
  );
}
