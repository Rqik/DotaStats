import { describe, expect, it } from 'vitest';
import {
  openDotaHeroStatsListSchema,
  openDotaHeroDurationsSchema,
  openDotaHeroMatchupsSchema,
  openDotaLeagueTeamsSchema,
  openDotaLeaguesSchema,
  openDotaMatchSchema,
  openDotaTeamMatchesSchema,
} from './schemas';

describe('OpenDota response schemas', () => {
  it('accepts the v31.1.0 league fields', () => {
    expect(openDotaLeaguesSchema.parse([{
      leagueid: 16935,
      ticket: null,
      banner: null,
      tier: 'premium',
      name: 'The International 2024',
    }])).toHaveLength(1);
  });

  it('requires league teams to be the array returned by the live endpoint', () => {
    const team = {
      team_id: 2163,
      rating: 1510.4,
      wins: 10,
      losses: 3,
      last_match_time: 1_720_000_000,
      name: 'Team Liquid',
      tag: 'Liquid',
      logo_url: 'https://cdn.example/liquid.png',
    };
    expect(openDotaLeagueTeamsSchema.parse([team])).toHaveLength(1);
    expect(openDotaLeagueTeamsSchema.safeParse(team).success).toBe(false);
  });

  it('accepts the relative-side shape of a team match list', () => {
    expect(openDotaTeamMatchesSchema.parse([{
      match_id: 8_000_000_001,
      radiant: true,
      radiant_win: null,
      radiant_score: 31,
      dire_score: 25,
      duration: 2400,
      start_time: 1_720_000_000,
      leagueid: 16935,
      league_name: 'The International 2024',
      opposing_team_id: 39,
      opposing_team_name: 'Shopify Rebellion',
      opposing_team_logo: null,
    }])).toHaveLength(1);
  });

  it('accepts partially parsed matches without inventing unavailable graphs', () => {
    const match = openDotaMatchSchema.parse({
      match_id: 8_000_000_001,
      version: null,
      duration: null,
      radiant_score: null,
      dire_score: null,
      radiant_win: null,
      picks_bans: null,
      radiant_gold_adv: null,
      radiant_xp_adv: null,
    });
    expect(match.match_id).toBe(8_000_000_001);
    expect(match.radiant_gold_adv).toBeNull();
  });

  it('rejects non-positive match identities before they reach the cache', () => {
    expect(openDotaMatchSchema.safeParse({ match_id: 0 }).success).toBe(false);
    expect(openDotaTeamMatchesSchema.safeParse([{
      match_id: -1,
      start_time: 1_720_000_000,
    }]).success).toBe(false);
  });

  it('rejects a hero catalog entry without stable identity fields', () => {
    expect(openDotaHeroStatsListSchema.safeParse([{ id: 1, name: 'npc_dota_hero_antimage' }]).success).toBe(false);
  });

  it('accepts the official hero matchup and documented duration response rows', () => {
    expect(openDotaHeroMatchupsSchema.parse([{
      hero_id: 2,
      games_played: 120,
      wins: 66,
    }])).toHaveLength(1);
    expect(openDotaHeroDurationsSchema.parse([{
      duration_bin: '1800',
      games_played: 80,
      wins: 44,
    }])).toEqual([{ duration_bin: '1800', games_played: 80, wins: 44 }]);
  });

  it('normalizes the numeric duration_bin returned by the live public endpoint', () => {
    expect(openDotaHeroDurationsSchema.parse([{
      duration_bin: 5700,
      games_played: 2,
      wins: 0,
    }])).toEqual([{ duration_bin: 5700, games_played: 2, wins: 0 }]);
  });

  it('rejects impossible hero statistics before caching them', () => {
    expect(openDotaHeroMatchupsSchema.safeParse([{
      hero_id: 2,
      games_played: 10,
      wins: 11,
    }]).success).toBe(false);
    expect(openDotaHeroDurationsSchema.safeParse([{
      duration_bin: '30 minutes',
      games_played: 10,
      wins: 5,
    }]).success).toBe(false);
  });
});
