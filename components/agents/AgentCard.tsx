'use client';

import { Agent } from '@/types/agent';
import { Bot, Edit, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';

interface AgentCardProps {
  agent: Agent;
  allAgents: Agent[];
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

export function AgentCard({ agent, allAgents, onDelete, onToggle }: AgentCardProps) {
  const handoffTargets = (agent.handoffTargets || [])
    .map((id) => allAgents.find((a) => a.id === id))
    .filter(Boolean);

  return (
    <div className="group relative rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/30">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: agent.color || '#6366f1' }}
          >
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.model.split('/').pop()}</p>
          </div>
        </div>
        <Switch
          checked={agent.isActive}
          onCheckedChange={(checked) => onToggle(agent.id, checked)}
        />
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {agent.description || 'No description'}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Badge variant="secondary" className="text-xs">
          Temp: {agent.temperature}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          Max: {agent.maxTokens}
        </Badge>
        {agent.stream && (
          <Badge variant="outline" className="text-xs">
            Stream
          </Badge>
        )}
      </div>

      {handoffTargets.length > 0 && (
        <div className="flex items-center gap-1 mb-4">
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Handoffs:</span>
          {handoffTargets.map((target) => (
            <Badge key={target!.id} variant="outline" className="text-xs">
              <div className="h-2 w-2 rounded-full mr-1" style={{ backgroundColor: target!.color }} />
              {target!.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Link href={`/agents/${agent.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1">
            <Edit className="h-3 w-3" />
            Edit
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(agent.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
