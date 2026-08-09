import type {
  CachedResult,
  LeagueOption,
  RefreshOptions,
  TeamOption,
} from '../../api/openDotaRepository';

export interface TeamPickerRepository {
  listLeagues: (options?: RefreshOptions) => Promise<CachedResult<LeagueOption[]>>;
  listLeagueTeams: (leagueId: number, options?: RefreshOptions) => Promise<CachedResult<TeamOption[]>>;
  searchTeams: (query: string, options?: RefreshOptions) => Promise<CachedResult<TeamOption[]>>;
}
