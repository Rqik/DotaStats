export type StakeType = 'cash' | 'freebet';
export type BetResult = 'pending' | 'win' | 'loss' | 'refund';

export interface ProfitInput {
  stake: number;
  odds: number;
  stakeType: StakeType;
  result: BetResult;
}

export interface Drawdown {
  amount: number;
  percent: number;
  peak: number;
  trough: number;
}

const assertNonNegative = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a non-negative finite number`);
};

export function calculateProfit({ stake, odds, stakeType, result }: ProfitInput): number {
  assertNonNegative(stake, 'stake');
  if (!Number.isFinite(odds) || odds <= 1) throw new RangeError('Odds must be greater than 1');
  if (result === 'win') return stake * (odds - 1);
  if (result === 'loss') return stakeType === 'cash' ? -stake : 0;
  return 0;
}

export function roi(profit: number, turnover: number): number {
  if (!Number.isFinite(profit)) throw new RangeError('profit must be finite');
  assertNonNegative(turnover, 'turnover');
  return turnover === 0 ? 0 : (profit / turnover) * 100;
}

/** Largest peak-to-trough loss in a chronological balance series. */
export function maximumDrawdown(balances: readonly number[]): Drawdown {
  if (balances.length === 0) return { amount: 0, percent: 0, peak: 0, trough: 0 };
  balances.forEach((balance) => assertNonNegative(balance, 'balance'));

  let peak = balances[0];
  let worst: Drawdown = { amount: 0, percent: 0, peak, trough: peak };
  for (const balance of balances) {
    if (balance > peak) peak = balance;
    const amount = peak - balance;
    const percent = peak === 0 ? 0 : (amount / peak) * 100;
    if (amount > worst.amount) worst = { amount, percent, peak, trough: balance };
  }
  return worst;
}
