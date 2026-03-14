"use client";

import { create } from "zustand";

interface SettingsState {
  settings: Record<string, unknown> | null;
  loading: boolean;
  setSettings: (settings: Record<string, unknown>) => void;
  setLoading: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
}));
