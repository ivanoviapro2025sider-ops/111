"use client";

import type { Agent } from "@/types/agent";

interface HandoffConfiguratorProps {
  currentAgentId?: string;
  selected: string[];
  agents: Agent[];
  onChange: (value: string[]) => void;
}

export function HandoffConfigurator({
  currentAgentId,
  selected,
  agents,
  onChange,
}: HandoffConfiguratorProps) {
  return (
    <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">Handoff targets</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {agents
          .filter((agent) => agent.id !== currentAgentId)
          .map((agent) => {
            const checked = selected.includes(agent.id);
            return (
              <label
                key={agent.id}
                className="flex items-center gap-2 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-200"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...selected, agent.id]);
                    } else {
                      onChange(selected.filter((id) => id !== agent.id));
                    }
                  }}
                />
                {agent.name}
              </label>
            );
          })}
      </div>
    </section>
  );
}
