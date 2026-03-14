"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/agents/AgentCard";
import { useAgentStore } from "@/stores/agentStore";

export default function AgentsPage() {
  const router = useRouter();
  const { agents, fetchAgents, createAgent, deleteAgent, loading, error } = useAgentStore();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  return (
    <main className="flex h-screen flex-col">
      <Header title="Agents" />
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Manage your swarm agents and handoffs.</p>
          <Button
            onClick={async () => {
              setCreating(true);
              const created = await createAgent({
                name: `Agent ${agents.length + 1}`,
              });
              setCreating(false);
              if (created) router.push(`/agents/${created.id}`);
            }}
            disabled={creating}
          >
            + New Agent
          </Button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onDelete={deleteAgent} />
          ))}
        </div>
        {!loading && agents.length === 0 && (
          <p className="text-sm text-zinc-500">No agents yet. Create the first one.</p>
        )}
      </div>
    </main>
  );
}
