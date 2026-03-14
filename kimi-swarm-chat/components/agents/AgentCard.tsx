"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  model: string;
  color: string;
  handoffs: string[];
  onDelete: (id: string) => Promise<void>;
}

export function AgentCard({
  id,
  name,
  description,
  model,
  color,
  handoffs,
  onDelete,
}: AgentCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <CardTitle>{name}</CardTitle>
        </div>
      </div>
      <CardDescription>{description || "No description"}</CardDescription>
      <div className="space-y-1 text-xs text-zinc-400">
        <p>Model: {model}</p>
        <p>Handoffs: {handoffs.length ? handoffs.join(", ") : "—"}</p>
      </div>
      <div className="flex gap-2">
        <Link href={`/agents/${id}`}>
          <Button size="sm" variant="outline">
            Edit
          </Button>
        </Link>
        <Button size="sm" variant="destructive" onClick={() => void onDelete(id)}>
          <Trash2 className="mr-1 h-4 w-4" />
          Delete
        </Button>
      </div>
    </Card>
  );
}
