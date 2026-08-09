import { LoaderCircle, Zap } from 'lucide-react';
import type { HandicapSign } from '../stores/analysis';
import type { AnalysisMode } from './analysisMode';

interface AnalysisSummaryProps {
  mode: AnalysisMode;
  teamA: string;
  teamB: string;
  selectedTeam: string;
  sign: HandicapSign;
  handicap: string;
  odds: string;
  sample: string;
  selectedHeroCount: number;
  matchId: string;
  canSubmit: boolean;
  isLoading: boolean;
}

function submitHint(mode: AnalysisMode, canSubmit: boolean): string {
  if (canSubmit) {
    return mode === 'match'
      ? 'Будут показаны только данные, которые фактически вернула OpenDota.'
      : 'Расчёт не является рекомендацией сделать ставку.';
  }

  if (mode === 'match') return 'Укажите Match ID, состоящий только из цифр.';
  if (mode === 'draft') return 'Выберите ровно по пять уникальных героев для каждой стороны.';
  return 'Сначала выберите выпуск турнира и две команды из каталога.';
}

export function AnalysisSummary({
  mode,
  teamA,
  teamB,
  selectedTeam,
  sign,
  handicap,
  odds,
  sample,
  selectedHeroCount,
  matchId,
  canSubmit,
  isLoading,
}: AnalysisSummaryProps) {
  return (
    <aside className="new-analysis__summary">
      <span>Предпросмотр запроса</span>
      {mode === 'handicap' ? (
        <>
          <strong>{teamA || 'Команда 1'} — {teamB || 'Команда 2'}</strong>
          <b>
            {selectedTeam || 'Команда не выбрана'}
            {' '}
            {selectedTeam ? `${sign === 'plus' ? '+' : '−'}${handicap}` : ''}
          </b>
          <small>Выборка: {sample} карт · коэффициент {odds}</small>
        </>
      ) : null}
      {mode === 'draft' ? (
        <>
          <strong>Ручной драфт</strong>
          <b>{selectedHeroCount} / 10 героев</b>
        </>
      ) : null}
      {mode === 'match' ? (
        <>
          <strong>Разбор матча</strong>
          <b>#{matchId || '—'}</b>
        </>
      ) : null}
      <button
        className="new-analysis__submit"
        type="submit"
        disabled={!canSubmit || isLoading}
      >
        {isLoading ? <LoaderCircle className="new-analysis__spinner" size={17} /> : <Zap size={17} />}
        {isLoading ? 'Загружаем данные…' : 'Запустить анализ'}
      </button>
      <small>{submitHint(mode, canSubmit)}</small>
    </aside>
  );
}
