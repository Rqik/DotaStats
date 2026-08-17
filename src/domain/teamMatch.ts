export type TeamSide = 'radiant' | 'dire';

export interface TeamMatchData {
  match_id: number;
  start_time: number;
  radiant?: boolean;
  radiant_win?: boolean | null;
  radiant_score?: number | null;
  dire_score?: number | null;
  radiant_team_id?: number | null;
  dire_team_id?: number | null;
  radiant_name?: string | null;
  dire_name?: string | null;
  opposing_team_id?: number | null;
  opposing_team_name?: string | null;
  leagueid?: number | null;
  league_name?: string | null;
}

export interface NormalizedTeamMatch {
  matchId: number;
  startTime: number;
  date: string;
  queriedTeamId: number;
  queriedTeamName: string | null;
  opponentTeamId: number | null;
  opponentTeamName: string | null;
  side: TeamSide;
  teamKills: number;
  opponentKills: number;
  leagueId: number | null;
  leagueName: string | null;
  teamWon: boolean | null;
}

export type TeamMatchSkipReason =
  | 'duplicate_match'
  | 'invalid_match_id'
  | 'invalid_start_time'
  | 'invalid_score'
  | 'unidentified_side'
  | 'conflicting_side';

export type TeamMatchNormalization =
  | { success: true; data: NormalizedTeamMatch }
  | { success: false; reason: Exclude<TeamMatchSkipReason, 'duplicate_match'> };

export interface NormalizedTeamMatchList {
  matches: NormalizedTeamMatch[];
  skipped: number;
  skippedByReason: Partial<Record<TeamMatchSkipReason, number>>;
}

function validId(value: number | null | undefined): value is number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0;
}

function validKills(value: number | null | undefined): value is number {
  return Number.isSafeInteger(value) && (value ?? -1) >= 0;
}

function name(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function sideFromIds(match: TeamMatchData, queriedTeamId: number): TeamSide | undefined | 'conflict' {
  const isRadiant = match.radiant_team_id === queriedTeamId;
  const isDire = match.dire_team_id === queriedTeamId;
  if (isRadiant && isDire) return 'conflict';
  if (isRadiant) return 'radiant';
  if (isDire) return 'dire';
  return undefined;
}

export function normalizeTeamMatch(
  match: TeamMatchData,
  queriedTeamId: number,
  fallbackTeamName?: string,
): TeamMatchNormalization {
  if (!Number.isSafeInteger(match.match_id) || match.match_id <= 0) {
    return { success: false, reason: 'invalid_match_id' };
  }
  const matchDate = new Date(match.start_time * 1000);
  if (!Number.isSafeInteger(match.start_time) || match.start_time < 0 || Number.isNaN(matchDate.valueOf())) {
    return { success: false, reason: 'invalid_start_time' };
  }
  if (!validKills(match.radiant_score) || !validKills(match.dire_score)) {
    return { success: false, reason: 'invalid_score' };
  }

  const idSide = sideFromIds(match, queriedTeamId);
  if (idSide === 'conflict') return { success: false, reason: 'conflicting_side' };
  const relativeSide: TeamSide | undefined = match.radiant === undefined
    ? undefined
    : match.radiant ? 'radiant' : 'dire';
  if (idSide && relativeSide && idSide !== relativeSide) {
    return { success: false, reason: 'conflicting_side' };
  }
  const side = idSide ?? relativeSide;
  if (!side) return { success: false, reason: 'unidentified_side' };

  const queriedIsRadiant = side === 'radiant';
  const sideOpponentId = queriedIsRadiant ? match.dire_team_id : match.radiant_team_id;
  const opponentTeamId = validId(sideOpponentId) ? sideOpponentId : match.opposing_team_id;
  if (opponentTeamId === queriedTeamId) return { success: false, reason: 'conflicting_side' };

  return {
    success: true,
    data: {
      matchId: match.match_id,
      startTime: match.start_time,
      date: matchDate.toISOString(),
      queriedTeamId,
      queriedTeamName: name(queriedIsRadiant ? match.radiant_name : match.dire_name) ?? name(fallbackTeamName),
      opponentTeamId: validId(opponentTeamId) ? opponentTeamId : null,
      opponentTeamName: name(queriedIsRadiant ? match.dire_name : match.radiant_name) ?? name(match.opposing_team_name),
      side,
      teamKills: queriedIsRadiant ? match.radiant_score : match.dire_score,
      opponentKills: queriedIsRadiant ? match.dire_score : match.radiant_score,
      leagueId: validId(match.leagueid) ? match.leagueid : null,
      leagueName: name(match.league_name),
      teamWon: match.radiant_win === undefined || match.radiant_win === null
        ? null
        : queriedIsRadiant ? match.radiant_win : !match.radiant_win,
    },
  };
}

export function normalizeTeamMatches(
  matches: readonly TeamMatchData[],
  queriedTeamId: number,
  fallbackTeamName?: string,
): NormalizedTeamMatchList {
  const normalized: NormalizedTeamMatch[] = [];
  const seen = new Set<number>();
  const skippedByReason: Partial<Record<TeamMatchSkipReason, number>> = {};

  const skip = (reason: TeamMatchSkipReason) => {
    skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
  };

  for (const match of matches) {
    const result = normalizeTeamMatch(match, queriedTeamId, fallbackTeamName);
    if (!result.success) {
      skip(result.reason);
      continue;
    }
    if (seen.has(result.data.matchId)) {
      skip('duplicate_match');
      continue;
    }
    seen.add(result.data.matchId);
    normalized.push(result.data);
  }

  normalized.sort((left, right) => right.startTime - left.startTime || right.matchId - left.matchId);
  const skipped = Object.values(skippedByReason).reduce((total, count) => total + count, 0);
  return { matches: normalized, skipped, skippedByReason };
}
