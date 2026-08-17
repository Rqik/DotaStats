import type { Bet } from '../bets/betStore';

const columns = [
  'id',
  'date',
  'tournament',
  'match',
  'selection',
  'odds',
  'stake',
  'stakeType',
  'result',
  'profit',
  'teamA',
  'teamB',
  'market',
  'handicap',
  'bookmaker',
  'comment',
  'analysisId',
] as const;

function csvCell(value: string | number | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function createBetsCsv(bets: readonly Bet[]): string {
  const header = columns.map(csvCell).join(',');
  const rows = bets.map((bet) => columns.map((column) => csvCell(bet[column])).join(','));
  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
}

export function downloadBetsCsv(fileName: string, bets: readonly Bet[]): void {
  const blob = new Blob([createBetsCsv(bets)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
