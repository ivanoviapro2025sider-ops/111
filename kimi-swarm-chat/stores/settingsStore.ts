"use client";

import { create } from "zustand";
import { DEFAULT_GLOBAL_SETTINGS } from "@/lib/defaults";

interface SettingsState {
  settings: Record<string, unknown>;
  loading: boolean;
  error?: string;
  fetchSettings: () => Promise<void>;
  saveSettings: (payload: Record<string, unknown>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_GLOBAL_SETTINGS,
  loading: false,
  error: undefined,
  fetchSettings: async () => {
    set({ loading: true, error: undefined });
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const data = await response.json();
      set({ settings: data, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load settings",
      });
    }
  },
  saveSettings: async (payload) => {
    set({ loading: true, error: undefined });
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      set({ settings: data, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to save settings",
      });
    }
  },
}));
