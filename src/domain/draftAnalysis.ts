export type DraftTeamKey = 'A' | 'B';
export type DraftSide = 'radiant' | 'dire';
export type DraftDurationBin = 'lt20' | '20-30' | '30-40' | '40-50' | '50+';
export type DraftConfidenceLevel = 'low' | 'medium' | 'high';

export const DRAFT_DURATION_BINS: readonly DraftDurationBin[] = [
  'lt20',
  '20-30',
  '30-40',
  '40-50',
  '50+',
];

export const DRAFT_CONTROL_MINUTES = [15, 20, 25, 30, 35, 40, 45, 50, 60] as const;

export interface HeroDurationRow {
  durationBinSeconds: number;
  gamesPlayed: number;
  wins: number;
}

export interface HeroDurationBinStat {
  bin: DraftDurationBin;
  games: number;
  wins: number;
  winRate: number | null;
}

export interface HeroDurationStats {
  heroId: number;
  bins: HeroDurationBinStat[];
}

export interface TeamDurationBinSummary {
  heroesRequested: number;
  heroesWithData: number;
  games: number;
  winRate: number | null;
}

export interface DraftDurationComponent {
  bin: DraftDurationBin;
  teamA: TeamDurationBinSummary;
  teamB: TeamDurationBinSummary;
  advantage: number | null;
}

export interface DraftMatchupPairInput {
  heroAId: number;
  heroBId: number;
  gamesPlayed: number;
  winsA: number;
}

export interface DraftMatchupPairResult extends DraftMatchupPairInput {
  winRateA: number | null;
  advantage: number | null;
}

export interface DraftMatchupComponent {
  requestedPairs: number;
  availablePairs: number;
  games: number;
  advantage: number | null;
  pairs: DraftMatchupPairResult[];
}

export interface DraftTeamFormMatch {
  won: boolean | null;
  killMargin: number;
  durationSeconds: number | null;
}

export interface DraftTeamFormSummary {
  requestedMatches: number;
  matches: number;
  decidedMatches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  averageKillMargin: number | null;
  averageDurationMinutes: number | null;
}

export interface DraftFormulaWeights {
  duration: number;
  matchup: number;
  form: number;
  mode: 'draft-only' | 'with-team-form';
}

export interface DraftBinProbability {
  bin: DraftDurationBin;
  durationAdvantage: number | null;
  matchupAdvantage: number | null;
  formAdvantage: number | null;
  totalAdvantage: number | null;
  probabilityA: number | null;
}

export interface DraftTimePoint {
  minute: (typeof DRAFT_CONTROL_MINUTES)[number];
  probabilityA: number | null;
  advantage: number | null;
}

export interface DraftPeakPoint {
  minute: (typeof DRAFT_CONTROL_MINUTES)[number];
  probabilityA: number;
  advantage: number;
  team: DraftTeamKey | 'even';
}

export interface DraftModelResult {
  weights: DraftFormulaWeights;
  bins: DraftBinProbability[];
  overallProbabilityA: number | null;
  timeSeries: DraftTimePoint[];
  peak: DraftPeakPoint | null;
}

export interface DraftCoverageInput {
  durationAvailableCells: number;
  durationRequestedCells: number;
  matchupAvailablePairs: number;
  matchupRequestedPairs: number;
  teamAMatches?: number;
  teamBMatches?: number;
  withTeamForm: boolean;
}

export interface DraftConfidence {
  level: DraftConfidenceLevel;
  coverage: number;
  durations: number;
  matchups: number;
  teamForm: number | null;
}

function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, value / total));
}

function clampProbability(value: number): number {
  return Math.min(0.85, Math.max(0.15, value));
}

export function durationBinFromSeconds(seconds: number): DraftDurationBin | null {
  if (!Number.isSafeInteger(seconds) || seconds < 0) return null;
  if (seconds < 20 * 60) return 'lt20';
  if (seconds < 30 * 60) return '20-30';
  if (seconds < 40 * 60) return '30-40';
  if (seconds < 50 * 60) return '40-50';
  return '50+';
}

