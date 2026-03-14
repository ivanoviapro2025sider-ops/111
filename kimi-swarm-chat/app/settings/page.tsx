"use client";

import { useEffect, useState } from "react";
import { APIKeyInput } from "@/components/settings/APIKeyInput";
import { GlobalParameters } from "@/components/settings/GlobalParameters";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { OpenRouterModel } from "@/types/openrouter";
import { initialSettings, useSettingsStore } from "@/stores/settingsStore";

export default function SettingsPage() {
  const { settings, setSettings } = useSettingsStore();
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/settings")
        .then((r) => r.json())
        .then((payload: { data: typeof initialSettings }) => {
          setSettings({ ...initialSettings, ...payload.data });
        }),
      fetch("/api/openrouter/models")
        .then((r) => r.json())
        .then((payload: { data: OpenRouterModel[] }) => {
          setModels(payload.data || []);
        }),
    ]);
  }, [setSettings]);

  async function saveSettings() {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaveStatus(response.ok ? "Saved" : "Save failed");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <APIKeyInput
            value={apiKeyInput}
            onChange={setApiKeyInput}
            onTest={async () => {
              await fetch("/api/openrouter/models");
            }}
          />
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Base URL</label>
            <Input
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Timeout (ms)</label>
              <Input
                type="number"
                value={settings.timeoutMs}
                onChange={(e) =>
                  setSettings({ ...settings, timeoutMs: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Retry count</label>
              <Input
                type="number"
                value={settings.retryCount}
                onChange={(e) =>
                  setSettings({ ...settings, retryCount: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Model Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ModelSelector
            models={models}
            value={settings.defaultModel}
            onChange={(defaultModel) => setSettings({ ...settings, defaultModel })}
          />
          <GlobalParameters
            value={settings.defaultSampling}
            onChange={(defaultSampling) => setSettings({ ...settings, defaultSampling })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Swarm defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="number"
            value={settings.defaultMaxTurns}
            onChange={(e) =>
              setSettings({ ...settings, defaultMaxTurns: Number(e.target.value) })
            }
          />
          <Switch
            checked={settings.debugDefault}
            label="Enable debug mode"
            onChange={(e) =>
              setSettings({ ...settings, debugDefault: e.target.checked })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File Processing + Interface</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Upload dir</label>
            <Input
              value={settings.uploadDir}
              onChange={(e) => setSettings({ ...settings, uploadDir: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Language</label>
            <Select
              value={settings.language}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  language: e.target.value as "ru" | "en",
                })
              }
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Theme</label>
            <Select
              value={settings.theme}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  theme: e.target.value as "dark" | "light" | "system",
                })
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </Select>
          </div>
          <Button onClick={() => void saveSettings()}>Save settings</Button>
          {saveStatus ? <p className="text-xs text-zinc-400">{saveStatus}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
