import type { Agent, SwarmParameters } from "@/types/agent";
import { HandoffConfigurator } from "@/components/agents/HandoffConfigurator";

interface SwarmConfigPanelProps {
  value: SwarmParameters;
  agents: Agent[];
  currentAgentId?: string;
  onChange: (next: SwarmParameters) => void;
}

export function SwarmConfigPanel({
  value,
  agents,
  currentAgentId,
  onChange,
}: SwarmConfigPanelProps) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 p-3">
      <h3 className="text-sm font-semibold text-zinc-100">Swarm Orchestration</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-zinc-300">
          Max turns
          <input
            type="number"
            value={value.max_turns ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                max_turns: event.target.value ? Number(event.target.value) : null,
              })
            }
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-zinc-300">
          Tool choice
          <select
            value={value.tool_choice}
            onChange={(event) =>
              onChange({
                ...value,
                tool_choice: event.target.value as SwarmParameters["tool_choice"],
              })
            }
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="none">none</option>
            <option value="auto">auto</option>
            <option value="required">required</option>
          </select>
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {[
          ["execute_tools", "Execute tools"],
          ["stream", "Stream response"],
          ["debug", "Debug mode"],
          ["parallel_tool_calls", "Parallel tools"],
        ].map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(value[key as keyof SwarmParameters])}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.checked } as SwarmParameters)
              }
            />
            {label}
          </label>
        ))}
      </div>

      <label className="block text-sm text-zinc-300">
        Context variables (JSON)
        <textarea
          value={JSON.stringify(value.context_variables, null, 2)}
          onChange={(event) => {
            try {
              onChange({
                ...value,
                context_variables: JSON.parse(event.target.value) as Record<string, unknown>,
              });
            } catch {
              // Skip invalid JSON while typing.
            }
          }}
          className="mt-1 min-h-28 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
        />
      </label>

      <HandoffConfigurator
        swarm={value}
        agents={agents}
        currentAgentId={currentAgentId}
        onChange={onChange}
      />
    </section>
  );
}
