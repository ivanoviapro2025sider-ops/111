'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ru';
  fontSize: number;
  debugMode: boolean;
  maxFileSize: number;
  defaultChunkSize: number;
  defaultProcessingStrategy: 'full' | 'chunked' | 'summary' | 'map-reduce';

  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setDefaultModel: (model: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (lang: 'en' | 'ru') => void;
  setFontSize: (size: number) => void;
  setDebugMode: (debug: boolean) => void;
  setMaxFileSize: (size: number) => void;
  setDefaultChunkSize: (size: number) => void;
  setDefaultProcessingStrategy: (strategy: 'full' | 'chunked' | 'summary' | 'map-reduce') => void;
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'moonshotai/kimi-k2',
      theme: 'dark',
      language: 'en',
      fontSize: 14,
      debugMode: false,
      maxFileSize: 10 * 1024 * 1024 * 1024,
      defaultChunkSize: 4000,
      defaultProcessingStrategy: 'full',

      setApiKey: (apiKey) => set({ apiKey }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setFontSize: (fontSize) => set({ fontSize }),
      setDebugMode: (debugMode) => set({ debugMode }),
      setMaxFileSize: (maxFileSize) => set({ maxFileSize }),
      setDefaultChunkSize: (defaultChunkSize) => set({ defaultChunkSize }),
      setDefaultProcessingStrategy: (defaultProcessingStrategy) =>
        set({ defaultProcessingStrategy }),

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
              debugMode: state.debugMode,
              maxFileSize: state.maxFileSize,
              defaultChunkSize: state.defaultChunkSize,
              defaultProcessingStrategy: state.defaultProcessingStrategy,
            }),
          });
        } catch (error) {
          console.error('Failed to save settings:', error);
        }
      },

      loadSettings: async () => {
        try {
          const res = await fetch('/api/settings');
          if (res.ok) {
            const data = await res.json();
            set(data);
          }
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      },
    }),
    {
      name: 'kimi-swarm-settings',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        fontSize: state.fontSize,
        debugMode: state.debugMode,
      }),
    }
  )
);
