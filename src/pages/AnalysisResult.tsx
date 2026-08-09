import { ArrowLeft, CheckCircle2, Download, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { AnalysisPersistenceNotice } from '../components/AnalysisPersistenceNotice';
import { useBetStore } from '../features/bets/betStore';
import { downloadJsonFile } from '../features/data-transfer/dataTransfer';
import { useAnalysisStore } from '../stores/analysis';
import { HandicapMatchesTable } from './HandicapMatchesTable';
import { HandicapResultOverview } from './HandicapResultOverview';
import './AnalysisResult.scss';

function resultSource(
  sources: readonly ('network' | 'cache' | 'stale-cache')[],
): 'real' | 'cache' | 'stale' {
  if (sources.includes('stale-cache')) return 'stale';
  if (sources.every((source) => source === 'cache')) return 'cache';
  return 'real';
}

function sourceDescription(source: 'real' | 'cache' | 'stale', savedAt: number): string {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - savedAt) / 60_000));
  if (source === 'stale') return `устаревший кэш · возраст ${ageMinutes} мин.`;
  if (source === 'cache') return `кэш · возраст ${ageMinutes} мин.`;
  return 'реальные данные OpenDota';
}

export default function AnalysisResult() {
  const navigate = useNavigate();
  const createBet = useBetStore((state) => state.createBet);
  const bets = useBetStore((state) => state.bets);
  const analysis = useAnalysisStore((state) => state.handicap);
  const persistence = useAnalysisStore((state) => state.persistence.handicap);
  const retryPersistence = useAnalysisStore((state) => state.retryPersistence);

  if (analysis.status === 'idle') {
    return (
      <div className="analysis-result">
        <PageHeading
          eyebrow="Фора по убийствам"
          title="Нет результата анализа"
          description="Сначала выберите турнир, две команды и загрузите реальные матчи OpenDota."
        />
        <section className="analysis-result__empty">
          <p>Демонстрационная выборка не подставляется вместо отсутствующих данных.</p>
          <button type="button" onClick={() => navigate('/analysis')}>Перейти к анализу</button>
        </section>
      </div>
    );
  }

  if (analysis.status === 'loading') {
    return (
      <div className="analysis-result">
        <PageHeading title="Загружаем матчи OpenDota…" />
        <p className="analysis-result__state" role="status">
          Собираем независимые выборки команд и личные встречи.
        </p>
      </div>
    );
  }

  if (analysis.status === 'error') {
    return (
      <div className="analysis-result">
        <PageHeading title="Анализ не выполнен" description={analysis.message} />
        <section className="analysis-result__empty" role="alert">
          <p>Результат не был рассчитан и выдуманные значения не показаны.</p>
          <button type="button" onClick={() => navigate('/analysis')}>Проверить запрос</button>
        </section>
      </div>
    );
  }

  const { input, result } = analysis;
  const sign = input.sign === 'plus' ? '+' : '−';
  const match = `${input.teamA} — ${input.teamB}`;
  const selection = `${input.selectedTeam} ${sign}${input.handicap} убийств`;
  const saved = bets.some((bet) => bet.match === match && bet.selection === selection);
  const sources = [
    result.selectedSample.source,
    result.opponentSample.source,
    result.h2hSample.source,
  ];
  const source = resultSource(sources);

  const saveBet = () => {
    if (saved) return;
    void createBet({
      date: new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
      tournament: input.leagueName,
      match,
      selection,
      odds: input.odds,
      stake: 1000,
      stakeType: 'cash',
      result: 'pending',
    });
  };

  const exportResult = () => downloadJsonFile('dota-pulse-analysis-result.json', {
    format: 'dota-pulse-analysis-result',
    version: 2,
    exportedAt: new Date().toISOString(),
    source: {
      kind: source,
      savedAt: new Date(result.savedAt).toISOString(),
      samples: {
        selectedTeam: result.selectedSample.source,
        opponent: result.opponentSample.source,
        headToHead: result.h2hSample.source,
      },
    },
    input,
    formula: {
      weights: result.weights,
      smoothing: '(wins + 1) / (matches + 2)',
      breakeven: '1 / odds',
      edge: 'probability - breakeven',
    },
    samples: {
      selectedTeam: result.selectedSample,
      opponent: result.opponentSample,
      headToHead: result.h2hSample,
    },
    result,
    usedMatches: result.usedMatches,
    disclaimer: 'Статистический расчёт не гарантирует исход и не является рекомендацией сделать ставку.',
  });

  return (
    <div className="analysis-result">
      <button
        className="analysis-result__back"
        type="button"
        onClick={() => navigate('/analysis')}
      >
        <ArrowLeft size={16} />
        Новый анализ
      </button>
      <PageHeading
        eyebrow="Фора по убийствам · реальные данные"
        title={`${input.teamA} — ${input.teamB}`}
        description={`${input.leagueName} · ${sourceDescription(source, result.savedAt)} · ${result.usedMatches.length} уникальных матчей`}
        actions={(
          <>
            <button className="analysis-result__secondary" type="button" onClick={exportResult}>
              <Download size={16} />
              Экспорт
            </button>
            <button
              className="analysis-result__primary"
              type="button"
              onClick={saveBet}
              disabled={saved}
            >
              {saved ? <CheckCircle2 size={16} /> : <Plus size={16} />}
              {saved ? 'В журнале' : 'Сохранить ставку'}
            </button>
          </>
        )}
      />
      <AnalysisPersistenceNotice state={persistence} onRetry={() => void retryPersistence('handicap')} />
      <HandicapResultOverview input={input} result={result} />
      {result.warnings.length > 0 ? (
        <section className="analysis-result__warnings" aria-labelledby="analysis-warnings-title">
          <h2 id="analysis-warnings-title">Ограничения данных</h2>
          <ul>{result.warnings.map((warning) => (
            <li key={`${warning.code}-${warning.count ?? 0}`}>{warning.message}</li>
          ))}</ul>
        </section>
      ) : null}
      <HandicapMatchesTable matches={result.usedMatches} sign={sign} line={result.line} />
    </div>
  );
}
