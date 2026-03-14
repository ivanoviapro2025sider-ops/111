"use client";

import { useMemo, useState } from "react";

interface ModelSelectorProps {
  models: Array<{
    id: string;
    name?: string;
    pricing?: { prompt?: string; completion?: string };
    context_length?: number;
  }>;
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => models.filter((model) => model.id.toLowerCase().includes(query.toLowerCase())),
    [models, query],
  );

  const activeModel = models.find((model) => model.id === value);

  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-300">Default model</label>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
        placeholder="Search models..."
      />
      <select
        className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {filtered.map((model) => (
          <option key={model.id} value={model.id}>
            {model.id}
          </option>
        ))}
      </select>

      {activeModel ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-400">
          <p>Context length: {activeModel.context_length ?? "n/a"}</p>
          <p>
            Pricing (1M): in {activeModel.pricing?.prompt ?? "n/a"} / out{" "}
            {activeModel.pricing?.completion ?? "n/a"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
