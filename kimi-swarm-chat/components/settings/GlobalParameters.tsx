"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface GlobalParametersProps {
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function GlobalParameters({ values, onChange }: GlobalParametersProps) {
  const setField = (field: string, value: unknown) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1">
        <p className="text-xs text-zinc-300">Temperature</p>
        <Input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={String(values.temperature ?? 1)}
          onChange={(event) => setField("temperature", Number(event.target.value))}
        />
      </label>
      <label className="space-y-1">
        <p className="text-xs text-zinc-300">Top P</p>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={String(values.top_p ?? 1)}
          onChange={(event) => setField("top_p", Number(event.target.value))}
        />
      </label>
      <label className="space-y-1">
        <p className="text-xs text-zinc-300">Max tokens</p>
        <Input
          type="number"
          min={1}
          max={131072}
          value={String(values.max_tokens ?? 4096)}
          onChange={(event) => setField("max_tokens", Number(event.target.value))}
        />
      </label>
      <label className="flex items-center gap-2 rounded-md border border-zinc-800 p-2 text-xs text-zinc-300">
        <Switch
          checked={Boolean(values.debug)}
          onCheckedChange={(checked) => setField("debug", checked)}
        />
        Debug by default
      </label>
    </div>
  );
}
