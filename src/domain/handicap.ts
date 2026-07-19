/** Pure calculations for a kills-handicap market. */
export type HandicapKind = 'plus' | 'minus';
export type HandicapOutcome = 'win' | 'loss' | 'refund';

export interface HandicapSettlement {
  outcome: HandicapOutcome;
  /** Positive means the selected team covered the line. */
  margin: number;
}

const assertFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
};

/**
 * Settles a kills handicap. `line` is always entered as a non-negative number;
 * its direction is set by `kind`, so `minus, 7.5` means -7.5.
 */
export function settleKillsHandicap(
  selectedKills: number,
  opponentKills: number,
  kind: HandicapKind,
  line: number,
): HandicapSettlement {
  assertFinite(selectedKills, 'selectedKills');
  assertFinite(opponentKills, 'opponentKills');
  assertFinite(line, 'line');
  if (!Number.isInteger(selectedKills) || !Number.isInteger(opponentKills) || selectedKills < 0 || opponentKills < 0 || line < 0) {
    throw new RangeError('Kills must be non-negative integers and line must not be negative');
  }

  const margin = selectedKills + (kind === 'plus' ? line : -line) - opponentKills;
  if (margin > 0) return { outcome: 'win', margin };
  if (margin < 0) return { outcome: 'loss', margin };

  // A half-point line cannot produce an exact tie with integer kill scores.
  return { outcome: Number.isInteger(line) ? 'refund' : 'loss', margin };
}
