import { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CloudOff,
  Coins,
  Database,
  Download,
  FileSearch,
  Gamepad2,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  ListFilter,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Upload,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateDemoHandicapResult, demoHandicapInput, useAnalysisStore } from './stores/analysis';

type BetResult = 'pending' | 'win' | 'loss' | 'refund';

type Bet = {
  id: string;
  date: string;
  tournament: string;
  match: string;
  selection: string;
  odds: number;
  stake: number;
  result: BetResult;
  profit: number;
};

type BetStore = {
  bets: Bet[];
  addBet: (bet: Bet) => void;
  settleBet: (id: string, result: BetResult) => void;
};

const seedBets: Bet[] = [
  {
    id: 'bet-1',
    date: '18 июл, 21:30',
    tournament: 'Riyadh Masters',
    match: 'Team Spirit — Aurora',
    selection: 'Spirit −7.5 убийств',
    odds: 1.82,
    stake: 1200,
    result: 'win',
    profit: 984,
  },
  {
    id: 'bet-2',
    date: '17 июл, 19:00',
    tournament: 'FISSURE Universe',
    match: 'PARIVISION — Tundra',
    selection: 'PARIVISION победа',
    odds: 1.68,
    stake: 1500,
    result: 'loss',
    profit: -1500,
  },
  {
    id: 'bet-3',
    date: '16 июл, 16:30',
    tournament: 'Elite League',
    match: 'Falcons — Vici Gaming',
    selection: 'Vici +20.5 убийств',
    odds: 1.65,
    stake: 1000,
    result: 'pending',
    profit: 0,
  },
  {
    id: 'bet-4',
    date: '15 июл, 20:00',
    tournament: 'Riyadh Masters',
    match: 'Liquid — BB Team',
    selection: 'Тотал больше 48.5',
    odds: 1.91,
    stake: 1000,
    result: 'win',
    profit: 910,
  },
];

const historicalSummary = {
  profit: 2446,
  turnover: 36300,
  wins: 21,
  settled: 34,
};

const useBetStore = create<BetStore>()(
  persist(
    (set) => ({
      bets: seedBets,
      addBet: (bet) =>
        set((state) => ({
          bets: state.bets.some((item) => item.id === bet.id) ? state.bets : [bet, ...state.bets],
        })),
      settleBet: (id, result) =>
        set((state) => ({
          bets: state.bets.map((bet) => {
            if (bet.id !== id) return bet;
            const profit = result === 'win' ? bet.stake * (bet.odds - 1) : result === 'loss' ? -bet.stake : 0;
            return { ...bet, result, profit };
          }),
        })),
    }),
    { name: 'dota-pulse-bets' },
  ),
);

const performanceData = [
  { day: '20 июн', bank: 50000, baseline: 50000 },
  { day: '24 июн', bank: 50720, baseline: 50000 },
  { day: '28 июн', bank: 49840, baseline: 50000 },
  { day: '2 июл', bank: 51260, baseline: 50000 },
  { day: '6 июл', bank: 51910, baseline: 50000 },
  { day: '10 июл', bank: 51450, baseline: 50000 },
  { day: '14 июл', bank: 52640, baseline: 50000 },
  { day: '18 июл', bank: 52840, baseline: 50000 },
];

const strengthData = [
  { minute: 15, value: 6 },
  { minute: 20, value: 9 },
  { minute: 25, value: 7 },
  { minute: 30, value: 2 },
  { minute: 35, value: -1 },
  { minute: 40, value: -4 },
  { minute: 45, value: -8 },
  { minute: 50, value: -12 },
  { minute: 60, value: -14 },
];

const matches = [
  { date: '14.07.26', opponent: 'Xtreme Gaming', score: '18 : 31', delta: '−13', covered: true, id: '8420184011' },
  { date: '12.07.26', opponent: 'Yakult Brothers', score: '21 : 39', delta: '−18', covered: true, id: '8417290448' },
  { date: '10.07.26', opponent: 'Team Tidebound', score: '14 : 38', delta: '−24', covered: false, id: '8414062231' },
  { date: '08.07.26', opponent: 'Azure Ray', score: '27 : 35', delta: '−8', covered: true, id: '8411057190' },
  { date: '06.07.26', opponent: 'Gaozu', score: '24 : 41', delta: '−17', covered: true, id: '8408061642' },
];

const analyses = [
  { kind: 'Фора', title: 'Vici Gaming +20.5', meta: 'против Team Falcons · 20 карт', value: '+11.4 п.п.', tone: 'positive', time: 'сегодня, 14:20' },
  { kind: 'Драфт', title: 'Team Spirit — Aurora', meta: 'предварительный фаворит: Spirit', value: '57%', tone: 'neutral', time: 'вчера, 22:05' },
  { kind: 'Фора', title: 'Tundra −8.5', meta: 'против Nigma Galaxy · 10 карт', value: '+4.8 п.п.', tone: 'warning', time: '16 июл, 18:40' },
];

const navItems = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard },
  { to: '/analysis', label: 'Новый анализ', icon: FileSearch },
  { to: '/bets', label: 'Журнал ставок', icon: BookOpen },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';

