import { z } from 'zod';
import { calculateProfit } from '../../domain/bankroll';
import type { Bet } from '../bets/betStore';
import type { PublicSettings } from '../settings/settingsStore';

const betTransferSchema = z.object({
  id: z.string().trim().min(1),
  date: z.string().trim().min(1),
  tournament: z.string().trim().min(1),
  match: z.string().trim().min(1),
  selection: z.string().trim().min(1),
  odds: z.number().finite().gt(1),
  stake: z.number().finite().nonnegative(),
  stakeType: z.enum(['cash', 'freebet']),
  result: z.enum(['pending', 'win', 'loss', 'refund']),
  profit: z.number().finite(),
}).strict();

const publicSettingsSchema = z.object({
  autoRefresh: z.boolean(),
  showCacheAge: z.boolean(),
}).strict();

const transferDocumentSchema = z.object({
  format: z.literal('dota-pulse-export'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  bets: z.array(betTransferSchema),
  settings: publicSettingsSchema,
}).strict();

export interface TransferDocument {
  format: 'dota-pulse-export';
  version: 1;
  exportedAt: string;
  bets: Bet[];
  settings: PublicSettings;
}

export type TransferParseResult =
  | { success: true; data: TransferDocument }
  | { success: false; message: string };

export function createTransferDocument(
  bets: readonly Bet[],
  settings: PublicSettings,
): TransferDocument {
  return {
    format: 'dota-pulse-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    bets: bets.map((bet) => ({ ...bet })),
    settings: { ...settings },
  };
}

export function parseTransferDocument(text: string): TransferParseResult {
  try {
    const raw: unknown = JSON.parse(text);
    const parsed = transferDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, message: 'Файл не соответствует формату Dota Pulse или содержит недопустимые значения.' };
    }

    const bets = parsed.data.bets.map((bet) => ({
      ...bet,
      profit: calculateProfit({
        stake: bet.stake,
        odds: bet.odds,
        stakeType: bet.stakeType,
        result: bet.result,
      }),
    }));

    return { success: true, data: { ...parsed.data, bets } };
  } catch {
    return { success: false, message: 'Не удалось прочитать JSON-файл.' };
  }
}

export function downloadJsonFile(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
