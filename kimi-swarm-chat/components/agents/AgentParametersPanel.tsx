"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface AgentParametersPanelProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function AgentParametersPanel({ value, onChange }: AgentParametersPanelProps) {
  const setField = (key: string, nextValue: number | string | boolean) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["temperature", 0, 2, 0.1],
          ["top_p", 0, 1, 0.05],
          ["top_k", 0, 500, 1],
          ["frequency_penalty", -2, 2, 0.1],
          ["presence_penalty", -2, 2, 0.1],
          ["repetition_penalty", 0, 2, 0.1],
          ["min_p", 0, 1, 0.05],
          ["top_a", 0, 1, 0.05],
        ].map(([field, min, max, step]) => (
          <label key={String(field)} className="space-y-1">
            <p className="text-xs text-zinc-300">{String(field)}</p>
            <input
              type="range"
              min={Number(min)}
              max={Number(max)}
              step={Number(step)}
              value={Number(value[String(field)] ?? 0)}
              onChange={(event) => setField(String(field), Number(event.target.value))}
              className="w-full"
            />
            <Input
              type="number"
              value={String(value[String(field)] ?? 0)}
              onChange={(event) => setField(String(field), Number(event.target.value))}
            />
          </label>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <p className="text-xs text-zinc-300">max_tokens</p>
          <Input
            type="number"
            min={1}
            max={131072}
            value={String(value.max_tokens ?? 4096)}
            onChange={(event) => setField("max_tokens", Number(event.target.value))}
          />
        </label>
        <label className="space-y-1">
          <p className="text-xs text-zinc-300">seed (optional)</p>
          <Input
            type="number"
            value={value.seed === null || value.seed === undefined ? "" : String(value.seed)}
            onChange={(event) =>
              setField("seed", event.target.value === "" ? null : Number(event.target.value))
            }
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <p className="text-xs text-zinc-300">response_format</p>
          <select
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
            value={String(value.response_format ?? "text")}
            onChange={(event) => setField("response_format", event.target.value)}
          >
            <option value="text">text</option>
            <option value="json_object">json_object</option>
          </select>
        </label>
        <label className="space-y-1">
          <p className="text-xs text-zinc-300">verbosity</p>
          <select
            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
            value={String(value.verbosity ?? "medium")}
            onChange={(event) => setField("verbosity", event.target.value)}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="max">max</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
          <Switch
            checked={Boolean(value.response_format === "json_object")}
            onCheckedChange={(checked) =>
              setField("response_format", checked ? "json_object" : "text")
            }
          />
          Force JSON response
        </label>
      </div>
    </div>
  );
}
