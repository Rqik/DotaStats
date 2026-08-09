import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CSSProperties } from 'react';
import type { MatchAdvantagePoint } from '../features/analysis/analysisClient';
import './MatchAdvantageChart.scss';

interface MatchAdvantageChartProps {
  gold: readonly MatchAdvantagePoint[];
  experience: readonly MatchAdvantagePoint[];
}

interface ChartPoint {
  minute: number;
  gold?: number;
  experience?: number;
}

const tooltipStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-line)',
  borderRadius: '0.4rem',
};

function mergeSeries(
  gold: readonly MatchAdvantagePoint[],
  experience: readonly MatchAdvantagePoint[],
): ChartPoint[] {
  const points = new Map<number, ChartPoint>();
  gold.forEach((point) => points.set(point.minute, { ...points.get(point.minute), minute: point.minute, gold: point.value }));
  experience.forEach((point) => points.set(point.minute, { ...points.get(point.minute), minute: point.minute, experience: point.value }));
  return [...points.values()].sort((left, right) => left.minute - right.minute);
}

export default function MatchAdvantageChart({ gold, experience }: MatchAdvantageChartProps) {
  const data = mergeSeries(gold, experience);

  return (
    <div className="match-advantage-chart" role="img" aria-label="График преимущества Radiant по золоту и опыту">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 12, right: 18, bottom: 8, left: 6 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
          <XAxis dataKey="minute" stroke="var(--color-muted)" unit=" мин" />
          <YAxis stroke="var(--color-muted)" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <ReferenceLine y={0} stroke="var(--color-muted)" />
          {gold.length > 0 ? (
            <Line type="monotone" dataKey="gold" name="Золото Radiant" stroke="var(--color-warning)" dot={false} />
          ) : null}
          {experience.length > 0 ? (
            <Line type="monotone" dataKey="experience" name="Опыт Radiant" stroke="var(--color-team-a)" dot={false} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
