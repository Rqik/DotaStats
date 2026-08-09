import type { HeroOption } from '../../api/openDotaRepository';

export type DraftTeamSide = 'radiant' | 'dire';
export type DraftHandicapTeam = 'A' | 'B' | 'none';

export interface DraftFormValue {
  teamAName: string;
  teamBName: string;
  teamASide: DraftTeamSide;
  teamBSide: DraftTeamSide;
  teamAHeroes: HeroOption[];
  teamBHeroes: HeroOption[];
  teamAOdds: string;
  teamBOdds: string;
  handicapTeam: DraftHandicapTeam;
  handicapLine: string;
}

export const emptyDraftForm: DraftFormValue = {
  teamAName: '',
  teamBName: '',
  teamASide: 'radiant',
  teamBSide: 'dire',
  teamAHeroes: [],
  teamBHeroes: [],
  teamAOdds: '',
  teamBOdds: '',
  handicapTeam: 'none',
  handicapLine: '',
};
