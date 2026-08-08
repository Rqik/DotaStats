import { ArrowLeft, Check, CheckCircle2, Download, Info, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { useBetStore } from '../features/bets/betStore';
import { calculateDemoHandicapResult, demoHandicapInput, useAnalysisStore } from '../stores/analysis';
import { ProbabilityChart } from './ProbabilityChart';
import './AnalysisResult.scss';

const statusLabels = { insufficient_data: 'Недостаточно данных', no_edge: 'Преимущества нет', borderline: 'Пограничная ситуация', statistical_edge: 'Есть статистический запас' };
const matches = [{ id: '8420184011', date: '14.07.26', opponent: 'Xtreme Gaming', score: '18 : 31', covered: true }, { id: '8417290448', date: '12.07.26', opponent: 'Yakult Brothers', score: '21 : 39', covered: true }, { id: '8414062231', date: '10.07.26', opponent: 'Team Tidebound', score: '14 : 38', covered: false }, { id: '8411057190', date: '08.07.26', opponent: 'Azure Ray', score: '27 : 35', covered: true }];

export default function AnalysisResult() {
  const navigate = useNavigate();
  const addBet = useBetStore((state) => state.addBet);
  const bets = useBetStore((state) => state.bets);
  const storedInput = useAnalysisStore((state) => state.handicapInput);
  const storedResult = useAnalysisStore((state) => state.handicapResult);
  const input = storedInput ?? demoHandicapInput;
  const result = storedResult ?? calculateDemoHandicapResult(input);
  const sign = input.sign === 'plus' ? '+' : '−';
  const opponent = input.selectedTeam === input.teamA ? input.teamB : input.teamA;
  const [saved, setSaved] = useState(bets.some(({ id }) => id === 'analysis-bet-handicap'));
  const saveBet = () => { addBet({ id: 'analysis-bet-handicap', date: '19 июл., 14:20', tournament: 'Elite League', match: `${input.teamA} — ${input.teamB}`, selection: `${input.selectedTeam} ${sign}${input.handicap} убийств`, odds: input.odds, stake: 1000, result: 'pending', profit: 0 }); setSaved(true); };

  return <div className="analysis-result"><button className="analysis-result__back" type="button" onClick={() => navigate('/analysis')}><ArrowLeft size={16} />Новый анализ</button><PageHeading eyebrow="Фора по убийствам · расчёт завершён" title={`${input.teamA} — ${input.teamB}`} description={`Elite League · выборка ${input.sample} карт`} actions={<><button className="analysis-result__secondary" type="button"><Download size={16} />Экспорт</button><button className="analysis-result__primary" type="button" onClick={saveBet}>{saved ? <CheckCircle2 size={16} /> : <Plus size={16} />}{saved ? 'В журнале' : 'Сохранить ставку'}</button></>} /><section className="analysis-result__hero"><article className="analysis-result__selection"><span>Анализируемый исход</span><h2>{input.selectedTeam} <b>{sign}{input.handicap}</b></h2><dl><div><dt>Коэффициент</dt><dd>{input.odds.toFixed(2)}</dd></div><div><dt>Безубыточность</dt><dd>{(result.breakeven * 100).toFixed(1)}%</dd></div></dl><p><CheckCircle2 size={19} /><span><strong>{statusLabels[result.status]}</strong>Расчёт выше порога безубыточности на {Math.abs(result.edge * 100).toFixed(1)} п.п.</span></p></article><article className="analysis-result__probability"><ProbabilityChart probability={result.probability} /></article><article className="analysis-result__edge"><span>{statusLabels[result.status]}</span><strong>{result.edge >= 0 ? '+' : ''}{(result.edge * 100).toFixed(1)} <small>п.п.</small></strong><div><i /><b /></div><p><Info size={15} />Это разница с вероятностью безубыточности, не гарантия исхода.</p></article></section><section className="analysis-result__coverage"><article><span>{input.selectedTeam}</span><strong>{(result.teamFrequency * 100).toFixed(1)}%</strong><small>Сглаженная частота, 17 из 20</small></article><article><span>Против {opponent}</span><strong>{(result.opponentFrequency * 100).toFixed(1)}%</strong><small>Сглаженная частота, 14 из 20</small></article><article><span>Личные встречи</span><strong>{(result.h2hFrequency * 100).toFixed(1)}%</strong><small>Вес в итоговом расчёте: 20%</small></article></section><section className="analysis-result__panel"><h2>Как получили {(result.probability * 100).toFixed(1)}%</h2><div className="analysis-result__formula"><span>{input.selectedTeam}<b>{(result.teamFrequency * 100).toFixed(1)}%</b></span><i>+</i><span>{opponent}<b>{(result.opponentFrequency * 100).toFixed(1)}%</b></span><i>+</i><span>H2H<b>{(result.h2hFrequency * 100).toFixed(1)}%</b></span><i>=</i><strong>{(result.probability * 100).toFixed(1)}%</strong></div></section><section className="analysis-result__panel"><h2>Использованные матчи</h2><div className="analysis-result__table"><table><thead><tr><th>Дата</th><th>Соперник</th><th>Счёт</th><th>Фора {sign}{input.handicap}</th><th>Match ID</th></tr></thead><tbody>{matches.map((match) => <tr key={match.id}><td>{match.date}</td><td>{match.opponent}</td><td>{match.score}</td><td><span className={match.covered ? 'analysis-result__status analysis-result__status--covered' : 'analysis-result__status analysis-result__status--missed'}>{match.covered ? <Check size={13} /> : null}{match.covered ? 'Прошла' : 'Не прошла'}</span></td><td>#{match.id}</td></tr>)}</tbody></table></div></section></div>;
}
