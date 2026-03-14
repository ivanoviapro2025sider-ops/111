'use client';

import React from 'react';
import { Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AgentIndicatorProps {
  name: string;
  color?: string;
  model?: string;
  isActive?: boolean;
}

export default function AgentIndicator({ name, color = '#6366f1', model, isActive }: AgentIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border text-xs">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <Bot className="h-3 w-3 text-white" />
      </div>
      <span className="font-medium">{name}</span>
      {model && <span className="text-muted-foreground">({model})</span>}
      {isActive && (
        <Badge variant="default" className="h-4 text-[10px] px-1.5">
          Active
        </Badge>
      )}
    </div>
  );
}
