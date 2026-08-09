import { z } from 'zod';
import { ApiError } from '../api/client';
import {
  openDotaRepository,
  type CachedResult,
  type RefreshOptions,
} from '../api/openDotaRepository';
import {
  openDotaMatchSchema,
  type OpenDotaMatch,
  type OpenDotaPlayer,
} from '../api/schemas';

const matchIdSchema = z.union([
  z.number().int().positive().safe(),
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().safe()),
]);

export type MatchSide = 'radiant' | 'dire';

export interface MatchPlayerAnalysis {
  side: MatchSide;
  accountId: number | null;
  playerSlot: number;
  heroId: number | null;
  name: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
}

export interface MatchDraftPick {
  heroId: number;
  side: MatchSide;
  order: number | null;
  source: 'picks-bans' | 'players';
}

export interface MatchDraftBan {
  heroId: number;
  side: MatchSide | null;
  order: number;
}

export interface MatchTeamAnalysis {
  side: MatchSide;
  teamId: number | null;
  name: string;
  score: number | null;
  winner: boolean | null;
  players: MatchPlayerAnalysis[];
  picks: MatchDraftPick[];
}

export interface MatchAdvantagePoint {
  minute: number;
  value: number;
}

export type MatchAnalysisWarningCode =
  | 'match_not_parsed'
  | 'team_name_fallback'
  | 'missing_score'
  | 'missing_winner'
  | 'missing_duration'
  | 'missing_players'
  | 'player_lineup_incomplete'
  | 'picks_from_players'
  | 'picks_incomplete'
  | 'missing_bans'
  | 'missing_gold_advantage'
  | 'missing_xp_advantage';

export interface MatchAnalysisWarning {
  code: MatchAnalysisWarningCode;
  message: string;
  side?: MatchSide;
}

export interface MatchAnalysisResult {
  matchId: number;
  parsed: boolean;
  startTime: number | null;
  date: string | null;
  durationSeconds: number | null;
  durationMinutes: number | null;
  radiant: MatchTeamAnalysis;
  dire: MatchTeamAnalysis;
  winnerSide: MatchSide | null;
  winnerTeamId: number | null;
  winnerTeamName: string | null;
  bans: MatchDraftBan[];
  radiantGoldAdvantage: MatchAdvantagePoint[];
  radiantXpAdvantage: MatchAdvantagePoint[];
  warnings: MatchAnalysisWarning[];
}

export interface LoadedMatchAnalysis {
  data: MatchAnalysisResult;
  source: CachedResult<unknown>['source'];
  savedAt: number;
  ageMs: number;
}

export interface MatchAnalysisRepository {
  getMatch: (
    matchId: number,
    options?: RefreshOptions,
  ) => Promise<CachedResult<OpenDotaMatch>>;
}

export interface LoadMatchAnalysisOptions extends RefreshOptions {
  repository?: MatchAnalysisRepository;
  now?: () => number;
}

function positiveInteger(value: number | null | undefined): number | null {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value ?? null : null;
}

function nonNegativeInteger(value: number | null | undefined): number | null {
  return Number.isInteger(value) && (value ?? -1) >= 0 ? value ?? null : null;
}

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function playerSide(playerSlot: number | null | undefined): MatchSide | null {
  if (!Number.isInteger(playerSlot) || playerSlot === null || playerSlot === undefined || playerSlot < 0 || playerSlot > 255) {
    return null;
  }
  return playerSlot < 128 ? 'radiant' : 'dire';
}

function normalizePlayers(players: readonly OpenDotaPlayer[] | undefined): MatchPlayerAnalysis[] {
  if (!players) return [];
  return players.flatMap((player) => {
    const side = playerSide(player.player_slot);
    if (!side || player.player_slot === null || player.player_slot === undefined) return [];
    return [{
      side,
      accountId: positiveInteger(player.account_id),
      playerSlot: player.player_slot,
      heroId: positiveInteger(player.hero_id),
      name: text(player.personaname) ?? text(player.name),
      kills: nonNegativeInteger(player.kills),
      deaths: nonNegativeInteger(player.deaths),
      assists: nonNegativeInteger(player.assists),
    }];
  }).sort((left, right) => left.playerSlot - right.playerSlot);
}

