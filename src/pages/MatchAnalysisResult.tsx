import { lazy, Suspense } from 'react';
import { ArrowLeft, Download, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { AnalysisPersistenceNotice } from '../components/AnalysisPersistenceNotice';
import { downloadJsonFile } from '../features/data-transfer/dataTransfer';
import { useAnalysisStore } from '../stores/analysis';
import { MatchTeamPanel } from './MatchTeamPanel';
import './MatchAnalysisResult.scss';

const MatchAdvantageChart = lazy(() => import('./MatchAdvantageChart'));

function formatDate(value: string | null): string {
  if (!value) return 'дата не указана';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'дата не указана'
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function sourceLabel(source: 'network' | 'cache' | 'stale-cache', ageMs: number): string {
  const ageMinutes = Math.max(0, Math.floor(ageMs / 60_000));
  if (source === 'network') return 'реальные данные OpenDota';
  if (source === 'stale-cache') return `устаревший кэш · возраст ${ageMinutes} мин.`;
  return `кэш · возраст ${ageMinutes} мин.`;
}

export default function MatchAnalysisResult() {
  const navigate = useNavigate();
  const analysis = useAnalysisStore((state) => state.match);
  const persistence = useAnalysisStore((state) => state.persistence.match);
  const retryPersistence = useAnalysisStore((state) => state.retryPersistence);

  if (analysis.status === 'idle') {
    return (
      <div className="match-analysis-result">
        <PageHeading
          eyebrow="Разбор матча"
          title="Матч ещё не загружен"
          description="Укажите цифровой Match ID, чтобы запросить реальные данные OpenDota."
        />
        <section className="match-analysis-result__state">
          <p>Без ответа API сведения о командах, счёте и графиках не показываются.</p>
          <button type="button" onClick={() => navigate('/analysis')}>Указать Match ID</button>
        </section>
      </div>
    );
  }

  if (analysis.status === 'loading') {
    return (
      <div className="match-analysis-result">
        <PageHeading title={`Загружаем матч #${analysis.input}…`} />
        <p className="match-analysis-result__state" role="status">Ожидаем ответ OpenDota.</p>
      </div>
    );
  }

  if (analysis.status === 'error') {
    return (
      <div className="match-analysis-result">
        <PageHeading title={`Матч #${analysis.input} не загружен`} description={analysis.message} />
        <section className="match-analysis-result__state" role="alert">
          <p>Проверьте идентификатор или повторите запрос позже.</p>
          <button type="button" onClick={() => navigate('/analysis')}>Вернуться к форме</button>
        </section>
      </div>
    );
  }

  const loaded = analysis.result;
  const match = loaded.data;
  const hasChart = match.radiantGoldAdvantage.length > 0 || match.radiantXpAdvantage.length > 0;
  const exportResult = () => downloadJsonFile(`dota-pulse-match-${match.matchId}.json`, {
    format: 'dota-pulse-match-analysis',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: loaded.source,
    savedAt: new Date(loaded.savedAt).toISOString(),
    ageMs: loaded.ageMs,
    result: match,
  });

  return (
    <div className="match-analysis-result">
      <button className="match-analysis-result__back" type="button" onClick={() => navigate('/analysis')}>
        <ArrowLeft size={16} />
        Другой Match ID
      </button>
      <PageHeading
        eyebrow={`Match ID #${match.matchId}`}
        title={`${match.radiant.name} — ${match.dire.name}`}
        description={`${formatDate(match.date)} · ${sourceLabel(loaded.source, loaded.ageMs)}`}
        actions={(
          <button className="match-analysis-result__export" type="button" onClick={exportResult}>
            <Download size={16} />
            Экспорт JSON
          </button>
        )}
      />
      <AnalysisPersistenceNotice state={persistence} onRetry={() => void retryPersistence('match')} />
      <section className="match-analysis-result__summary" aria-label="Итог матча">
        <div><span>Счёт</span><strong>{match.radiant.score ?? '—'} : {match.dire.score ?? '—'}</strong></div>
        <div><span>Победитель</span><strong>{match.winnerTeamName ?? 'Не указан'}</strong></div>
        <div><span>Длительность</span><strong>{match.durationMinutes === null ? 'Не указана' : `${match.durationMinutes.toFixed(1)} мин.`}</strong></div>
        <div><span>Парсинг</span><strong>{match.parsed ? 'Разобран OpenDota' : 'Не разобран'}</strong></div>
      </section>
      <section className="match-analysis-result__teams" aria-label="Команды и составы">
        <MatchTeamPanel team={match.radiant} />
        <MatchTeamPanel team={match.dire} />
      </section>
      <section className="match-analysis-result__draft">
        <h2>Баны героев</h2>
        {match.bans.length > 0 ? (
          <ul>{match.bans.map((ban) => (
            <li key={`${ban.heroId}-${ban.order}`}>
              Hero #{ban.heroId}
              <small>{ban.side ?? 'сторона не указана'} · порядок {ban.order}</small>
            </li>
          ))}</ul>
        ) : <p>Баны отсутствуют в ответе OpenDota.</p>}
      </section>
      <section className="match-analysis-result__chart">
        <h2>Преимущество Radiant по времени</h2>
        <p>Положительные значения относятся к Radiant, отрицательные — к Dire.</p>
        {hasChart ? (
          <Suspense fallback={<p role="status">Загружаем график…</p>}>
            <MatchAdvantageChart
              gold={match.radiantGoldAdvantage}
              experience={match.radiantXpAdvantage}
            />
          </Suspense>
        ) : <p>OpenDota не вернула временные ряды золота или опыта.</p>}
      </section>
      {match.warnings.length > 0 ? (
        <section className="match-analysis-result__warnings" aria-labelledby="match-warning-title">
          <h2 id="match-warning-title"><Info size={18} />Ограничения данных</h2>
          <ul>{match.warnings.map((warning) => (
            <li key={`${warning.code}-${warning.side ?? 'all'}`}>{warning.message}</li>
          ))}</ul>
        </section>
      ) : null}
    </div>
  );
}
