import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ru';
  fontSize: number;
  showDebug: boolean;
  maxFileSize: number;
  defaultChunkSize: number;
  defaultStrategy: 'full' | 'chunked' | 'summary' | 'map-reduce';

  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setDefaultModel: (model: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (lang: 'en' | 'ru') => void;
  setFontSize: (size: number) => void;
  setShowDebug: (show: boolean) => void;
  setMaxFileSize: (size: number) => void;
  setDefaultChunkSize: (size: number) => void;
  setDefaultStrategy: (strategy: 'full' | 'chunked' | 'summary' | 'map-reduce') => void;
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'moonshotai/kimi-k2',
      theme: 'dark',
      language: 'en',
      fontSize: 14,
      showDebug: false,
      maxFileSize: 10 * 1024 * 1024 * 1024,
      defaultChunkSize: 4000,
      defaultStrategy: 'chunked',

      setApiKey: (key) => set({ apiKey: key }),
      setBaseUrl: (url) => set({ baseUrl: url }),
      setDefaultModel: (model) => set({ defaultModel: model }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => set({ language: lang }),
      setFontSize: (size) => set({ fontSize: size }),
      setShowDebug: (show) => set({ showDebug: show }),
      setMaxFileSize: (size) => set({ maxFileSize: size }),
      setDefaultChunkSize: (size) => set({ defaultChunkSize: size }),
      setDefaultStrategy: (strategy) => set({ defaultStrategy: strategy }),

      saveSettings: async () => {
        const state = get();
        try {
          await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: state.apiKey,
              baseUrl: state.baseUrl,
              defaultModel: state.defaultModel,
              theme: state.theme,
              language: state.language,
              fontSize: state.fontSize,
              showDebug: state.showDebug,
              maxFileSize: state.maxFileSize,
              defaultChunkSize: state.defaultChunkSize,
              defaultStrategy: state.defaultStrategy,
            }),
          });
        } catch (e) {
          console.error('Failed to save settings:', e);
        }
      },

      loadSettings: async () => {
        try {
          const res = await fetch('/api/settings');
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
              set({
                apiKey: data.apiKey || '',
                baseUrl: data.baseUrl || 'https://openrouter.ai/api/v1',
                defaultModel: data.defaultModel || 'moonshotai/kimi-k2',
                theme: data.theme || 'dark',
                language: data.language || 'en',
                fontSize: data.fontSize || 14,
                showDebug: data.showDebug || false,
              });
            }
          }
        } catch (e) {
          console.error('Failed to load settings:', e);
        }
      },
    }),
    {
      name: 'kimi-swarm-settings',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        fontSize: state.fontSize,
        showDebug: state.showDebug,
        defaultModel: state.defaultModel,
      }),
    }
  )
);
