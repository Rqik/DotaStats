import { describe, expect, it } from 'vitest';
import { calculateProfit } from '../domain/bankroll';
import { normalizeStoredBet } from './betRepository';

describe('bet repository normalization', () => {
  it('preserves user fields and recalculates profit before persistence', () => {
    const normalized = normalizeStoredBet({
      id: 'bet-1',
      date: '2026-08-09',
      tournament: 'The International',
      match: 'Team A — Team B',
      selection: 'Team A победа',
      odds: 2.25,
      stake: 400,
      stakeType: 'cash',
      result: 'win',
      profit: 99_999,
      createdAt: 100,
      updatedAt: 200,
    });

    expect(normalized).toEqual({
      id: 'bet-1',
      date: '2026-08-09',
      tournament: 'The International',
      match: 'Team A — Team B',
      selection: 'Team A победа',
      odds: 2.25,
      stake: 400,
      stakeType: 'cash',
      result: 'win',
      profit: calculateProfit({ stake: 400, odds: 2.25, stakeType: 'cash', result: 'win' }),
      createdAt: 100,
      updatedAt: 200,
    });
  });

  it('rejects a malformed record instead of normalizing it', () => {
    expect(normalizeStoredBet({ id: 'broken', odds: 1 })).toBeNull();
  });
});
