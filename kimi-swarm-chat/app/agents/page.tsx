"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AgentCard } from "@/components/agents/AgentCard";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/stores/agentStore";

interface AgentItem {
  id: string;
  name: string;
  description: string;
  model: string;
  color: string;
  swarmConfig: { handoff_targets?: string[] };
}

export default function AgentsPage() {
  const { agents, setAgents, removeAgent } = useAgentStore();

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/agents");
      const payload = (await response.json()) as AgentItem[];
      setAgents(payload as never);
    })();
  }, [setAgents]);

  const deleteAgent = async (id: string) => {
    const response = await fetch(`/api/agents/${id}`, { method: "DELETE" });
    if (response.ok) removeAgent(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Agents</h2>
        <Link href="/agents/new">
          <Button>+ New Agent</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            id={agent.id}
            name={agent.name}
            description={agent.description}
            model={agent.model}
            color={agent.color}
            handoffs={(agent.swarmConfig?.handoff_targets || []) as string[]}
            onDelete={deleteAgent}
          />
        ))}
      </div>
    </div>
  );
}
