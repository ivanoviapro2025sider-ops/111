'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Edit, Trash2, ArrowRight } from 'lucide-react';
import { Agent } from '@/types/agent';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface AgentCardProps {
  agent: Agent;
  allAgents: Agent[];
  onDelete: (id: string) => void;
}

export default function AgentCard({ agent, allAgents, onDelete }: AgentCardProps) {
  const handoffTargets = (agent.handoffTargets || [])
    .map(id => allAgents.find(a => a.id === id))
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="group hover:border-primary/30 transition-colors">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: agent.color }}
              >
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{agent.name}</h3>
                <p className="text-xs text-muted-foreground">{agent.description || 'No description'}</p>
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-mono">
                {agent.model}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
              <span>T:{agent.temperature}</span>
              <span>P:{agent.topP}</span>
              <span>Max:{agent.maxTokens}</span>
            </div>

            {handoffTargets.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Handoffs:</span>
                {handoffTargets.map((target) => (
                  <span
                    key={target!.id}
                    className="flex items-center gap-0.5"
                  >
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span style={{ color: target!.color }}>{target!.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link href={`/agents/${agent.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1">
                <Edit className="w-3 h-3" /> Edit
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(agent.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
