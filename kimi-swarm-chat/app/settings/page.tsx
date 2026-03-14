"use client";

import { useEffect, useMemo, useState } from "react";
import { APIKeyInput } from "@/components/settings/APIKeyInput";
import { GlobalParameters } from "@/components/settings/GlobalParameters";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ModelItem {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [settingsRes, modelsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/openrouter/models"),
      ]);
      const settingsPayload = (await settingsRes.json()) as Record<string, unknown>;
      const modelsPayload = (await modelsRes.json()) as { data?: ModelItem[] };
      setSettings(settingsPayload);
      setModels(modelsPayload.data || []);
    })();
  }, []);

  const defaultSampling = useMemo(
    () => (settings?.defaultSamplingConfig as Record<string, unknown>) || {},
    [settings],
  );

  const testConnection = async () => {
    const response = await fetch("/api/openrouter/models");
    return response.ok;
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      setSettings((await response.json()) as Record<string, unknown>);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <p className="text-sm text-zinc-400">Loading settings...</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">Global Settings</h2>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100">API Configuration</h3>
        <APIKeyInput
          value={String(settings.openRouterApiKey || "")}
          onChange={(value) => setSettings({ ...settings, openRouterApiKey: value })}
          onTestConnection={testConnection}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <p className="text-xs text-zinc-300">Base URL</p>
            <Input
              value={String(settings.openRouterBaseUrl || "")}
              onChange={(event) =>
                setSettings({ ...settings, openRouterBaseUrl: event.target.value })
              }
            />
          </label>
          <label className="space-y-1">
            <p className="text-xs text-zinc-300">HTTP-Referer</p>
            <Input
              value={String(settings.httpReferer || "")}
              onChange={(event) => setSettings({ ...settings, httpReferer: event.target.value })}
            />
          </label>
          <label className="space-y-1">
            <p className="text-xs text-zinc-300">X-Title</p>
            <Input
              value={String(settings.xTitle || "")}
              onChange={(event) => setSettings({ ...settings, xTitle: event.target.value })}
            />
          </label>
          <label className="space-y-1">
            <p className="text-xs text-zinc-300">Timeout (ms)</p>
            <Input
              type="number"
              value={String(settings.timeoutMs || 60000)}
              onChange={(event) => setSettings({ ...settings, timeoutMs: Number(event.target.value) })}
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100">Default Model Settings</h3>
        <ModelSelector
          models={models}
          value={String(settings.defaultModel || "moonshotai/kimi-k2")}
          onChange={(value) => setSettings({ ...settings, defaultModel: value })}
        />
        <GlobalParameters
          values={defaultSampling}
          onChange={(value) => setSettings({ ...settings, defaultSamplingConfig: value })}
        />
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100">Swarm Defaults</h3>
        <Textarea
          rows={5}
          value={JSON.stringify(settings.defaultSwarmConfig || {}, null, 2)}
          onChange={(event) => {
            try {
              setSettings({
                ...settings,
                defaultSwarmConfig: JSON.parse(event.target.value),
              });
            } catch {
              // Ignore invalid JSON while typing.
            }
          }}
        />
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100">File Processing</h3>
        <Textarea
          rows={6}
          value={JSON.stringify(settings.fileProcessingConfig || {}, null, 2)}
          onChange={(event) => {
            try {
              setSettings({
                ...settings,
                fileProcessingConfig: JSON.parse(event.target.value),
              });
            } catch {
              // Ignore invalid JSON while typing.
            }
          }}
        />
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100">Interface</h3>
        <Textarea
          rows={4}
          value={JSON.stringify(settings.interfaceConfig || {}, null, 2)}
          onChange={(event) => {
            try {
              setSettings({
                ...settings,
                interfaceConfig: JSON.parse(event.target.value),
              });
            } catch {
              // Ignore invalid JSON while typing.
            }
          }}
        />
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
