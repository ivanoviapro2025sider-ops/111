import type { Agent, SwarmParameters } from "@/types/agent";

interface HandoffConfiguratorProps {
  swarm: SwarmParameters;
  agents: Agent[];
  currentAgentId?: string;
  onChange: (next: SwarmParameters) => void;
}

export function HandoffConfigurator({
  swarm,
  agents,
  currentAgentId,
  onChange,
}: HandoffConfiguratorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-zinc-300">
        Handoff targets
        <select
          multiple
          value={swarm.handoff_targets}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map(
              (option) => option.value,
            );
            onChange({ ...swarm, handoff_targets: selected });
          }}
          className="mt-1 min-h-28 w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm"
        >
          {agents
            .filter((agent) => agent.id !== currentAgentId)
            .map((agent) => (
              <option key={agent.id} value={agent.name}>
                {agent.name}
              </option>
            ))}
        </select>
      </label>
      <label className="block text-sm text-zinc-300">
        Handoff conditions
        <textarea
          value={swarm.handoff_conditions}
          onChange={(event) =>
            onChange({ ...swarm, handoff_conditions: event.target.value })
          }
          className="mt-1 min-h-20 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          placeholder="When should this agent transfer control?"
        />
      </label>
    </div>
  );
}
