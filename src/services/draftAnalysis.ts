import { z } from 'zod';
import { ApiError } from '../api/client';
import {
  openDotaRepository,
  type CachedResult,
  type HeroOption,
  type RefreshOptions,
} from '../api/openDotaRepository';
import type {
  OpenDotaHeroDuration,
  OpenDotaHeroMatchup,
  OpenDotaTeamMatch,
} from '../api/schemas';
import {
  aggregateHeroDurations,
  calculateDraftConfidence,
  calculateDraftModel,
  calculateDurationComponents,
  calculateMatchupComponent,
  summarizeTeamForm,
  type DraftConfidence,
  type DraftDurationComponent,
  type DraftFormulaWeights,
  type DraftMatchupPairResult,
  type DraftPeakPoint,
  type DraftSide,
  type DraftTeamFormSummary,
  type DraftTeamKey,
  type DraftTimePoint,
  type HeroDurationStats,
} from '../domain/draftAnalysis';
import { normalizeTeamMatches } from '../domain/teamMatch';

const positiveIdSchema = z.number().int().positive().safe();
const teamSchema = z.object({
  name: z.string().trim().min(1),
  side: z.enum(['radiant', 'dire']),
  heroIds: z.array(positiveIdSchema).length(5).refine((ids) => new Set(ids).size === ids.length, {
    message: 'A team cannot contain duplicate heroes',
  }),
  teamId: positiveIdSchema.optional(),
});
const oddsSchema = z.object({
  teamA: z.number().finite().gt(1).optional(),
  teamB: z.number().finite().gt(1).optional(),
}).refine((odds) => odds.teamA !== undefined || odds.teamB !== undefined, {
  message: 'At least one odds value is required',
});
const draftInputSchema = z.object({
  teamA: teamSchema,
  teamB: teamSchema,
  odds: oddsSchema.optional(),
  handicap: z.object({
    team: z.enum(['A', 'B']),
    signedLine: z.number().finite(),
  }).optional(),
  forceRefresh: z.boolean().optional(),
}).superRefine((input, context) => {
  if (input.teamA.side === input.teamB.side) {
    context.addIssue({ code: 'custom', message: 'Draft sides must be different', path: ['teamB', 'side'] });
  }
  const heroIds = [...input.teamA.heroIds, ...input.teamB.heroIds];
  if (new Set(heroIds).size !== heroIds.length) {
    context.addIssue({ code: 'custom', message: 'All ten heroes must be unique', path: ['teamB', 'heroIds'] });
  }
  const hasTeamAId = input.teamA.teamId !== undefined;
  const hasTeamBId = input.teamB.teamId !== undefined;
  if (hasTeamAId !== hasTeamBId) {
    context.addIssue({ code: 'custom', message: 'Both real team IDs are required for team form', path: ['teamB', 'teamId'] });
  }
  if (hasTeamAId && input.teamA.teamId === input.teamB.teamId) {
    context.addIssue({ code: 'custom', message: 'Real team IDs must be different', path: ['teamB', 'teamId'] });
  }
});

export interface DraftTeamInput {
  name: string;
  side: DraftSide;
  heroIds: number[];
  teamId?: number;
}

export interface DraftAnalysisInput {
  teamA: DraftTeamInput;
  teamB: DraftTeamInput;
  odds?: { teamA?: number; teamB?: number };
  handicap?: { team: DraftTeamKey; signedLine: number };
  forceRefresh?: boolean;
}

export interface DraftHero {
  heroId: number;
  name: string;
}

export interface DraftResolvedTeam {
  name: string;
  side: DraftSide;
  teamId: number | null;
  heroes: DraftHero[];
}

export interface DraftHeroDurationResult extends HeroDurationStats {
  team: DraftTeamKey;
  hero: DraftHero;
  source: CachedResult<unknown>['source'];
  savedAt: number;
}

export interface DraftMatchupPair extends DraftMatchupPairResult {
  heroA: DraftHero;
  heroB: DraftHero;
}

export interface DraftMatchupAnalysis {
  requestedPairs: number;
  availablePairs: number;
  games: number;
  advantage: number | null;
  pairs: DraftMatchupPair[];
}

export interface DraftTeamFormResult extends DraftTeamFormSummary {
  team: DraftTeamKey;
  teamId: number;
  name: string;
  source: CachedResult<unknown>['source'];
  savedAt: number;
  oldest: string | null;
  newest: string | null;
  skippedMatches: number;
}

