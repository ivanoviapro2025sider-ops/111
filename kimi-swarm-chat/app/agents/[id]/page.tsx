"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { AgentForm } from "@/components/agents/AgentForm";
import { useAgentStore } from "@/stores/agentStore";

export default function AgentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { agents, loadAgents, updateAgent } = useAgentStore();

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const agent = useMemo(
    () => agents.find((item) => item.id === params.id),
    [agents, params.id],
  );

  if (!agent) {
    return (
      <main className="p-6">
        <p className="text-sm text-zinc-400">Loading agent...</p>
      </main>
    );
  }

  return (
    <main className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agent: {agent.name}</h1>
        <button
          type="button"
          onClick={() => router.push("/agents")}
          className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
        >
          Back
        </button>
      </div>
      <AgentForm
        value={agent}
        allAgents={agents}
        onSubmit={async (payload) => {
          await updateAgent(agent.id, payload);
          router.push("/agents");
        }}
      />
    </main>
  );
}
