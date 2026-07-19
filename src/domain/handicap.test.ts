import { describe, expect, it } from 'vitest';
import { settleKillsHandicap } from './handicap';

describe('settleKillsHandicap', () => {
  it('settles a winning plus handicap', () => {
    expect(settleKillsHandicap(14, 33, 'plus', 20.5)).toEqual({ outcome: 'win', margin: 1.5 });
  });

  it('settles a winning minus handicap', () => {
    expect(settleKillsHandicap(40, 30, 'minus', 7.5)).toEqual({ outcome: 'win', margin: 2.5 });
  });

  it('refunds an exactly tied integer line', () => {
    expect(settleKillsHandicap(25, 30, 'plus', 5)).toEqual({ outcome: 'refund', margin: 0 });
  });

  it('settles a half-point line as a loss when it misses', () => {
    expect(settleKillsHandicap(24, 30, 'plus', 5.5)).toEqual({ outcome: 'loss', margin: -0.5 });
  });

  it('settles a losing handicap', () => {
    expect(settleKillsHandicap(20, 30, 'minus', 3.5)).toEqual({ outcome: 'loss', margin: -13.5 });
  });

  it('rejects fractional kill counts', () => {
    expect(() => settleKillsHandicap(20.5, 30, 'plus', 3.5)).toThrow(RangeError);
  });
});