export interface DraftTeamFormComponent {
  requested: boolean;
  included: boolean;
  advantage: number | null;
  teamA: DraftTeamFormResult | null;
  teamB: DraftTeamFormResult | null;
}

export interface DraftAnalysisSource {
  kind: 'hero-catalog' | 'hero-duration' | 'hero-matchup' | 'team-form';
  key: string;
  source: CachedResult<unknown>['source'];
  savedAt: number;
  heroId?: number;
  team?: DraftTeamKey;
}

export type DraftAnalysisWarningCode =
  | 'hero_catalog_incomplete'
  | 'duration_data_missing'
  | 'duration_coverage_incomplete'
  | 'matchup_data_missing'
  | 'matchup_coverage_incomplete'
  | 'team_form_incomplete'
  | 'team_form_not_used'
  | 'probability_incomplete'
  | 'stale_data';

export interface DraftAnalysisWarning {
  code: DraftAnalysisWarningCode;
  message: string;
  count?: number;
  heroId?: number;
  team?: DraftTeamKey;
}

export interface DraftTextSummary {
  range: '15-25' | '30-40' | 'after-45';
  startMinute: number;
  endMinute: number | null;
  probabilityA: number | null;
  advantage: number | null;
  team: DraftTeamKey | 'even' | 'unknown';
  strength: 'unknown' | 'even' | 'small' | 'noticeable';
  text: string;
}

export interface DraftPeakSummary extends DraftPeakPoint {
  teamName: string | null;
  rangeLabel: string;
  text: string;
}

export interface DraftAnalysisResult {
  input: Omit<DraftAnalysisInput, 'forceRefresh'>;
  teamA: DraftResolvedTeam;
  teamB: DraftResolvedTeam;
  heroDurations: DraftHeroDurationResult[];
  durationBins: DraftDurationComponent[];
  matchups: DraftMatchupAnalysis;
  teamForm: DraftTeamFormComponent;
  weights: DraftFormulaWeights;
  binProbabilities: ReturnType<typeof calculateDraftModel>['bins'];
  overallProbabilityA: number | null;
  favorite: DraftTeamKey | 'even' | 'unknown';
  confidence: DraftConfidence;
  timeSeries: DraftTimePoint[];
  peak: DraftPeakSummary | null;
  summaries: DraftTextSummary[];
  sources: DraftAnalysisSource[];
  warnings: DraftAnalysisWarning[];
  savedAt: number;
}

export interface DraftAnalysisRepository {
  listHeroes: (options?: RefreshOptions) => Promise<CachedResult<HeroOption[]>>;
  getHeroDurations: (
    heroId: number,
    options?: RefreshOptions,
  ) => Promise<CachedResult<OpenDotaHeroDuration[]>>;
  getHeroMatchups: (
    heroId: number,
    options?: RefreshOptions,
  ) => Promise<CachedResult<OpenDotaHeroMatchup[]>>;
  getTeamMatches: (
    teamId: number,
    options?: RefreshOptions,
  ) => Promise<CachedResult<OpenDotaTeamMatch[]>>;
}

function resolvedHero(heroId: number, catalog: ReadonlyMap<number, HeroOption>): DraftHero {
  return { heroId, name: catalog.get(heroId)?.name ?? `Hero ${heroId}` };
}

