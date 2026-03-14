"use client";

import { create } from "zustand";
import { defaultGlobalSettings, type GlobalSettings } from "@/lib/defaults";

interface SettingsState {
  settings: GlobalSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (value: GlobalSettings) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultGlobalSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true });
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) return;
      const data = (await response.json()) as GlobalSettings;
      set({ settings: data });
    } finally {
      set({ loading: false });
    }
  },

  saveSettings: async (value) => {
    set({ loading: true });
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!response.ok) return;
      const updated = (await response.json()) as GlobalSettings;
      set({ settings: updated });
    } finally {
      set({ loading: false });
    }
  },
}));
