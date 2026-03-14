'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { Bot, Loader2 } from 'lucide-react';

interface StreamingMessageProps {
  content: string;
  agentName?: string | null;
  agentColor?: string | null;
}

export default function StreamingMessage({ content, agentName, agentColor }: StreamingMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 px-4 py-3"
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white"
        style={{ backgroundColor: agentColor || '#6366f1' }}
      >
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex flex-col gap-1">
        {agentName && (
          <span className="text-xs font-medium" style={{ color: agentColor || '#6366f1' }}>
            {agentName}
          </span>
        )}

        <div className="rounded-2xl rounded-tl-md px-4 py-2.5 bg-card border text-sm">
          {content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}
        </div>

        {content && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
            />
            <span className="text-[10px]">Streaming...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
