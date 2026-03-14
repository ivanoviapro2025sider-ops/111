'use client';

import { Copy, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileAttachment } from '@/components/chat/FileAttachment';
import { StreamingMessage } from '@/components/chat/StreamingMessage';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl rounded-3xl border px-5 py-4 ${isUser ? 'border-indigo-500/30 bg-indigo-500/15' : 'border-white/10 bg-white/5'}`}>
        <div className="mb-3 flex items-center gap-2 text-xs text-white/45">
          <span className="font-medium text-white/75">{isUser ? 'You' : message.agent ?? 'Assistant'}</span>
          <span>{new Date(message.timestamp).toLocaleString()}</span>
          {message.metadata?.handoffFrom && message.metadata?.handoffTo ? <Badge>{`${message.metadata.handoffFrom} -> ${message.metadata.handoffTo}`}</Badge> : null}
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-white/50" onClick={() => navigator.clipboard.writeText(message.content)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        {message.attachments?.length ? <div className="mb-3 grid gap-2">{message.attachments.map((attachment) => <FileAttachment key={attachment.id} attachment={attachment} />)}</div> : null}
        {message.isStreaming ? (
          <StreamingMessage content={message.content} />
        ) : (
          <div className="prose prose-invert prose-pre:rounded-2xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/30 prose-code:text-indigo-200 max-w-none text-sm prose-p:text-white/85">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.toolCalls?.length ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/35">
              <Wrench className="h-3.5 w-3.5" /> Tool Calls
            </div>
            <pre className="whitespace-pre-wrap text-xs text-white/65">{JSON.stringify(message.toolCalls, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
