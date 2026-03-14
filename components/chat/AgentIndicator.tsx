'use client';

import { Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AgentIndicatorProps {
  name: string;
  color?: string;
  model?: string;
  isActive?: boolean;
}

export function AgentIndicator({ name, color, model, isActive }: AgentIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: color || '#6366f1' }}
      >
        <Bot className="h-3 w-3 text-white" />
      </div>
      <span className="text-sm font-medium" style={{ color: color || undefined }}>
        {name}
      </span>
      {model && (
        <Badge variant="outline" className="text-[10px]">
          {model.split('/').pop()}
        </Badge>
      )}
      {isActive && (
        <span className="flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      )}
    </div>
  );
}
