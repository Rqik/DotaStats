import { z } from 'zod';
import { ApiError } from '../api/client';
import {
  openDotaRepository,
  type CachedResult,
  type RefreshOptions,
} from '../api/openDotaRepository';
import type { OpenDotaTeamMatch } from '../api/schemas';
import {
  normalizeTeamMatches,
  type NormalizedTeamMatch,
} from '../domain/teamMatch';
import {
  settleKillsHandicap,
  type HandicapKind,
  type HandicapOutcome,
} from '../domain/handicap';
import {
  analysisStatus,
  breakevenProbability,
  probabilityEdge,
  smoothedFrequency,
  weightedProbability,
  type AnalysisStatus,
} from '../domain/probability';

const handicapAnalysisInputSchema = z.object({
  selectedTeamId: z.number().int().positive().safe(),
  opponentTeamId: z.number().int().positive().safe(),
  selectedTeamName: z.string().trim().min(1).optional(),
  opponentTeamName: z.string().trim().min(1).optional(),
  sign: z.enum(['plus', 'minus']),
  line: z.number().finite().nonnegative(),
  odds: z.number().finite().gt(1),
  sample: z.union([z.literal(10), z.literal(20), z.literal(30)]),
  forceRefresh: z.boolean().optional(),
}).refine((input) => input.selectedTeamId !== input.opponentTeamId, {
  message: 'Selected and opponent teams must be different',
  path: ['opponentTeamId'],
});

export interface KillsHandicapAnalysisInput {
  selectedTeamId: number;
  opponentTeamId: number;
  selectedTeamName?: string;
  opponentTeamName?: string;
  sign: HandicapKind;
  line: number;
  odds: number;
  sample: 10 | 20 | 30;
  forceRefresh?: boolean;
}

export type HandicapSampleGroup = 'selected-team' | 'opponent-opponents' | 'h2h';

export interface HandicapSampleResult {
  group: HandicapSampleGroup;
  requested: number;
  matches: number;
  wins: number;
  losses: number;
  refunds: number;
  rawFrequency: number | null;
  frequency: number;
  included: boolean;
  source: CachedResult<unknown>['source'];
  savedAt: number;
  oldest: string | null;
  newest: string | null;
  matchIds: number[];
}

export interface HandicapUsedMatch {
  matchId: number;
  group: HandicapSampleGroup;
  groups: HandicapSampleGroup[];
  date: string;
  startTime: number;
  subjectTeamId: number | null;
  subjectTeamName: string | null;
  opponentTeamId: number | null;
  opponentTeamName: string | null;
  subjectKills: number;
  opponentKills: number;
  score: string;
  margin: number;
  outcome: HandicapOutcome;
}

export type HandicapAnalysisWarningCode =
  | 'selected_matches_skipped'
  | 'opponent_matches_skipped'
  | 'selected_sample_short'
  | 'opponent_sample_short'
  | 'insufficient_primary_data'
  | 'h2h_not_included'
  | 'conflicting_duplicate_match';

export interface HandicapAnalysisWarning {
  code: HandicapAnalysisWarningCode;
  message: string;
  count?: number;
}

export interface KillsHandicapAnalysisResult {
  selectedTeamId: number;
  opponentTeamId: number;
  sign: HandicapKind;
  line: number;
  signedHandicap: number;
  odds: number;
  sample: 10 | 20 | 30;
  selectedSample: HandicapSampleResult;
  opponentSample: HandicapSampleResult;
  h2hSample: HandicapSampleResult;
  probability: number | null;
  breakeven: number;
  edge: number | null;
  weights: readonly number[];
  status: AnalysisStatus;
  savedAt: number;
  oldest: string | null;
  newest: string | null;
  usedMatches: HandicapUsedMatch[];
  warnings: HandicapAnalysisWarning[];
}

export interface TeamMatchesRepository {
  getTeamMatches: (
    teamId: number,
    options?: RefreshOptions,
  ) => Promise<CachedResult<OpenDotaTeamMatch[]>>;
}

interface SettlementRow extends HandicapUsedMatch {
  groups: [HandicapSampleGroup];
}

