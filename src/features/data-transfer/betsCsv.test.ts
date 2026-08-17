import { describe, expect, it } from 'vitest';
import type { Bet } from '../bets/betStore';
import { createBetsCsv } from './betsCsv';

const bets: Bet[] = [
  {
    id: 'cash-1',
    date: '2026-08-10',
    tournament: 'Cup, "Final"',
    match: 'Radiant — Dire',
    selection: 'Radiant\nпобеда',
    odds: 2,
    stake: 100,
    stakeType: 'cash',
    result: 'win',
    profit: 100,
  },
  {
    id: 'freebet-1',
    date: '2026-08-11',
    tournament: 'Test Cup',
    match: 'A — B',
    selection: 'B +5.5',
    odds: 1.75,
    stake: 200,
    stakeType: 'freebet',
    result: 'loss',
    profit: 0,
  },
];

describe('bets CSV export', () => {
  it('uses a UTF-8 BOM, stable columns and CRLF row separators', () => {
    const csv = createBetsCsv(bets);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')[0]).toBe(
      '\uFEFF"id","date","tournament","match","selection","odds","stake","stakeType","result","profit","teamA","teamB","market","handicap","bookmaker","comment","analysisId"',
    );
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('RFC-escapes commas, quotes and line breaks and keeps cash/freebet profit columns', () => {
    const csv = createBetsCsv(bets);
    expect(csv).toContain('"Cup, ""Final"""');
    expect(csv).toContain('"Radiant\nпобеда"');
    expect(csv).toContain('"cash","win","100"');
    expect(csv).toContain('"freebet","loss","0"');
  });

  it('preserves metadata and emits empty metadata cells for legacy bets', () => {
    const csv = createBetsCsv([{ ...bets[0], teamA: 'Radiant', market: 'Победа', handicap: -2.5, bookmaker: 'Local', comment: 'note', analysisId: 'analysis-1' }]);
    expect(csv).toContain('"Radiant","","Победа","-2.5","Local","note","analysis-1"');
    expect(createBetsCsv(bets)).toContain('"100","","","","","",""');
  });
});
