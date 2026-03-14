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
  const [form, setForm] = useState<Record<string, unknown>>(
    settings as Record<string, unknown>,
  );
  const [testStatus, setTestStatus] = useState<string>();

  useEffect(() => {
    let active = true;
    const run = async () => {
      await fetchSettings();
      if (!active) return;
      setForm(useSettingsStore.getState().settings as Record<string, unknown>);
    };
    void run();
    return () => {
      active = false;
    };
  }, [fetchSettings]);

  const defaults = useMemo(
    () => (form.defaults as Record<string, unknown> | undefined) ?? {},
    [form],
  );
  const sampling = (defaults.sampling as Record<string, unknown> | undefined) ?? {};

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
            value={String((form.api as Record<string, unknown> | undefined)?.apiKey ?? "")}
            onChange={(value) =>
              setForm({
                ...form,
                api: {
                  ...((form.api as Record<string, unknown> | undefined) ?? {}),
                  apiKey: value,
                },
              })
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={String(
                (form.api as Record<string, unknown> | undefined)?.baseUrl ??
                  "https://openrouter.ai/api/v1",
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  api: {
                    ...((form.api as Record<string, unknown> | undefined) ?? {}),
                    baseUrl: event.target.value,
                  },
                })
              }
              placeholder="Base URL"
            />
            <Input
              value={String(
                (form.api as Record<string, unknown> | undefined)?.httpReferer ??
                  "http://localhost:3000",
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  api: {
                    ...((form.api as Record<string, unknown> | undefined) ?? {}),
                    httpReferer: event.target.value,
                  },
                })
              }
              placeholder="HTTP-Referer"
            />
            <Input
              value={String(
                (form.api as Record<string, unknown> | undefined)?.xTitle ??
                  "KIMI Swarm Chat Service",
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  api: {
                    ...((form.api as Record<string, unknown> | undefined) ?? {}),
                    xTitle: event.target.value,
                  },
                })
              }
              placeholder="X-Title"
            />
            <Input
              type="number"
              value={Number(
                (form.api as Record<string, unknown> | undefined)?.timeout ?? 60000,
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  api: {
                    ...((form.api as Record<string, unknown> | undefined) ?? {}),
                    timeout: Number(event.target.value),
                  },
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
            value={String(defaults.model ?? "moonshotai/kimi-k2")}
            onChange={(value) =>
              setForm({ ...form, defaults: { ...defaults, model: value } })
            }
          />
          <GlobalParameters
            temperature={Number(sampling.temperature ?? 1)}
            topP={Number(sampling.top_p ?? 1)}
            maxTokens={Number(sampling.max_tokens ?? 4096)}
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
              value={String(
                (
                  ((form.defaults as Record<string, unknown> | undefined)?.swarm ??
                    {}) as Record<string, unknown>
                ).initialAgentId ?? "",
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  defaults: {
                    ...defaults,
                    swarm: {
                      ...(((form.defaults as Record<string, unknown> | undefined)?.swarm ??
                        {}) as Record<string, unknown>),
                      initialAgentId: event.target.value,
                    },
                  },
                })
              }
            />
            <Input
              type="number"
              placeholder="Max turns"
              value={Number(
                (
                  ((form.defaults as Record<string, unknown> | undefined)?.swarm ??
                    {}) as Record<string, unknown>
                ).maxTurns ?? 6,
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  defaults: {
                    ...defaults,
                    swarm: {
                      ...(((form.defaults as Record<string, unknown> | undefined)?.swarm ??
                        {}) as Record<string, unknown>),
                      maxTurns: Number(event.target.value),
                    },
                  },
                })
              }
            />
          </div>
          <Textarea
            className="min-h-24 font-mono text-xs"
            value={JSON.stringify(
              (
                ((form.defaults as Record<string, unknown> | undefined)?.swarm ??
                  {}) as Record<string, unknown>
              ).contextVariables ?? {},
              null,
              2,
            )}
            onChange={(event) => {
              try {
                const parsed = JSON.parse(event.target.value);
                setForm({
                  ...form,
                  defaults: {
                    ...defaults,
                    swarm: {
                      ...(((form.defaults as Record<string, unknown> | undefined)?.swarm ??
                        {}) as Record<string, unknown>),
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
              value={Number(
                (form.files as Record<string, unknown> | undefined)?.maxFileSize ??
                  10 * 1024 * 1024 * 1024,
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  files: {
                    ...((form.files as Record<string, unknown> | undefined) ?? {}),
                    maxFileSize: Number(event.target.value),
                  },
                })
              }
              placeholder="Max file size"
            />
            <Input
              value={String(
                (form.files as Record<string, unknown> | undefined)?.uploadDir ??
                  "./uploads",
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  files: {
                    ...((form.files as Record<string, unknown> | undefined) ?? {}),
                    uploadDir: event.target.value,
                  },
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
              value={String(
                (form.interface as Record<string, unknown> | undefined)?.theme ?? "dark",
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  interface: {
                    ...((form.interface as Record<string, unknown> | undefined) ?? {}),
                    theme: event.target.value,
                  },
                })
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <select
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(
                (form.interface as Record<string, unknown> | undefined)?.language ?? "ru",
              )}
              onChange={(event) =>
                setForm({
                  ...form,
                  interface: {
                    ...((form.interface as Record<string, unknown> | undefined) ?? {}),
                    language: event.target.value,
                  },
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
          <Button
            variant="ghost"
            onClick={() => setForm(settings as Record<string, unknown>)}
          >
            Reset
          </Button>
        </div>
      </div>
    </main>
  );
}
