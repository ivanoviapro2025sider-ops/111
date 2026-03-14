"use client";

import type { OpenRouterModel } from "@/types/openrouter";
import { Select } from "@/components/ui/select";

export function ModelSelector({
  models,
  value,
  onChange,
}: {
  models: OpenRouterModel[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-400">Default model</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.id}
          </option>
        ))}
      </Select>
    </div>
  );
}
