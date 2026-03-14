'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Edit, Trash2, ArrowRight } from 'lucide-react';
import type { Agent } from '@/types/agent';

interface AgentCardProps {
  agent: Agent;
  allAgents: Agent[];
  onDelete: (id: string) => void;
}

export default function AgentCard({ agent, allAgents, onDelete }: AgentCardProps) {
  const handoffTargets = (agent.handoffTargets || [])
    .map((t) => allAgents.find((a) => a.id === t || a.name === t)?.name)
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: agent.color }}
          >
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.model}</p>
          </div>
        </div>
        <Badge variant={agent.isActive ? 'default' : 'secondary'}>
          {agent.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {agent.description || 'No description'}
      </p>

      <div className="flex flex-wrap gap-1 mb-4">
        <Badge variant="outline" className="text-xs">
          temp: {agent.temperature}
        </Badge>
        <Badge variant="outline" className="text-xs">
          max: {agent.maxTokens}
        </Badge>
        {agent.stream && (
          <Badge variant="outline" className="text-xs">
            streaming
          </Badge>
        )}
      </div>

      {handoffTargets.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <ArrowRight className="h-3 w-3" />
          <span>Handoffs to: {handoffTargets.join(', ')}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Link href={`/agents/${agent.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(agent.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
