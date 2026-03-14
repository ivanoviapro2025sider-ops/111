"use client";

import { create } from "zustand";
import { defaultSampling } from "@/types/agent";
import { defaultFileProcessingOptions } from "@/types/file";

export interface AppSettings {
  apiKeySet: boolean;
  baseUrl: string;
  referer: string;
  title: string;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  defaultModel: string;
  defaultSampling: typeof defaultSampling;
  defaultMaxTurns: number;
  debugDefault: boolean;
  maxFileSize: number;
  fileProcessing: typeof defaultFileProcessingOptions;
  uploadDir: string;
  language: "ru" | "en";
  theme: "dark" | "light" | "system";
}

interface SettingsStoreState {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  patchSettings: (patch: Partial<AppSettings>) => void;
}

export const initialSettings: AppSettings = {
  apiKeySet: false,
  baseUrl: "https://openrouter.ai/api/v1",
  referer: "http://localhost:3000",
  title: "KIMI Swarm Chat Service",
  timeoutMs: 120000,
  retryCount: 3,
  retryDelayMs: 1000,
  defaultModel: "moonshotai/kimi-k2",
  defaultSampling,
  defaultMaxTurns: 10,
  debugDefault: false,
  maxFileSize: 10 * 1024 * 1024 * 1024,
  fileProcessing: defaultFileProcessingOptions,
  uploadDir: "./uploads",
  language: "ru",
  theme: "dark",
};

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  settings: initialSettings,
  setSettings: (settings) => set({ settings }),
  patchSettings: (patch) =>
    set((state) => ({
      settings: { ...state.settings, ...patch },
    })),
}));