export function aggregateHeroDurations(
  heroId: number,
  rows: readonly HeroDurationRow[],
): HeroDurationStats {
  const totals = new Map<DraftDurationBin, { games: number; wins: number }>(
    DRAFT_DURATION_BINS.map((bin) => [bin, { games: 0, wins: 0 }]),
  );
  for (const row of rows) {
    const bin = durationBinFromSeconds(row.durationBinSeconds);
    if (!bin
      || !Number.isSafeInteger(row.gamesPlayed)
      || !Number.isSafeInteger(row.wins)
      || row.gamesPlayed < 0
      || row.wins < 0
      || row.wins > row.gamesPlayed) continue;
    const total = totals.get(bin);
    if (!total) continue;
    total.games += row.gamesPlayed;
    total.wins += row.wins;
  }
  return {
    heroId,
    bins: DRAFT_DURATION_BINS.map((bin) => {
      const total = totals.get(bin) ?? { games: 0, wins: 0 };
      return {
        bin,
        games: total.games,
        wins: total.wins,
        winRate: total.games > 0 ? total.wins / total.games : null,
      };
    }),
  };
}

function summarizeDurationTeam(
  heroes: readonly HeroDurationStats[],
  bin: DraftDurationBin,
): TeamDurationBinSummary {
  const rows = heroes
    .map((hero) => hero.bins.find((row) => row.bin === bin))
    .filter((row): row is HeroDurationBinStat => row?.winRate !== null && row !== undefined);
  return {
    heroesRequested: heroes.length,
    heroesWithData: rows.length,
    games: rows.reduce((sum, row) => sum + row.games, 0),
    winRate: average(rows.map((row) => row.winRate).filter((value): value is number => value !== null)),
  };
}

export function calculateDurationComponents(
  teamA: readonly HeroDurationStats[],
  teamB: readonly HeroDurationStats[],
): DraftDurationComponent[] {
  return DRAFT_DURATION_BINS.map((bin) => {
    const summaryA = summarizeDurationTeam(teamA, bin);
    const summaryB = summarizeDurationTeam(teamB, bin);
    return {
      bin,
      teamA: summaryA,
      teamB: summaryB,
      advantage: summaryA.winRate === null || summaryB.winRate === null
        ? null
        : summaryA.winRate - summaryB.winRate,
    };
  });
}

export function calculateMatchupComponent(
  requestedPairs: readonly { heroAId: number; heroBId: number }[],
  availableRows: readonly DraftMatchupPairInput[],
): DraftMatchupComponent {
  const rowByPair = new Map(
    availableRows.map((row) => [`${row.heroAId}:${row.heroBId}`, row]),
  );
  const pairs = requestedPairs.map(({ heroAId, heroBId }): DraftMatchupPairResult => {
    const row = rowByPair.get(`${heroAId}:${heroBId}`);
    if (!row || row.gamesPlayed <= 0 || row.winsA < 0 || row.winsA > row.gamesPlayed) {
      return { heroAId, heroBId, gamesPlayed: row?.gamesPlayed ?? 0, winsA: row?.winsA ?? 0, winRateA: null, advantage: null };
    }
    const winRateA = row.winsA / row.gamesPlayed;
    return { ...row, winRateA, advantage: winRateA - 0.5 };
  });
  const valid = pairs.filter((pair): pair is DraftMatchupPairResult & { advantage: number } => pair.advantage !== null);
  return {
    requestedPairs: pairs.length,
    availablePairs: valid.length,
    games: valid.reduce((sum, pair) => sum + pair.gamesPlayed, 0),
    advantage: average(valid.map((pair) => pair.advantage)),
    pairs,
  };
}

export function summarizeTeamForm(
  matches: readonly DraftTeamFormMatch[],
  requestedMatches = 20,
): DraftTeamFormSummary {
  const sample = matches.slice(0, requestedMatches);
  const decided = sample.filter((match): match is DraftTeamFormMatch & { won: boolean } => match.won !== null);
  const durations = sample
    .map((match) => match.durationSeconds)
    .filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration >= 0);
  const margins = sample
    .map((match) => match.killMargin)
    .filter((margin) => Number.isFinite(margin));
  const wins = decided.filter((match) => match.won).length;
  return {
    requestedMatches,
    matches: sample.length,
    decidedMatches: decided.length,
    wins,
    losses: decided.length - wins,
    winRate: decided.length > 0 ? wins / decided.length : null,
    averageKillMargin: average(margins),
    averageDurationMinutes: durations.length === 0 ? null : (average(durations) ?? 0) / 60,
  };
}

export function draftWeights(withTeamForm: boolean): DraftFormulaWeights {
  return withTeamForm
    ? { duration: 0.55, matchup: 0.25, form: 0.2, mode: 'with-team-form' }
    : { duration: 0.7, matchup: 0.3, form: 0, mode: 'draft-only' };
}

