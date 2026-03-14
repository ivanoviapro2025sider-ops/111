import { create } from 'zustand';
import { GlobalSettings, DEFAULT_AGENT_SETTINGS } from '@/types/agent';

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  openrouterApiKey: '',
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  whisperProvider: 'openrouter',
  openaiApiKey: '',
  agent: DEFAULT_AGENT_SETTINGS,
  video: {
    maxFileSize: 500 * 1024 * 1024,
    frameExtractionMethod: 'combined',
    fixedIntervalSeconds: 5,
    sceneChangeThreshold: 0.3,
    maxFrames: 200,
    frameQuality: 85,
    frameResolution: '1280x720',
    whisperModel: 'base',
    whisperLanguage: 'auto',
  },
  instruction: {
    defaultLanguage: 'ru',
    defaultStyle: 'step_by_step',
    includeTimestamps: true,
    includeTips: true,
    includeWarnings: true,
    annotateScreenshots: true,
  },
  ui: {
    theme: 'system',
    language: 'ru',
  },
};

interface SettingsStore {
  settings: GlobalSettings;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  saveSettings: (data: Partial<GlobalSettings>) => Promise<void>;
  testApiKey: (key: string) => Promise<boolean>;
  resetToDefaults: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_GLOBAL_SETTINGS,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      set({ settings: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  saveSettings: async (data) => {
    set({ loading: true });
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(res.statusText);
      const updated = await res.json();
      set({ settings: updated, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  testApiKey: async (key) => {
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  resetToDefaults: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_GLOBAL_SETTINGS),
      });
      if (!res.ok) throw new Error(res.statusText);
      const updated = await res.json();
      set({ settings: updated, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
}));
