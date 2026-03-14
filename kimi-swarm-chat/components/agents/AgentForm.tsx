"use client";

import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AgentParametersPanel } from "@/components/agents/AgentParametersPanel";
import { SwarmConfigPanel } from "@/components/agents/SwarmConfigPanel";
import { HandoffConfigurator } from "@/components/agents/HandoffConfigurator";
import { FunctionEditor } from "@/components/agents/FunctionEditor";
import {
  DEFAULT_SAMPLING,
  DEFAULT_SWARM,
  type Agent,
  type SamplingParameters,
  type SwarmParameters,
  type AgentFunction,
} from "@/types/agent";

interface AgentFormValues {
  name: string;
  description: string;
  model: string;
  instructions: string;
  isActive: boolean;
  avatar: string;
  color: string;
  sampling: SamplingParameters;
  swarm: SwarmParameters;
  functions: AgentFunction[];
}

interface AgentFormProps {
  value?: Agent;
  allAgents: Agent[];
  onSubmit: (payload: AgentFormValues) => Promise<void> | void;
  loading?: boolean;
}

const tabs = ["general", "sampling", "swarm", "functions"] as const;
type AgentFormTab = (typeof tabs)[number];

export function AgentForm({ value, allAgents, onSubmit, loading }: AgentFormProps) {
  const [tab, setTab] = useState<AgentFormTab>("general");
  const [form, setForm] = useState<AgentFormValues>({
    name: value?.name ?? "Agent A",
    description: value?.description ?? "Main triage agent",
    model: value?.model ?? "moonshotai/kimi-k2",
    instructions:
      value?.instructions ??
      "You are a helpful triage agent. Use context variables and handoff when needed.",
    isActive: value?.isActive ?? true,
    avatar: value?.avatar ?? "🤖",
    color: value?.color ?? "#6366f1",
    sampling: value?.sampling ?? DEFAULT_SAMPLING,
    swarm: value?.swarm ?? DEFAULT_SWARM,
    functions: value?.functions ?? [],
  });

  const availableModels = useMemo(
    () => [
      "moonshotai/kimi-k2",
      "moonshotai/kimi-k2-thinking",
      "openai/gpt-4.1-mini",
      "anthropic/claude-3.7-sonnet",
    ],
    [],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(form);
      }}
    >
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-md px-3 py-1 text-xs ${
              tab === item ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-300"
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">General</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Agent name"
            />
            <Input
              value={form.model}
              list="models"
              onChange={(event) => setForm({ ...form, model: event.target.value })}
              placeholder="Model id"
            />
            <datalist id="models">
              {availableModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <Input
              value={form.avatar}
              onChange={(event) => setForm({ ...form, avatar: event.target.value })}
              placeholder="Avatar / emoji"
            />
            <Input
              type="color"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
            />
          </div>
          <Textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className="min-h-16"
            placeholder="Description"
          />
          <label className="flex items-center justify-between rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
            Agent active
            <Switch
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
          </label>
          <div className="space-y-1">
            <p className="text-xs text-zinc-400">System instructions (supports {"{context_variables}"})</p>
            <Editor
              height="240px"
              defaultLanguage="markdown"
              theme="vs-dark"
              value={form.instructions}
              onChange={(valueText) =>
                setForm({ ...form, instructions: valueText ?? "" })
              }
            />
          </div>
        </section>
      )}

      {tab === "sampling" && (
        <AgentParametersPanel
          value={form.sampling}
          onChange={(sampling) => setForm({ ...form, sampling })}
        />
      )}

      {tab === "swarm" && (
        <div className="space-y-4">
          <SwarmConfigPanel
            value={form.swarm}
            onChange={(swarm) => setForm({ ...form, swarm })}
          />
          <HandoffConfigurator
            currentAgentId={value?.id}
            selected={form.swarm.handoff_targets}
            agents={allAgents}
            onChange={(targets) =>
              setForm({
                ...form,
                swarm: {
                  ...form.swarm,
                  handoff_targets: targets,
                },
              })
            }
          />
          <Textarea
            value={JSON.stringify(form.swarm.context_variables, null, 2)}
            onChange={(event) => {
              try {
                const parsed = JSON.parse(event.target.value);
                setForm({
                  ...form,
                  swarm: { ...form.swarm, context_variables: parsed },
                });
              } catch {
                // Ignore invalid JSON while user types.
              }
            }}
            className="min-h-24 font-mono text-xs"
          />
        </div>
      )}

      {tab === "functions" && (
        <FunctionEditor
          functions={form.functions}
          onChange={(functions) => setForm({ ...form, functions })}
        />
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save agent"}
      </Button>
    </form>
  );
}
