import { Coins, Gift, Target, TrendingUp } from 'lucide-react';
import { formatMoney } from '../features/bets/betStore';

interface DashboardMetricsProps {
  cashProfit: number;
  cashTurnover: number;
  cashRoi: number;
  cashWins: number;
  settledCashCount: number;
  freebetProfit: number;
}

export function DashboardMetrics({
  cashProfit,
  cashTurnover,
  cashRoi,
  cashWins,
  settledCashCount,
  freebetProfit,
}: DashboardMetricsProps) {
  const metrics = [
    {
      label: 'Результат деньгами',
      value: `${cashProfit > 0 ? '+' : ''}${formatMoney(cashProfit)}`,
      helper: `Оборот ${formatMoney(cashTurnover)}`,
      icon: Coins,
    },
    {
      label: 'ROI денег',
      value: `${cashRoi.toFixed(1)}%`,
      helper: 'Фрибеты не входят в оборот',
      icon: TrendingUp,
    },
    {
      label: 'Выигранные денежные ставки',
      value: `${cashWins} из ${settledCashCount}`,
      helper: settledCashCount ? `${Math.round((cashWins / settledCashCount) * 100)}%` : 'Нет расчётных ставок',
      icon: Target,
    },
    {
      label: 'Прибыль фрибетов',
      value: `${freebetProfit > 0 ? '+' : ''}${formatMoney(freebetProfit)}`,
      helper: 'Отдельно от денежного банка',
      icon: Gift,
    },
  ];

  return (
    <section className="dashboard__metrics" aria-label="Фактические показатели журнала">
      {metrics.map(({ label, value, helper, icon: Icon }) => (
        <article className="dashboard__metric" key={label}>
          <div className="dashboard__metric-header"><span>{label}</span><Icon size={18} /></div>
          <strong>{value}</strong>
          <small>{helper}</small>
        </article>
      ))}
    </section>
  );
}
