import { z } from 'zod';

export const OPEN_DOTA_SETTINGS_STORAGE_KEY = 'dota-pulse-settings:v1';

const persistedOpenDotaSettingsSchema = z.object({
  state: z.object({
    apiKey: z.string().trim().max(512).optional(),
  }).passthrough(),
  version: z.number().int().optional(),
}).passthrough();

export interface OpenDotaSettings {
  apiKey?: string;
}

export type OpenDotaSettingsProvider = () => OpenDotaSettings;

export interface SettingsStorage {
  getItem: (key: string) => string | null;
}

function browserStorage(): SettingsStorage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

export function readOpenDotaSettings(storage: SettingsStorage | undefined = browserStorage()): OpenDotaSettings {
  if (!storage) return {};

  try {
    const serialized = storage.getItem(OPEN_DOTA_SETTINGS_STORAGE_KEY);
    if (!serialized) return {};
    const parsed: unknown = JSON.parse(serialized);
    const result = persistedOpenDotaSettingsSchema.safeParse(parsed);
    if (!result.success || !result.data.state.apiKey) return {};
    return { apiKey: result.data.state.apiKey };
  } catch {
    return {};
  }
}
