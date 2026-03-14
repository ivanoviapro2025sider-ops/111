"use client";

import type { OpenRouterModel } from "@/types/openrouter";

interface ModelSelectorProps {
  models: OpenRouterModel[];
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-400">Default model</label>
      <select
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="moonshotai/kimi-k2">moonshotai/kimi-k2</option>
        <option value="moonshotai/kimi-k2-thinking">moonshotai/kimi-k2-thinking</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.id}
          </option>
        ))}
      </select>
      {models.find((model) => model.id === value)?.pricing && (
        <p className="text-xs text-zinc-500">
          Pricing (per 1M): in {models.find((model) => model.id === value)?.pricing?.prompt}
          {" / "}out {models.find((model) => model.id === value)?.pricing?.completion}
        </p>
      )}
    </div>
  );
}
