interface ProbabilityChartProps {
  probability: number;
  label?: string;
}

export function ProbabilityChart({ probability, label = 'Вероятность прохода форы' }: ProbabilityChartProps) {
  const percentage = probability * 100;
  const angle = percentage * 1.8;
  const radians = (angle * Math.PI) / 180;
  const x = 100 - 72 * Math.cos(radians);
  const y = 100 - 72 * Math.sin(radians);
  return <svg className="probability-chart" viewBox="0 0 200 112" role="img" aria-label={`${label}: ${percentage.toFixed(1)} процента`}><path className="probability-chart__track" d="M 28 100 A 72 72 0 0 1 172 100" pathLength="100" /><path className="probability-chart__value" d="M 28 100 A 72 72 0 0 1 172 100" pathLength="100" strokeDasharray={`${percentage} 100`} /><circle className="probability-chart__dot" cx={x} cy={y} r="4" /><text className="probability-chart__number" x="100" y="78" textAnchor="middle">{percentage.toFixed(1)}%</text><text className="probability-chart__label" x="100" y="98" textAnchor="middle">{label}</text></svg>;
}
