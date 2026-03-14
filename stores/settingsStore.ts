import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  httpReferer: string;
  xTitle: string;
  timeout: number;
  retryCount: number;
  retryDelay: number;

  theme: 'light' | 'dark' | 'system';
  language: 'ru' | 'en';
  fontSize: number;
  showDebugInfo: boolean;

  maxFileSize: number;
  defaultProcessingStrategy: 'full' | 'chunked' | 'summary' | 'map-reduce';
  defaultChunkSize: number;
  uploadDir: string;

  defaultMaxTurns: number;
  globalContextVariables: Record<string, unknown>;
  defaultDebugMode: boolean;
  defaultStartAgentId: string | null;

  setApiKey: (key: string) => void;
  setBaseUrl: (url: string) => void;
  setDefaultModel: (model: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: 'ru' | 'en') => void;
  setFontSize: (size: number) => void;
  setShowDebugInfo: (show: boolean) => void;
  updateSettings: (settings: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'moonshotai/kimi-k2',
      httpReferer: 'http://localhost:3000',
      xTitle: 'KIMI Swarm Chat Service',
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,

      theme: 'dark',
      language: 'en',
      fontSize: 14,
      showDebugInfo: false,

      maxFileSize: 10737418240,
      defaultProcessingStrategy: 'chunked',
      defaultChunkSize: 4000,
      uploadDir: './uploads',

      defaultMaxTurns: 10,
      globalContextVariables: {},
      defaultDebugMode: false,
      defaultStartAgentId: null,

      setApiKey: (key) => set({ apiKey: key }),
      setBaseUrl: (url) => set({ baseUrl: url }),
      setDefaultModel: (model) => set({ defaultModel: model }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setFontSize: (size) => set({ fontSize: size }),
      setShowDebugInfo: (show) => set({ showDebugInfo: show }),
      updateSettings: (settings) => set(settings),
    }),
    { name: 'kimi-swarm-settings' }
  )
);
