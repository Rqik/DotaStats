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

  it('roundtrips optional metadata while accepting old records without it', () => {
    const metadata = {
      teamA: 'Team A',
      teamB: 'Team B',
      market: 'kills handicap',
      handicap: 7.5,
      bookmaker: 'Example',
      comment: 'manual note',
      analysisId: 'analysis-1',
    };
    expect(normalizeStoredBet({
      id: 'bet-meta',
      date: '2026-08-09',
      tournament: 'Cup',
      match: 'Team A — Team B',
      selection: 'Team A',
      odds: 2,
      stake: 100,
      stakeType: 'cash',
      result: 'pending',
      profit: 0,
      createdAt: 1,
      updatedAt: 1,
      ...metadata,
    })).toMatchObject(metadata);
    expect(normalizeStoredBet({
      id: 'bet-old', date: '2026-08-09', tournament: 'Cup', match: 'A — B', selection: 'A',
      odds: 2, stake: 100, stakeType: 'cash', result: 'pending', profit: 0, createdAt: 1, updatedAt: 1,
    })).not.toBeNull();
  });

  it('rejects non-finite handicap values but accepts a negative finite line', () => {
    const base = {
      id: 'bet-handicap',
      date: '2026-08-09',
      tournament: 'Cup',
      match: 'A — B',
      selection: 'A',
      odds: 2,
      stake: 100,
      stakeType: 'cash' as const,
      result: 'pending' as const,
      profit: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(normalizeStoredBet({ ...base, handicap: Number.POSITIVE_INFINITY })).toBeNull();
    expect(normalizeStoredBet({ ...base, handicap: Number.NaN })).toBeNull();
    expect(normalizeStoredBet({ ...base, handicap: -7.5 })).toMatchObject({ handicap: -7.5 });
  });
});
