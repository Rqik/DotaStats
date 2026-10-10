import type { HeroOption } from '../api/openDotaRepository';
import { HeroIdentity } from '../components/HeroIdentity';
import type { MatchDraftPick, MatchPlayerAnalysis } from '../services/matchAnalysis';
import './MatchPlayerCard.scss';

interface MatchPlayerCardProps {
  heroId: number | null;
  hero?: HeroOption;
  player?: MatchPlayerAnalysis;
  pick?: MatchDraftPick;
}

export function MatchPlayerCard({ heroId, hero, player, pick }: MatchPlayerCardProps) {
  const name = player?.name || 'Ник не передан';

  return (
    <div className="match-player">
      <HeroIdentity hero={hero} heroId={heroId} />
      <strong className={`match-player__name${player?.name ? '' : ' match-player__name--missing'}`} title={name}>{name}</strong>
      <span className="match-player__kda">
        <small>K / D / A</small>
        <b>{player?.kills ?? '—'} / {player?.deaths ?? '—'} / {player?.assists ?? '—'}</b>
      </span>
      {pick ? <small className="match-player__pick">{pick.order === null ? 'Пик из состава' : `Порядок ${pick.order + 1}`}</small> : null}
    </div>
  );
}
