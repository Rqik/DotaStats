import type { HandicapUsedMatch } from '../features/analysis/analysisClient';
import './HandicapMatchesTable.scss';

interface HandicapMatchesTableProps {
  matches: readonly HandicapUsedMatch[];
  sign: string;
  line: number;
}

const groups = [
  { id: 'selected-team' as const, label: 'Матчи выбранной команды' },
  { id: 'opponent-opponents' as const, label: 'Матчи соперника против других команд' },
  { id: 'h2h' as const, label: 'Личные встречи' },
];

const outcomeLabels = { win: 'Выигрыш', loss: 'Проигрыш', refund: 'Возврат' };

interface MarginPresentation {
  primary: string;
  detail: string;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}`;
}

export function describeHandicapMargin(margin: number, outcome: HandicapUsedMatch['outcome']): MarginPresentation {
  if (outcome === 'win') {
    return { primary: `Запас ${signed(margin)}`, detail: 'Линия пройдена' };
  }
  if (outcome === 'refund') {
    return { primary: 'Ровно по линии', detail: 'Для выигрыша нужно ещё 1 убийство' };
  }
  const killsNeeded = Math.floor(Math.abs(margin)) + 1;
  return {
    primary: `Не хватило ${killsNeeded} ${killsNeeded === 1 ? 'убийства' : 'убийств'}`,
    detail: `Итог линии ${signed(margin)}`,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
      .format(date);
}

export function HandicapMatchesTable({ matches, sign, line }: HandicapMatchesTableProps) {
  if (matches.length === 0) {
    return (
      <section className="handicap-matches">
        <h2>Использованные матчи</h2>
        <p>Валидных матчей для таблицы не найдено.</p>
      </section>
    );
  }

  return (
    <section className="handicap-matches">
      <h2>Использованные матчи</h2>
      <p>«Итог линии» — результат формулы с учётом форы. Для проигранной линии рядом показано целое число убийств, которого не хватило до выигрыша.</p>
      <p>Один матч может входить в несколько групп, но в общей выборке хранится один раз.</p>
      <div
        className="handicap-matches__scroller"
        role="region"
        aria-label="Таблица использованных матчей"
      >
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Команда / соперник</th>
              <th>Счёт</th>
              <th>Итог линии {sign}{line}</th>
              <th>Исход</th>
              <th>Match ID</th>
            </tr>
          </thead>
          {groups.map((group) => {
            const rows = matches.filter((match) => match.groups.includes(group.id));
            if (rows.length === 0) return null;
            return (
              <tbody key={group.id}>
                <tr className="handicap-matches__group">
                  <th colSpan={6}>{group.label} · {rows.length}</th>
                </tr>
                {rows.map((match) => {
                  const margin = describeHandicapMargin(match.margin, match.outcome);
                  return <tr key={`${group.id}-${match.matchId}`}>
                    <td>{formatDate(match.date)}</td>
                    <td>
                      <strong>{match.subjectTeamName ?? `Team ${match.subjectTeamId ?? '—'}`}</strong>
                      <small>{match.opponentTeamName ?? `Team ${match.opponentTeamId ?? '—'}`}</small>
                    </td>
                    <td>{match.score}</td>
                    <td className="handicap-matches__margin"><strong>{margin.primary}</strong><small>{margin.detail}</small></td>
                    <td>
                      <span className={`handicap-matches__status handicap-matches__status--${match.outcome}`}>
                        {outcomeLabels[match.outcome]}
                      </span>
                    </td>
                    <td>#{match.matchId}</td>
                  </tr>;
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}
