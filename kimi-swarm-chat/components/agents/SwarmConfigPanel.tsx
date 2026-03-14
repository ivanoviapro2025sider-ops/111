"use client";

import type { SwarmParameters } from "@/types/agent";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";

export function SwarmConfigPanel({
  swarm,
  onChange,
}: {
  swarm: SwarmParameters;
  onChange: (swarm: SwarmParameters) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">max_turns</label>
        <Input
          type="number"
          min={1}
          value={swarm.max_turns}
          onChange={(e) => onChange({ ...swarm, max_turns: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">tool_choice</label>
        <Select
          value={swarm.tool_choice}
          onChange={(e) =>
            onChange({
              ...swarm,
              tool_choice: e.target.value as SwarmParameters["tool_choice"],
            })
          }
        >
          <option value="none">none</option>
          <option value="auto">auto</option>
          <option value="required">required</option>
        </Select>
      </div>
      <Switch
        checked={swarm.execute_tools}
        label="execute_tools"
        onChange={(e) => onChange({ ...swarm, execute_tools: e.target.checked })}
      />
      <Switch
        checked={swarm.parallel_tool_calls}
        label="parallel_tool_calls"
        onChange={(e) => onChange({ ...swarm, parallel_tool_calls: e.target.checked })}
      />
      <Switch
        checked={swarm.stream}
        label="stream"
        onChange={(e) => onChange({ ...swarm, stream: e.target.checked })}
      />
      <Switch
        checked={swarm.debug}
        label="debug"
        onChange={(e) => onChange({ ...swarm, debug: e.target.checked })}
      />
    </div>
  );
}
