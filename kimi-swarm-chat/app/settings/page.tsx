"use client";

import { useEffect, useState } from "react";
import { APIKeyInput } from "@/components/settings/APIKeyInput";
import { GlobalParameters } from "@/components/settings/GlobalParameters";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { useSettingsStore } from "@/stores/settingsStore";
import type { OpenRouterModel } from "@/types/openrouter";

export default function SettingsPage() {
  const { settings, loadSettings, saveSettings, loading } = useSettingsStore();
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const loadModels = async () => {
      const response = await fetch("/api/openrouter/models");
      if (!response.ok) return;
      const body = (await response.json()) as { data: OpenRouterModel[] };
      setModels(body.data ?? []);
    };
    void loadModels();
  }, []);

  return (
    <main className="h-full overflow-y-auto p-6">
      <h1 className="mb-4 text-xl font-semibold">Global Settings</h1>
      <div className="space-y-4">
        <APIKeyInput
          value={apiKey}
          onChange={setApiKey}
          baseUrl={settings.api.baseUrl}
        />
        <ModelSelector
          models={models}
          value={settings.defaults.model}
          onChange={(value) =>
            saveSettings({
              ...settings,
              defaults: {
                ...settings.defaults,
                model: value,
              },
            })
          }
        />
        <GlobalParameters
          settings={settings}
          onChange={(next) => {
            void saveSettings(next);
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => void saveSettings(settings)}
        disabled={loading}
        className="mt-4 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save settings"}
      </button>
    </main>
  );
}
