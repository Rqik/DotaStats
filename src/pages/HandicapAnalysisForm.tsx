import { ChevronDown } from 'lucide-react';
import {
  TournamentTeamSelection,
  type TournamentSelection,
} from '../features/team-picker/TournamentTeamSelection';
import type { AnalysisSampleSize, HandicapSign } from '../stores/analysis';

interface HandicapAnalysisFormProps {
  tournamentSelection: TournamentSelection;
  selectedTeamId: number | null;
  sign: HandicapSign;
  handicap: string;
  odds: string;
  sample: AnalysisSampleSize;
  onTournamentSelectionChange: (value: TournamentSelection) => void;
  onSelectedTeamChange: (teamId: number) => void;
  onSignChange: (sign: HandicapSign) => void;
  onHandicapChange: (value: string) => void;
  onOddsChange: (value: string) => void;
  onSampleChange: (value: AnalysisSampleSize) => void;
}

const sampleSizes: readonly AnalysisSampleSize[] = [10, 20, 30];

export function HandicapAnalysisForm({ tournamentSelection, selectedTeamId, sign, handicap, odds, sample, onTournamentSelectionChange, onSelectedTeamChange, onSignChange, onHandicapChange, onOddsChange, onSampleChange }: HandicapAnalysisFormProps) {
  const availableTeams = [tournamentSelection.teamA, tournamentSelection.teamB].filter((team) => team !== null);
  return <><h2>Участники и линия</h2><TournamentTeamSelection value={tournamentSelection} onChange={onTournamentSelectionChange} /><div className="new-analysis__fields"><label>Выбранная команда<select value={selectedTeamId ?? ''} onChange={(event) => onSelectedTeamChange(Number(event.target.value))} disabled={availableTeams.length !== 2}><option value="">Выберите команду</option>{availableTeams.map((team) => <option value={team.teamId} key={team.teamId}>{team.name}</option>)}</select><ChevronDown size={16} /></label><fieldset><legend>Фора по убийствам</legend><button className={sign === 'plus' ? 'new-analysis__sign new-analysis__sign--active' : 'new-analysis__sign'} type="button" onClick={() => onSignChange('plus')} aria-pressed={sign === 'plus'}>+</button><button className={sign === 'minus' ? 'new-analysis__sign new-analysis__sign--active' : 'new-analysis__sign'} type="button" onClick={() => onSignChange('minus')} aria-pressed={sign === 'minus'}>−</button><input aria-label="Значение форы" inputMode="decimal" value={handicap} onChange={(event) => onHandicapChange(event.target.value)} /></fieldset><label>Коэффициент<input inputMode="decimal" value={odds} onChange={(event) => onOddsChange(event.target.value)} /></label></div><div className="new-analysis__sample" aria-label="Размер выборки">{sampleSizes.map((size) => <button className={sample === size ? 'new-analysis__sample-option new-analysis__sample-option--active' : 'new-analysis__sample-option'} type="button" key={size} onClick={() => onSampleChange(size)} aria-pressed={sample === size}>{size} карт</button>)}</div></>;
}
