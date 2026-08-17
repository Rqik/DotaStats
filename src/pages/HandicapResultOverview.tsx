import { CheckCircle2, Info } from 'lucide-react';
import type { KillsHandicapAnalysisResult } from '../features/analysis/analysisClient';
import type { HandicapAnalysisInput } from '../stores/analysis';
import { ProbabilityChart } from './ProbabilityChart';
import './HandicapResultOverview.scss';

interface HandicapResultOverviewProps {
  input: HandicapAnalysisInput;
  result: KillsHandicapAnalysisResult;
}

const statusLabels = {
  insufficient_data: 'Недостаточно данных',
  no_edge: 'Преимущества нет',
  borderline: 'Пограничная ситуация',
  statistical_edge: 'Есть статистический запас',
};

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function sampleSource(source: 'network' | 'cache' | 'stale-cache', savedAt: number): string {
  if (source === 'network') return 'Источник: сеть OpenDota';
  const ageMinutes = Math.max(0, Math.floor((Date.now() - savedAt) / 60_000));
  return source === 'stale-cache'
    ? `Источник: устаревший кэш, возраст ${ageMinutes} мин.`
    : `Источник: кэш, возраст ${ageMinutes} мин.`;
}

export function HandicapResultOverview({ input, result }: HandicapResultOverviewProps) {
  const sign = result.sign === 'plus' ? '+' : '−';
  const opponent = input.selectedTeamId === input.teamAId ? input.teamB : input.teamA;
  const samples = [
    { label: input.selectedTeam, value: result.selectedSample },
    { label: `Соперники против ${opponent}`, value: result.opponentSample },
    { label: 'Личные встречи', value: result.h2hSample },
  ];

  return (
    <>
      <section className="handicap-result__hero">
        <article className="handicap-result__selection">
          <span>Анализируемый исход</span>
          <h2>{input.selectedTeam} <b>{sign}{result.line}</b></h2>
          <dl>
            <div><dt>Коэффициент</dt><dd>{result.odds.toFixed(2)}</dd></div>
            <div><dt>Безубыточность</dt><dd>{percent(result.breakeven)}</dd></div>
          </dl>
          <p>
            <CheckCircle2 size={19} />
            <span>
              <strong>{statusLabels[result.status]}</strong>
              {result.edge === null
                ? 'Запас не рассчитан: одна из основных выборок пуста.'
                : `Разница с порогом: ${(result.edge * 100).toFixed(1)} п.п.`}
            </span>
          </p>
        </article>
        <article className="handicap-result__probability">
          <span>Вероятность прохода форы</span>
          {result.probability === null ? (
            <p>Вероятность не рассчитана из-за отсутствия данных.</p>
          ) : <ProbabilityChart probability={result.probability} label="Вероятность прохода форы" />}
        </article>
        <article className="handicap-result__edge">
          <span>{statusLabels[result.status]}</span>
          <strong>{result.edge === null ? '—' : `${(result.edge * 100).toFixed(1)} п.п.`}</strong>
          <p><Info size={16} />Положительный запас не гарантирует исход отдельной карты.</p>
        </article>
      </section>
      <section className="handicap-result__match-win" aria-label="Вероятность победы">
        <div>
          <span>Вероятность победы карты</span>
          <strong>{percent(result.matchWinProbability.probability)}</strong>
          <p>Отдельная оценка исхода карты, без форы и без сравнения с коэффициентом и порогом безубыточности; использует те же ответы OpenDota, возраст источника указан выше.</p>
        </div>
        <div className="handicap-result__match-win-coverage">
          <span>Сигналы победителя</span>
          <small>{input.selectedTeam}: {result.matchWinProbability.selected.signals}; соперник: {result.matchWinProbability.opponent.signals}; личные встречи: {result.matchWinProbability.h2h.signals}</small>
          <small>{result.matchWinProbability.probability === null ? 'Нужно минимум 10 сигналов победителя в каждой основной выборке.' : 'Покрытие достаточное для расчёта.'}</small>
        </div>
        <div>
          <span>Формула</span>
          <small>50/50: сглаженные победы выбранной команды и сглаженные поражения соперника; при ≥3 личных встречах — 40/40/20.</small>
        </div>
      </section>
      <section className="handicap-result__coverage" aria-label="Выборки анализа">
        {samples.map(({ label, value }) => (
          <article key={value.group}>
            <span>{label}</span>
            <strong>{percent(value.frequency)}</strong>
            <small>
              Сглаженная частота: {value.wins} побед из {value.matches};
              {' '}сырая {percent(value.rawFrequency)}
            </small>
            <small>
              {value.included ? 'Учитывается в формуле' : 'Не учитывается: нужно минимум 3 H2H'}
            </small>
            <small>{sampleSource(value.source, value.savedAt)}</small>
          </article>
        ))}
      </section>
      <section className="handicap-result__formula">
        <h2>Как получена вероятность прохода форы {percent(result.probability)}</h2>
        <p>Частоты сглажены формулой (wins + 1) / (matches + 2).</p>
        <div>
          {result.weights.map((weight, index) => (
            <span key={`${weight}-${index}`}>
              <b>{(weight * 100).toFixed(0)}%</b>
              {index === 0 ? input.selectedTeam : index === 1 ? opponent : 'H2H'}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
