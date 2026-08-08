import { Download, Plus, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeading } from '../components/PageHeading';
import { formatMoney, useBetStore, type BetResult } from '../features/bets/betStore';
import './BetsJournal.scss';

const resultLabels: Record<BetResult, string> = { pending: 'Ожидает', win: 'Выигрыш', loss: 'Проигрыш', refund: 'Возврат' };

export default function BetsJournal() {
  const bets = useBetStore((state) => state.bets);
  const settleBet = useBetStore((state) => state.settleBet);
  const [filter, setFilter] = useState<'all' | BetResult>('all');
  const visibleBets = useMemo(() => filter === 'all' ? bets : bets.filter((bet) => bet.result === filter), [bets, filter]);
  const settledBets = bets.filter((bet) => bet.result !== 'pending');
  const profit = settledBets.reduce((sum, bet) => sum + bet.profit, 0);
  const turnover = settledBets.reduce((sum, bet) => sum + bet.stake, 0);
  return <div className="bets-journal"><PageHeading eyebrow="Локальный учёт" title="Журнал ставок" description="Записи сохранены в этом браузере. Статистика не является прогнозом." actions={<button className="bets-journal__primary" type="button"><Plus size={17} />Добавить запись</button>} /><section className="bets-journal__summary"><article><span>Прибыль</span><strong>{profit >= 0 ? '+' : ''}{formatMoney(profit)}</strong></article><article><span>Оборот</span><strong>{formatMoney(turnover)}</strong></article><article><span>ROI</span><strong>{turnover ? `${((profit / turnover) * 100).toFixed(1)}%` : '0.0%'}</strong></article><article><span>Расчётных ставок</span><strong>{settledBets.length}</strong></article></section><section className="bets-journal__panel"><div className="bets-journal__toolbar"><div className="bets-journal__filters" aria-label="Фильтр ставок">{(['all', 'pending', 'win', 'loss', 'refund'] as const).map((result) => <button className={filter === result ? 'bets-journal__filter bets-journal__filter--active' : 'bets-journal__filter'} type="button" key={result} onClick={() => setFilter(result)}>{result === 'all' ? 'Все' : resultLabels[result]}</button>)}</div><div className="bets-journal__tools"><button type="button"><Download size={15} />Экспорт</button><button type="button"><Upload size={15} />Импорт</button></div></div><div className="bets-journal__table"><table><thead><tr><th>Матч</th><th>Исход</th><th>Коэф.</th><th>Сумма</th><th>Статус</th><th>Прибыль</th></tr></thead><tbody>{visibleBets.map((bet) => <tr key={bet.id}><td><strong>{bet.match}</strong><small>{bet.tournament} · {bet.date}</small></td><td>{bet.selection}</td><td>{bet.odds.toFixed(2)}</td><td>{formatMoney(bet.stake)}</td><td><select aria-label={`Статус ставки ${bet.selection}`} value={bet.result} onChange={(event) => settleBet(bet.id, event.target.value as BetResult)}>{(Object.keys(resultLabels) as BetResult[]).map((result) => <option key={result} value={result}>{resultLabels[result]}</option>)}</select></td><td className={bet.profit > 0 ? 'bets-journal__profit bets-journal__profit--positive' : bet.profit < 0 ? 'bets-journal__profit bets-journal__profit--negative' : 'bets-journal__profit'}>{bet.result === 'pending' ? '—' : `${bet.profit > 0 ? '+' : ''}${formatMoney(bet.profit)}`}</td></tr>)}</tbody></table></div>{visibleBets.length === 0 ? <p className="bets-journal__empty">Нет записей с выбранным статусом.</p> : null}</section></div>;
}
