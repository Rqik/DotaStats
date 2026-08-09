import { formatMoney } from '../features/bets/betStore';

interface DashboardRiskSummaryProps {
  averageCashStake: number;
  maxDrawdown: number;
  openCashExposure: number;
  pendingCashCount: number;
}

export function DashboardRiskSummary({
  averageCashStake,
  maxDrawdown,
  openCashExposure,
  pendingCashCount,
}: DashboardRiskSummaryProps) {
  return (
    <article className="dashboard__panel">
      <div className="dashboard__panel-heading">
        <div><span>Контроль риска</span><h2>По данным журнала</h2></div>
      </div>
      <p>Показатели рассчитаны только из фактических локальных записей, без условного стартового банка.</p>
      <dl className="dashboard__risk-list">
        <div><dt>Средняя денежная ставка</dt><dd>{formatMoney(averageCashStake)}</dd></div>
        <div><dt>Максимальная денежная просадка</dt><dd>{formatMoney(maxDrawdown)}</dd></div>
        <div><dt>Открытая денежная экспозиция</dt><dd>{formatMoney(openCashExposure)} · {pendingCashCount}</dd></div>
      </dl>
    </article>
  );
}