function isoDate(startTime: number | undefined): string | null {
  if (!Number.isSafeInteger(startTime) || (startTime ?? -1) < 0) return null;
  const date = new Date((startTime ?? 0) * 1000);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function teamFormResult(
  team: DraftTeamKey,
  teamId: number,
  name: string,
  response: CachedResult<OpenDotaTeamMatch[]>,
): DraftTeamFormResult {
  const normalized = normalizeTeamMatches(response.data, teamId, name);
  const rawById = new Map(response.data.map((match) => [match.match_id, match]));
  const matches = normalized.matches.slice(0, 20).map((match) => {
    const raw = rawById.get(match.matchId);
    const won = raw?.radiant_win === null || raw?.radiant_win === undefined
      ? null
      : match.side === 'radiant' ? raw.radiant_win : !raw.radiant_win;
    const durationSeconds = Number.isSafeInteger(raw?.duration) && (raw?.duration ?? -1) >= 0
      ? raw?.duration ?? null
      : null;
    return { won, killMargin: match.teamKills - match.opponentKills, durationSeconds };
  });
  const dates = normalized.matches
    .slice(0, 20)
    .map((match) => isoDate(match.startTime))
    .filter((date): date is string => date !== null)
    .sort();
  return {
    team,
    teamId,
    name,
    ...summarizeTeamForm(matches),
    source: response.source,
    savedAt: response.savedAt,
    oldest: dates[0] ?? null,
    newest: dates.at(-1) ?? null,
    skippedMatches: normalized.skipped,
  };
}

function textSummary(
  range: DraftTextSummary['range'],
  minutes: readonly number[],
  points: readonly DraftTimePoint[],
  teamAName: string,
  teamBName: string,
): DraftTextSummary {
  const values = points
    .filter((point) => minutes.includes(point.minute))
    .map((point) => point.probabilityA)
    .filter((value): value is number => value !== null);
  const probabilityA = values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
  if (probabilityA === null) {
    return {
      range,
      startMinute: minutes[0] ?? 0,
      endMinute: range === 'after-45' ? null : minutes.at(-1) ?? null,
      probabilityA: null,
      advantage: null,
      team: 'unknown',
      strength: 'unknown',
      text: 'Недостаточно данных для оценки этого временного диапазона.',
    };
  }
  const advantage = probabilityA - 0.5;
  const absolute = Math.abs(advantage);
  const team: DraftTeamKey | 'even' = absolute < 0.02 ? 'even' : advantage > 0 ? 'A' : 'B';
  const strength: DraftTextSummary['strength'] = team === 'even'
    ? 'even'
    : absolute < 0.06 ? 'small' : 'noticeable';
  const label = team === 'even'
    ? 'примерно равные составы'
    : `${strength === 'small' ? 'небольшое' : 'заметное'} преимущество ${team === 'A' ? teamAName : teamBName}`;
  return {
    range,
    startMinute: minutes[0] ?? 0,
    endMinute: range === 'after-45' ? null : minutes.at(-1) ?? null,
    probabilityA,
    advantage,
    team,
    strength,
    text: label,
  };
}

function peakSummary(
  peak: DraftPeakPoint | null,
  teamAName: string,
  teamBName: string,
): DraftPeakSummary | null {
  if (!peak) return null;
  const teamName = peak.team === 'A' ? teamAName : peak.team === 'B' ? teamBName : null;
  const rangeLabel = peak.minute >= 50
    ? `после ${peak.minute} минут`
    : `${Math.max(15, peak.minute - 3)}–${peak.minute + 3} минут`;
  return {
    ...peak,
    teamName,
    rangeLabel,
    text: teamName
      ? `Главный пик ${teamName}: ${rangeLabel}, около ${(Math.abs(peak.advantage) * 100).toFixed(1)} п.п.`
      : `Составы максимально близки около ${peak.minute} минуты.`,
  };
}

function warning(
  warnings: DraftAnalysisWarning[],
  code: DraftAnalysisWarningCode,
  message: string,
  details: Pick<DraftAnalysisWarning, 'count' | 'heroId' | 'team'> = {},
): void {
  warnings.push({ code, message, ...details });
}

export async function analyzeDraft(
  input: DraftAnalysisInput,
  repository: DraftAnalysisRepository = openDotaRepository,
): Promise<DraftAnalysisResult> {
  const parsed = draftInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError('invalid_request', 'Invalid draft analysis input', { cause: parsed.error });
  }
  const value = parsed.data;
  const refresh = value.forceRefresh ? { forceRefresh: true } : undefined;
  const allHeroIds = [...value.teamA.heroIds, ...value.teamB.heroIds];
  const catalogPromise = repository.listHeroes(refresh);
  const durationPromise = Promise.all(allHeroIds.map((heroId) => repository.getHeroDurations(heroId, refresh)));
  const matchupPromise = Promise.all(value.teamA.heroIds.map((heroId) => repository.getHeroMatchups(heroId, refresh)));
  const teamAId = value.teamA.teamId;
  const teamBId = value.teamB.teamId;
  const formRequested = teamAId !== undefined && teamBId !== undefined;
  const formPromise = teamAId !== undefined && teamBId !== undefined
    ? Promise.all([
      repository.getTeamMatches(teamAId, refresh),
      repository.getTeamMatches(teamBId, refresh),
    ])
    : Promise.resolve(null);
  const [catalogResponse, durationResponses, matchupResponses, formResponses] = await Promise.all([
    catalogPromise,
    durationPromise,
    matchupPromise,
    formPromise,
  ]);

  const catalog = new Map(catalogResponse.data.map((hero) => [hero.heroId, hero]));
  const teamA: DraftResolvedTeam = {
    name: value.teamA.name,
    side: value.teamA.side,
    teamId: value.teamA.teamId ?? null,
    heroes: value.teamA.heroIds.map((heroId) => resolvedHero(heroId, catalog)),
  };
  const teamB: DraftResolvedTeam = {
    name: value.teamB.name,
    side: value.teamB.side,
    teamId: value.teamB.teamId ?? null,
    heroes: value.teamB.heroIds.map((heroId) => resolvedHero(heroId, catalog)),
  };
  const heroById = new Map([...teamA.heroes, ...teamB.heroes].map((hero) => [hero.heroId, hero]));
  const heroDurations = allHeroIds.map((heroId, index): DraftHeroDurationResult => {
    const response = durationResponses[index];
    const stats = aggregateHeroDurations(heroId, response.data.map((row) => ({
      durationBinSeconds: Number(row.duration_bin),
      gamesPlayed: row.games_played,
      wins: row.wins,
    })));
    return {
      ...stats,
      team: index < 5 ? 'A' : 'B',
      hero: heroById.get(heroId) ?? { heroId, name: `Hero ${heroId}` },
      source: response.source,
      savedAt: response.savedAt,
    };
  });
  const durationBins = calculateDurationComponents(
    heroDurations.filter((hero) => hero.team === 'A'),
    heroDurations.filter((hero) => hero.team === 'B'),
  );
  const requestedPairs = value.teamA.heroIds.flatMap((heroAId) => (
    value.teamB.heroIds.map((heroBId) => ({ heroAId, heroBId }))
  ));
  const availablePairs = value.teamA.heroIds.flatMap((heroAId, index) => {
    const rows = new Map(matchupResponses[index].data.map((row) => [row.hero_id, row]));
    return value.teamB.heroIds.flatMap((heroBId) => {
      const row = rows.get(heroBId);
      return row ? [{ heroAId, heroBId, gamesPlayed: row.games_played, winsA: row.wins }] : [];
    });
  });
  const matchupComponent = calculateMatchupComponent(requestedPairs, availablePairs);
  const matchups: DraftMatchupAnalysis = {
    ...matchupComponent,
    pairs: matchupComponent.pairs.map((pair) => ({
      ...pair,
      heroA: heroById.get(pair.heroAId) ?? { heroId: pair.heroAId, name: `Hero ${pair.heroAId}` },
      heroB: heroById.get(pair.heroBId) ?? { heroId: pair.heroBId, name: `Hero ${pair.heroBId}` },
    })),
  };

  const formA = formResponses && teamAId !== undefined
    ? teamFormResult('A', teamAId, value.teamA.name, formResponses[0])
    : null;
  const formB = formResponses && teamBId !== undefined
    ? teamFormResult('B', teamBId, value.teamB.name, formResponses[1])
    : null;
  const formAWinRate = formA?.winRate ?? null;
  const formBWinRate = formB?.winRate ?? null;
  const formIncluded = formAWinRate !== null && formBWinRate !== null;
  const formAdvantage = formIncluded
    ? formAWinRate - formBWinRate
    : null;
  const teamForm: DraftTeamFormComponent = {
    requested: formRequested,
    included: formIncluded,
    advantage: formAdvantage,
    teamA: formA,
    teamB: formB,
  };
  const model = calculateDraftModel(durationBins, matchups.advantage, formAdvantage, formIncluded);
  const durationAvailableCells = durationBins.reduce((sum, bin) => (
    sum + bin.teamA.heroesWithData + bin.teamB.heroesWithData
  ), 0);
  const confidence = calculateDraftConfidence({
    durationAvailableCells,
    durationRequestedCells: 50,
    matchupAvailablePairs: matchups.availablePairs,
    matchupRequestedPairs: matchups.requestedPairs,
    teamAMatches: formA?.matches,
    teamBMatches: formB?.matches,
    withTeamForm: formRequested,
  });

  const sources: DraftAnalysisSource[] = [
    { kind: 'hero-catalog', key: 'heroes', source: catalogResponse.source, savedAt: catalogResponse.savedAt },
    ...durationResponses.map((response, index) => ({
      kind: 'hero-duration' as const,
      key: `hero-durations:${allHeroIds[index]}`,
      heroId: allHeroIds[index],
      source: response.source,
      savedAt: response.savedAt,
    })),
    ...matchupResponses.map((response, index) => ({
      kind: 'hero-matchup' as const,
      key: `hero-matchups:${value.teamA.heroIds[index]}`,
      heroId: value.teamA.heroIds[index],
      source: response.source,
      savedAt: response.savedAt,
    })),
    ...(formA ? [{ kind: 'team-form' as const, key: `team-matches:${formA.teamId}`, team: 'A' as const, source: formA.source, savedAt: formA.savedAt }] : []),
    ...(formB ? [{ kind: 'team-form' as const, key: `team-matches:${formB.teamId}`, team: 'B' as const, source: formB.source, savedAt: formB.savedAt }] : []),
  ];
  const warnings: DraftAnalysisWarning[] = [];
  const missingCatalog = allHeroIds.filter((heroId) => !catalog.has(heroId));
  if (missingCatalog.length > 0) warning(
    warnings,
    'hero_catalog_incomplete',
    `В каталоге OpenDota отсутствуют названия ${missingCatalog.length} выбранных героев; показаны ID.` ,
    { count: missingCatalog.length },
  );
  for (const hero of heroDurations) {
    if (hero.bins.every((bin) => bin.winRate === null)) warning(
      warnings,
      'duration_data_missing',
      `Для героя ${hero.hero.name} отсутствует статистика по длительности.`,
      { heroId: hero.heroId, team: hero.team },
    );
  }
  if (durationAvailableCells < 50) warning(
    warnings,
    'duration_coverage_incomplete',
    `Доступно ${durationAvailableCells} из 50 ожидаемых hero/bin значений.`,
    { count: durationAvailableCells },
  );
  if (matchups.availablePairs === 0) warning(warnings, 'matchup_data_missing', 'Не найдено ни одной валидной пары матчапов.');
  else if (matchups.availablePairs < matchups.requestedPairs) warning(
    warnings,
    'matchup_coverage_incomplete',
    `Доступно ${matchups.availablePairs} из ${matchups.requestedPairs} пар матчапов.`,
    { count: matchups.availablePairs },
  );
  if (formRequested && !formIncluded) warning(
    warnings,
    'team_form_incomplete',
    'Форма реальных команд не включена: хотя бы у одной команды нет матчей с известным победителем.',
  );
  if (!formRequested) warning(
    warnings,
    'team_form_not_used',
    'Реальные team ID не выбраны; применяется прозрачная формула 70% тайминги + 30% матчапы.',
  );
  if (model.bins.filter((bin) => bin.bin !== 'lt20' && bin.probabilityA !== null).length < 4) warning(
    warnings,
    'probability_incomplete',
    'Общая вероятность рассчитана только по доступным временным диапазонам; пропуски не заменены нейтральными значениями.',
  );
  const staleCount = sources.filter((source) => source.source === 'stale-cache').length;
  if (staleCount > 0) warning(
    warnings,
    'stale_data',
    `Используются устаревшие данные кэша для ${staleCount} источников.`,
    { count: staleCount },
  );

  const overallProbabilityA = model.overallProbabilityA;
  const favorite: DraftAnalysisResult['favorite'] = overallProbabilityA === null
    ? 'unknown'
    : Math.abs(overallProbabilityA - 0.5) < 0.005
      ? 'even'
      : overallProbabilityA > 0.5 ? 'A' : 'B';
  const summaries = [
    textSummary('15-25', [15, 20, 25], model.timeSeries, teamA.name, teamB.name),
    textSummary('30-40', [30, 35, 40], model.timeSeries, teamA.name, teamB.name),
    textSummary('after-45', [45, 50, 60], model.timeSeries, teamA.name, teamB.name),
  ];
  const savedAt = sources.length === 0 ? 0 : Math.min(...sources.map((source) => source.savedAt));

  return {
    input: {
      teamA: value.teamA,
      teamB: value.teamB,
      ...(value.odds ? { odds: value.odds } : {}),
      ...(value.handicap ? { handicap: value.handicap } : {}),
    },
    teamA,
    teamB,
    heroDurations,
    durationBins,
    matchups,
    teamForm,
    weights: model.weights,
    binProbabilities: model.bins,
    overallProbabilityA,
    favorite,
    confidence,
    timeSeries: model.timeSeries,
    peak: peakSummary(model.peak, teamA.name, teamB.name),
    summaries,
    sources,
    warnings,
    savedAt,
  };
}
