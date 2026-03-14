'use client';

import { Agent } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Bot } from 'lucide-react';

interface HandoffConfiguratorProps {
  agent: Partial<Agent>;
  allAgents: Agent[];
  onChange: (handoffTargets: string[], handoffConditions: string) => void;
}

export function HandoffConfigurator({ agent, allAgents, onChange }: HandoffConfiguratorProps) {
  const otherAgents = allAgents.filter((a) => a.id !== (agent as Agent).id);
  const targets = (agent.handoffTargets || []) as string[];
  const conditions = agent.handoffConditions || '';

  const toggleTarget = (agentId: string) => {
    const newTargets = targets.includes(agentId)
      ? targets.filter((id) => id !== agentId)
      : [...targets, agentId];
    onChange(newTargets, conditions);
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Handoff Configuration</Label>

      <div className="grid gap-3 md:grid-cols-2">
        {otherAgents.map((a) => {
          const selected = targets.includes(a.id);
          return (
            <div
              key={a.id}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                selected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
              }`}
              onClick={() => toggleTarget(a.id)}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: a.color }}
              >
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground truncate">{a.description || a.model}</p>
              </div>
              {selected && <ArrowRight className="h-4 w-4 text-primary shrink-0" />}
            </div>
          );
        })}
      </div>

      {targets.length > 0 && (
        <div className="space-y-2">
          <Label>When to hand off (conditions)</Label>
          <Textarea
            value={conditions}
            onChange={(e) => onChange(targets, e.target.value)}
            placeholder="e.g., Hand off to Analyst when user asks for data analysis..."
            rows={3}
          />
        </div>
      )}
    </div>
  );
}
