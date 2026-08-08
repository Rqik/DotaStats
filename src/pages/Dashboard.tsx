import { Activity, ArrowRight, ArrowUpRight, Coins, Plus, Target, TrendingUp, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { formatMoney, useBetStore } from '../features/bets/betStore';
import { DashboardChart } from './DashboardChart';
import './Dashboard.scss';

const historicalSummary = { profit: 2446, turnover: 36300, wins: 21, settled: 34 };

export default function Dashboard() {
  const navigate = useNavigate();
  const bets = useBetStore((state) => state.bets);
  const settledBets = bets.filter(({ result }) => result !== 'pending');
  const profit = historicalSummary.profit + settledBets.reduce((sum, bet) => sum + bet.profit, 0);
  const turnover = historicalSummary.turnover + settledBets.reduce((sum, bet) => sum + bet.stake, 0);
  const wins = historicalSummary.wins + settledBets.filter(({ result }) => result === 'win').length;
  const settledCount = historicalSummary.settled + settledBets.length;
  const metrics = [
    { label: 'Текущий банк', value: formatMoney(50000 + profit), helper: 'Старт: 50 000 ₽', icon: WalletCards },
    { label: 'Чистая прибыль', value: `${profit >= 0 ? '+' : ''}${formatMoney(profit)}`, helper: 'За всё время', icon: Coins },
    { label: 'ROI', value: `${turnover ? ((profit / turnover) * 100).toFixed(1) : '0.0'}%`, helper: `Оборот ${formatMoney(turnover)}`, icon: TrendingUp },
    { label: 'Винрейт', value: `${settledCount ? Math.round((wins / settledCount) * 100) : 0}%`, helper: `${wins} из ${settledCount} расчётных`, icon: Target },
  ];

  return <div className="dashboard"><PageHeading eyebrow="Воскресенье, 19 июля" title="Обзор стратегии" description="Ключевые показатели и последние расчёты в одном месте." actions={<button className="dashboard__action" type="button" onClick={() => navigate('/analysis')}><Plus size={18} />Новый анализ</button>} /><section className="dashboard__metrics" aria-label="Основные показатели">{metrics.map(({ label, value, helper, icon: Icon }) => <article className="dashboard__metric" key={label}><div className="dashboard__metric-header"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small><ArrowUpRight size={13} />{helper}</small></article>)}</section><section className="dashboard__grid"><article className="dashboard__panel dashboard__panel--chart"><div className="dashboard__panel-heading"><div><span>Динамика</span><h2>Банк и доходность</h2></div><Activity size={20} /></div><DashboardChart /></article><article className="dashboard__panel"><div className="dashboard__panel-heading"><div><span>Контроль риска</span><h2>Пульс стратегии</h2></div></div><strong className="dashboard__score">74 <small>/ 100</small></strong><p>Здоровая динамика: риск остаётся в пределах выбранной стратегии.</p><dl className="dashboard__risk-list"><div><dt>Средний размер ставки</dt><dd>2.1% банка</dd></div><div><dt>Макс. просадка</dt><dd>−4.8%</dd></div><div><dt>Открытые ставки</dt><dd>1 000 ₽</dd></div></dl></article></section><section className="dashboard__grid"><article className="dashboard__panel"><div className="dashboard__panel-heading"><div><span>Расчёты</span><h2>Последние анализы</h2></div><button className="dashboard__link" type="button" onClick={() => navigate('/analysis')}>Все анализы <ArrowRight size={15} /></button></div><button className="dashboard__analysis" type="button" onClick={() => navigate('/analysis/result')}><strong>Vici Gaming +20.5</strong><span>против Team Falcons · 20 карт</span><b>+11.4 п.п.</b></button><button className="dashboard__analysis" type="button" onClick={() => navigate('/analysis/result')}><strong>Tundra −8.5</strong><span>против Nigma Galaxy · 10 карт</span><b>+4.8 п.п.</b></button></article><article className="dashboard__panel"><div className="dashboard__panel-heading"><div><span>Журнал</span><h2>Последние ставки</h2></div><button className="dashboard__link" type="button" onClick={() => navigate('/bets')}>Открыть <ArrowRight size={15} /></button></div>{bets.slice(0, 3).map((bet) => <div className="dashboard__bet" key={bet.id}><span className={`dashboard__dot dashboard__dot--${bet.result}`} /><div><strong>{bet.selection}</strong><small>{bet.match}</small></div><b>{bet.result === 'pending' ? 'В игре' : `${bet.profit > 0 ? '+' : ''}${formatMoney(bet.profit)}`}</b></div>)}</article></section><aside className="dashboard__notice"><strong>Интерпретируйте малые выборки осторожно.</strong><span>Расчёты на 10 картах могут заметно меняться после каждого нового матча.</span></aside></div>;
}
