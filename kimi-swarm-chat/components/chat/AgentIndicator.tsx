"use client";

import { Bot } from "lucide-react";

interface AgentIndicatorProps {
  name?: string;
  color?: string;
  model?: string;
}

export function AgentIndicator({ name, color, model }: AgentIndicatorProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: color || "#6366f1" }}>
        <Bot className="h-3.5 w-3.5 text-white" />
      </span>
      <span>{name || "No Agent Selected"}</span>
      {model ? <span className="text-zinc-500">({model})</span> : null}
    </div>
  );
}
