import { Bot, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { Agent } from "@/types/agent";

interface AgentCardProps {
  agent: Agent;
  onDelete?: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm"
            style={{ backgroundColor: agent.color }}
          >
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <CardTitle>{agent.name}</CardTitle>
            <CardDescription>{agent.description}</CardDescription>
          </div>
        </div>
        <Badge>{agent.isActive ? "Active" : "Disabled"}</Badge>
      </div>
      <p className="text-xs text-zinc-400">Model: {agent.model}</p>
      <div className="flex gap-2">
        <Link
          href={`/agents/${agent.id}`}
          className="inline-flex h-8 items-center rounded-md bg-zinc-800 px-3 text-xs text-zinc-100 hover:bg-zinc-700"
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Link>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete?.(agent.id)}
          disabled={!onDelete}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </Card>
  );
}
