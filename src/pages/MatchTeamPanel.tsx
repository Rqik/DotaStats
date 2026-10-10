import { Trophy } from 'lucide-react';
import type { HeroOption } from '../api/openDotaRepository';
import type { MatchTeamAnalysis } from '../features/analysis/analysisClient';
import { MatchPlayerCard } from './MatchPlayerCard';
import './MatchTeamPanel.scss';

interface MatchTeamPanelProps {
  team: MatchTeamAnalysis;
  heroes: ReadonlyMap<number, HeroOption>;
}

export function MatchTeamPanel({ team, heroes }: MatchTeamPanelProps) {
  const players = team.players.filter((player) => player.side === team.side);
  const roster = [
    ...players.map((player) => ({
      key: `player-${player.playerSlot}`,
      heroId: player.heroId,
      player,
      pick: team.picks.find((pick) => pick.side === team.side && pick.heroId === player.heroId),
    })),
    ...team.picks.filter((pick) => pick.side === team.side && !players.some((player) => player.heroId === pick.heroId)).map((pick) => ({
      key: `pick-${pick.heroId}`,
      heroId: pick.heroId,
      player: undefined,
      pick,
    })),
  ];

  return (
    <article className={`match-team match-team--${team.side}`}>
      <header className="match-team__header">
        <span>{team.side === 'radiant' ? 'Radiant' : 'Dire'}</span>
        <h2>{team.name}</h2>
        <strong>{team.score ?? '—'}</strong>
        <small className={`match-team__outcome${team.winner === true ? ' match-team__outcome--winner' : ''}`}>
          {team.winner === true ? <Trophy size={15} aria-hidden="true" /> : null}
          {team.winner === null ? 'Победитель не указан' : team.winner ? 'Победитель' : 'Проигравшая сторона'}
        </small>
      </header>
      <div className="match-team__roster">
        {roster.length > 0 ? <ul aria-label={`Состав и пики ${team.name}`}>
          {roster.map(({ key, heroId, player, pick }) => <li key={key}>
            <MatchPlayerCard heroId={heroId} hero={heroId === null ? undefined : heroes.get(heroId)} player={player} pick={pick} />
          </li>)}
        </ul> : <p>Состав и пики отсутствуют в ответе OpenDota.</p>}
      </div>
    </article>
  );
}
