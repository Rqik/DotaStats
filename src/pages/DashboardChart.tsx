import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../features/bets/betStore';

export interface DashboardChartPoint {
  label: string;
  cashProfit: number;
}

interface DashboardChartProps {
  points: readonly DashboardChartPoint[];
}

export function DashboardChart({ points }: DashboardChartProps) {
  return (
    <div className="dashboard-chart" aria-label="График накопленного денежного результата">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...points]} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboard-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dcff52" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#dcff52" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#24282d" vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b969d', fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b969d', fontSize: 11 }} tickFormatter={(value) => formatMoney(Number(value))} />
          <Tooltip contentStyle={{ background: '#121518', border: '1px solid #30363b', borderRadius: 8 }} formatter={(value) => [formatMoney(Number(value)), 'Денежный результат']} />
          <Area type="monotone" dataKey="cashProfit" stroke="#dcff52" strokeWidth={2.5} fill="url(#dashboard-chart-fill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
