import type { LeagueOption } from '../../api/openDotaRepository';

const tierLabels: Readonly<Record<string, string>> = {
  amateur: 'Любительский',
  excluded: 'Исключённый',
  premium: 'Премиальный',
  professional: 'Профессиональный',
};

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
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return leagues
    .filter((league) => !normalizedQuery || league.name.toLocaleLowerCase().includes(normalizedQuery))
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
