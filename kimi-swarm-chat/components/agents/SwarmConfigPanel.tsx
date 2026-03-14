"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface SwarmConfigPanelProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function SwarmConfigPanel({ value, onChange }: SwarmConfigPanelProps) {
  const setField = (field: string, fieldValue: unknown) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <p className="text-xs text-zinc-300">max_turns</p>
          <Input
            type="number"
            value={value.max_turns === null ? "" : String(value.max_turns ?? "")}
            onChange={(event) =>
              setField("max_turns", event.target.value ? Number(event.target.value) : null)
            }
          />
        </label>
        <label className="space-y-1">
          <p className="text-xs text-zinc-300">tool_choice</p>
          <select
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
            value={String(value.tool_choice ?? "auto")}
            onChange={(event) => setField("tool_choice", event.target.value)}
          >
            <option value="none">none</option>
            <option value="auto">auto</option>
            <option value="required">required</option>
          </select>
        </label>
      </div>

      <Textarea
        rows={6}
        placeholder='{"project":"kimi"}'
        value={JSON.stringify(value.context_variables ?? {}, null, 2)}
        onChange={(event) => {
          try {
            setField("context_variables", JSON.parse(event.target.value));
          } catch {
            // Keep raw invalid JSON hidden; ignore parse failures while user types.
          }
        }}
      />
      <Textarea
        rows={3}
        placeholder="handoff conditions..."
        value={String(value.handoff_conditions ?? "")}
        onChange={(event) => setField("handoff_conditions", event.target.value)}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["execute_tools", "Execute tools automatically"],
          ["stream", "Stream responses"],
          ["debug", "Debug mode"],
          ["parallel_tool_calls", "Parallel tool calls"],
        ].map(([field, label]) => (
          <label
            key={field}
            className="flex items-center gap-2 rounded-md border border-zinc-800 p-2 text-xs text-zinc-300"
          >
            <Switch
              checked={Boolean(value[field])}
              onCheckedChange={(checked) => setField(field, checked)}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
