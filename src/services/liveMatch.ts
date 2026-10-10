import { ApiError } from '../api/client';
import { openDotaRepository, type HeroOption, type CachedResult } from '../api/openDotaRepository';
import type { OpenDotaLiveMatch } from '../api/schemas';
import type { DraftFormValue } from '../features/analysis/draftForm';

export interface LiveTeam {
  name: string;
  teamId: number | null;
  heroIds: number[];
  players: { heroId: number; name: string | null }[];
  score: number | null;
}

export interface LiveMatchSnapshot {
  matchId: number;
  leagueId: number | null;
  radiant: LiveTeam;
  dire: LiveTeam;
  gameTimeSeconds: number | null;
  delaySeconds: number | null;
  updatedAt: number | null;
  fetchedAt: number;
  isDraftComplete: boolean;
}

export type LiveMatchLookup =
  | { status: 'found'; match: LiveMatchSnapshot }
  | { status: 'not-found'; searchedMatches: number; fetchedAt: number };

export interface LiveMatchRepository {
  listLiveMatches: (options?: { forceRefresh?: boolean }) => Promise<CachedResult<OpenDotaLiveMatch[]>>;
}

function positiveId(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function findLiveMatch(id: string, games: OpenDotaLiveMatch[], fetchedAt: number): LiveMatchLookup {
  const matchId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(matchId) || matchId <= 0) {
    throw new ApiError('invalid_request', 'Укажите положительный цифровой Match ID.');
  }
  const game = games.find((item) => Number(item.match_id) === matchId && !(item.deactivate_time && item.deactivate_time > 0));
  if (!game) return { status: 'not-found', searchedMatches: games.length, fetchedAt };
  const playersForSide = (side: number) => game.players.filter((player) => player.team === side).flatMap((player) => {
    const heroId = positiveId(player.hero_id);
    return heroId === null ? [] : [{ heroId, name: player.personaname?.trim() || player.name?.trim() || null }];
  });
  const radiantPlayers = playersForSide(0);
  const direPlayers = playersForSide(1);
  const radiantHeroes = radiantPlayers.map((player) => player.heroId);
  const direHeroes = direPlayers.map((player) => player.heroId);
  const heroIds = [...radiantHeroes, ...direHeroes];
  return {
    status: 'found',
    match: {
      matchId,
      leagueId: positiveId(game.league_id),
      radiant: { name: game.team_name_radiant?.trim() || 'Radiant', teamId: positiveId(game.team_id_radiant), heroIds: radiantHeroes, players: radiantPlayers, score: game.radiant_score ?? null },
      dire: { name: game.team_name_dire?.trim() || 'Dire', teamId: positiveId(game.team_id_dire), heroIds: direHeroes, players: direPlayers, score: game.dire_score ?? null },
      gameTimeSeconds: game.game_time ?? null,
      delaySeconds: game.delay !== null && game.delay !== undefined && game.delay >= 0 ? game.delay : null,
      updatedAt: positiveId(game.last_update_time) === null ? null : (game.last_update_time ?? 0) * 1000,
      fetchedAt,
      isDraftComplete: radiantHeroes.length === 5 && direHeroes.length === 5 && new Set(heroIds).size === 10,
    },
  };
}

export async function loadLiveMatch(id: string, repository: LiveMatchRepository = openDotaRepository): Promise<LiveMatchLookup> {
  // Live snapshots are mutable: an explicit load always bypasses the short memory cache.
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new ApiError('invalid_request', 'Укажите положительный цифровой Match ID.');
  }
  const result = await repository.listLiveMatches({ forceRefresh: true });
  return findLiveMatch(id, result.data, result.savedAt);
}

export function applyLiveDraft(match: LiveMatchSnapshot, heroes: HeroOption[], draft: DraftFormValue): DraftFormValue {
  if (!match.isDraftComplete) throw new ApiError('invalid_request', 'Дождитесь десяти уникальных пиков: по пять для каждой стороны.');
  const resolveHero = (id: number): HeroOption => {
    const hero = heroes.find((item) => item.heroId === id);
    if (!hero) throw new ApiError('invalid_schema', `В каталоге OpenDota не найден герой #${id}. Обновите каталог.`);
    return hero;
  };
  return {
    ...draft,
    teamAName: match.radiant.name,
    teamBName: match.dire.name,
    teamASide: 'radiant',
    teamBSide: 'dire',
    teamAHeroes: match.radiant.heroIds.map(resolveHero),
    teamBHeroes: match.dire.heroIds.map(resolveHero),
  };
}
