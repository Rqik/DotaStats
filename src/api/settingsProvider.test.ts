import { describe, expect, it, vi } from 'vitest';
import {
  OPEN_DOTA_SETTINGS_STORAGE_KEY,
  readOpenDotaSettings,
  type SettingsStorage,
} from './settingsProvider';

function storageWith(value: string | null): SettingsStorage {
  return { getItem: vi.fn(() => value) };
}

describe('OpenDota settings provider', () => {
  it('reads the versioned Zustand persist envelope used by the settings UI', () => {
    const storage = storageWith(JSON.stringify({
      state: { apiKey: 'local-secret', autoRefresh: true, showCacheAge: true },
      version: 1,
    }));

    expect(readOpenDotaSettings(storage)).toEqual({ apiKey: 'local-secret' });
    expect(storage.getItem).toHaveBeenCalledWith(OPEN_DOTA_SETTINGS_STORAGE_KEY);
  });

  it('fails closed for malformed JSON or an unexpected envelope', () => {
    expect(readOpenDotaSettings(storageWith('{not-json'))).toEqual({});
    expect(readOpenDotaSettings(storageWith(JSON.stringify({ apiKey: 'wrong-level' })))).toEqual({});
    expect(readOpenDotaSettings(undefined)).toEqual({});
  });

  it('does not log the API key while reading settings', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const secret = 'must-not-be-logged';

    expect(readOpenDotaSettings(storageWith(JSON.stringify({ state: { apiKey: secret }, version: 1 })))).toEqual({ apiKey: secret });
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });
});
