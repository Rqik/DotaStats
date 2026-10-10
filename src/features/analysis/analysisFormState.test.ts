import { describe, expect, it } from 'vitest';
import { ANALYSIS_FORM_STORAGE_KEY, createAnalysisFormState, readAnalysisForm, saveAnalysisForm } from './analysisFormState';
import { createAnalysisFormStore } from './analysisFormStore';
import { updateTournamentPickerState } from '../team-picker/tournamentPickerState';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('analysis form persistence', () => {
  it('restores selected releases, teams, filters, parameters and mode in a new session', () => {
    const storage = memoryStorage();
    const store = createAnalysisFormStore(storage);
    const { setField } = store.getState();
    let picker = updateTournamentPickerState(createAnalysisFormState().tournamentPicker, {
      type: 'select-league', league: { leagueId: 19102, name: 'BLAST SLAM VIII', tier: 'professional' },
    });
    picker = updateTournamentPickerState(picker, { type: 'set-tier-filter', tier: 'professional' });
    picker = updateTournamentPickerState(picker, { type: 'select-team', side: 'a', team: { teamId: 1, name: 'Team A', tag: null, logoUrl: null } });
    picker = updateTournamentPickerState(picker, { type: 'select-team', side: 'b', team: { teamId: 2, name: 'Team B', tag: null, logoUrl: null } });
    setField('tournamentPicker', picker);
    setField('selectedTeamId', 2);
    setField('odds', '1,85');
    setField('handicap', '7.5');
    setField('sign', 'minus');
    setField('sample', 50);
    setField('matchId', '9037322346');
    setField('mode', 'match');
    const restored = createAnalysisFormStore(storage);
    expect(restored.getState().form).toEqual(store.getState().form);
    expect(restored.getState().form.tournamentPicker.selection.teamB?.teamId).toBe(2);
    expect(storage.values.size).toBe(1);
  });

  it('falls back safely for malformed JSON, unknown versions and stale dependent IDs', () => {
    const storage = memoryStorage();
    for (const raw of ['{broken', JSON.stringify({ version: 99, form: createAnalysisFormState() }), JSON.stringify({ version: 1, form: { ...createAnalysisFormState(), selectedTeamId: 999 } })]) {
      storage.setItem(ANALYSIS_FORM_STORAGE_KEY, raw);
      expect(readAnalysisForm(storage)).toEqual(createAnalysisFormState());
    }
  });

  it('rejects oversized or duplicated draft lineups instead of trusting browser storage', () => {
    const storage = memoryStorage();
    const hero = { heroId: 1, name: 'Anti-Mage', internalName: 'npc_dota_hero_antimage', roles: [], imageUrl: null, iconUrl: null };
    const form = createAnalysisFormState();
    form.draft = { ...form.draft, teamAHeroes: [hero], teamBHeroes: [hero] };
    saveAnalysisForm(form, storage);
    expect(readAnalysisForm(storage).draft.teamAHeroes).toEqual([]);
  });

  it('keeps edits in memory and reports failed browser storage', () => {
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    const store = createAnalysisFormStore(storage);
    store.getState().setField('odds', '2.10');
    expect(store.getState().form.odds).toBe('2.10');
    expect(store.getState().isFormSaved).toBe(false);
  });

  it('resets in-memory state after confirmed deletion without recreating the removed key', () => {
    const storage = memoryStorage();
    const store = createAnalysisFormStore(storage);
    store.getState().setField('matchId', '9037322346');
    storage.values.delete(ANALYSIS_FORM_STORAGE_KEY);
    store.getState().resetForm();
    expect(store.getState().form).toEqual(createAnalysisFormState());
    expect(storage.getItem(ANALYSIS_FORM_STORAGE_KEY)).toBeNull();
  });
});
