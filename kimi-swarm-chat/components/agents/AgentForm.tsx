"use client";

import { useEffect, useState } from "react";
import {
  defaultSamplingParameters,
  defaultSwarmParameters,
  type Agent,
  type AgentFunction,
  type SamplingParameters,
  type SwarmParameters,
} from "@/types/agent";
import { AgentParametersPanel } from "@/components/agents/AgentParametersPanel";
import { SwarmConfigPanel } from "@/components/agents/SwarmConfigPanel";
import { FunctionEditor } from "@/components/agents/FunctionEditor";
import type { OpenRouterModel } from "@/types/openrouter";

interface AgentFormProps {
  value?: Partial<Agent>;
  allAgents: Agent[];
  onSubmit: (payload: Partial<Agent>) => Promise<void>;
}

export function AgentForm({ value, allAgents, onSubmit }: AgentFormProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [name, setName] = useState(value?.name ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  const [model, setModel] = useState(value?.model ?? "moonshotai/kimi-k2");
  const [instructions, setInstructions] = useState(value?.instructions ?? "");
  const [isActive, setIsActive] = useState(value?.isActive ?? true);
  const [avatar, setAvatar] = useState(value?.avatar ?? "🤖");
  const [color, setColor] = useState(value?.color ?? "#6366f1");
  const [sampling, setSampling] = useState<SamplingParameters>(
    value?.sampling ?? defaultSamplingParameters,
  );
  const [swarm, setSwarm] = useState<SwarmParameters>(
    value?.swarm ?? defaultSwarmParameters,
  );
  const [functions, setFunctions] = useState<AgentFunction[]>(value?.functions ?? []);

  useEffect(() => {
    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const response = await fetch("/api/openrouter/models");
        if (!response.ok) return;
        const body = (await response.json()) as { data: OpenRouterModel[] };
        setModels(body.data ?? []);
      } finally {
        setLoadingModels(false);
      }
    };

    void loadModels();
  }, []);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({
          name,
          description,
          model,
          instructions,
          isActive,
          avatar,
          color,
          sampling,
          swarm,
          functions,
        });
      }}
    >
      <section className="grid gap-3 rounded-lg border border-zinc-800 p-4 md:grid-cols-2">
        <label className="text-sm text-zinc-300">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            required
          />
        </label>
        <label className="text-sm text-zinc-300">
          Model
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          >
            {!models.length && <option value={model}>{model}</option>}
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))}
          </select>
          {loadingModels && <span className="text-xs text-zinc-500">Loading models...</span>}
        </label>
        <label className="text-sm text-zinc-300 md:col-span-2">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 min-h-16 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-zinc-300 md:col-span-2">
          System instructions
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            className="mt-1 min-h-40 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
            placeholder="You are a helpful agent..."
            required
          />
        </label>
        <label className="text-sm text-zinc-300">
          Avatar
          <input
            value={avatar}
            onChange={(event) => setAvatar(event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-zinc-300">
          Color
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="mt-1 block h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Agent is active
        </label>
      </section>

      <AgentParametersPanel value={sampling} onChange={setSampling} />
      <SwarmConfigPanel
        value={swarm}
        onChange={setSwarm}
        agents={allAgents}
        currentAgentId={value?.id}
      />
      <FunctionEditor value={functions} onChange={setFunctions} />

      <button
        type="submit"
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Save agent
      </button>
    </form>
  );
}
