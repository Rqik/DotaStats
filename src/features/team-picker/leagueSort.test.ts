import { describe, expect, it } from 'vitest';
import { extractLeagueYear, sortAndFilterLeagues } from './leagueSort';

const leagues = [
  { leagueId: 1, name: 'The International 2024', tier: 'premium' },
  { leagueId: 2, name: 'The International 2026', tier: 'professional' },
  { leagueId: 3, name: 'Regional League', tier: null },
  { leagueId: 4, name: 'The International 2025', tier: null },
];

describe('league sorting and year filtering', () => {
  it('extracts only a four-digit release year from the title', () => {
    expect(extractLeagueYear('The International 2026')).toBe(2026);
    expect(extractLeagueYear('Regional League')).toBeNull();
  });

  it('sorts titled releases by descending year and leaves undated releases below', () => {
    expect(sortAndFilterLeagues(leagues, '', null).map((league) => league.leagueId)).toEqual([2, 4, 1, 3]);
    expect(sortAndFilterLeagues(leagues, '', 2025).map((league) => league.leagueId)).toEqual([4]);
  });

  it('filters releases by the OpenDota tournament level', () => {
    expect(sortAndFilterLeagues(leagues, '', null, 'premium').map((league) => league.leagueId)).toEqual([1]);
    expect(sortAndFilterLeagues(leagues, 'international', null, 'professional').map((league) => league.leagueId)).toEqual([2]);
  });

  it('finds undated BLAST releases after clearing the year and tier filters', () => {
    const releases = [
      ...leagues,
      { leagueId: 19102, name: 'BLAST SLAM VIII', tier: 'professional' },
    ];

    expect(sortAndFilterLeagues(releases, 'BLAST', 2026)).toEqual([]);
    expect(sortAndFilterLeagues(releases, 'BLAST', null, 'premium')).toEqual([]);
    expect(sortAndFilterLeagues(releases, 'BLAST', null).map((league) => league.leagueId)).toEqual([19102]);
    expect(extractLeagueYear('BLAST SLAM VIII')).toBeNull();
  });

  it('matches Cyrillic BLAST queries and whitespace-separated words', () => {
    const releases = [
      { leagueId: 19102, name: 'BLAST SLAM VIII', tier: 'professional' },
      { leagueId: 20188, name: 'BLAST Slam VIII China Qualifier', tier: 'professional' },
    ];

    expect(sortAndFilterLeagues(releases, '  БЛАСТ  слэм  ', null)).toHaveLength(2);
    expect(sortAndFilterLeagues(releases, 'бласт слем VIII', null)).toHaveLength(2);
    expect(sortAndFilterLeagues(releases, 'blast china', null).map((league) => league.leagueId)).toEqual([20188]);
    expect(sortAndFilterLeagues(releases, 'несуществующий турнир', null)).toEqual([]);
  });
});
