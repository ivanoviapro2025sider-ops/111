"use client";

import type { SamplingParameters } from "@/types/agent";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export function GlobalParameters({
  value,
  onChange,
}: {
  value: SamplingParameters;
  onChange: (value: SamplingParameters) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Temperature</label>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={value.temperature}
          onChange={(e) => onChange({ ...value, temperature: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Top P</label>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={value.top_p}
          onChange={(e) => onChange({ ...value, top_p: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Max tokens</label>
        <Input
          type="number"
          value={value.max_tokens}
          onChange={(e) => onChange({ ...value, max_tokens: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Presence penalty</label>
        <Input
          type="number"
          step={0.1}
          min={-2}
          max={2}
          value={value.presence_penalty}
          onChange={(e) => onChange({ ...value, presence_penalty: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