function draftSide(team: number): MatchSide | null {
  if (team === 0) return 'radiant';
  if (team === 1) return 'dire';
  return null;
}

function picksFromDraft(match: OpenDotaMatch, side: MatchSide): MatchDraftPick[] {
  const seen = new Set<number>();
  const picks: MatchDraftPick[] = [];
  for (const pick of [...(match.picks_bans ?? [])].sort((left, right) => left.order - right.order)) {
    if (!pick.is_pick || draftSide(pick.team) !== side || pick.hero_id <= 0 || seen.has(pick.hero_id)) continue;
    seen.add(pick.hero_id);
    picks.push({ heroId: pick.hero_id, side, order: pick.order, source: 'picks-bans' });
    if (picks.length === 5) break;
  }
  return picks;
}

function completePicksFromPlayers(
  picks: readonly MatchDraftPick[],
  players: readonly MatchPlayerAnalysis[],
  side: MatchSide,
): MatchDraftPick[] {
  const completed = [...picks];
  const seen = new Set(completed.map((pick) => pick.heroId));
  for (const player of players) {
    if (player.side !== side || player.heroId === null || seen.has(player.heroId)) continue;
    seen.add(player.heroId);
    completed.push({ heroId: player.heroId, side, order: null, source: 'players' });
    if (completed.length === 5) break;
  }
  return completed;
}

function bans(match: OpenDotaMatch): MatchDraftBan[] {
  return [...(match.picks_bans ?? [])]
    .filter((pick) => !pick.is_pick && pick.hero_id > 0)
    .sort((left, right) => left.order - right.order)
    .map((pick) => ({ heroId: pick.hero_id, side: draftSide(pick.team), order: pick.order }));
}

function advantage(values: readonly number[] | null | undefined): MatchAdvantagePoint[] {
  return (values ?? []).map((value, minute) => ({ minute, value }));
}

function teamName(match: OpenDotaMatch, side: MatchSide): { name: string; fallback: boolean } {
  const value = side === 'radiant' ? match.radiant_team?.name : match.dire_team?.name;
  const normalized = text(value);
  return normalized ? { name: normalized, fallback: false } : { name: side === 'radiant' ? 'Radiant' : 'Dire', fallback: true };
}

