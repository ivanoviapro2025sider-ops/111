"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { AgentForm } from "@/components/agents/AgentForm";
import { useAgentStore } from "@/stores/agentStore";
import type { Agent } from "@/types/agent";

export default function AgentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { agents, fetchAgents, updateAgent } = useAgentStore();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const agent = useMemo(
    () => agents.find((candidate) => candidate.id === params.id),
    [agents, params.id],
  );

  if (!agent) {
    return (
      <main className="flex h-screen flex-col">
        <Header title="Agent" />
        <div className="p-4 text-sm text-zinc-500">Loading agent...</div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <Header title={`Agent: ${agent.name}`} />
      <div className="space-y-3 overflow-y-auto p-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
          ← Back to agents
        </Button>
        <AgentForm
          value={agent}
          allAgents={agents}
          loading={saving}
          onSubmit={async (payload) => {
            setSaving(true);
            await updateAgent(params.id, payload as Partial<Agent>);
            setSaving(false);
          }}
        />
      </div>
    </main>
  );
}
