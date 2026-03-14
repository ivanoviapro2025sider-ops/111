"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AgentForm } from "@/components/agents/AgentForm";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/agent";

export default function AgentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    async function load() {
      const [allRes, oneRes] = await Promise.all([
        fetch("/api/agents"),
        fetch(`/api/agents/${params.id}`),
      ]);
      if (allRes.ok) {
        const all = (await allRes.json()) as { data: Agent[] };
        setAgents(all.data || []);
      }
      if (oneRes.ok) {
        const one = (await oneRes.json()) as { data: Agent };
        setAgent(one.data);
      }
    }
    void load();
  }, [params.id]);

  if (!agent) {
    return <p className="text-sm text-zinc-500">Loading agent...</p>;
  }

  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={() => router.push("/agents")}>
        ← Back to agents
      </Button>
      <AgentForm
        initial={agent}
        allAgents={agents}
        onSave={async (payload) => {
          await fetch(`/api/agents/${params.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          router.push("/agents");
        }}
      />
    </div>
  );
}
