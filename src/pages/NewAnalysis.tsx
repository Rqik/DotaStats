import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { useAnalysisStore, type HandicapSign } from '../stores/analysis';
import { AnalysisModes } from './AnalysisModes';
import { AnalysisSummary } from './AnalysisSummary';
import { HandicapAnalysisForm } from './HandicapAnalysisForm';
import { UnavailableAnalysisForm } from './UnavailableAnalysisForm';
import type { AnalysisMode } from './analysisMode';
import './NewAnalysis.scss';

const heroes = ['Ember Spirit', 'Marci', 'Beastmaster', 'Phoenix', 'Disruptor', 'Templar Assassin', 'Tiny', 'Mars', 'Rubick', 'Enchantress', 'Morphling', 'Pangolier'];
const normalizeSelectedTeam = (selectedTeam: string, teamA: string, teamB: string): string | null => [teamA.trim(), teamB.trim()].find((team) => team.toLocaleLowerCase() === selectedTeam.trim().toLocaleLowerCase()) ?? null;

export default function NewAnalysis() {
  const navigate = useNavigate();
  const runHandicap = useAnalysisStore((state) => state.runHandicap);
  const [mode, setMode] = useState<AnalysisMode>('handicap');
  const [loading, setLoading] = useState(false);
  const [teamA, setTeamA] = useState('Team Falcons');
  const [teamB, setTeamB] = useState('Vici Gaming');
  const [selectedTeam, setSelectedTeam] = useState('Vici Gaming');
  const [sign, setSign] = useState<HandicapSign>('plus');
  const [handicap, setHandicap] = useState('20.5');
  const [odds, setOdds] = useState('1.65');
  const [sample, setSample] = useState('20');
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>(heroes.slice(0, 10));
  const [matchId, setMatchId] = useState('8420184011');
  const [error, setError] = useState('');
  const changeMode = (nextMode: AnalysisMode) => { setMode(nextMode); setError(''); };
  const updateTeam = (side: 'a' | 'b', value: string) => { const previous = side === 'a' ? teamA : teamB; if (side === 'a') setTeamA(value); else setTeamB(value); setSelectedTeam((current) => current === previous ? value : current); };
  const toggleHero = (hero: string) => setSelectedHeroes((current) => current.includes(hero) ? current.filter((item) => item !== hero) : current.length < 10 ? [...current, hero] : current);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (mode !== 'handicap') { setError('Этот режим честно заблокирован до подключения данных OpenDota.'); return; } const selected = normalizeSelectedTeam(selectedTeam, teamA, teamB); if (!teamA.trim() || !teamB.trim() || teamA.trim().toLowerCase() === teamB.trim().toLowerCase()) { setError('Укажите две разные команды.'); return; } if (!selected || !Number.isFinite(Number(handicap)) || !Number.isFinite(Number(odds)) || Number(odds) <= 1) { setError('Проверьте выбранную команду, фору и коэффициент больше 1.'); return; } runHandicap({ teamA: teamA.trim(), teamB: teamB.trim(), selectedTeam: selected, sign, handicap: Number(handicap), odds: Number(odds), sample: Number(sample) }); setLoading(true); window.setTimeout(() => navigate('/analysis/result'), 500); };

  return <div className="new-analysis"><PageHeading eyebrow="Новый расчёт" title="Что будем анализировать?" description="Выберите сценарий и укажите исходные данные. Результат покажет формулу и ограничения модели." /><AnalysisModes mode={mode} onChange={changeMode} /><form className="new-analysis__workspace" onSubmit={submit}><section className="new-analysis__form">{mode === 'handicap' ? <HandicapAnalysisForm teamA={teamA} teamB={teamB} selectedTeam={selectedTeam} sign={sign} handicap={handicap} odds={odds} sample={sample} onTeamChange={updateTeam} onSelectedTeamChange={setSelectedTeam} onSignChange={setSign} onHandicapChange={setHandicap} onOddsChange={setOdds} onSampleChange={setSample} /> : <UnavailableAnalysisForm mode={mode} heroes={heroes} selectedHeroes={selectedHeroes} matchId={matchId} onHeroToggle={toggleHero} onMatchIdChange={setMatchId} />}{error ? <p className="new-analysis__error" role="alert">{error}</p> : null}</section><AnalysisSummary mode={mode} teamA={teamA} teamB={teamB} selectedTeam={selectedTeam} sign={sign} handicap={handicap} odds={odds} sample={sample} selectedHeroCount={selectedHeroes.length} matchId={matchId} loading={loading} /></form></div>;
}
