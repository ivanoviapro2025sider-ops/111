import Link from "next/link";
import type { Agent } from "@/types/agent";

interface AgentCardProps {
  agent: Agent;
  onDelete: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{agent.avatar || "🤖"}</span>
        <div>
          <h3 className="font-semibold text-zinc-100">{agent.name}</h3>
          <p className="text-xs text-zinc-400">{agent.description}</p>
        </div>
      </div>
      <p className="mb-3 text-xs text-zinc-400">Model: {agent.model}</p>
      <p className="mb-4 text-xs text-zinc-500">
        Handoffs: {agent.swarm?.handoff_targets?.join(", ") || "none"}
      </p>
      <div className="flex gap-2">
        <Link
          href={`/agents/${agent.id}`}
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-200"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => onDelete(agent.id)}
          className="rounded-md border border-red-500/50 px-3 py-1 text-xs text-red-300"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
