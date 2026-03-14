"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SwarmParameters } from "@/types/agent";

interface SwarmConfigPanelProps {
  value: SwarmParameters;
  onChange: (value: SwarmParameters) => void;
}

export function SwarmConfigPanel({ value, onChange }: SwarmConfigPanelProps) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Swarm orchestration</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
          Execute tools
          <Switch
            checked={value.execute_tools}
            onChange={(event) =>
              onChange({ ...value, execute_tools: event.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
          Stream responses
          <Switch
            checked={value.stream}
            onChange={(event) => onChange({ ...value, stream: event.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
          Debug
          <Switch
            checked={value.debug}
            onChange={(event) => onChange({ ...value, debug: event.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
          Parallel tool calls
          <Switch
            checked={value.parallel_tool_calls}
            onChange={(event) =>
              onChange({ ...value, parallel_tool_calls: event.target.checked })
            }
          />
        </label>
      </div>

      <div className="grid grid-cols-[150px_1fr] items-center gap-3">
        <label className="text-xs text-zinc-400">Max turns</label>
        <Input
          type="number"
          placeholder="Infinity"
          value={value.max_turns ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              max_turns: event.target.value ? Number.parseInt(event.target.value, 10) : null,
            })
          }
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Handoff conditions</label>
        <Textarea
          value={value.handoff_conditions}
          onChange={(event) =>
            onChange({ ...value, handoff_conditions: event.target.value })
          }
          placeholder="Describe when this agent should handoff..."
          className="min-h-16"
        />
      </div>
    </section>
  );
}
