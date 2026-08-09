import type { MatchTeamAnalysis } from '../features/analysis/analysisClient';
import './MatchTeamPanel.scss';

interface MatchTeamPanelProps {
  team: MatchTeamAnalysis;
}

function playerName(name: string | null, accountId: number | null): string {
  if (name) return name;
  return accountId === null ? 'Игрок не указан' : `Игрок #${accountId}`;
}

export function MatchTeamPanel({ team }: MatchTeamPanelProps) {
  return (
    <article className={`match-team match-team--${team.side}`}>
      <header className="match-team__header">
        <span>{team.side === 'radiant' ? 'Radiant' : 'Dire'}</span>
        <h2>{team.name}</h2>
        <strong>{team.score ?? '—'}</strong>
        <small>{team.winner === null ? 'Победитель не указан' : team.winner ? 'Победитель' : 'Проигравшая сторона'}</small>
      </header>
      <div className="match-team__roster">
        <table>
          <thead><tr><th>Игрок</th><th>Герой</th><th>K / D / A</th></tr></thead>
          <tbody>
            {team.players.length > 0 ? team.players.map((player) => (
              <tr key={`${player.playerSlot}-${player.accountId ?? 'anonymous'}`}>
                <td>{playerName(player.name, player.accountId)}</td>
                <td>{player.heroId === null ? 'Не указан' : `Hero #${player.heroId}`}</td>
                <td>{player.kills ?? '—'} / {player.deaths ?? '—'} / {player.assists ?? '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={3}>Состав игроков отсутствует в ответе OpenDota.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="match-team__picks">
        <span>Пики</span>
        {team.picks.length > 0 ? (
          <ul>{team.picks.map((pick) => (
            <li key={`${pick.heroId}-${pick.order ?? 'player'}`}>
              Hero #{pick.heroId}
              <small>{pick.source === 'players' ? 'из состава' : `порядок ${pick.order}`}</small>
            </li>
          ))}</ul>
        ) : <p>Пики отсутствуют.</p>}
      </div>
    </article>
  );
}
