import type { LeagueOption, TeamOption } from '../../api/openDotaRepository';

export interface TournamentSelection {
  league: LeagueOption | null;
  teamA: TeamOption | null;
  teamB: TeamOption | null;
}

export interface TournamentPickerState {
  selection: TournamentSelection;
  leagueQuery: string;
  teamAQuery: string;
  teamBQuery: string;
  yearFilter: number | null;
  tierFilter: string | null;
}

export type TournamentPickerAction =
  | { type: 'change-league-query'; query: string }
  | { type: 'select-league'; league: LeagueOption }
  | { type: 'change-team-query'; side: 'a' | 'b'; query: string }
  | { type: 'select-team'; side: 'a' | 'b'; team: TeamOption }
  | { type: 'reconcile-teams'; teams: TeamOption[] }
  | { type: 'set-year-filter'; year: number | null }
  | { type: 'reset-league-filters' }
  | { type: 'set-tier-filter'; tier: string | null };

const emptySelection: TournamentSelection = {
  league: null,
  teamA: null,
  teamB: null,
};

export function createTournamentPickerState(): TournamentPickerState {
  return {
    selection: emptySelection,
    leagueQuery: '',
    teamAQuery: '',
    teamBQuery: '',
    yearFilter: null,
    tierFilter: null,
  };
}

export function updateTournamentPickerState(
  state: TournamentPickerState,
  action: TournamentPickerAction,
): TournamentPickerState {
  switch (action.type) {
    case 'reconcile-teams': {
      const { teamA, teamB } = state.selection;
      const isTeamAValid = !teamA || action.teams.some((team) => team.teamId === teamA.teamId);
      const isTeamBValid = !teamB || action.teams.some((team) => team.teamId === teamB.teamId);
      if (isTeamAValid && isTeamBValid) return state;
      return {
        ...state,
        selection: { ...state.selection, teamA: isTeamAValid ? teamA : null, teamB: isTeamBValid ? teamB : null },
        teamAQuery: isTeamAValid ? state.teamAQuery : '',
        teamBQuery: isTeamBValid ? state.teamBQuery : '',
      };
    }
    case 'reset-league-filters':
      return { ...state, yearFilter: null, tierFilter: null };
    case 'set-year-filter':
      return { ...state, yearFilter: action.year };
    case 'set-tier-filter':
      return { ...state, tierFilter: action.tier };
    case 'change-league-query': {
      const clearsSelection = Boolean(
        state.selection.league && action.query !== state.selection.league.name,
      );
      return {
        ...state,
        leagueQuery: action.query,
        ...(clearsSelection
          ? {
            selection: emptySelection,
            teamAQuery: '',
            teamBQuery: '',
          }
          : {}),
      };
    }
    case 'select-league':
      return {
        ...state,
        selection: { league: action.league, teamA: null, teamB: null },
        leagueQuery: action.league.name,
        teamAQuery: '',
        teamBQuery: '',
      };
    case 'change-team-query': {
      const key = action.side === 'a' ? 'teamA' : 'teamB';
      const queryKey = action.side === 'a' ? 'teamAQuery' : 'teamBQuery';
      const selectedTeam = state.selection[key];
      return {
        ...state,
        [queryKey]: action.query,
        selection: selectedTeam && action.query !== selectedTeam.name
          ? { ...state.selection, [key]: null }
          : state.selection,
      };
    }
    case 'select-team': {
      if (action.side === 'a') {
        const duplicateTeam = state.selection.teamB?.teamId === action.team.teamId;
        return {
          ...state,
          selection: {
            ...state.selection,
            teamA: action.team,
            teamB: duplicateTeam ? null : state.selection.teamB,
          },
          teamAQuery: action.team.name,
          teamBQuery: duplicateTeam ? '' : state.teamBQuery,
        };
      }
      const duplicateTeam = state.selection.teamA?.teamId === action.team.teamId;
      return {
        ...state,
        selection: {
          ...state.selection,
          teamB: action.team,
          teamA: duplicateTeam ? null : state.selection.teamA,
        },
        teamBQuery: action.team.name,
        teamAQuery: duplicateTeam ? '' : state.teamAQuery,
      };
    }
    default:
      return state;
  }
}
