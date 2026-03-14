"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AgentForm } from "@/components/agents/AgentForm";
import { Button } from "@/components/ui/button";

interface AgentData {
  id: string;
  name: string;
  description: string;
  model: string;
  instructions: string;
  isActive: boolean;
  avatar: string;
  color: string;
  samplingConfig: Record<string, unknown>;
  swarmConfig: Record<string, unknown>;
  functions: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    implementation: string;
    isHandoff: boolean;
    handoffTarget?: string | null;
  }>;
}

export default function AgentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Partial<AgentData> | undefined>(undefined);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void (async () => {
      const listRes = await fetch("/api/agents");
      const listPayload = (await listRes.json()) as AgentData[];
      setAgents(listPayload.map((item) => ({ id: item.id, name: item.name })));

      if (params.id !== "new") {
        const response = await fetch(`/api/agents/${params.id}`);
        if (response.ok) {
          const payload = (await response.json()) as AgentData;
          setAgent({
            ...payload,
            functions: payload.functions.map((fn) => ({
              ...fn,
              parameters: JSON.stringify(fn.parameters || {}, null, 2),
              handoffTarget: fn.handoffTarget || undefined,
            })),
          } as never);
        }
      }
    })();
  }, [params.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">
          {params.id === "new" ? "Create Agent" : "Edit Agent"}
        </h2>
        <Link href="/agents">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <AgentForm
        agent={agent}
        agents={agents}
        onSaved={(saved) => {
          const savedId = String(saved.id ?? params.id);
          router.push(`/agents/${savedId}`);
        }}
      />
    </div>
  );
}
