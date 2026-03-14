'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface StreamingMessageProps {
  content: string;
  isComplete: boolean;
}

export function StreamingMessage({ content, isComplete }: StreamingMessageProps) {
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {!isComplete && (
          <span
            className={cn(
              'inline-block w-2 h-4 ml-0.5 bg-foreground/70 animate-pulse'
            )}
          />
        )}
      </div>
    </div>
  );
}
