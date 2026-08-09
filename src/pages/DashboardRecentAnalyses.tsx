import { ArrowRight, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  listAnalysisHistory,
  type AnalysisMetadata,
} from '../features/analysis/analysisHistoryClient';

interface DashboardRecentAnalysesProps {
  onCreate: () => void;
  onOpen: (id: string) => void;
}

const modeLabels: Record<AnalysisMetadata['mode'], string> = {
  handicap: 'Фора',
  draft: 'Драфт',
  match: 'Матч',
};

export function DashboardRecentAnalyses({ onCreate, onOpen }: DashboardRecentAnalysesProps) {
  const [items, setItems] = useState<AnalysisMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invalidCount, setInvalidCount] = useState(0);

  useEffect(() => {
    let active = true;
    void listAnalysisHistory()
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setInvalidCount(result.invalidCount);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить сохранённые анализы из IndexedDB.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="dashboard__panel" aria-busy={loading}>
      <div className="dashboard__panel-heading">
        <div><span>Расчёты</span><h2>Последние анализы</h2></div>
        <button className="dashboard__link" type="button" onClick={onCreate}>
          Новый <ArrowRight size={15} />
        </button>
      </div>
      {loading ? <p className="dashboard__empty" role="status"><RefreshCw size={15} /> Загружаем историю…</p> : null}
      {error ? <p className="dashboard__error" role="alert">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="dashboard__empty">Сохранённых анализов пока нет.</p>
      ) : null}
      {items.map((analysis) => (
        <button className="dashboard__analysis" type="button" key={analysis.id} onClick={() => onOpen(analysis.id)}>
          <strong>{analysis.title}</strong>
          <span>{modeLabels[analysis.mode]} · {new Date(analysis.createdAt).toLocaleString('ru-RU')}</span>
          <b>{analysis.status}</b>
        </button>
      ))}
      {invalidCount > 0 ? (
        <p className="dashboard__warning" role="status">Пропущено повреждённых записей: {invalidCount}.</p>
      ) : null}
    </article>
  );
}
