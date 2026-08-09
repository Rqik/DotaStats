import { Activity, Plus, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { maximumDrawdown, roi } from '../domain/bankroll';
import { useBetStore } from '../features/bets/betStore';
import { DashboardChart, type DashboardChartPoint } from './DashboardChart';
import { DashboardMetrics } from './DashboardMetrics';
import { DashboardRecentAnalyses } from './DashboardRecentAnalyses';
import { DashboardRecentBets } from './DashboardRecentBets';
import { DashboardRiskSummary } from './DashboardRiskSummary';
import './Dashboard.scss';

interface DashboardSummary {
  cashProfit: number;
  cashTurnover: number;
  cashRoi: number;
  cashWins: number;
  settledCashCount: number;
  freebetProfit: number;
  averageCashStake: number;
  maxDrawdown: number;
  openCashExposure: number;
  pendingCashCount: number;
  chart: DashboardChartPoint[];
}

function summarizeBets(bets: ReturnType<typeof useBetStore.getState>['bets']): DashboardSummary {
  const cashBets = bets.filter((bet) => bet.stakeType === 'cash');
  const settledCash = cashBets.filter((bet) => bet.result !== 'pending');
  const pendingCash = cashBets.filter((bet) => bet.result === 'pending');
  const cashProfit = settledCash.reduce((sum, bet) => sum + bet.profit, 0);
  const cashTurnover = settledCash.reduce((sum, bet) => sum + bet.stake, 0);
  const freebetProfit = bets
    .filter((bet) => bet.stakeType === 'freebet' && bet.result !== 'pending')
    .reduce((sum, bet) => sum + bet.profit, 0);
  let runningProfit = 0;
  const chart = [...settledCash].reverse().map((bet) => {
    runningProfit += bet.profit;
    return { label: bet.date || bet.match, cashProfit: runningProfit };
  });
  const values = [0, ...chart.map((point) => point.cashProfit)];
  const offset = Math.max(0, -Math.min(...values));
  const drawdown = maximumDrawdown(values.map((value) => value + offset));

  return {
    cashProfit,
    cashTurnover,
    cashRoi: roi(cashProfit, cashTurnover),
    cashWins: settledCash.filter((bet) => bet.result === 'win').length,
    settledCashCount: settledCash.length,
    freebetProfit,
    averageCashStake: cashBets.length
      ? cashBets.reduce((sum, bet) => sum + bet.stake, 0) / cashBets.length
      : 0,
    maxDrawdown: drawdown.amount,
    openCashExposure: pendingCash.reduce((sum, bet) => sum + bet.stake, 0),
    pendingCashCount: pendingCash.length,
    chart,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const bets = useBetStore((state) => state.bets);
  const hydrated = useBetStore((state) => state.hydrated);
  const loading = useBetStore((state) => state.loading);
  const error = useBetStore((state) => state.error);
  const retryHydration = useBetStore((state) => state.retryHydration);
  const summary = useMemo(() => summarizeBets(bets), [bets]);
  const busy = loading || !hydrated;

  return (
    <div className="dashboard" aria-busy={busy}>
      <PageHeading
        eyebrow="Локальная сводка"
        title="Обзор данных"
        description="Фактические показатели ставок и сохранённые анализы из IndexedDB этого браузера. Без условного банка и демонстрационной истории."
        actions={(
          <button className="dashboard__action" type="button" onClick={() => navigate('/analysis')}>
            <Plus size={18} /> Новый анализ
          </button>
        )}
      />
      {busy ? (
        <section className="dashboard__storage-state" role="status">
          <RefreshCw className="dashboard__spinner" size={20} /> Загружаем локальный журнал…
        </section>
      ) : null}
      {error ? (
        <section className="dashboard__storage-state dashboard__storage-state--error" role="alert">
          <div><strong>Не удалось полностью прочитать журнал</strong><p>{error}</p></div>
          <button type="button" onClick={() => void retryHydration()}><RefreshCw size={16} /> Повторить</button>
        </section>
      ) : null}
      {!busy ? (
        <>
          <DashboardMetrics {...summary} />
          <section className="dashboard__grid">
            <article className="dashboard__panel dashboard__panel--chart">
              <div className="dashboard__panel-heading">
                <div><span>Динамика</span><h2>Накопленный денежный результат</h2></div>
                <Activity size={20} />
              </div>
              {summary.chart.length ? <DashboardChart points={summary.chart} /> : (
                <p className="dashboard__empty">Добавьте и рассчитайте денежные ставки, чтобы появился график.</p>
              )}
            </article>
            <DashboardRiskSummary {...summary} />
          </section>
          <section className="dashboard__grid">
            <DashboardRecentAnalyses
              onCreate={() => navigate('/analysis')}
              onOpen={(id) => navigate(`/analysis/saved/${encodeURIComponent(id)}`)}
            />
            <DashboardRecentBets bets={bets} onOpenJournal={() => navigate('/bets')} />
          </section>
        </>
      ) : null}
      <aside className="dashboard__notice">
        <strong>Интерпретируйте малые выборки осторожно.</strong>
        <span>Вероятности и история ставок описывают локальные данные, но не гарантируют будущий результат.</span>
      </aside>
    </div>
  );
}
