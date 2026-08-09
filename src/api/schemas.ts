import { z } from 'zod';

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableInteger = z.number().int().nullable().optional();

export const openDotaLeagueSchema = z.object({
  leagueid: z.number().int(),
  name: z.string(),
  tier: nullableString,
  ticket: nullableString,
  banner: nullableString,
}).passthrough();
export type OpenDotaLeague = z.infer<typeof openDotaLeagueSchema>;

export const openDotaTeamSchema = z.object({
  team_id: z.number().int(),
  rating: nullableNumber,
  wins: nullableInteger,
  losses: nullableInteger,
  last_match_time: nullableInteger,
  name: nullableString,
  tag: nullableString,
  logo_url: nullableString,
}).passthrough();
export type OpenDotaTeam = z.infer<typeof openDotaTeamSchema>;

export const openDotaHeroStatsSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  localized_name: z.string(),
  primary_attr: nullableString,
  attack_type: nullableString,
  roles: z.array(z.string()).optional(),
  img: nullableString,
  icon: nullableString,
  hero_id: nullableInteger,
  pro_pick: nullableInteger,
  pro_win: nullableInteger,
  pro_ban: nullableInteger,
}).passthrough();
export type OpenDotaHeroStats = z.infer<typeof openDotaHeroStatsSchema>;

export const openDotaTeamMatchSchema = z.object({
  match_id: z.number().int().positive().safe(),
  radiant: z.boolean().optional(),
  radiant_win: z.boolean().nullable().optional(),
  radiant_score: nullableInteger,
  dire_score: nullableInteger,
  duration: nullableInteger,
  start_time: z.number().int(),
  leagueid: nullableInteger,
  league_name: nullableString,
  opposing_team_id: nullableInteger,
  opposing_team_name: nullableString,
  opposing_team_logo: nullableString,
  radiant_team_id: nullableInteger,
  dire_team_id: nullableInteger,
  radiant_name: nullableString,
  dire_name: nullableString,
}).passthrough();
export type OpenDotaTeamMatch = z.infer<typeof openDotaTeamMatchSchema>;

export const openDotaPlayerSchema = z.object({
  account_id: nullableInteger,
  player_slot: nullableInteger,
  hero_id: nullableInteger,
  personaname: nullableString,
  name: nullableString,
  kills: nullableInteger,
  deaths: nullableInteger,
  assists: nullableInteger,
}).passthrough();
export type OpenDotaPlayer = z.infer<typeof openDotaPlayerSchema>;

export const openDotaPickBanSchema = z.object({
  is_pick: z.boolean(),
  hero_id: z.number().int(),
  team: z.number().int(),
  order: z.number().int(),
}).passthrough();
export type OpenDotaPickBan = z.infer<typeof openDotaPickBanSchema>;

export const openDotaMatchSchema = z.object({
  match_id: z.number().int().positive().safe(),
  version: nullableInteger,
  duration: nullableInteger,
  start_time: nullableInteger,
  leagueid: nullableInteger,
  radiant_score: nullableInteger,
  dire_score: nullableInteger,
  radiant_win: z.boolean().nullable().optional(),
  radiant_team: openDotaTeamSchema.nullable().optional(),
  dire_team: openDotaTeamSchema.nullable().optional(),
  players: z.array(openDotaPlayerSchema).optional(),
  picks_bans: z.array(openDotaPickBanSchema).nullable().optional(),
  radiant_gold_adv: z.array(z.number()).nullable().optional(),
  radiant_xp_adv: z.array(z.number()).nullable().optional(),
}).passthrough();
export type OpenDotaMatch = z.infer<typeof openDotaMatchSchema>;

export const openDotaLeaguesSchema = z.array(openDotaLeagueSchema);
export const openDotaTeamsSchema = z.array(openDotaTeamSchema);
export const openDotaLeagueTeamsSchema = z.array(openDotaTeamSchema);
export const openDotaHeroStatsListSchema = z.array(openDotaHeroStatsSchema);
export const openDotaTeamMatchesSchema = z.array(openDotaTeamMatchSchema);

export const openDotaHeroMatchupSchema = z.object({
  hero_id: z.number().int().positive().safe(),
  games_played: z.number().int().nonnegative().safe(),
  wins: z.number().int().nonnegative().safe(),
}).passthrough().refine((row) => row.wins <= row.games_played, {
  message: 'wins cannot exceed games_played',
  path: ['wins'],
});
export type OpenDotaHeroMatchup = z.infer<typeof openDotaHeroMatchupSchema>;

const openDotaDurationBinSchema = z.union([
  z.number().int().nonnegative().safe(),
  z.string().regex(/^\d+$/).refine((value) => Number.isSafeInteger(Number(value)), {
    message: 'duration_bin must be a safe integer value',
  }),
]);

export const openDotaHeroDurationSchema = z.object({
  duration_bin: openDotaDurationBinSchema,
  games_played: z.number().int().nonnegative().safe(),
  wins: z.number().int().nonnegative().safe(),
}).passthrough().refine((row) => row.wins <= row.games_played, {
  message: 'wins cannot exceed games_played',
  path: ['wins'],
});
export type OpenDotaHeroDuration = z.infer<typeof openDotaHeroDurationSchema>;

export const openDotaHeroMatchupsSchema = z.array(openDotaHeroMatchupSchema);
export const openDotaHeroDurationsSchema = z.array(openDotaHeroDurationSchema);