function interpolate(left: number | null, right: number | null, share: number): number | null {
  if (left === null || right === null) return null;
  return left + (right - left) * share;
}

function buildTimeSeries(bins: readonly DraftBinProbability[]): DraftTimePoint[] {
  const byBin = new Map(bins.map((bin) => [bin.bin, bin.probabilityA]));
  const anchors = [
    { minute: 15, value: byBin.get('lt20') ?? null },
    { minute: 25, value: byBin.get('20-30') ?? null },
    { minute: 35, value: byBin.get('30-40') ?? null },
    { minute: 45, value: byBin.get('40-50') ?? null },
    { minute: 60, value: byBin.get('50+') ?? null },
  ] as const;
  return DRAFT_CONTROL_MINUTES.map((minute) => {
    const exact = anchors.find((anchor) => anchor.minute === minute);
    let probabilityA = exact?.value ?? null;
    if (!exact) {
      const rightIndex = anchors.findIndex((anchor) => anchor.minute > minute);
      const left = anchors[rightIndex - 1];
      const right = anchors[rightIndex];
      probabilityA = left && right
        ? interpolate(left.value, right.value, (minute - left.minute) / (right.minute - left.minute))
        : null;
    }
    return {
      minute,
      probabilityA,
      advantage: probabilityA === null ? null : probabilityA - 0.5,
    };
  });
}

export function calculateDraftModel(
  durations: readonly DraftDurationComponent[],
  matchupAdvantage: number | null,
  formAdvantage: number | null,
  withTeamForm: boolean,
): DraftModelResult {
  const weights = draftWeights(withTeamForm);
  const bins = durations.map((duration): DraftBinProbability => {
    const durationAdvantage = duration.advantage;
    const effectiveFormAdvantage = withTeamForm ? formAdvantage : null;
    if (durationAdvantage === null
      || matchupAdvantage === null
      || (withTeamForm && effectiveFormAdvantage === null)) {
      return {
        bin: duration.bin,
        durationAdvantage,
        matchupAdvantage,
        formAdvantage: effectiveFormAdvantage,
        totalAdvantage: null,
        probabilityA: null,
      };
    }
    const totalAdvantage = weights.duration * durationAdvantage
      + weights.matchup * matchupAdvantage
      + weights.form * (effectiveFormAdvantage ?? 0);
    return {
      bin: duration.bin,
      durationAdvantage,
      matchupAdvantage,
      formAdvantage: effectiveFormAdvantage,
      totalAdvantage,
      probabilityA: clampProbability(0.5 + totalAdvantage),
    };
  });
  const overallBins = bins
    .filter((bin) => bin.bin !== 'lt20')
    .map((bin) => bin.probabilityA)
    .filter((value): value is number => value !== null);
  const timeSeries = buildTimeSeries(bins);
  const points = timeSeries.filter((point): point is DraftTimePoint & { probabilityA: number; advantage: number } => (
    point.probabilityA !== null && point.advantage !== null
  ));
  const peak = points.reduce<(typeof points)[number] | null>((current, point) => (
    !current || Math.abs(point.advantage) > Math.abs(current.advantage) ? point : current
  ), null);
  return {
    weights,
    bins,
    overallProbabilityA: average(overallBins),
    timeSeries,
    peak: peak ? {
      minute: peak.minute,
      probabilityA: peak.probabilityA,
      advantage: peak.advantage,
      team: Math.abs(peak.advantage) < Number.EPSILON ? 'even' : peak.advantage > 0 ? 'A' : 'B',
    } : null,
  };
}

export function calculateDraftConfidence(input: DraftCoverageInput): DraftConfidence {
  const durations = ratio(input.durationAvailableCells, input.durationRequestedCells);
  const matchups = ratio(input.matchupAvailablePairs, input.matchupRequestedPairs);
  const teamForm = input.withTeamForm
    ? (ratio(input.teamAMatches ?? 0, 20) + ratio(input.teamBMatches ?? 0, 20)) / 2
    : null;
  const weights = draftWeights(input.withTeamForm);
  const coverage = weights.duration * durations
    + weights.matchup * matchups
    + weights.form * (teamForm ?? 0);
  return {
    level: coverage >= 0.85 ? 'high' : coverage >= 0.5 ? 'medium' : 'low',
    coverage,
    durations,
    matchups,
    teamForm,
  };
}
