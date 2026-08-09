import { lazy, Suspense } from 'react';
import { ArrowLeft, Download, Info, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { AnalysisPersistenceNotice } from '../components/AnalysisPersistenceNotice';
import { downloadJsonFile } from '../features/data-transfer/dataTransfer';
import { useAnalysisStore } from '../stores/analysis';
import { DraftResultOverview } from './DraftResultOverview';
import './DraftAnalysisResult.scss';

const DraftPowerChart = lazy(() => import('./DraftPowerChart'));

function sourceDescription(source: 'network' | 'cache' | 'stale-cache', savedAt: number): string {
  if (source === 'network') return 'реальные данные OpenDota';
  const ageMinutes = Math.max(0, Math.floor((Date.now() - savedAt) / 60_000));
  return source === 'stale-cache'
    ? `устаревший кэш · возраст ${ageMinutes} мин.`
    : `кэш · возраст ${ageMinutes} мин.`;
}

export default function DraftAnalysisResult() {
  const navigate = useNavigate();
  const analysis = useAnalysisStore((state) => state.draft);
  const persistence = useAnalysisStore((state) => state.persistence.draft);
  const retryPersistence = useAnalysisStore((state) => state.retryPersistence);

  if (analysis.status === 'idle') {
    return (
      <div className="draft-analysis-result">
        <PageHeading title="Нет результата анализа драфта" description="Выберите десять реальных героев, чтобы загрузить данные OpenDota." />
        <section className="draft-analysis-result__state">
          <p>Без ответа сервиса вероятность, тайминги и фаворит не показываются.</p>
          <button type="button" onClick={() => navigate('/analysis')}>Собрать драфт</button>
        </section>
      </div>
    );
  }

  if (analysis.status === 'loading') {
    return (
      <div className="draft-analysis-result">
        <PageHeading title="Анализируем драфт…" />
        <p className="draft-analysis-result__state" role="status"><RefreshCw size={17} /> Загружаем длительности, матчапы и форму команд.</p>
      </div>
    );
  }

  if (analysis.status === 'error') {
    return (
      <div className="draft-analysis-result">
        <PageHeading title="Драфт не проанализирован" description={analysis.message} />
        <section className="draft-analysis-result__state" role="alert">
          <p>Недоступные данные не заменены условной вероятностью.</p>
          <button type="button" onClick={() => navigate('/analysis')}>Проверить составы</button>
        </section>
      </div>
    );
  }

  const { input, result } = analysis;
  const oldestSource = result.sources.reduce((oldest, source) => (
    source.savedAt < oldest.savedAt ? source : oldest
  ));
  const exportResult = () => downloadJsonFile('dota-pulse-draft-analysis.json', {
    format: 'dota-pulse-draft-analysis',
    version: 1,
    exportedAt: new Date().toISOString(),
    input,
    source: result.sources,
    result,
    disclaimer: 'Статистическая модель не гарантирует исход и не является рекомендацией сделать ставку.',
  });
  const hasChart = result.timeSeries.some((point) => point.probabilityA !== null);

  return (
    <div className="draft-analysis-result">
      <button className="draft-analysis-result__back" type="button" onClick={() => navigate('/analysis')}>
        <ArrowLeft size={16} /> Новый драфт
      </button>
      <PageHeading
        eyebrow="Ручной драфт · реальные данные"
        title={`${result.teamA.name} — ${result.teamB.name}`}
        description={`${sourceDescription(oldestSource.source, oldestSource.savedAt)} · сохранено ${new Date(result.savedAt).toLocaleString('ru-RU')}`}
        actions={<button className="draft-analysis-result__export" type="button" onClick={exportResult}><Download size={16} /> Экспорт JSON</button>}
      />
      <AnalysisPersistenceNotice state={persistence} onRetry={() => void retryPersistence('draft')} />
      <DraftResultOverview result={result} />
      <section className="draft-analysis-result__chart">
        <h2>Сила составов по времени</h2>
        <p>Линия показывает вероятность команды A с 15-й по 60-ю минуту. Пропуски означают отсутствие данных.</p>
        {hasChart ? (
          <Suspense fallback={<p role="status">Загружаем график…</p>}>
            <DraftPowerChart points={result.timeSeries} teamAName={result.teamA.name} />
          </Suspense>
        ) : <p>OpenDota не вернула достаточно статистики для временного графика.</p>}
      </section>
      {result.warnings.length ? (
        <section className="draft-analysis-result__warnings" aria-labelledby="draft-warnings-title">
          <h2 id="draft-warnings-title"><Info size={18} /> Ограничения данных</h2>
          <ul>{result.warnings.map((warning) => <li key={`${warning.code}-${warning.heroId ?? warning.team ?? 'all'}`}>{warning.message}</li>)}</ul>
        </section>
      ) : null}
      <aside className="draft-analysis-result__disclaimer">
        Вероятность описывает статистическую модель доступных данных. Она не гарантирует исход и не является советом сделать ставку.
      </aside>
    </div>
  );
}
