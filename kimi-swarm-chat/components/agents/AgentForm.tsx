"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@/types/agent";
import { defaultSampling, defaultSwarm } from "@/types/agent";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AgentParametersPanel } from "./AgentParametersPanel";
import { SwarmConfigPanel } from "./SwarmConfigPanel";
import { HandoffConfigurator } from "./HandoffConfigurator";
import { FunctionEditor } from "./FunctionEditor";

interface AgentFormProps {
  initial?: Agent;
  allAgents: Agent[];
  onSave: (payload: Omit<Agent, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>;
}

const defaultModels = [
  "moonshotai/kimi-k2",
  "moonshotai/kimi-k2-thinking",
  "openai/gpt-4o-mini",
];

export function AgentForm({ initial, allAgents, onSave }: AgentFormProps) {
  const [form, setForm] = useState<
    Omit<Agent, "createdAt" | "updatedAt"> & { id?: string }
  >({
    id: initial?.id,
    name: initial?.name || "",
    description: initial?.description || "",
    model: initial?.model || "moonshotai/kimi-k2",
    instructions:
      initial?.instructions ||
      "You are a helpful KIMI swarm agent. Use context variables when available.",
    isActive: initial?.isActive ?? true,
    avatar: initial?.avatar || "🤖",
    color: initial?.color || "#6366f1",
    sampling: initial?.sampling || defaultSampling,
    swarm: initial?.swarm || defaultSwarm,
    functions: initial?.functions || [],
  });

  useEffect(() => {
    if (!initial) return;
    setForm({ ...initial });
  }, [initial]);

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="sampling">Sampling</TabsTrigger>
        <TabsTrigger value="swarm">Swarm</TabsTrigger>
        <TabsTrigger value="functions">Functions</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <div className="grid gap-3">
          <Input
            placeholder="Agent name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
            {defaultModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Avatar"
              value={form.avatar}
              onChange={(e) => setForm({ ...form, avatar: e.target.value })}
            />
            <Input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <Switch
            checked={form.isActive}
            label="Active"
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <Textarea
            className="min-h-[220px] font-mono text-xs"
            placeholder="System instructions"
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </div>
      </TabsContent>

      <TabsContent value="sampling">
        <AgentParametersPanel
          sampling={form.sampling}
          onChange={(sampling) => setForm({ ...form, sampling })}
        />
      </TabsContent>

      <TabsContent value="swarm">
        <SwarmConfigPanel
          swarm={form.swarm}
          onChange={(swarm) => setForm({ ...form, swarm })}
        />
        <HandoffConfigurator
          currentId={form.id}
          allAgents={allAgents}
          selectedIds={form.swarm.handoff_targets}
          onChange={(handoff_targets) =>
            setForm({ ...form, swarm: { ...form.swarm, handoff_targets } })
          }
        />
        <Textarea
          value={form.swarm.handoff_conditions}
          onChange={(e) =>
            setForm({
              ...form,
              swarm: { ...form.swarm, handoff_conditions: e.target.value },
            })
          }
          placeholder="Handoff conditions"
        />
      </TabsContent>

      <TabsContent value="functions">
        <FunctionEditor
          functions={form.functions}
          onChange={(functions) => setForm({ ...form, functions })}
        />
      </TabsContent>

      <Button
        onClick={() => onSave(form)}
        disabled={!form.name.trim() || !form.instructions.trim()}
      >
        Save Agent
      </Button>
    </Tabs>
  );
}
