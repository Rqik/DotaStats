import type { LeagueOption } from '../../api/openDotaRepository';

const tierLabels: Readonly<Record<string, string>> = {
  amateur: 'Любительский',
  excluded: 'Исключённый',
  premium: 'Премиальный',
  professional: 'Профессиональный',
};

const searchAliases = new Map([
  ['бласт', 'blast'],
  ['слэм', 'slam'],
  ['слем', 'slam'],
]);

export function extractLeagueYear(name: string): number | null {
  const match = name.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function formatLeagueTier(tier: string): string {
  return tierLabels[tier.toLocaleLowerCase()] ?? tier;
}

export function sortAndFilterLeagues(
  leagues: readonly LeagueOption[],
  query: string,
  year: number | null,
  tier: string | null = null,
): LeagueOption[] {
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    .map((term) => searchAliases.get(term) ?? term);
  return leagues
    .filter((league) => searchTerms.every((term) => league.name.toLocaleLowerCase().includes(term)))
    .filter((league) => year === null || extractLeagueYear(league.name) === year)
    .filter((league) => tier === null || league.tier === tier)
    .sort((left, right) => {
      const leftYear = extractLeagueYear(left.name);
      const rightYear = extractLeagueYear(right.name);
      if (leftYear !== rightYear) {
        if (leftYear === null) return 1;
        if (rightYear === null) return -1;
        return rightYear - leftYear;
      }
      return left.name.localeCompare(right.name, 'ru') || left.leagueId - right.leagueId;
    });
}
