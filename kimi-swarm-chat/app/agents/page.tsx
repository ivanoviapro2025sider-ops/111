"use client";

import { useEffect, useState } from "react";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentForm } from "@/components/agents/AgentForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Agent } from "@/types/agent";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  async function loadAgents() {
    const response = await fetch("/api/agents");
    if (!response.ok) return;
    const payload = (await response.json()) as { data: Agent[] };
    setAgents(payload.data || []);
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
        <section className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={async (id) => {
                await fetch(`/api/agents/${id}`, { method: "DELETE" });
                await loadAgents();
              }}
            />
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>+ New Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentForm
              allAgents={agents}
              onSave={async (form) => {
                await fetch("/api/agents", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(form),
                });
                await loadAgents();
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
