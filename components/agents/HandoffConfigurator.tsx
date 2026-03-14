import type { AgentConfig } from '@/types/agent';

export function HandoffConfigurator({ agent, allAgents, onChange }: { agent: AgentConfig; allAgents: AgentConfig[]; onChange: (handoffTargetIds: string[]) => void; }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-white/70">Handoff targets</div>
      <div className="grid gap-2 md:grid-cols-2">
        {allAgents.filter((candidate) => candidate.id !== agent.id).map((candidate) => {
          const checked = agent.handoffTargetIds.includes(candidate.id);
          return <label key={candidate.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75"><input type="checkbox" checked={checked} onChange={(event) => { if (event.target.checked) onChange([...agent.handoffTargetIds, candidate.id]); else onChange(agent.handoffTargetIds.filter((item) => item !== candidate.id)); }} />{candidate.name}</label>;
        })}
      </div>
    </div>
  );
}
