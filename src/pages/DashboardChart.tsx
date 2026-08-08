import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../features/bets/betStore';

const performanceData = [{ day: '20 июн', bank: 50000 }, { day: '24 июн', bank: 50720 }, { day: '28 июн', bank: 49840 }, { day: '2 июл', bank: 51260 }, { day: '6 июл', bank: 51910 }, { day: '10 июл', bank: 51450 }, { day: '14 июл', bank: 52640 }, { day: '18 июл', bank: 52840 }];

export function DashboardChart() {
  return <div className="dashboard-chart" aria-label="График динамики банка"><ResponsiveContainer width="100%" height="100%"><AreaChart data={performanceData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="dashboard-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dcff52" stopOpacity={0.2} /><stop offset="100%" stopColor="#dcff52" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#24282d" vertical={false} strokeDasharray="3 4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b969d', fontSize: 11 }} /><YAxis domain={[49000, 53500]} axisLine={false} tickLine={false} tick={{ fill: '#8b969d', fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><Tooltip contentStyle={{ background: '#121518', border: '1px solid #30363b', borderRadius: 8 }} formatter={(value) => [formatMoney(Number(value)), 'Банк']} /><Area type="monotone" dataKey="bank" stroke="#dcff52" strokeWidth={2.5} fill="url(#dashboard-chart-fill)" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>;
}
