'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot } from 'lucide-react';

interface StreamingMessageProps {
  content: string;
  agentName?: string;
  agentColor?: string;
}

export function StreamingMessage({ content, agentName, agentColor }: StreamingMessageProps) {
  if (!content) return null;

  return (
    <div className="flex gap-3 py-4 px-4">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: agentColor || '#6366f1' }}
      >
        <Bot className="h-4 w-4 text-primary-foreground" />
      </div>

      <div className="flex flex-col gap-1 max-w-[80%]">
        {agentName && (
          <span className="text-xs font-medium" style={{ color: agentColor || undefined }}>
            {agentName}
          </span>
        )}
        <div className="rounded-2xl bg-secondary px-4 py-2.5 text-sm">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
        </div>
      </div>
    </div>
  );
}