function settleRow(
  match: NormalizedTeamMatch,
  group: HandicapSampleGroup,
  sign: HandicapKind,
  line: number,
  reverse: boolean,
): SettlementRow {
  const subjectKills = reverse ? match.opponentKills : match.teamKills;
  const opponentKills = reverse ? match.teamKills : match.opponentKills;
  const settlement = settleKillsHandicap(subjectKills, opponentKills, sign, line);
  const subjectTeamId = reverse ? match.opponentTeamId : match.queriedTeamId;
  const subjectTeamName = reverse ? match.opponentTeamName : match.queriedTeamName;
  const opponentTeamId = reverse ? match.queriedTeamId : match.opponentTeamId;
  const opponentTeamName = reverse ? match.queriedTeamName : match.opponentTeamName;

  return {
    matchId: match.matchId,
    group,
    groups: [group],
    date: match.date,
    startTime: match.startTime,
    subjectTeamId,
    subjectTeamName,
    opponentTeamId,
    opponentTeamName,
    subjectKills,
    opponentKills,
    score: `${subjectKills}:${opponentKills}`,
    margin: settlement.margin,
    outcome: settlement.outcome,
  };
}

function sampleResult(
  group: HandicapSampleGroup,
  rows: readonly SettlementRow[],
  requested: number,
  source: CachedResult<unknown>['source'],
  savedAt: number,
  included = true,
): HandicapSampleResult {
  const wins = rows.filter((row) => row.outcome === 'win').length;
  const losses = rows.filter((row) => row.outcome === 'loss').length;
  const refunds = rows.filter((row) => row.outcome === 'refund').length;
  const ordered = [...rows].sort((left, right) => left.startTime - right.startTime);
  return {
    group,
    requested,
    matches: rows.length,
    wins,
    losses,
    refunds,
    rawFrequency: rows.length === 0 ? null : wins / rows.length,
    frequency: smoothedFrequency({ wins, matches: rows.length }),
    included,
    source,
    savedAt,
    oldest: ordered[0]?.date ?? null,
    newest: ordered.at(-1)?.date ?? null,
    matchIds: rows.map((row) => row.matchId),
  };
}

function combineUsedMatches(
  samples: readonly (readonly SettlementRow[])[],
  warnings: HandicapAnalysisWarning[],
): HandicapUsedMatch[] {
  const used = new Map<number, HandicapUsedMatch>();
  for (const rows of samples) {
    for (const row of rows) {
      const existing = used.get(row.matchId);
      if (!existing) {
        used.set(row.matchId, { ...row, groups: [...row.groups] });
        continue;
      }
      const sameSettlement = existing.subjectTeamId === row.subjectTeamId
        && existing.opponentTeamId === row.opponentTeamId
        && existing.subjectKills === row.subjectKills
        && existing.opponentKills === row.opponentKills
        && existing.outcome === row.outcome;
      if (!sameSettlement) {
        warnings.push({
          code: 'conflicting_duplicate_match',
          message: `Матч ${row.matchId} имеет конфликтующие данные в выборках и учтён только один раз.`,
          count: 1,
        });
        continue;
      }
      if (!existing.groups.includes(row.group)) existing.groups.push(row.group);
    }
  }
  return [...used.values()].sort((left, right) => right.startTime - left.startTime || right.matchId - left.matchId);
}

function dataWindow(rows: readonly HandicapUsedMatch[]): { oldest: string | null; newest: string | null } {
  if (rows.length === 0) return { oldest: null, newest: null };
  const ordered = [...rows].sort((left, right) => left.startTime - right.startTime);
  return { oldest: ordered[0].date, newest: ordered.at(-1)?.date ?? null };
}

