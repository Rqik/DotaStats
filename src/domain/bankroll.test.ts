import { describe, expect, it } from 'vitest';
import { calculateProfit, maximumDrawdown, roi } from './bankroll';

describe('bankroll domain', () => {
  it('calculates cash-bet profit for win, loss and refund', () => {
    expect(calculateProfit({ stake: 100, odds: 1.8, stakeType: 'cash', result: 'win' })).toBeCloseTo(80);
    expect(calculateProfit({ stake: 100, odds: 1.8, stakeType: 'cash', result: 'loss' })).toBe(-100);
    expect(calculateProfit({ stake: 100, odds: 1.8, stakeType: 'cash', result: 'refund' })).toBe(0);
  });

  it('does not deduct a lost freebet nominal', () => {
    expect(calculateProfit({ stake: 100, odds: 2, stakeType: 'freebet', result: 'win' })).toBe(100);
    expect(calculateProfit({ stake: 100, odds: 2, stakeType: 'freebet', result: 'loss' })).toBe(0);
  });

  it('calculates ROI and handles no turnover', () => {
    expect(roi(25, 100)).toBe(25);
    expect(roi(25, 0)).toBe(0);
  });

  it('finds the maximum peak-to-trough drawdown', () => {
    expect(maximumDrawdown([100, 130, 110, 120, 90, 150])).toEqual({ amount: 40, percent: 400 / 13, peak: 130, trough: 90 });
    expect(maximumDrawdown([])).toEqual({ amount: 0, percent: 0, peak: 0, trough: 0 });
  });
});
