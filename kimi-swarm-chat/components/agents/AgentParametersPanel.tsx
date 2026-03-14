import type { SamplingParameters } from "@/types/agent";

interface AgentParametersPanelProps {
  value: SamplingParameters;
  onChange: (next: SamplingParameters) => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
      />
    </label>
  );
}

export function AgentParametersPanel({ value, onChange }: AgentParametersPanelProps) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 p-3">
      <h3 className="text-sm font-semibold text-zinc-100">Sampling</h3>
      <div className="grid gap-2 md:grid-cols-2">
        <NumberField
          label="Temperature"
          value={value.temperature}
          min={0}
          max={2}
          onChange={(next) => onChange({ ...value, temperature: next })}
        />
        <NumberField
          label="Top P"
          value={value.top_p}
          min={0}
          max={1}
          onChange={(next) => onChange({ ...value, top_p: next })}
        />
        <NumberField
          label="Top K"
          value={value.top_k}
          min={0}
          max={500}
          step={1}
          onChange={(next) => onChange({ ...value, top_k: next })}
        />
        <NumberField
          label="Max Tokens"
          value={value.max_tokens}
          min={1}
          max={131072}
          step={1}
          onChange={(next) => onChange({ ...value, max_tokens: next })}
        />
      </div>
    </section>
  );
}
