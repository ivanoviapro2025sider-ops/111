'use client';

import { create } from 'zustand';

interface SettingsState {
  settings: Record<string, unknown> | null;
  models: Array<Record<string, unknown>>;
  load: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  models: [],
  load: async () => {
    const [settingsResponse, modelsResponse] = await Promise.all([
      fetch('/api/settings', { cache: 'no-store' }),
      fetch('/api/openrouter/models', { cache: 'no-store' }),
    ]);
    const settings = await settingsResponse.json();
    const models = await modelsResponse.json();
    set({ settings: settings.settings ?? null, models: models.models ?? [] });
  },
}));
