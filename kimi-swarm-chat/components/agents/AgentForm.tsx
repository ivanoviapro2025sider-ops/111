"use client";

import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { AgentParametersPanel } from "@/components/agents/AgentParametersPanel";
import { FunctionEditor, type FunctionDraft } from "@/components/agents/FunctionEditor";
import { HandoffConfigurator } from "@/components/agents/HandoffConfigurator";
import { SwarmConfigPanel } from "@/components/agents/SwarmConfigPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TabsList } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SAMPLING_CONFIG, DEFAULT_SWARM_CONFIG } from "@/lib/utils";

interface AgentPayload {
  id?: string;
  name: string;
  description: string;
  model: string;
  instructions: string;
  isActive: boolean;
  avatar: string;
  color: string;
  samplingConfig: Record<string, unknown>;
  swarmConfig: Record<string, unknown>;
  functions: FunctionDraft[];
}

interface AgentFormProps {
  agent?: Partial<AgentPayload>;
  agents: Array<{ id: string; name: string }>;
  onSaved?: (agent: Record<string, unknown>) => void;
}

const tabs = ["General", "Sampling", "Swarm", "Functions", "Files"];

const emptyAgent: AgentPayload = {
  name: "Agent A",
  description: "Main triage agent",
  model: "moonshotai/kimi-k2",
  instructions: "You are a helpful KIMI assistant.",
  isActive: true,
  avatar: "Bot",
  color: "#6366f1",
  samplingConfig: DEFAULT_SAMPLING_CONFIG,
  swarmConfig: DEFAULT_SWARM_CONFIG,
  functions: [],
};

export function AgentForm({ agent, agents, onSaved }: AgentFormProps) {
  const [currentTab, setCurrentTab] = useState(tabs[0]);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name?: string }>>([]);
  const [state, setState] = useState<AgentPayload>(() => ({
    ...emptyAgent,
    ...agent,
    samplingConfig: { ...DEFAULT_SAMPLING_CONFIG, ...(agent?.samplingConfig || {}) },
    swarmConfig: { ...DEFAULT_SWARM_CONFIG, ...(agent?.swarmConfig || {}) },
    functions: (agent?.functions || []) as FunctionDraft[],
  }));

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/openrouter/models");
      const payload = (await response.json()) as { data?: Array<{ id: string; name?: string }> };
      setModels(payload.data || []);
    })();
  }, []);

  const handoffOptions = useMemo(
    () => agents.filter((item) => item.id !== state.id),
    [agents, state.id],
  );

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...state,
        functions: state.functions.map((fn) => ({
          ...fn,
          parameters: (() => {
            try {
              return JSON.parse(fn.parameters);
            } catch {
              return { type: "object", properties: {} };
            }
          })(),
        })),
      };

      const response = await fetch(state.id ? `/api/agents/${state.id}` : "/api/agents", {
        method: state.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to save agent");
      const saved = await response.json();
      onSaved?.(saved as Record<string, unknown>);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <TabsList tabs={tabs} value={currentTab} onValueChange={setCurrentTab} />

      {currentTab === "General" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <p className="text-xs text-zinc-300">Name</p>
              <Input
                value={state.name}
                onChange={(event) => setState({ ...state, name: event.target.value })}
              />
            </label>
            <label className="space-y-1">
              <p className="text-xs text-zinc-300">Model</p>
              <select
                className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                value={state.model}
                onChange={(event) => setState({ ...state, model: event.target.value })}
              >
                {[{ id: "moonshotai/kimi-k2", name: "Kimi K2" }, ...models]
                  .filter((model, index, self) => self.findIndex((m) => m.id === model.id) === index)
                  .map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <p className="text-xs text-zinc-300">Description</p>
            <Textarea
              rows={3}
              value={state.description}
              onChange={(event) => setState({ ...state, description: event.target.value })}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <p className="text-xs text-zinc-300">Avatar</p>
              <Input
                value={state.avatar}
                onChange={(event) => setState({ ...state, avatar: event.target.value })}
              />
            </label>
            <label className="space-y-1">
              <p className="text-xs text-zinc-300">Color</p>
              <Input
                type="color"
                value={state.color}
                onChange={(event) => setState({ ...state, color: event.target.value })}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
            <Switch
              checked={state.isActive}
              onCheckedChange={(checked) => setState({ ...state, isActive: checked })}
            />
            Active
          </label>

          <div className="space-y-2">
            <p className="text-xs text-zinc-300">System Instructions (Monaco)</p>
            <Editor
              height="280px"
              defaultLanguage="markdown"
              theme="vs-dark"
              value={state.instructions}
              onChange={(code) => setState({ ...state, instructions: code || "" })}
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>
        </div>
      )}

      {currentTab === "Sampling" && (
        <AgentParametersPanel
          value={state.samplingConfig}
          onChange={(samplingConfig) => setState({ ...state, samplingConfig })}
        />
      )}

      {currentTab === "Swarm" && (
        <div className="space-y-4">
          <SwarmConfigPanel
            value={state.swarmConfig}
            onChange={(swarmConfig) => setState({ ...state, swarmConfig })}
          />
          <HandoffConfigurator
            options={handoffOptions}
            selected={(state.swarmConfig.handoff_targets as string[] | undefined) || []}
            onChange={(next) =>
              setState({
                ...state,
                swarmConfig: { ...state.swarmConfig, handoff_targets: next },
              })
            }
          />
        </div>
      )}

      {currentTab === "Functions" && (
        <FunctionEditor
          value={state.functions}
          handoffTargets={handoffOptions}
          onChange={(functions) => setState({ ...state, functions })}
        />
      )}

      {currentTab === "Files" && (
        <div className="rounded-md border border-zinc-800 p-3 text-sm text-zinc-400">
          Здесь можно добавить policy обработки файлов на уровне агента (включая OCR, map-reduce,
          max context tokens и preprocessor стратегию). Базовая реализация доступна через
          <code className="mx-1 rounded bg-zinc-900 px-1">/api/files/process</code>.
        </div>
      )}

      <Button onClick={submit} disabled={saving}>
        {saving ? "Saving..." : "Save Agent"}
      </Button>
    </div>
  );
}
