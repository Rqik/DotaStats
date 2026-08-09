import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { OPEN_DOTA_SETTINGS_STORAGE_KEY } from '../../api/settingsProvider';

export interface PublicSettings {
  autoRefresh: boolean;
  showCacheAge: boolean;
}

interface SettingsStore extends PublicSettings {
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  setAutoRefresh: (autoRefresh: boolean) => void;
  setShowCacheAge: (showCacheAge: boolean) => void;
  applyPublicSettings: (settings: PublicSettings) => void;
}

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(name, value);
    } catch {
      // Settings stay available in memory if browser storage is unavailable.
    }
  },
  removeItem: (name) => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(name);
    } catch {
      // Removing unavailable storage is a no-op.
    }
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKey: '',
      autoRefresh: true,
      showCacheAge: true,
      setApiKey: (apiKey) => set({ apiKey }),
      setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
      setShowCacheAge: (showCacheAge) => set({ showCacheAge }),
      applyPublicSettings: (settings) => set(settings),
    }),
    {
      name: OPEN_DOTA_SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
);

export function selectPublicSettings(): PublicSettings {
  const { autoRefresh, showCacheAge } = useSettingsStore.getState();
  return { autoRefresh, showCacheAge };
}
