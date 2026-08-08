import { ChevronDown, Search } from 'lucide-react';
import type { HandicapSign } from '../stores/analysis';

interface HandicapAnalysisFormProps {
  teamA: string;
  teamB: string;
  selectedTeam: string;
  sign: HandicapSign;
  handicap: string;
  odds: string;
  sample: string;
  onTeamChange: (side: 'a' | 'b', value: string) => void;
  onSelectedTeamChange: (value: string) => void;
  onSignChange: (sign: HandicapSign) => void;
  onHandicapChange: (value: string) => void;
  onOddsChange: (value: string) => void;
  onSampleChange: (value: string) => void;
}

export function HandicapAnalysisForm({ teamA, teamB, selectedTeam, sign, handicap, odds, sample, onTeamChange, onSelectedTeamChange, onSignChange, onHandicapChange, onOddsChange, onSampleChange }: HandicapAnalysisFormProps) {
  return <><h2>Участники и линия</h2><div className="new-analysis__teams"><label>Команда 1<span><Search size={16} /><input value={teamA} onChange={(event) => onTeamChange('a', event.target.value)} /></span></label><label>Команда 2<span><Search size={16} /><input value={teamB} onChange={(event) => onTeamChange('b', event.target.value)} /></span></label></div><div className="new-analysis__fields"><label>Выбранная команда<select value={selectedTeam} onChange={(event) => onSelectedTeamChange(event.target.value)}><option value={teamA}>{teamA}</option><option value={teamB}>{teamB}</option></select><ChevronDown size={16} /></label><fieldset><legend>Фора по убийствам</legend><button className={sign === 'plus' ? 'new-analysis__sign new-analysis__sign--active' : 'new-analysis__sign'} type="button" onClick={() => onSignChange('plus')} aria-pressed={sign === 'plus'}>+</button><button className={sign === 'minus' ? 'new-analysis__sign new-analysis__sign--active' : 'new-analysis__sign'} type="button" onClick={() => onSignChange('minus')} aria-pressed={sign === 'minus'}>−</button><input inputMode="decimal" value={handicap} onChange={(event) => onHandicapChange(event.target.value)} /></fieldset><label>Коэффициент<input inputMode="decimal" value={odds} onChange={(event) => onOddsChange(event.target.value)} /></label></div><div className="new-analysis__sample" aria-label="Размер выборки">{['10', '20', '30'].map((size) => <button className={sample === size ? 'new-analysis__sample-option new-analysis__sample-option--active' : 'new-analysis__sample-option'} type="button" key={size} onClick={() => onSampleChange(size)}>{size} карт</button>)}</div></>;
}
