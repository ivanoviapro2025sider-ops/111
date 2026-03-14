"use client";

import type { Agent } from "@/types/agent";

interface HandoffConfiguratorProps {
  currentId?: string;
  allAgents: Agent[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function HandoffConfigurator({
  currentId,
  allAgents,
  selectedIds,
  onChange,
}: HandoffConfiguratorProps) {
  const available = allAgents.filter((agent) => agent.id !== currentId);

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-400">Handoff targets</p>
      <div className="grid gap-2 md:grid-cols-2">
        {available.map((agent) => {
          const selected = selectedIds.includes(agent.id);
          return (
            <label
              key={agent.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selectedIds, agent.id]);
                  } else {
                    onChange(selectedIds.filter((id) => id !== agent.id));
                  }
                }}
              />
              <span>{agent.avatar}</span>
              <span>{agent.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
