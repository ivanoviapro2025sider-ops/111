"use client";

import { Input } from "@/components/ui/input";
import type { SamplingParameters } from "@/types/agent";

interface AgentParametersPanelProps {
  value: SamplingParameters;
  onChange: (value: SamplingParameters) => void;
}

const rows: Array<{
  key: keyof SamplingParameters;
  label: string;
  min: number;
  max: number;
  step?: number;
}> = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.1 },
  { key: "top_p", label: "Top P", min: 0, max: 1, step: 0.01 },
  { key: "top_k", label: "Top K", min: 0, max: 500, step: 1 },
  { key: "frequency_penalty", label: "Frequency Penalty", min: -2, max: 2, step: 0.1 },
  { key: "presence_penalty", label: "Presence Penalty", min: -2, max: 2, step: 0.1 },
  { key: "repetition_penalty", label: "Repetition Penalty", min: 0, max: 2, step: 0.1 },
  { key: "min_p", label: "Min P", min: 0, max: 1, step: 0.01 },
  { key: "top_a", label: "Top A", min: 0, max: 1, step: 0.01 },
];

export function AgentParametersPanel({ value, onChange }: AgentParametersPanelProps) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Sampling</h3>
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[150px_1fr_100px] items-center gap-3">
          <label className="text-xs text-zinc-400">{row.label}</label>
          <input
            type="range"
            min={row.min}
            max={row.max}
            step={row.step}
            value={Number(value[row.key] ?? 0)}
            onChange={(event) =>
              onChange({
                ...value,
                [row.key]:
                  row.step === 1
                    ? Number.parseInt(event.target.value, 10)
                    : Number.parseFloat(event.target.value),
              })
            }
          />
          <Input
            value={String(value[row.key])}
            onChange={(event) =>
              onChange({
                ...value,
                [row.key]:
                  row.step === 1
                    ? Number.parseInt(event.target.value || "0", 10)
                    : Number.parseFloat(event.target.value || "0"),
              })
            }
          />
        </div>
      ))}
      <div className="grid grid-cols-[150px_1fr] items-center gap-3">
        <label className="text-xs text-zinc-400">Max tokens</label>
        <Input
          type="number"
          min={1}
          max={131072}
          value={value.max_tokens}
          onChange={(event) =>
            onChange({
              ...value,
              max_tokens: Number.parseInt(event.target.value || "1", 10),
            })
          }
        />
      </div>
    </section>
  );
}
