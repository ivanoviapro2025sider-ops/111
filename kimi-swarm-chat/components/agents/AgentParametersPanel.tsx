"use client";

import type { SamplingParameters } from "@/types/agent";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface AgentParametersPanelProps {
  sampling: SamplingParameters;
  onChange: (next: SamplingParameters) => void;
}

export function AgentParametersPanel({ sampling, onChange }: AgentParametersPanelProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Temperature</label>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={sampling.temperature}
          onChange={(e) => onChange({ ...sampling, temperature: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Top P</label>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={sampling.top_p}
          onChange={(e) => onChange({ ...sampling, top_p: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Max tokens</label>
        <Input
          type="number"
          min={1}
          max={131072}
          value={sampling.max_tokens}
          onChange={(e) => onChange({ ...sampling, max_tokens: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Top K</label>
        <Input
          type="number"
          min={0}
          max={500}
          value={sampling.top_k}
          onChange={(e) => onChange({ ...sampling, top_k: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
