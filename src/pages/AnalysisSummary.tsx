import { Zap } from 'lucide-react';
import type { HandicapSign } from '../stores/analysis';
import type { AnalysisMode } from './analysisMode';

interface AnalysisSummaryProps { mode: AnalysisMode; teamA: string; teamB: string; selectedTeam: string; sign: HandicapSign; handicap: string; odds: string; sample: string; selectedHeroCount: number; matchId: string; loading: boolean; }

export function AnalysisSummary({ mode, teamA, teamB, selectedTeam, sign, handicap, odds, sample, selectedHeroCount, matchId, loading }: AnalysisSummaryProps) {
  return <aside className="new-analysis__summary"><span>Предпросмотр запроса</span>{mode === 'handicap' ? <><strong>{teamA || 'Команда 1'} — {teamB || 'Команда 2'}</strong><b>{selectedTeam} {sign === 'plus' ? '+' : '−'}{handicap}</b><small>Выборка: {sample} карт · коэффициент {odds}</small></> : null}{mode === 'draft' ? <><strong>Ручной драфт</strong><b>{selectedHeroCount} / 10 героев</b></> : null}{mode === 'match' ? <><strong>Разбор матча</strong><b>#{matchId || '—'}</b></> : null}<button className="new-analysis__submit" type="submit" disabled={loading}>{loading ? 'Собираем данные…' : <><Zap size={17} />Запустить анализ</>}</button><small>Расчёт не является рекомендацией сделать ставку.</small></aside>;
}