export async function analyzeKillsHandicap(
  input: KillsHandicapAnalysisInput,
  repository: TeamMatchesRepository = openDotaRepository,
): Promise<KillsHandicapAnalysisResult> {
  const parsed = handicapAnalysisInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError('invalid_request', 'Invalid kills handicap analysis input', { cause: parsed.error });
  }
  const value = parsed.data;
  const refresh = value.forceRefresh ? { forceRefresh: true } : undefined;
  const [selectedResponse, opponentResponse] = await Promise.all([
    repository.getTeamMatches(value.selectedTeamId, refresh),
    repository.getTeamMatches(value.opponentTeamId, refresh),
  ]);

  const selectedNormalized = normalizeTeamMatches(
    selectedResponse.data,
    value.selectedTeamId,
    value.selectedTeamName,
  );
  const opponentNormalized = normalizeTeamMatches(
    opponentResponse.data,
    value.opponentTeamId,
    value.opponentTeamName,
  );
  const selectedRows = selectedNormalized.matches
    .slice(0, value.sample)
    .map((match) => settleRow(match, 'selected-team', value.sign, value.line, false));
  const opponentRows = opponentNormalized.matches
    .slice(0, value.sample)
    .map((match) => settleRow(match, 'opponent-opponents', value.sign, value.line, true));
  const h2hRows = selectedNormalized.matches
    .filter((match) => match.opponentTeamId === value.opponentTeamId)
    .slice(0, value.sample)
    .map((match) => settleRow(match, 'h2h', value.sign, value.line, false));

  const selectedSample = sampleResult(
    'selected-team',
    selectedRows,
    value.sample,
    selectedResponse.source,
    selectedResponse.savedAt,
  );
  const opponentSample = sampleResult(
    'opponent-opponents',
    opponentRows,
    value.sample,
    opponentResponse.source,
    opponentResponse.savedAt,
  );
  const h2hIncluded = h2hRows.length >= 3;
  const h2hSample = sampleResult(
    'h2h',
    h2hRows,
    value.sample,
    selectedResponse.source,
    selectedResponse.savedAt,
    h2hIncluded,
  );

  const warnings: HandicapAnalysisWarning[] = [];
  if (selectedNormalized.skipped > 0) warnings.push({
    code: 'selected_matches_skipped',
    message: 'Часть матчей выбранной команды пропущена из-за отсутствующих или противоречивых данных.',
    count: selectedNormalized.skipped,
  });
  if (opponentNormalized.skipped > 0) warnings.push({
    code: 'opponent_matches_skipped',
    message: 'Часть матчей второй команды пропущена из-за отсутствующих или противоречивых данных.',
    count: opponentNormalized.skipped,
  });
  if (selectedRows.length < value.sample) warnings.push({
    code: 'selected_sample_short',
    message: `Для выбранной команды найдено ${selectedRows.length} из ${value.sample} запрошенных карт.`,
    count: selectedRows.length,
  });
  if (opponentRows.length < value.sample) warnings.push({
    code: 'opponent_sample_short',
    message: `Для второй команды найдено ${opponentRows.length} из ${value.sample} запрошенных карт.`,
    count: opponentRows.length,
  });
  if (selectedRows.length < 10 || opponentRows.length < 10) warnings.push({
    code: 'insufficient_primary_data',
    message: 'Для статистического вывода требуется минимум 10 валидных карт в каждой основной выборке.',
  });
  if (!h2hIncluded) warnings.push({
    code: 'h2h_not_included',
    message: `Личные встречи не включены в итог: найдено ${h2hRows.length}, требуется минимум 3.`,
    count: h2hRows.length,
  });

  const usedMatches = combineUsedMatches([selectedRows, opponentRows, h2hRows], warnings);
  const window = dataWindow(usedMatches);
  const breakeven = breakevenProbability(value.odds);
  let probability: number | null = null;
  let edge: number | null = null;
  let weights: readonly number[] = h2hIncluded ? [0.4, 0.4, 0.2] : [0.5, 0.5];
  let status: AnalysisStatus = 'insufficient_data';

  if (selectedRows.length > 0 && opponentRows.length > 0) {
    const weighted = h2hIncluded
      ? weightedProbability(selectedSample.frequency, opponentSample.frequency, h2hSample.frequency)
      : weightedProbability(selectedSample.frequency, opponentSample.frequency);
    probability = weighted.probability;
    weights = weighted.weights;
    edge = probabilityEdge(probability, value.odds);
    status = analysisStatus(edge, selectedRows.length, opponentRows.length);
  }

  return {
    selectedTeamId: value.selectedTeamId,
    opponentTeamId: value.opponentTeamId,
    sign: value.sign,
    line: value.line,
    signedHandicap: value.sign === 'plus' ? value.line : -value.line,
    odds: value.odds,
    sample: value.sample,
    selectedSample,
    opponentSample,
    h2hSample,
    probability,
    breakeven,
    edge,
    weights,
    status,
    savedAt: Math.min(selectedResponse.savedAt, opponentResponse.savedAt),
    oldest: window.oldest,
    newest: window.newest,
    usedMatches,
    warnings,
  };
}
