import { ArrowRight } from 'lucide-react';
import type { Bet } from '../features/bets/betStore';
import { formatMoney } from '../features/bets/betStore';

interface DashboardRecentBetsProps {
  bets: readonly Bet[];
  onOpenJournal: () => void;
}

export function DashboardRecentBets({ bets, onOpenJournal }: DashboardRecentBetsProps) {
  return (
    <article className="dashboard__panel">
      <div className="dashboard__panel-heading">
        <div><span>Журнал</span><h2>Последние ставки</h2></div>
        <button className="dashboard__link" type="button" onClick={onOpenJournal}>
          Открыть <ArrowRight size={15} />
        </button>
      </div>
      {bets.length === 0 ? <p className="dashboard__empty">В журнале пока нет ставок.</p> : null}
      {bets.slice(0, 3).map((bet) => (
        <div className="dashboard__bet" key={bet.id}>
          <span className={`dashboard__dot dashboard__dot--${bet.result}`} />
          <div><strong>{bet.selection}</strong><small>{bet.match}</small></div>
          <b>{bet.result === 'pending' ? 'Ожидает' : `${bet.profit > 0 ? '+' : ''}${formatMoney(bet.profit)}`}</b>
        </div>
      ))}
    </article>
  );
}
