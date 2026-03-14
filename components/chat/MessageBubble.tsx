'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  showDebug?: boolean;
}

export function MessageBubble({ message, showDebug = false }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isTool && !showDebug) return null;
  if (isSystem && !showDebug) return null;

  const handoffData = isTool ? (() => {
    try { const d = JSON.parse(message.content); return d.handoff ? d : null; } catch { return null; }
  })() : null;

  if (handoffData) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <ArrowRightLeft className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">
          Handoff: <strong>{handoffData.from}</strong> → <strong>{handoffData.to}</strong>
        </span>
      </div>
    );
  }

  return (
    <div className={cn('group flex gap-3 py-4 px-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary' : 'bg-secondary'
        )}
        style={!isUser && message.agentColor ? { backgroundColor: message.agentColor } : {}}
      >
        {isUser ? <User className="h-4 w-4 text-primary-foreground" /> : <Bot className="h-4 w-4 text-primary-foreground" />}
      </div>

      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && message.agent && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: message.agentColor || undefined }}>
              {message.agent}
            </span>
            {message.metadata?.model && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {message.metadata.model.split('/').pop()}
              </Badge>
            )}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    if (isInline) {
                      return <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>{children}</code>;
                    }
                    return (
                      <div className="relative group/code">
                        <div className="flex items-center justify-between bg-muted/50 px-3 py-1 rounded-t-md border-b border-border">
                          <span className="text-xs text-muted-foreground">{match[1]}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover/code:opacity-100"
                            onClick={() => navigator.clipboard.writeText(String(children))}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <pre className="!mt-0 !rounded-t-none"><code className={className} {...props}>{children}</code></pre>
                      </div>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.attachments.map((att) => (
              <Badge key={att.id} variant="secondary" className="text-xs">
                📎 {att.name}
              </Badge>
            ))}
          </div>
        )}

        {showDebug && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-1 p-2 bg-muted/50 rounded-md text-xs font-mono">
            {message.toolCalls.map((tc) => (
              <div key={tc.id} className="mb-1">
                <span className="text-primary">tool_call:</span> {tc.function.name}({tc.function.arguments})
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
