import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import {
  loadSavedAnalysis,
  type SavedAnalysisDetails,
} from '../features/analysis/analysisHistoryClient';
import './SavedAnalysisPage.scss';

export default function SavedAnalysisPage() {
  const navigate = useNavigate();
  const { analysisId = '' } = useParams();
  const [analysis, setAnalysis] = useState<SavedAnalysisDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadSavedAnalysis(analysisId)
      .then((result) => {
        if (!active) return;
        if (result.analysis) setAnalysis(result.analysis);
        else setError(result.invalid ? 'Сохранённый анализ повреждён и не может быть открыт.' : 'Сохранённый анализ не найден.');
      })
      .catch(() => {
        if (active) setError('Не удалось прочитать анализ из IndexedDB.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [analysisId]);

  return (
    <div className="saved-analysis" aria-busy={loading}>
      <PageHeading
        eyebrow="История"
        title={analysis?.title ?? 'Сохранённый анализ'}
        description={analysis?.summary ?? 'Фактическая запись из локальной истории анализов.'}
        actions={(
          <button type="button" onClick={() => navigate('/')}><ArrowLeft size={17} /> К обзору</button>
        )}
      />
      {loading ? <p className="saved-analysis__state" role="status"><RefreshCw size={17} /> Загружаем анализ…</p> : null}
      {error ? <p className="saved-analysis__state saved-analysis__state--error" role="alert">{error}</p> : null}
      {analysis ? (
        <article className="saved-analysis__card">
          <dl className="saved-analysis__metadata">
            <div><dt>Режим</dt><dd>{analysis.mode}</dd></div>
            <div><dt>Статус</dt><dd>{analysis.status}</dd></div>
            <div><dt>Источник</dt><dd>{analysis.source}</dd></div>
            <div><dt>Сохранён</dt><dd>{new Date(analysis.createdAt).toLocaleString('ru-RU')}</dd></div>
          </dl>
          <p>Запись открыта без повторного сетевого запроса. Ниже сохранены входные данные и фактический результат расчёта.</p>
          <details className="saved-analysis__details">
            <summary>Показать сохранённые данные</summary>
            <pre>{JSON.stringify(analysis.payload, null, 2)}</pre>
          </details>
        </article>
      ) : null}
    </div>
  );
}
