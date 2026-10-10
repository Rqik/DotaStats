import { describe, expect, it } from 'vitest';
import { openDotaLiveMatchesSchema } from '../api/schemas';
import type { HeroOption } from '../api/openDotaRepository';
import { emptyDraftForm } from '../features/analysis/draftForm';
import { applyLiveDraft, findLiveMatch, loadLiveMatch } from './liveMatch';

const rawMatch = {
  match_id: '9037322346', league_id: 19102, deactivate_time: 0, last_update_time: 1_000,
  team_id_radiant: 1, team_id_dire: 2, team_name_radiant: 'Team A', team_name_dire: 'Team B',
  game_time: -30, delay: 120, radiant_score: 0, dire_score: 0,
  players: Array.from({ length: 10 }, (_, index) => ({ hero_id: index + 1, team: index < 5 ? 0 : 1 })),
};

function foundMatch(raw: unknown = rawMatch) {
  const result = findLiveMatch('9037322346', openDotaLiveMatchesSchema.parse([raw]), 1_120_000);
  if (result.status !== 'found') throw new Error('Fixture must match');
  return result.match;
}

const heroes: HeroOption[] = Array.from({ length: 10 }, (_, index) => ({ heroId: index + 1, name: `Hero ${index + 1}`, internalName: `hero_${index + 1}`, roles: [], imageUrl: null, iconUrl: null }));

describe('current match and draft', () => {
  it('uses actual live side assignments, zero score and provider timestamps', () => {
    expect(foundMatch()).toMatchObject({
      matchId: 9037322346, leagueId: 19102, isDraftComplete: true, gameTimeSeconds: -30, delaySeconds: 120,
      updatedAt: 1_000_000, fetchedAt: 1_120_000,
      radiant: { name: 'Team A', teamId: 1, heroIds: [1, 2, 3, 4, 5], score: 0 },
      dire: { name: 'Team B', teamId: 2, heroIds: [6, 7, 8, 9, 10], score: 0 },
    });
  });

  it('does not invent unpicked heroes or treat duplicate picks as a complete draft', () => {
    const partial = foundMatch({ ...rawMatch, players: [{ team: 0, hero_id: 0 }, { team: 1, hero_id: 6 }] });
    expect(partial.radiant.heroIds).toEqual([]);
    expect(partial.isDraftComplete).toBe(false);
    expect(() => applyLiveDraft(partial, heroes, emptyDraftForm)).toThrow('десяти уникальных');
    const duplicate = foundMatch({ ...rawMatch, players: rawMatch.players.map((player) => ({ ...player, hero_id: 1 })) });
    expect(duplicate.isDraftComplete).toBe(false);
  });

  it('reports an unavailable or ended game without falling back to completed-match data', async () => {
    const games = openDotaLiveMatchesSchema.parse([{ ...rawMatch, deactivate_time: 999 }]);
    expect(findLiveMatch('9037322346', games, 1_120_000)).toEqual({ status: 'not-found', searchedMatches: 1, fetchedAt: 1_120_000 });
    await expect(loadLiveMatch('9037322346', { listLiveMatches: async (options) => {
      expect(options?.forceRefresh).toBe(true);
      return { data: [], source: 'network', savedAt: 1_120_000 };
    } })).resolves.toMatchObject({ status: 'not-found', searchedMatches: 0 });
  });

  it('rejects unsafe IDs and malformed external live responses', () => {
    expect(() => findLiveMatch('12x34', [], 0)).toThrow();
    expect(() => findLiveMatch('9007199254740993', [], 0)).toThrow();
    expect(() => openDotaLiveMatchesSchema.parse([{ ...rawMatch, players: 'invalid' }])).toThrow();
  });

  it('imports all ten heroes and actual teams atomically while preserving market inputs', () => {
    const previous = { ...emptyDraftForm, teamAOdds: '1.85', handicapLine: '-5.5' };
    const imported = applyLiveDraft(foundMatch(), heroes, previous);
    expect(imported).toMatchObject({ teamAName: 'Team A', teamBName: 'Team B', teamASide: 'radiant', teamBSide: 'dire', teamAOdds: '1.85', handicapLine: '-5.5' });
    expect(imported.teamAHeroes.map((hero) => hero.heroId)).toEqual([1, 2, 3, 4, 5]);
    expect(imported.teamBHeroes.map((hero) => hero.heroId)).toEqual([6, 7, 8, 9, 10]);
    expect(() => applyLiveDraft(foundMatch(), heroes.slice(0, 9), previous)).toThrow('не найден герой');
    expect(previous.teamAHeroes).toEqual([]);
  });
});
