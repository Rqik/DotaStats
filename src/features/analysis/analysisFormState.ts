import { z } from 'zod';
import { emptyDraftForm } from './draftForm';
import { createTournamentPickerState } from '../team-picker/tournamentPickerState';

export const ANALYSIS_FORM_STORAGE_KEY = 'dota-pulse-analysis-form:v1';

const text = z.string().max(300);
const positiveId = z.number().int().positive().safe();
const leagueSchema = z.object({ leagueId: positiveId, name: text, tier: text.nullable() });
const teamSchema = z.object({ teamId: positiveId, name: text, tag: text.nullable(), logoUrl: z.string().max(2000).nullable() });
const pickerSchema = z.object({
  selection: z.object({ league: leagueSchema.nullable(), teamA: teamSchema.nullable(), teamB: teamSchema.nullable() }),
  leagueQuery: text,
  teamAQuery: text,
  teamBQuery: text,
  yearFilter: z.number().int().min(1900).max(2099).nullable(),
  tierFilter: text.nullable(),
}).refine(({ selection }) => {
  if (!selection.league) return !selection.teamA && !selection.teamB;
  return !selection.teamA || !selection.teamB || selection.teamA.teamId !== selection.teamB.teamId;
});
const heroSchema = z.object({
  heroId: positiveId,
  name: text,
  internalName: text,
  roles: z.array(text).max(20),
  imageUrl: z.string().max(2000).nullable(),
  iconUrl: z.string().max(2000).nullable(),
});
const draftSchema = z.object({
  teamAName: text,
  teamBName: text,
  teamASide: z.enum(['radiant', 'dire']),
  teamBSide: z.enum(['radiant', 'dire']),
  teamAHeroes: z.array(heroSchema).max(5),
  teamBHeroes: z.array(heroSchema).max(5),
  teamAOdds: text,
  teamBOdds: text,
  handicapTeam: z.enum(['A', 'B', 'none']),
  handicapLine: text,
}).refine((draft) => {
  const ids = [...draft.teamAHeroes, ...draft.teamBHeroes].map((hero) => hero.heroId);
  return draft.teamASide !== draft.teamBSide && new Set(ids).size === ids.length;
});

export const analysisFormSchema = z.object({
  mode: z.enum(['handicap', 'draft', 'match']),
  tournamentPicker: pickerSchema,
  selectedTeamId: positiveId.nullable(),
  sign: z.enum(['plus', 'minus']),
  handicap: text,
  odds: text,
  sample: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(50), z.literal(100)]),
  draft: draftSchema,
  draftTournamentPicker: pickerSchema,
  matchId: z.string().max(20).regex(/^\d*$/),
  matchSource: z.enum(['live', 'completed']),
  draftOrigin: z.object({
    matchId: positiveId,
    fetchedAt: z.number().int().nonnegative().safe(),
    teamAId: positiveId.nullable(),
    teamBId: positiveId.nullable(),
  }).nullable().default(null),
}).refine((form) => form.selectedTeamId === null
  || [form.tournamentPicker.selection.teamA?.teamId, form.tournamentPicker.selection.teamB?.teamId].includes(form.selectedTeamId));

export type AnalysisFormState = z.infer<typeof analysisFormSchema>;
type FormStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createAnalysisFormState(): AnalysisFormState {
  return {
    mode: 'handicap',
    tournamentPicker: createTournamentPickerState(),
    selectedTeamId: null,
    sign: 'plus',
    handicap: '20.5',
    odds: '1.65',
    sample: 20,
    draft: { ...emptyDraftForm, teamAHeroes: [], teamBHeroes: [] },
    draftTournamentPicker: createTournamentPickerState(),
    matchId: '',
    matchSource: 'live',
    draftOrigin: null,
  };
}

export function readAnalysisForm(storage?: FormStorage): AnalysisFormState {
  try {
    const source = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    const raw = source?.getItem(ANALYSIS_FORM_STORAGE_KEY);
    if (!raw) return createAnalysisFormState();
    const envelope: unknown = JSON.parse(raw);
    const parsed = z.object({ version: z.literal(1), form: analysisFormSchema }).safeParse(envelope);
    return parsed.success ? parsed.data.form : createAnalysisFormState();
  } catch {
    return createAnalysisFormState();
  }
}

export function saveAnalysisForm(form: AnalysisFormState, storage?: FormStorage): boolean {
  try {
    const destination = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    if (!destination) return false;
    destination.setItem(ANALYSIS_FORM_STORAGE_KEY, JSON.stringify({ version: 1, form }));
    return true;
  } catch {
    return false;
  }
}
