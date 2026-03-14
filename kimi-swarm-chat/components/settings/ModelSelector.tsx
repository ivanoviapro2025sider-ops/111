import type { OpenRouterModel } from "@/types/openrouter";

interface ModelSelectorProps {
  models: OpenRouterModel[];
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  return (
    <section className="space-y-2 rounded-xl border border-zinc-800 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Default model</h2>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.id}
          </option>
        ))}
      </select>
      {models.find((model) => model.id === value) && (
        <div className="rounded-md bg-zinc-950 p-2 text-xs text-zinc-400">
          <p>Context: {models.find((model) => model.id === value)?.context_length ?? "n/a"}</p>
          <p>
            Price: in {models.find((model) => model.id === value)?.pricing.prompt ?? "n/a"} / out{" "}
            {models.find((model) => model.id === value)?.pricing.completion ?? "n/a"}
          </p>
        </div>
      )}
    </section>
  );
}
