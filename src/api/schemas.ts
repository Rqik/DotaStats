import { z } from 'zod';

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

export const openDotaTeamSchema = z.object({
  team_id: z.number(),
  name: nullableString,
  tag: nullableString,
  logo_url: nullableString,
}).passthrough();
export type OpenDotaTeam = z.infer<typeof openDotaTeamSchema>;

export const openDotaHeroStatsSchema = z.object({
  id: z.number(),
  name: z.string(),
  localized_name: z.string(),
  primary_attr: z.string().optional(),
  attack_type: z.string().optional(),
  roles: z.array(z.string()).optional(),
  img: nullableString,
  icon: nullableString,
}).passthrough();
export type OpenDotaHeroStats = z.infer<typeof openDotaHeroStatsSchema>;

export const openDotaTeamMatchSchema = z.object({
  match_id: z.number(),
  start_time: z.number(),
  duration: z.number().optional(),
  radiant_team_id: nullableNumber,
  dire_team_id: nullableNumber,
  radiant_name: nullableString,
  dire_name: nullableString,
  radiant_score: z.number().optional(),
  dire_score: z.number().optional(),
  radiant_win: z.boolean().nullable().optional(),
  league_name: nullableString,
}).passthrough();
export type OpenDotaTeamMatch = z.infer<typeof openDotaTeamMatchSchema>;

export const openDotaPlayerSchema = z.object({
  account_id: nullableNumber,
  player_slot: z.number().nullable().optional(),
  hero_id: z.number().nullable().optional(),
  personaname: nullableString,
  name: nullableString,
  kills: z.number().optional(),
  deaths: z.number().optional(),
  assists: z.number().optional(),
}).passthrough();
export type OpenDotaPlayer = z.infer<typeof openDotaPlayerSchema>;

export const openDotaPickBanSchema = z.object({
  is_pick: z.boolean(),
  hero_id: z.number(),
  team: z.number(),
  order: z.number(),
}).passthrough();
export type OpenDotaPickBan = z.infer<typeof openDotaPickBanSchema>;

export const openDotaMatchSchema = z.object({
  match_id: z.number(),
  duration: z.number(),
  start_time: z.number().optional(),
  radiant_score: z.number(),
  dire_score: z.number(),
  radiant_win: z.boolean().nullable(),
  radiant_team: openDotaTeamSchema.nullable().optional(),
  dire_team: openDotaTeamSchema.nullable().optional(),
  players: z.array(openDotaPlayerSchema).optional(),
  picks_bans: z.array(openDotaPickBanSchema).nullable().optional(),
  radiant_gold_adv: z.array(z.number()).nullable().optional(),
  radiant_xp_adv: z.array(z.number()).nullable().optional(),
}).passthrough();
export type OpenDotaMatch = z.infer<typeof openDotaMatchSchema>;

export const openDotaTeamsSchema = z.array(openDotaTeamSchema);
export const openDotaHeroStatsListSchema = z.array(openDotaHeroStatsSchema);
export const openDotaTeamMatchesSchema = z.array(openDotaTeamMatchSchema);
