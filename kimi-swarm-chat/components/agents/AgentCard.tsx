import Link from "next/link";
import type { Agent } from "@/types/agent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AgentCard({ agent, onDelete }: { agent: Agent; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{agent.avatar}</span>
          <span>{agent.name}</span>
        </CardTitle>
        <CardDescription>{agent.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between text-xs text-zinc-400">
          <Badge>{agent.model}</Badge>
          <span>Handoffs: {agent.swarm.handoff_targets.length}</span>
        </div>
        <div className="flex gap-2">
          <Link href={`/agents/${agent.id}`}>
            <Button variant="secondary" size="sm">
              Edit
            </Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={() => onDelete(agent.id)}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