export function normalizeMatchAnalysis(input: unknown): MatchAnalysisResult {
  const parsed = openDotaMatchSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError('invalid_schema', 'OpenDota returned an unexpected match shape', { cause: parsed.error });
  }
  const match = parsed.data;
  const warnings: MatchAnalysisWarning[] = [];
  const players = normalizePlayers(match.players);
  const radiantPlayers = players.filter((player) => player.side === 'radiant');
  const direPlayers = players.filter((player) => player.side === 'dire');
  const radiantDraftPicks = picksFromDraft(match, 'radiant');
  const direDraftPicks = picksFromDraft(match, 'dire');
  const radiantPicks = completePicksFromPlayers(radiantDraftPicks, players, 'radiant');
  const direPicks = completePicksFromPlayers(direDraftPicks, players, 'dire');
  const matchBans = bans(match);
  const radiantIdentity = teamName(match, 'radiant');
  const direIdentity = teamName(match, 'dire');
  const radiantScore = nonNegativeInteger(match.radiant_score);
  const direScore = nonNegativeInteger(match.dire_score);
  const durationSeconds = nonNegativeInteger(match.duration);
  const startTime = nonNegativeInteger(match.start_time);
  const parsedMatch = positiveInteger(match.version) !== null;
  const winnerSide: MatchSide | null = match.radiant_win === true
    ? 'radiant'
    : match.radiant_win === false ? 'dire' : null;

  if (!parsedMatch) warnings.push({ code: 'match_not_parsed', message: 'OpenDota не пометил матч как разобранный парсером.' });
  if (radiantIdentity.fallback) warnings.push({ code: 'team_name_fallback', side: 'radiant', message: 'Название Radiant отсутствует; используется обозначение стороны.' });
  if (direIdentity.fallback) warnings.push({ code: 'team_name_fallback', side: 'dire', message: 'Название Dire отсутствует; используется обозначение стороны.' });
  if (radiantScore === null || direScore === null) warnings.push({ code: 'missing_score', message: 'Итоговый счёт матча доступен не полностью.' });
  if (winnerSide === null) warnings.push({ code: 'missing_winner', message: 'OpenDota не указал победившую сторону.' });
  if (durationSeconds === null) warnings.push({ code: 'missing_duration', message: 'Продолжительность матча отсутствует.' });
  if (players.length === 0) warnings.push({ code: 'missing_players', message: 'Список игроков отсутствует.' });
  if (radiantPlayers.length !== 5) warnings.push({ code: 'player_lineup_incomplete', side: 'radiant', message: `Для Radiant найдено игроков: ${radiantPlayers.length} из 5.` });
  if (direPlayers.length !== 5) warnings.push({ code: 'player_lineup_incomplete', side: 'dire', message: `Для Dire найдено игроков: ${direPlayers.length} из 5.` });
  if (radiantPicks.some((pick) => pick.source === 'players')) warnings.push({ code: 'picks_from_players', side: 'radiant', message: 'Пики Radiant частично восстановлены из hero_id игроков.' });
  if (direPicks.some((pick) => pick.source === 'players')) warnings.push({ code: 'picks_from_players', side: 'dire', message: 'Пики Dire частично восстановлены из hero_id игроков.' });
  if (radiantPicks.length !== 5) warnings.push({ code: 'picks_incomplete', side: 'radiant', message: `Для Radiant найдено пиков: ${radiantPicks.length} из 5.` });
  if (direPicks.length !== 5) warnings.push({ code: 'picks_incomplete', side: 'dire', message: `Для Dire найдено пиков: ${direPicks.length} из 5.` });
  if (matchBans.length === 0) warnings.push({ code: 'missing_bans', message: 'Баны героев отсутствуют.' });
  if (!match.radiant_gold_adv || match.radiant_gold_adv.length === 0) warnings.push({ code: 'missing_gold_advantage', message: 'Поминутное преимущество по золоту отсутствует.' });
  if (!match.radiant_xp_adv || match.radiant_xp_adv.length === 0) warnings.push({ code: 'missing_xp_advantage', message: 'Поминутное преимущество по опыту отсутствует.' });

  const radiant: MatchTeamAnalysis = {
    side: 'radiant',
    teamId: positiveInteger(match.radiant_team?.team_id),
    name: radiantIdentity.name,
    score: radiantScore,
    winner: winnerSide === null ? null : winnerSide === 'radiant',
    players: radiantPlayers,
    picks: radiantPicks,
  };
  const dire: MatchTeamAnalysis = {
    side: 'dire',
    teamId: positiveInteger(match.dire_team?.team_id),
    name: direIdentity.name,
    score: direScore,
    winner: winnerSide === null ? null : winnerSide === 'dire',
    players: direPlayers,
    picks: direPicks,
  };
  const winner = winnerSide === 'radiant' ? radiant : winnerSide === 'dire' ? dire : null;

  return {
    matchId: match.match_id,
    parsed: parsedMatch,
    startTime,
    date: startTime === null ? null : new Date(startTime * 1000).toISOString(),
    durationSeconds,
    durationMinutes: durationSeconds === null ? null : durationSeconds / 60,
    radiant,
    dire,
    winnerSide,
    winnerTeamId: winner?.teamId ?? null,
    winnerTeamName: winner?.name ?? null,
    bans: matchBans,
    radiantGoldAdvantage: advantage(match.radiant_gold_adv),
    radiantXpAdvantage: advantage(match.radiant_xp_adv),
    warnings,
  };
}

export async function loadMatchAnalysis(
  matchId: number | string,
  options: LoadMatchAnalysisOptions = {},
): Promise<LoadedMatchAnalysis> {
  const parsedId = matchIdSchema.safeParse(matchId);
  if (!parsedId.success) {
    throw new ApiError('invalid_request', 'Match ID must be a positive safe integer', { cause: parsedId.error });
  }
  const repository = options.repository ?? openDotaRepository;
  const refresh = options.forceRefresh ? { forceRefresh: true } : undefined;
  const result = await repository.getMatch(parsedId.data, refresh);
  const now = options.now ?? Date.now;
  return {
    data: normalizeMatchAnalysis(result.data),
    source: result.source,
    savedAt: result.savedAt,
    ageMs: Math.max(0, now() - result.savedAt),
  };
}
