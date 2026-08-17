import { describe, expect, it } from 'vitest';
import { normalizeTeamMatch, normalizeTeamMatches, type TeamMatchData } from './teamMatch';

const baseMatch: TeamMatchData = {
  match_id: 101,
  start_time: 1_720_000_000,
  radiant: true,
  radiant_score: 31,
  dire_score: 25,
  opposing_team_id: 20,
  opposing_team_name: 'Dire Team',
};

describe('team match normalization', () => {
  it('orients kills from the queried team relative radiant flag', () => {
    expect(normalizeTeamMatch(baseMatch, 10, 'Radiant Team')).toEqual({
      success: true,
      data: expect.objectContaining({
        queriedTeamId: 10,
        queriedTeamName: 'Radiant Team',
        opponentTeamId: 20,
        opponentTeamName: 'Dire Team',
        side: 'radiant',
        teamKills: 31,
        opponentKills: 25,
      }),
    });
  });

  it('uses explicit team IDs when the relative radiant flag is absent', () => {
    const result = normalizeTeamMatch({
      ...baseMatch,
      radiant: undefined,
      radiant_team_id: 20,
      dire_team_id: 10,
      radiant_name: 'Radiant Team',
      dire_name: 'Dire Team',
    }, 10);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        side: 'dire',
        queriedTeamName: 'Dire Team',
        opponentTeamName: 'Radiant Team',
        teamKills: 25,
        opponentKills: 31,
      }),
    });
  });

  it('derives the queried team winner only from radiant_win', () => {
    const radiantWin = normalizeTeamMatch({ ...baseMatch, radiant_win: true }, 10);
    const direLoss = normalizeTeamMatch({ ...baseMatch, radiant_win: true }, 20);
    const unknown = normalizeTeamMatch({ ...baseMatch, radiant_win: null }, 10);
    expect(radiantWin.success && radiantWin.data.teamWon).toBe(true);
    expect(direLoss.success && direLoss.data.teamWon).toBe(false);
    expect(unknown.success && unknown.data.teamWon).toBeNull();
  });

  it('skips conflicting identity, missing scores and unidentified sides', () => {
    expect(normalizeTeamMatch({ ...baseMatch, radiant_team_id: 20, dire_team_id: 10 }, 10)).toEqual({
      success: false,
      reason: 'conflicting_side',
    });
    expect(normalizeTeamMatch({ ...baseMatch, radiant_score: null }, 10)).toEqual({
      success: false,
      reason: 'invalid_score',
    });
    expect(normalizeTeamMatch({ ...baseMatch, radiant: undefined }, 10)).toEqual({
      success: false,
      reason: 'unidentified_side',
    });
  });

  it('skips timestamps outside the JavaScript date range', () => {
    expect(normalizeTeamMatch({ ...baseMatch, start_time: Number.MAX_SAFE_INTEGER }, 10)).toEqual({
      success: false,
      reason: 'invalid_start_time',
    });
  });

  it('deduplicates match IDs and sorts valid rows newest first', () => {
    const result = normalizeTeamMatches([
      baseMatch,
      { ...baseMatch, match_id: 102, start_time: baseMatch.start_time + 100 },
      { ...baseMatch, radiant_score: null },
      baseMatch,
    ], 10);

    expect(result.matches.map((match) => match.matchId)).toEqual([102, 101]);
    expect(result.skipped).toBe(2);
    expect(result.skippedByReason).toEqual({ invalid_score: 1, duplicate_match: 1 });
  });
});