function Logo() {
  return (
    <div className="logo-lockup">
      <div className="logo-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>DOTA PULSE</strong>
        <small>LOCAL ANALYTICS</small>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button className="sidebar-scrim" onClick={onClose} aria-label="Закрыть меню" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button close-sidebar" onClick={onClose} aria-label="Закрыть меню">
            <X size={18} />
          </button>
        </div>
        <nav className="main-nav" aria-label="Основная навигация">
          <span className="nav-caption">Рабочее пространство</span>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {to === '/analysis' && <span className="nav-hotkey">N</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="bank-mini">
          <div className="bank-mini-heading">
            <span>Текущий банк</span>
            <WalletCards size={16} />
          </div>
          <strong>52 840 ₽</strong>
          <div className="mini-progress"><span /></div>
          <small><b>+5.7%</b> от стартового банка</small>
        </div>
        <div className="sidebar-profile">
          <div className="avatar">АК</div>
          <div>
            <strong>Алексей К.</strong>
            <span><i /> Данные локально</span>
          </div>
          <MoreHorizontal size={18} />
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="topbar">
      <button className="icon-button menu-button" onClick={onMenu} aria-label="Открыть меню">
        <Menu size={20} />
      </button>
      <div className="topbar-context">
        <span className="live-dot" />
        OpenDota доступна
        <span className="context-divider" />
        <span className="muted">Обновлено 12 минут назад</span>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Помощь"><CircleHelp size={19} /></button>
        <button className="icon-button notification-button" aria-label="Уведомления"><Bell size={19} /><span /></button>
      </div>
    </header>
  );
}

function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="page-wrap">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const bets = useBetStore((state) => state.bets);
  const settled = bets.filter((bet) => bet.result !== 'pending');
  const profit = historicalSummary.profit + settled.reduce((sum, bet) => sum + bet.profit, 0);
  const turnover = historicalSummary.turnover + settled.reduce((sum, bet) => sum + bet.stake, 0);
  const wins = historicalSummary.wins + settled.filter((bet) => bet.result === 'win').length;
  const settledCount = historicalSummary.settled + settled.length;
  const metrics = [
    { label: 'Текущий банк', value: formatMoney(50000 + profit), helper: 'Старт: 50 000 ₽', icon: WalletCards, trend: '+5.7%', tone: 'positive' },
    { label: 'Чистая прибыль', value: `${profit >= 0 ? '+' : ''}${formatMoney(profit)}`, helper: 'За всё время', icon: Coins, trend: '+984 ₽', tone: 'positive' },
    { label: 'ROI', value: `${turnover ? ((profit / turnover) * 100).toFixed(1) : '0.0'}%`, helper: `Оборот ${formatMoney(turnover)}`, icon: TrendingUp, trend: '+2.4 п.п.', tone: 'positive' },
    { label: 'Винрейт', value: `${settledCount ? Math.round((wins / settledCount) * 100) : 0}%`, helper: `${wins} из ${settledCount} расчётных`, icon: Target, trend: 'стабильно', tone: 'neutral' },
  ];

  return (
    <div className="page dashboard-page">
      <PageHeading
        eyebrow="Воскресенье, 19 июля"
        title="Обзор стратегии"
        description="Ключевые показатели и последние расчёты в одном месте."
        actions={
          <button className="button primary" onClick={() => navigate('/analysis')}>
            <Plus size={18} /> Новый анализ
          </button>
        }
      />

      <section className="metrics-grid" aria-label="Основные показатели">
        {metrics.map(({ label, value, helper, icon: Icon, trend, tone }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top"><span>{label}</span><Icon size={19} /></div>
            <div className="metric-value">{value}</div>
            <div className="metric-bottom">
              <span className={`trend-tag ${tone}`}>
                {tone === 'positive' ? <ArrowUpRight size={13} /> : <Activity size={13} />}{trend}
              </span>
              <span>{helper}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-main-grid">
        <article className="panel performance-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">Динамика</span><h2>Банк и доходность</h2></div>
            <div className="period-switch" aria-label="Период">
              <button>7д</button><button className="active">30д</button><button>Всё</button>
            </div>
          </div>
          <div className="chart-summary">
            <strong>+2 840 ₽</strong>
            <span><ArrowUpRight size={14} /> 5.68% за 30 дней</span>
          </div>
          <div className="performance-chart" aria-label="График динамики банка">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="bankFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dcff52" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#dcff52" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#24282d" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#737b84', fontSize: 11 }} dy={8} />
                <YAxis domain={[49000, 53500]} axisLine={false} tickLine={false} tick={{ fill: '#737b84', fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip contentStyle={{ background: '#16191d', border: '1px solid #30353b', borderRadius: 10, fontSize: 12 }} formatter={(value) => [formatMoney(Number(value)), 'Банк']} />
                <Area type="monotone" dataKey="bank" stroke="#dcff52" strokeWidth={2.3} fill="url(#bankFill)" activeDot={{ r: 4, fill: '#dcff52', stroke: '#0b0d0f', strokeWidth: 3 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel pulse-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">Контроль риска</span><h2>Пульс стратегии</h2></div>
            <ShieldCheck size={20} />
          </div>
          <div className="risk-score">
            <div className="risk-ring"><span>74</span><small>/ 100</small></div>
            <div><strong>Здоровая динамика</strong><p>Риск остаётся в пределах выбранной стратегии.</p></div>
          </div>
          <div className="risk-list">
            <div><span><i className="risk-green" /> Средний размер ставки</span><strong>2.1% банка</strong></div>
            <div><span><i className="risk-yellow" /> Макс. просадка</span><strong>−4.8%</strong></div>
            <div><span><i className="risk-blue" /> Открытые ставки</span><strong>1 000 ₽</strong></div>
          </div>
          <div className="insight-note"><Sparkles size={16} /><span>Последние 12 ставок показывают меньше разброса, чем среднее за месяц.</span></div>
        </article>
      </section>

      <section className="dashboard-lower-grid">
        <article className="panel analyses-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">Расчёты</span><h2>Последние анализы</h2></div>
            <button className="text-button" onClick={() => navigate('/analysis')}>Все анализы <ArrowRight size={15} /></button>
          </div>
          <div className="analysis-list">
            {analyses.map((analysis) => (
              <button className="analysis-row" key={analysis.title} onClick={() => navigate('/analysis/result')}>
                <div className="analysis-type-icon">{analysis.kind === 'Драфт' ? <Swords size={18} /> : <Gauge size={18} />}</div>
                <div className="analysis-copy"><strong>{analysis.title}</strong><span>{analysis.meta}</span></div>
                <div className={`analysis-edge ${analysis.tone}`}><strong>{analysis.value}</strong><span>{analysis.time}</span></div>
                <ArrowRight size={16} className="row-arrow" />
              </button>
            ))}
          </div>
        </article>

        <article className="panel bets-preview-panel">
          <div className="panel-heading">
            <div><span className="panel-kicker">Журнал</span><h2>Последние ставки</h2></div>
            <button className="text-button" onClick={() => navigate('/bets')}>Открыть <ArrowRight size={15} /></button>
          </div>
          <div className="compact-bets">
            {bets.slice(0, 3).map((bet) => (
              <div className="compact-bet" key={bet.id}>
                <span className={`result-dot ${bet.result}`} />
                <div><strong>{bet.selection}</strong><span>{bet.match}</span></div>
                <div><strong>{bet.odds.toFixed(2)}</strong><span className={bet.profit > 0 ? 'positive-text' : bet.profit < 0 ? 'negative-text' : ''}>{bet.result === 'pending' ? 'в игре' : `${bet.profit > 0 ? '+' : ''}${formatMoney(bet.profit)}`}</span></div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <div className="data-warning">
        <Info size={18} />
        <div><strong>Интерпретируйте малые выборки осторожно</strong><span>Расчёты на 10 картах могут заметно меняться после каждого нового матча.</span></div>
        <button>Как считаем вероятность</button>
      </div>
    </div>
  );
}

type AnalysisMode = 'handicap' | 'draft' | 'match';

const heroes = ['Ember Spirit', 'Marci', 'Beastmaster', 'Phoenix', 'Disruptor', 'Templar Assassin', 'Tiny', 'Mars', 'Rubick', 'Enchantress', 'Morphling', 'Pangolier'];

const normalizeSelectedTeam = (selectedTeam: string, teamA: string, teamB: string): string | null => {
  const normalizedSelection = selectedTeam.trim().toLocaleLowerCase();
  return [teamA.trim(), teamB.trim()].find((team) => team.toLocaleLowerCase() === normalizedSelection) ?? null;
};

function NewAnalysis() {
  const navigate = useNavigate();
  const runHandicap = useAnalysisStore((state) => state.runHandicap);
  const [mode, setMode] = useState<AnalysisMode>('handicap');
  const [loading, setLoading] = useState(false);
  const [teamA, setTeamA] = useState('Team Falcons');
  const [teamB, setTeamB] = useState('Vici Gaming');
  const [selectedTeam, setSelectedTeam] = useState('Vici Gaming');
  const [handicapSign, setHandicapSign] = useState<'+' | '−'>('+');
  const [handicap, setHandicap] = useState('20.5');
  const [odds, setOdds] = useState('1.65');
  const [sample, setSample] = useState('20');
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>(heroes.slice(0, 10));
  const [matchId, setMatchId] = useState('8420184011');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateTeamA = (value: string) => {
    const previousTeam = teamA;
    setTeamA(value);
    setSelectedTeam((current) => current === previousTeam ? value : current);
  };

  const updateTeamB = (value: string) => {
    const previousTeam = teamB;
    setTeamB(value);
    setSelectedTeam((current) => current === previousTeam ? value : current);
  };

  const run = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (mode !== 'handicap') {
      setErrors({ integration: 'Режим ожидает подключения OpenDota.' });
      return;
    }

    if (!teamA.trim()) nextErrors.teamA = 'Укажите первую команду.';
    if (!teamB.trim()) nextErrors.teamB = 'Укажите вторую команду.';
    const normalizedSelectedTeam = normalizeSelectedTeam(selectedTeam, teamA, teamB);
    if (!normalizedSelectedTeam) nextErrors.selectedTeam = 'Выберите одну из указанных команд.';
    if (teamA.trim() && teamB.trim() && teamA.trim().toLocaleLowerCase() === teamB.trim().toLocaleLowerCase()) {
      nextErrors.teams = 'Выберите две разные команды.';
    }
    if (!handicap.trim() || !Number.isFinite(Number(handicap))) nextErrors.handicap = 'Введите числовое значение форы.';
    if (!odds.trim() || !Number.isFinite(Number(odds)) || Number(odds) <= 1) nextErrors.odds = 'Коэффициент должен быть больше 1.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    runHandicap({
      teamA: teamA.trim(),
      teamB: teamB.trim(),
      selectedTeam: normalizedSelectedTeam!,
      sign: handicapSign === '+' ? 'plus' : 'minus',
      handicap: Number(handicap),
      odds: Number(odds),
      sample: Number(sample),
    });
    setLoading(true);
    window.setTimeout(() => navigate('/analysis/result'), 900);
  };

  const toggleHero = (hero: string) => {
    setSelectedHeroes((current) =>
      current.includes(hero) ? current.filter((item) => item !== hero) : current.length < 10 ? [...current, hero] : current,
    );
  };

  return (
    <div className="page analysis-create-page">
      <PageHeading
        eyebrow="Новый расчёт"
        title="Что будем анализировать?"
        description="Выберите сценарий и укажите исходные данные. Мы покажем расчёт, выборку и ограничения модели."
      />

      <div className="mode-grid" role="tablist" aria-label="Режим анализа">
        <button className={`mode-card ${mode === 'handicap' ? 'active' : ''}`} onClick={() => { setMode('handicap'); setErrors({}); }} role="tab" aria-selected={mode === 'handicap'}>
          <span className="mode-icon"><Gauge size={22} /></span>
          <span><strong>Фора по убийствам</strong><small>Проверить покрытие линии на истории команд</small></span>
          <i>{mode === 'handicap' && <Check size={13} />}</i>
        </button>
        <button className={`mode-card ${mode === 'draft' ? 'active' : ''}`} onClick={() => { setMode('draft'); setErrors({}); }} role="tab" aria-selected={mode === 'draft'}>
          <span className="mode-icon"><Swords size={22} /></span>
          <span><strong>Ручной драфт</strong><small>Сравнить пики, матчапы и пики силы</small></span>
          <i>{mode === 'draft' && <Check size={13} />}</i>
        </button>
        <button className={`mode-card ${mode === 'match' ? 'active' : ''}`} onClick={() => { setMode('match'); setErrors({}); }} role="tab" aria-selected={mode === 'match'}>
          <span className="mode-icon"><Gamepad2 size={22} /></span>
          <span><strong>По Match ID</strong><small>Разобрать начавшийся или завершённый матч</small></span>
          <i>{mode === 'match' && <Check size={13} />}</i>
        </button>
      </div>

      <form className="analysis-workspace" onSubmit={run}>
        <section className="panel analysis-form-panel">
          {mode === 'handicap' && (
            <>
              <div className="form-section-heading"><span>01</span><div><h2>Участники матча</h2><p>Начните вводить название профессиональной команды.</p></div></div>
              <div className="team-fields">
                <label className="field"><span>Команда 1</span><div className="input-with-icon"><Search size={17} /><input value={teamA} onChange={(e) => updateTeamA(e.target.value)} /><span className="team-color blue" /></div>{errors.teamA && <small className="field-error">{errors.teamA}</small>}</label>
                <div className="versus">VS</div>
                <label className="field"><span>Команда 2</span><div className="input-with-icon"><Search size={17} /><input value={teamB} onChange={(e) => updateTeamB(e.target.value)} /><span className="team-color orange" /></div>{errors.teamB && <small className="field-error">{errors.teamB}</small>}</label>
              </div>
              {errors.teams && <p className="form-error" role="alert">{errors.teams}</p>}
              <div className="form-divider" />
              <div className="form-section-heading"><span>02</span><div><h2>Линия букмекера</h2><p>Коэффициент вводится вручную и не сохраняется как рекомендация.</p></div></div>
              <div className="form-grid three">
                <label className="field"><span>Выбранная команда</span><div className="select-wrap"><select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}><option>{teamB}</option><option>{teamA}</option></select><ChevronDown size={16} /></div>{errors.selectedTeam && <small className="field-error">{errors.selectedTeam}</small>}</label>
                <label className="field"><span>Фора по убийствам</span><div className="handicap-input"><button type="button" className={`sign-button ${handicapSign === '+' ? 'active' : ''}`} onClick={() => setHandicapSign('+')} aria-pressed={handicapSign === '+'}>+</button><button type="button" className={`sign-button ${handicapSign === '−' ? 'active' : ''}`} onClick={() => setHandicapSign('−')} aria-pressed={handicapSign === '−'}>−</button><input inputMode="decimal" value={handicap} onChange={(e) => setHandicap(e.target.value)} /></div>{errors.handicap && <small className="field-error">{errors.handicap}</small>}</label>
                <label className="field"><span>Коэффициент</span><input inputMode="decimal" value={odds} onChange={(e) => setOdds(e.target.value)} />{errors.odds && <small className="field-error">{errors.odds}</small>}</label>
              </div>
              <div className="form-grid three secondary-fields">
                <label className="field"><span>Размер выборки</span><div className="sample-switch">{['10', '20', '30'].map((size) => <button type="button" className={sample === size ? 'active' : ''} onClick={() => setSample(size)} key={size}>{size}</button>)}</div></label>
                <label className="field"><span>Турнир <em>необязательно</em></span><input placeholder="Например, Riyadh Masters" /></label>
                <label className="field"><span>Дата матча <em>необязательно</em></span><div className="input-with-icon"><CalendarDays size={17} /><input type="date" defaultValue="2026-07-19" /></div></label>
              </div>
            </>
          )}

          {mode === 'draft' && (
            <>
              <div className="form-section-heading"><span>01</span><div><h2>Составы команд</h2><p>Выберите десять разных героев: по пять на каждую сторону.</p></div></div>
              <div className="draft-team-headings">
                <div><i className="team-color blue" /><label className="field"><span>Radiant · Команда A</span><input defaultValue="Team Falcons" /></label></div>
                <strong>VS</strong>
                <div><i className="team-color orange" /><label className="field"><span>Dire · Команда B</span><input defaultValue="Vici Gaming" /></label></div>
              </div>
              <div className="draft-slots">
                <div>{selectedHeroes.slice(0, 5).map((hero, index) => <span className="hero-slot blue-slot" key={hero}><b>{index + 1}</b>{hero}<button type="button" onClick={() => toggleHero(hero)}><X size={13} /></button></span>)}</div>
                <div>{selectedHeroes.slice(5, 10).map((hero, index) => <span className="hero-slot orange-slot" key={hero}><b>{index + 1}</b>{hero}<button type="button" onClick={() => toggleHero(hero)}><X size={13} /></button></span>)}</div>
              </div>
              <div className="hero-browser-heading"><span>Все герои</span><div className="mini-search"><Search size={15} /><input placeholder="Поиск героя" /></div></div>
              <div className="hero-grid">
                {heroes.map((hero, index) => <button type="button" className={selectedHeroes.includes(hero) ? 'selected' : ''} onClick={() => toggleHero(hero)} key={hero}><span className={`hero-glyph glyph-${index % 5}`}>{hero.slice(0, 1)}</span><small>{hero}</small>{selectedHeroes.includes(hero) && <Check size={12} />}</button>)}
              </div>
              <div className="draft-count"><span style={{ width: `${selectedHeroes.length * 10}%` }} /><p>{selectedHeroes.length} из 10 героев выбрано</p></div>
              {errors.draft && <p className="form-error" role="alert">{errors.draft}</p>}
              {errors.integration && <p className="form-error" role="status">{errors.integration}</p>}
            </>
          )}

          {mode === 'match' && (
            <div className="match-id-mode">
              <div className="form-section-heading"><span>01</span><div><h2>Загрузить матч</h2><p>Подойдёт числовой ID профессионального или публичного матча.</p></div></div>
              <label className="field match-id-field"><span>Match ID</span><div className="input-with-icon"><Gamepad2 size={19} /><input inputMode="numeric" value={matchId} onChange={(e) => setMatchId(e.target.value.replace(/\D/g, ''))} /></div><small>Только цифры · данные будут запрошены через OpenDota</small>{errors.matchId && <small className="field-error" role="alert">{errors.matchId}</small>}</label>
              {errors.integration && <p className="form-error" role="status">{errors.integration}</p>}
              <div className="match-preview">
                <div className="match-preview-icon"><Database size={22} /></div>
                <div><strong>Что загрузим</strong><p>Составы, пики и баны, итоговый счёт, графики золота и опыта.</p></div>
                <span>~ 2–5 сек</span>
              </div>
            </div>
          )}
        </section>

        <aside className="analysis-summary-card">
          <span className="summary-caption">Предпросмотр запроса</span>
          {mode === 'handicap' && <>
            <div className="summary-match"><div><span className="team-badge blue-badge">FLC</span><strong>{teamA || 'Команда 1'}</strong></div><span>против</span><div><span className="team-badge orange-badge">VICI</span><strong>{teamB || 'Команда 2'}</strong></div></div>
            <div className="summary-selection"><span>Анализируемый исход</span><strong>{selectedTeam} {handicapSign}{handicap}</strong><small>по убийствам · коэффициент {odds}</small></div>
            <div className="summary-facts"><div><span>Выборка</span><strong>{sample} карт</strong></div><div><span>Безубыточность</span><strong>{odds && Number(odds) > 0 ? (100 / Number(odds)).toFixed(1) : '—'}%</strong></div></div>
          </>}
          {mode === 'draft' && <>
            <div className="draft-summary-icon"><Swords size={30} /></div><div className="summary-selection centered"><span>Ручной драфт</span><strong>{selectedHeroes.length} / 10 героев</strong><small>тайминги · матчапы · форма команд</small></div>
            <div className="summary-facts"><div><span>Сторона A</span><strong>Radiant</strong></div><div><span>Сторона B</span><strong>Dire</strong></div></div>
          </>}
          {mode === 'match' && <>
            <div className="draft-summary-icon"><Gamepad2 size={30} /></div><div className="summary-selection centered"><span>Разбор матча</span><strong>#{matchId || '—'}</strong><small>актуальные данные OpenDota</small></div>
            <div className="connection-row"><span><i /> API доступна</span><RefreshCw size={14} /></div>
          </>}
          <div className="privacy-note"><CloudOff size={16} /><span>Результат сохранится только в этом браузере.</span></div>
          <button className="button primary wide" type="submit" disabled={loading}>
            {loading ? <><RefreshCw size={17} className="spin" /> Собираем данные…</> : <><Zap size={17} /> Запустить анализ</>}
          </button>
          <small className="summary-disclaimer">Расчёт не является рекомендацией сделать ставку.</small>
        </aside>
      </form>
    </div>
  );
}

function ProbabilityGauge({ probability }: { probability: number }) {
  const percentage = probability * 100;
  const angle = percentage * 1.8;
  const radians = (angle * Math.PI) / 180;
  const x = 100 - 72 * Math.cos(radians);
  const y = 100 - 72 * Math.sin(radians);
  return (
    <svg className="probability-gauge" viewBox="0 0 200 112" role="img" aria-label={`Расчётная вероятность ${percentage.toFixed(1)} процента`}>
      <path d="M 28 100 A 72 72 0 0 1 172 100" pathLength="100" className="gauge-track" />
      <path d="M 28 100 A 72 72 0 0 1 172 100" pathLength="100" className="gauge-value" strokeDasharray={`${percentage} 100`} />
      <circle cx={x} cy={y} r="4" className="gauge-dot" />
      <text x="100" y="78" textAnchor="middle" className="gauge-number">{percentage.toFixed(1)}%</text>
      <text x="100" y="98" textAnchor="middle" className="gauge-label">расчётная вероятность</text>
    </svg>
  );
}

function AnalysisResult() {
  const navigate = useNavigate();
  const addBet = useBetStore((state) => state.addBet);
  const bets = useBetStore((state) => state.bets);
  const storedInput = useAnalysisStore((state) => state.handicapInput);
  const storedResult = useAnalysisStore((state) => state.handicapResult);
  const input = storedInput ?? demoHandicapInput;
  const result = storedResult ?? calculateDemoHandicapResult(input);
  const sign = input.sign === 'plus' ? '+' : '−';
  const opponent = input.selectedTeam === input.teamA ? input.teamB : input.teamA;
  const statusCopy = {
    insufficient_data: 'Недостаточно данных',
    no_edge: 'Преимущества нет',
    borderline: 'Пограничная ситуация',
    statistical_edge: 'Есть статистический запас',
  }[result.status];
  const alreadySaved = bets.some((bet) => bet.id === 'analysis-bet-handicap');
  const [saved, setSaved] = useState(alreadySaved);
  const [showAll, setShowAll] = useState(false);

  const saveBet = () => {
    addBet({ id: 'analysis-bet-handicap', date: '19 июл, 14:20', tournament: 'Elite League', match: `${input.teamA} — ${input.teamB}`, selection: `${input.selectedTeam} ${sign}${input.handicap} убийств`, odds: input.odds, stake: 1000, result: 'pending', profit: 0 });
    setSaved(true);
  };

  return (
    <div className="page result-page">
      <button className="back-button" onClick={() => navigate('/analysis')}><ArrowLeft size={16} /> Новый анализ</button>
      <PageHeading
        eyebrow="Фора по убийствам · расчёт завершён"
        title={`${input.teamA} — ${input.teamB}`}
        description={`Elite League · 19 июля, 19:00 · выборка ${input.sample} карт`}
        actions={<><button className="button secondary"><Download size={17} /> Экспорт</button><button className={`button ${saved ? 'saved-button' : 'primary'}`} onClick={saveBet}>{saved ? <CheckCircle2 size={17} /> : <Plus size={17} />}{saved ? 'В журнале' : 'Сохранить ставку'}</button></>}
      />

      <section className="result-hero">
        <div className="result-selection">
          <div className="result-selection-top"><span className="team-badge orange-badge">{input.selectedTeam.slice(0, 4).toUpperCase()}</span><div><span>Анализируемый исход</span><h2>{input.selectedTeam} <b>{sign}{input.handicap}</b></h2></div></div>
          <div className="odds-line"><span>Коэффициент <strong>{input.odds.toFixed(2)}</strong></span><i /><span>Безубыточность <strong>{(result.breakeven * 100).toFixed(1)}%</strong></span></div>
          <div className="result-status"><CheckCircle2 size={20} /><div><strong>{statusCopy}</strong><span>Расчёт {result.edge >= 0 ? 'выше' : 'ниже'} порога безубыточности на {Math.abs(result.edge * 100).toFixed(1)} п.п.</span></div></div>
        </div>
        <div className="gauge-wrap"><ProbabilityGauge probability={result.probability} /><div className="gauge-legend"><span>0%</span><span>50%</span><span>100%</span></div></div>
        <div className="edge-card"><span>{statusCopy}</span><strong>{result.edge >= 0 ? '+' : ''}{(result.edge * 100).toFixed(1)} <small>п.п.</small></strong><div className="edge-scale"><i /><b /></div><div className="edge-labels"><span>нет</span><span>погранично</span><span>запас</span></div><p><Info size={14} /> Это разница с вероятностью безубыточности, не гарантия исхода.</p></div>
      </section>

      <section className="coverage-grid">
        <article className="panel coverage-card blue-coverage"><div className="coverage-heading"><span className="team-badge blue-badge">{input.selectedTeam.slice(0, 4).toUpperCase()}</span><div><span>Последние карты {input.selectedTeam}</span><strong>17 из 20 покрытий</strong></div><b>85%</b></div><div className="coverage-bar"><span style={{ width: '85%' }} /></div><p>Скорректированная частота: <strong>{(result.teamFrequency * 100).toFixed(1)}%</strong></p></article>
        <article className="panel coverage-card orange-coverage"><div className="coverage-heading"><span className="team-badge orange-badge">{opponent.slice(0, 4).toUpperCase()}</span><div><span>Соперники {opponent}</span><strong>14 из 20 покрытий</strong></div><b>70%</b></div><div className="coverage-bar"><span style={{ width: '70%' }} /></div><p>Скорректированная частота: <strong>{(result.opponentFrequency * 100).toFixed(1)}%</strong></p></article>
        <article className="panel coverage-card h2h-coverage"><div className="coverage-heading"><span className="versus-badge">H2H</span><div><span>Личные встречи</span><strong>2 из 3 покрытий</strong></div><b>66.7%</b></div><div className="coverage-bar"><span style={{ width: '66.7%' }} /></div><p>Вес в итоговом расчёте: <strong>20%</strong></p></article>
      </section>

      <section className="panel formula-panel">
        <div className="panel-heading"><div><span className="panel-kicker">Прозрачный расчёт</span><h2>Как получили {(result.probability * 100).toFixed(1)}%</h2></div><button className="text-button">Методология <ArrowRight size={15} /></button></div>
        <div className="formula-flow">
          <div><span>{input.selectedTeam}</span><strong>{(result.teamFrequency * 100).toFixed(1)}%</strong><small>40% веса</small></div><b>+</b><div><span>Против {opponent}</span><strong>{(result.opponentFrequency * 100).toFixed(1)}%</strong><small>40% веса</small></div><b>+</b><div><span>Личные встречи</span><strong>{(result.h2hFrequency * 100).toFixed(1)}%</strong><small>20% веса</small></div><b>=</b><div className="formula-result"><span>Итого</span><strong>{(result.probability * 100).toFixed(1)}%</strong><small>сглаженная оценка</small></div>
        </div>
      </section>

      <section className="panel strength-panel">
        <div className="panel-heading"><div><span className="panel-kicker">Контекст драфта</span><h2>Сила составов по времени</h2></div><div className="chart-legend"><span><i className="legend-blue" /> Falcons</span><span><i className="legend-orange" /> Vici Gaming</span></div></div>
        <div className="strength-layout">
          <div className="strength-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={strengthData} margin={{ top: 12, right: 18, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="#24282d" vertical={false} strokeDasharray="3 4" />
                <XAxis dataKey="minute" axisLine={false} tickLine={false} tick={{ fill: '#737b84', fontSize: 11 }} tickFormatter={(v) => `${v}'`} />
                <YAxis domain={[-16, 16]} axisLine={false} tickLine={false} tick={{ fill: '#737b84', fontSize: 11 }} tickFormatter={(v) => `${Number(v) > 0 ? '+' : ''}${v}`} />
                <Tooltip contentStyle={{ background: '#16191d', border: '1px solid #30353b', borderRadius: 10, fontSize: 12 }} formatter={(value) => [`${Number(value) > 0 ? '+' : ''}${value} п.п.`, 'Преимущество Falcons']} />
                <Line type="monotone" dataKey="value" stroke="#65a9ff" strokeWidth={2.5} dot={{ r: 3, fill: '#0e1114', stroke: '#65a9ff', strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="timing-notes">
            <div><span>15–25 мин</span><strong><i className="team-color blue" /> Небольшое преимущество Falcons</strong><small>Пик: около +9 п.п. на 20 минуте</small></div>
            <div><span>30–40 мин</span><strong><i className="equal-dot" /> Примерно равные составы</strong><small>Разница не превышает 4 п.п.</small></div>
            <div><span>После 45 мин</span><strong><i className="team-color orange" /> Преимущество Vici Gaming</strong><small>Главный пик: +14 п.п. после 55 минуты</small></div>
          </div>
        </div>
      </section>

      <section className="panel matches-panel">
        <div className="panel-heading"><div><span className="panel-kicker">Исходные данные</span><h2>Использованные матчи</h2></div><div className="match-table-actions"><button><ListFilter size={15} /> Все выборки</button><span>43 карты</span></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Дата</th><th>Соперник</th><th>Счёт</th><th>Разница</th><th>Фора +20.5</th><th>Match ID</th></tr></thead>
            <tbody>{matches.slice(0, showAll ? matches.length : 4).map((match) => <tr key={match.id}><td>{match.date}</td><td><strong>{match.opponent}</strong></td><td>{match.score}</td><td>{match.delta}</td><td><span className={`coverage-status ${match.covered ? 'covered' : 'missed'}`}>{match.covered ? <Check size={13} /> : <X size={13} />}{match.covered ? 'Прошла' : 'Не прошла'}</span></td><td><button className="match-link">#{match.id} <ArrowUpRight size={13} /></button></td></tr>)}</tbody>
          </table>
        </div>
        <button className="show-more" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Свернуть список' : 'Показать ещё матчи'} <ChevronDown size={15} className={showAll ? 'upside-down' : ''} /></button>
      </section>
    </div>
  );
}

const resultLabels: Record<BetResult, string> = { pending: 'Ожидает', win: 'Выигрыш', loss: 'Проигрыш', refund: 'Возврат' };

function BetsJournal() {
  const bets = useBetStore((state) => state.bets);
  const settleBet = useBetStore((state) => state.settleBet);
  const [filter, setFilter] = useState<'all' | BetResult>('all');
  const [showAdd, setShowAdd] = useState(false);
  const visibleBets = filter === 'all' ? bets : bets.filter((bet) => bet.result === filter);
  const settled = bets.filter((bet) => bet.result !== 'pending');
  const profit = historicalSummary.profit + settled.reduce((sum, bet) => sum + bet.profit, 0);
  const turnover = historicalSummary.turnover + settled.reduce((sum, bet) => sum + bet.stake, 0);
  const wins = historicalSummary.wins + settled.filter((bet) => bet.result === 'win').length;
  const settledCount = historicalSummary.settled + settled.length;

  return (
    <div className="page bets-page">
      <PageHeading eyebrow="Локальный учёт" title="Журнал ставок" description="История решений, результаты и динамика банка без синхронизации с букмекером." actions={<button className="button primary" onClick={() => setShowAdd(true)}><Plus size={18} /> Добавить ставку</button>} />
      <section className="journal-summary">
        <div><span>Текущий банк</span><strong>{formatMoney(50000 + profit)}</strong><small><ArrowUpRight size={13} /> +{((profit / 50000) * 100).toFixed(1)}% к старту</small></div>
        <div><span>Чистая прибыль</span><strong className={profit >= 0 ? 'positive-text' : 'negative-text'}>{profit >= 0 ? '+' : ''}{formatMoney(profit)}</strong><small>Оборот {formatMoney(turnover)}</small></div>
        <div><span>ROI</span><strong>{turnover ? ((profit / turnover) * 100).toFixed(1) : '0.0'}%</strong><small>Макс. просадка −4.8%</small></div>
        <div><span>Винрейт</span><strong>{settledCount ? Math.round((wins / settledCount) * 100) : 0}%</strong><small>{wins} выигрыша · {settledCount - wins} проигрыша</small></div>
      </section>
      <section className="panel journal-panel">
        <div className="journal-toolbar">
          <div className="filter-tabs">{(['all', 'pending', 'win', 'loss'] as const).map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item === 'all' ? 'Все' : resultLabels[item]}{item === 'all' && <span>{bets.length}</span>}</button>)}</div>
          <div className="toolbar-actions"><button><Search size={16} /> Поиск</button><button><ListFilter size={16} /> Фильтры</button><button><Download size={16} /> CSV</button></div>
        </div>
        <div className="bet-list-table">
          <div className="bet-table-header"><span>Событие</span><span>Выбор</span><span>Коэф.</span><span>Сумма</span><span>Результат</span><span>Прибыль</span><span /></div>
          {visibleBets.map((bet) => <div className="bet-table-row" key={bet.id}>
            <div><span className="bet-date">{bet.date}</span><strong>{bet.match}</strong><small>{bet.tournament}</small></div>
            <div><strong>{bet.selection}</strong><small>Фора по убийствам</small></div>
            <div><strong>{bet.odds.toFixed(2)}</strong></div>
            <div><strong>{formatMoney(bet.stake)}</strong><small>деньги</small></div>
            <div>{bet.result === 'pending' ? <select value={bet.result} onChange={(e) => settleBet(bet.id, e.target.value as BetResult)}><option value="pending">Ожидает</option><option value="win">Выигрыш</option><option value="loss">Проигрыш</option><option value="refund">Возврат</option></select> : <span className={`bet-result ${bet.result}`}><i />{resultLabels[bet.result]}</span>}</div>
            <div><strong className={bet.profit > 0 ? 'positive-text' : bet.profit < 0 ? 'negative-text' : ''}>{bet.profit > 0 ? '+' : ''}{formatMoney(bet.profit)}</strong></div>
            <button className="icon-button"><MoreHorizontal size={17} /></button>
          </div>)}
        </div>
        {visibleBets.length === 0 && <div className="empty-state"><History size={26} /><strong>Здесь пока нет ставок</strong><span>Измените фильтр или добавьте новую запись.</span></div>}
      </section>
      {showAdd && <div className="modal-layer"><button className="modal-scrim" onClick={() => setShowAdd(false)} /><div className="modal-card"><button className="icon-button modal-close" onClick={() => setShowAdd(false)}><X size={18} /></button><span className="eyebrow">Новая запись</span><h2>Добавить ставку</h2><p>В прототипе новая ставка удобнее всего создаётся из результата анализа.</p><button className="button primary wide" onClick={() => { setShowAdd(false); window.location.assign('/analysis'); }}><FileSearch size={17} /> Перейти к анализу</button><button className="button secondary wide" onClick={() => setShowAdd(false)}>Отмена</button></div></div>}
    </div>
  );
}

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={() => setOn((value) => !value)} aria-pressed={on}><span /></button>;
}

function SettingsPage() {
  return (
    <div className="page settings-page">
      <PageHeading eyebrow="Параметры" title="Настройки" description="Источник данных, локальное хранилище и параметры интерфейса." />
      <div className="settings-layout">
        <nav className="settings-nav"><button className="active"><Database size={17} /> Источник данных</button><button><Activity size={17} /> Анализ</button><button><WalletCards size={17} /> Банк</button><button><Download size={17} /> Импорт и экспорт</button><button><Settings size={17} /> Интерфейс</button></nav>
        <div className="settings-content">
          <section className="panel settings-section"><div className="settings-heading"><div><h2>OpenDota API</h2><p>Прототип работает на демонстрационных данных. Для живых запросов можно добавить личный ключ.</p></div><span className="connection-badge"><i /> Доступна</span></div><label className="field"><span>API-ключ <em>необязательно</em></span><div className="api-key-row"><input type="password" defaultValue="dota-pulse-local-key" /><button className="button secondary">Проверить</button></div><small>Ключ сохраняется только в LocalStorage этого браузера.</small></label></section>
          <section className="panel settings-section"><div className="settings-heading"><div><h2>Обновление данных</h2><p>Сроки хранения кэша соответствуют типу данных.</p></div></div><div className="setting-row"><div><strong>Автоматически обновлять команды</strong><span>Не чаще одного раза в час</span></div><Toggle defaultOn /></div><div className="setting-row"><div><strong>Показывать возраст кэша</strong><span>Например: «данные сохранены 6 часов назад»</span></div><Toggle defaultOn /></div><div className="cache-row"><div><Database size={18} /><span><strong>Локальный кэш</strong><small>14.8 МБ · обновлён 12 минут назад</small></span></div><button className="button secondary"><RefreshCw size={16} /> Очистить кэш</button></div></section>
          <section className="panel settings-section"><div className="settings-heading"><div><h2>Перенос данных</h2><p>Экспортируйте журнал и анализы перед очисткой браузера.</p></div></div><div className="export-actions"><button><Download size={19} /><span><strong>Экспорт JSON</strong><small>Все данные и настройки</small></span></button><button><Upload size={19} /><span><strong>Импорт JSON</strong><small>С проверкой структуры</small></span></button></div></section>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="analysis" element={<NewAnalysis />} />
        <Route path="analysis/result" element={<AnalysisResult />} />
        <Route path="bets" element={<BetsJournal />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
