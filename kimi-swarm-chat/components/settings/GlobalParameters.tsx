"use client";

import { Input } from "@/components/ui/input";

interface GlobalParametersProps {
  temperature: number;
  topP: number;
  maxTokens: number;
  onChange: (value: { temperature: number; topP: number; maxTokens: number }) => void;
}

export function GlobalParameters({
  temperature,
  topP,
  maxTokens,
  onChange,
}: GlobalParametersProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 md:grid-cols-3">
      <label className="space-y-1 text-xs text-zinc-400">
        Temperature
        <Input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={(event) =>
            onChange({
              temperature: Number(event.target.value),
              topP,
              maxTokens,
            })
          }
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        Top P
        <Input
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={topP}
          onChange={(event) =>
            onChange({
              temperature,
              topP: Number(event.target.value),
              maxTokens,
            })
          }
        />
      </label>
      <label className="space-y-1 text-xs text-zinc-400">
        Max tokens
        <Input
          type="number"
          min={1}
          max={131072}
          value={maxTokens}
          onChange={(event) =>
            onChange({
              temperature,
              topP,
              maxTokens: Number(event.target.value),
            })
          }
        />
      </label>
    </div>
  );
}
