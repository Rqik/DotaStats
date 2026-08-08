import { Check, Gamepad2, Gauge, Swords } from 'lucide-react';
import type { AnalysisMode } from './analysisMode';

interface AnalysisModesProps { mode: AnalysisMode; onChange: (mode: AnalysisMode) => void; }

const modes = [{ id: 'handicap' as const, title: 'Фора по убийствам', description: 'Проверить покрытие линии на истории команд', icon: Gauge }, { id: 'draft' as const, title: 'Ручной драфт', description: 'Сравнить пики и матчапы', icon: Swords }, { id: 'match' as const, title: 'По Match ID', description: 'Разобрать завершённый матч', icon: Gamepad2 }];

export function AnalysisModes({ mode, onChange }: AnalysisModesProps) {
  return <div className="new-analysis__modes" role="tablist" aria-label="Режим анализа">{modes.map(({ id, title, description, icon: Icon }) => <button className={mode === id ? 'new-analysis__mode new-analysis__mode--active' : 'new-analysis__mode'} type="button" key={id} role="tab" aria-selected={mode === id} onClick={() => onChange(id)}><Icon size={21} /><span><strong>{title}</strong><small>{description}</small></span>{mode === id ? <Check size={17} /> : null}</button>)}</div>;
}
