"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { APIKeyInput } from "@/components/settings/APIKeyInput";
import { ModelSelector } from "@/components/settings/ModelSelector";
import { GlobalParameters } from "@/components/settings/GlobalParameters";
import { useSettingsStore } from "@/stores/settingsStore";
import type { OpenRouterModel } from "@/types/openrouter";

export default function SettingsPage() {
  const { settings, fetchSettings, saveSettings, loading } = useSettingsStore();
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [testStatus, setTestStatus] = useState<string>();

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setForm(settings as Record<string, any>);
  }, [settings]);

  const defaults = useMemo(() => form.defaults ?? {}, [form]);
  const sampling = defaults.sampling ?? {};

  const fetchModels = async () => {
    const response = await fetch("/api/openrouter/models");
    const data = await response.json();
    setModels(data.data ?? []);
  };

  return (
    <main className="flex h-screen flex-col">
      <Header title="Settings" />
      <div className="space-y-4 overflow-y-auto p-4">
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">API Configuration</h3>
          <APIKeyInput
            value={form.api?.apiKey ?? ""}
            onChange={(value) => setForm({ ...form, api: { ...form.api, apiKey: value } })}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={form.api?.baseUrl ?? "https://openrouter.ai/api/v1"}
              onChange={(event) =>
                setForm({ ...form, api: { ...form.api, baseUrl: event.target.value } })
              }
              placeholder="Base URL"
            />
            <Input
              value={form.api?.httpReferer ?? "http://localhost:3000"}
              onChange={(event) =>
                setForm({ ...form, api: { ...form.api, httpReferer: event.target.value } })
              }
              placeholder="HTTP-Referer"
            />
            <Input
              value={form.api?.xTitle ?? "KIMI Swarm Chat Service"}
              onChange={(event) =>
                setForm({ ...form, api: { ...form.api, xTitle: event.target.value } })
              }
              placeholder="X-Title"
            />
            <Input
              type="number"
              value={form.api?.timeout ?? 60000}
              onChange={(event) =>
                setForm({
                  ...form,
                  api: { ...form.api, timeout: Number(event.target.value) },
                })
              }
              placeholder="Timeout"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                setTestStatus("Testing...");
                try {
                  await fetchModels();
                  setTestStatus("Connection successful");
                } catch (error) {
                  setTestStatus(
                    error instanceof Error ? `Connection failed: ${error.message}` : "Failed",
                  );
                }
              }}
            >
              Test Connection
            </Button>
            {testStatus && <span className="text-xs text-zinc-400">{testStatus}</span>}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Default Model Settings</h3>
          <ModelSelector
            models={models}
            value={defaults.model ?? "moonshotai/kimi-k2"}
            onChange={(value) =>
              setForm({ ...form, defaults: { ...defaults, model: value } })
            }
          />
          <GlobalParameters
            temperature={sampling.temperature ?? 1}
            topP={sampling.top_p ?? 1}
            maxTokens={sampling.max_tokens ?? 4096}
            onChange={({ temperature, topP, maxTokens }) =>
              setForm({
                ...form,
                defaults: {
                  ...defaults,
                  sampling: {
                    ...sampling,
                    temperature,
                    top_p: topP,
                    max_tokens: maxTokens,
                  },
                },
              })
            }
          />
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Swarm Defaults</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Initial agent id"
              value={form.defaults?.swarm?.initialAgentId ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  defaults: {
                    ...defaults,
                    swarm: { ...(form.defaults?.swarm ?? {}), initialAgentId: event.target.value },
                  },
                })
              }
            />
            <Input
              type="number"
              placeholder="Max turns"
              value={form.defaults?.swarm?.maxTurns ?? 6}
              onChange={(event) =>
                setForm({
                  ...form,
                  defaults: {
                    ...defaults,
                    swarm: {
                      ...(form.defaults?.swarm ?? {}),
                      maxTurns: Number(event.target.value),
                    },
                  },
                })
              }
            />
          </div>
          <Textarea
            className="min-h-24 font-mono text-xs"
            value={JSON.stringify(form.defaults?.swarm?.contextVariables ?? {}, null, 2)}
            onChange={(event) => {
              try {
                const parsed = JSON.parse(event.target.value);
                setForm({
                  ...form,
                  defaults: {
                    ...defaults,
                    swarm: {
                      ...(form.defaults?.swarm ?? {}),
                      contextVariables: parsed,
                    },
                  },
                });
              } catch {
                // Ignore invalid JSON while typing.
              }
            }}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">File Processing</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              value={form.files?.maxFileSize ?? 10 * 1024 * 1024 * 1024}
              onChange={(event) =>
                setForm({
                  ...form,
                  files: { ...form.files, maxFileSize: Number(event.target.value) },
                })
              }
              placeholder="Max file size"
            />
            <Input
              value={form.files?.uploadDir ?? "./uploads"}
              onChange={(event) =>
                setForm({
                  ...form,
                  files: { ...form.files, uploadDir: event.target.value },
                })
              }
              placeholder="Upload dir"
            />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Interface</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={form.interface?.theme ?? "dark"}
              onChange={(event) =>
                setForm({
                  ...form,
                  interface: { ...form.interface, theme: event.target.value },
                })
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <select
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={form.interface?.language ?? "ru"}
              onChange={(event) =>
                setForm({
                  ...form,
                  interface: { ...form.interface, language: event.target.value },
                })
              }
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </div>
        </section>

        <div className="sticky bottom-0 flex gap-2 border-t border-zinc-800 bg-[#0a0a0a]/90 py-3 backdrop-blur">
          <Button
            onClick={async () => {
              await saveSettings(form);
              setTestStatus("Settings saved.");
            }}
            disabled={loading}
          >
            Save settings
          </Button>
          <Button variant="ghost" onClick={() => setForm(settings as Record<string, unknown>)}>
            Reset
          </Button>
        </div>
      </div>
    </main>
  );
}
