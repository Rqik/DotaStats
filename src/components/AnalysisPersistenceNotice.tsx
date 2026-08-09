import { RefreshCw } from 'lucide-react';
import type { AnalysisPersistenceState } from '../stores/analysis';
import './AnalysisPersistenceNotice.scss';

interface AnalysisPersistenceNoticeProps {
  state: AnalysisPersistenceState;
  onRetry: () => void;
}

export function AnalysisPersistenceNotice({ state, onRetry }: AnalysisPersistenceNoticeProps) {
  if (state.status === 'saving') {
    return <p className="analysis-persistence" role="status"><RefreshCw size={15} /> Сохраняем анализ в IndexedDB…</p>;
  }
  if (state.status !== 'error') return null;
  return (
    <section className="analysis-persistence analysis-persistence--error" role="alert">
      <span>{state.message}</span>
      <button type="button" onClick={onRetry}><RefreshCw size={15} /> Повторить сохранение</button>
    </section>
  );
}
