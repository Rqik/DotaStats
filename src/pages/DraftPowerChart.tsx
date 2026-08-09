import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DraftAnalysisResult } from '../features/analysis/analysisClient';
import './DraftPowerChart.scss';

interface DraftPowerChartProps {
  points: DraftAnalysisResult['timeSeries'];
  teamAName: string;
}

export default function DraftPowerChart({ points, teamAName }: DraftPowerChartProps) {
  return (
    <div className="draft-power-chart" aria-label={`Вероятность преимущества ${teamAName} по времени`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...points]} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#24282d" vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="minute" axisLine={false} tickLine={false} tick={{ fill: '#8b969d', fontSize: 11 }} unit=" мин" />
          <YAxis domain={[0, 1]} axisLine={false} tickLine={false} tick={{ fill: '#8b969d', fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
          <ReferenceLine y={0.5} stroke="#8b969d" strokeDasharray="4 4" />
          <Tooltip formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, teamAName]} labelFormatter={(minute) => `${minute} минута`} contentStyle={{ background: '#121518', border: '1px solid #30363b', borderRadius: 8 }} />
          <Line type="monotone" dataKey="probabilityA" connectNulls={false} stroke="#56c8ff" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
