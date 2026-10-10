import { describe, expect, it } from 'vitest';
import {
  createTournamentPickerState,
  updateTournamentPickerState,
} from './tournamentPickerState';

const league = { leagueId: 17, name: 'The International 2026', tier: 'premium' };
const teamA = { teamId: 1, name: 'Team Yandex', tag: 'YDX', logoUrl: null };
const teamB = { teamId: 2, name: 'Team Liquid', tag: 'TL', logoUrl: null };

describe('tournament picker state', () => {
  it('clears only restored teams that no longer belong to the release', () => {
    let state = createTournamentPickerState();
    state = updateTournamentPickerState(state, { type: 'select-league', league });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'a', team: teamA });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'b', team: teamB });
    expect(updateTournamentPickerState(state, { type: 'reconcile-teams', teams: [teamA, teamB] })).toBe(state);
    expect(updateTournamentPickerState(state, { type: 'reconcile-teams', teams: [teamA] })).toMatchObject({
      selection: { league, teamA, teamB: null }, teamAQuery: teamA.name, teamBQuery: '',
    });
  });
  it('resets both league filters without losing the query or selected teams', () => {
    let state = createTournamentPickerState();
    state = updateTournamentPickerState(state, { type: 'set-year-filter', year: 2026 });
    state = updateTournamentPickerState(state, { type: 'set-tier-filter', tier: 'premium' });
    state = updateTournamentPickerState(state, { type: 'select-league', league });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'a', team: teamA });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'b', team: teamB });

    expect(updateTournamentPickerState(state, { type: 'reset-league-filters' })).toEqual({
      ...state,
      yearFilter: null,
      tierFilter: null,
    });
  });

  it('keeps the year and selected release while team queries change', () => {
    let state = createTournamentPickerState();
    state = updateTournamentPickerState(state, { type: 'set-year-filter', year: 2026 });
    state = updateTournamentPickerState(state, { type: 'select-league', league });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'a', team: teamA });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'b', team: teamB });

    expect(state).toMatchObject({
      yearFilter: 2026,
      leagueQuery: league.name,
      selection: { league, teamA, teamB },
    });
  });

  it('clears a stale release and its teams only after the selected release query changes', () => {
    let state = createTournamentPickerState();
    state = updateTournamentPickerState(state, { type: 'set-year-filter', year: 2026 });
    state = updateTournamentPickerState(state, { type: 'select-league', league });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'a', team: teamA });

    const unchanged = updateTournamentPickerState(state, {
      type: 'change-league-query',
      query: league.name,
    });
    expect(unchanged.selection.league).toEqual(league);

    const changed = updateTournamentPickerState(state, {
      type: 'change-league-query',
      query: 'The International',
    });
    expect(changed.yearFilter).toBe(2026);
    expect(changed.selection).toEqual({ league: null, teamA: null, teamB: null });
  });

  it('prevents the same team from remaining selected on both sides', () => {
    let state = updateTournamentPickerState(createTournamentPickerState(), {
      type: 'select-league',
      league,
    });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'a', team: teamA });
    state = updateTournamentPickerState(state, { type: 'select-team', side: 'b', team: teamA });

    expect(state.selection.teamA).toBeNull();
    expect(state.selection.teamB).toEqual(teamA);
    expect(state.teamAQuery).toBe('');
  });
});
