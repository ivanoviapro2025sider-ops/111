'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Loader2 } from 'lucide-react';

interface StreamingMessageProps {
  content: string;
  agentName?: string | null;
  agentColor?: string | null;
}

export default function StreamingMessage({ content, agentName, agentColor }: StreamingMessageProps) {
  return (
    <div className="flex gap-3 mb-6">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
        style={{ backgroundColor: agentColor || '#6366f1' }}
      >
        <Bot className="h-4 w-4 text-white" />
      </div>

      <div className="max-w-[75%]">
        {agentName && (
          <div className="text-xs text-muted-foreground mb-1 font-medium">{agentName}</div>
        )}

        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-card border border-border">
          {content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
          <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-0.5" />
        </div>
      </div>
    </div>
  );
}
