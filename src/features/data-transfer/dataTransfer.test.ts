import { describe, expect, it } from 'vitest';
import { createTransferDocument, parseTransferDocument } from './dataTransfer';

describe('Dota Pulse data transfer', () => {
  it('exports only non-secret settings and recalculates bet profit on import', () => {
    const document = createTransferDocument([
      {
        id: 'bet-1',
        date: '2026-08-08',
        tournament: 'The International 2026',
        match: 'Team A — Team B',
        selection: 'Team A победа',
        odds: 2,
        stake: 100,
        stakeType: 'cash',
        result: 'win',
        profit: 9_999,
        teamA: 'Team A',
        market: 'Победа',
        handicap: -2.5,
        bookmaker: 'Local',
        comment: 'Для проверки',
        analysisId: 'analysis-1',
      },
    ], { autoRefresh: true, showCacheAge: false });

    expect(JSON.stringify(document)).not.toContain('apiKey');
    const parsed = parseTransferDocument(JSON.stringify(document));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.format).toBe('dota-pulse-export');
      expect(parsed.data.bets[0].profit).toBe(100);
      expect(parsed.data.bets[0]).toMatchObject({ teamA: 'Team A', market: 'Победа', handicap: -2.5, bookmaker: 'Local', comment: 'Для проверки', analysisId: 'analysis-1' });
      expect(parsed.data.settings).toEqual({ autoRefresh: true, showCacheAge: false });
    }
  });

  it('rejects the whole document when one bet is invalid', () => {
    const parsed = parseTransferDocument(JSON.stringify({
      format: 'dota-pulse-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      bets: [{
        id: 'invalid',
        date: '2026-08-08',
        tournament: 'Tournament',
        match: 'A — B',
        selection: 'A',
        odds: 1,
        stake: 100,
        stakeType: 'cash',
        result: 'pending',
        profit: 0,
      }],
      settings: { autoRefresh: true, showCacheAge: true },
    }));

    expect(parsed).toEqual({
      success: false,
      message: 'Файл не соответствует формату Dota Pulse или содержит недопустимые значения.',
    });
  });

  it('accepts legacy exports without optional metadata', () => {
    const parsed = parseTransferDocument(JSON.stringify({
      format: 'dota-pulse-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      bets: [{
        id: 'legacy', date: '2026-08-08', tournament: 'Tournament', match: 'A — B', selection: 'A',
        odds: 2, stake: 100, stakeType: 'cash', result: 'win', profit: 0,
      }],
      settings: { autoRefresh: true, showCacheAge: true },
    }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.bets[0].teamA).toBeUndefined();
  });

  it('rejects unknown bet fields under the strict import schema', () => {
    const parsed = parseTransferDocument(JSON.stringify({
      format: 'dota-pulse-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      bets: [{
        id: 'unknown-field', date: '2026-08-08', tournament: 'Tournament', match: 'A — B', selection: 'A',
        odds: 2, stake: 100, stakeType: 'cash', result: 'win', profit: 100, unexpected: 'reject-me',
      }],
      settings: { autoRefresh: true, showCacheAge: true },
    }));
    expect(parsed.success).toBe(false);
  });

  it('rejects an overflowing handicap parsed as Infinity', () => {
    const parsed = parseTransferDocument(`{"format":"dota-pulse-export","version":1,"exportedAt":"${new Date().toISOString()}","bets":[{"id":"overflow","date":"2026-08-08","tournament":"Tournament","match":"A — B","selection":"A","odds":2,"stake":100,"stakeType":"cash","result":"win","profit":100,"handicap":1e400}],"settings":{"autoRefresh":true,"showCacheAge":true}}`);
    expect(parsed.success).toBe(false);
  });
});
