'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { Copy, Check, Bot, User } from 'lucide-react';
import { ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MessageBubbleProps {
  message: ChatMessage;
  showDebug?: boolean;
}

export default function MessageBubble({ message, showDebug }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isHandoff = message.metadata?.handoffTo;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white',
          isUser ? 'bg-blue-600' : 'bg-primary'
        )}
        style={message.agentColor && !isUser ? { backgroundColor: message.agentColor } : undefined}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && message.agentName && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: message.agentColor || '#6366f1' }}>
              {message.agentName}
            </span>
            {isHandoff && (
              <Badge variant="secondary" className="text-[10px] py-0">
                handoff to {message.metadata?.handoffTo}
              </Badge>
            )}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-md'
              : 'bg-card border rounded-tl-md'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-headings:my-2">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    if (isInline) {
                      return (
                        <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <div className="relative group">
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              navigator.clipboard.writeText(String(children));
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className={cn('block text-xs font-mono', className)} {...props}>
                          {children}
                        </code>
                      </div>
                    );
                  },
                  pre({ children }) {
                    return <pre className="bg-muted rounded-lg overflow-x-auto">{children}</pre>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>

        {showDebug && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-1 p-2 bg-muted rounded-lg text-xs font-mono max-w-full overflow-x-auto">
            <div className="text-muted-foreground mb-1">Tool Calls:</div>
            {message.toolCalls.map((tc) => (
              <div key={tc.id} className="ml-2">
                <span className="text-primary">{tc.function.name}</span>
                <span className="text-muted-foreground">({tc.function.arguments})</span>
              </div>
            ))}
          </div>
        )}

        {showDebug && message.metadata?.model && (
          <div className="text-[10px] text-muted-foreground">
            Model: {message.metadata.model}
            {message.metadata.tokensUsed && ` | Tokens: ${message.metadata.tokensUsed}`}
          </div>
        )}
      </div>
    </motion.div>
  );
}
