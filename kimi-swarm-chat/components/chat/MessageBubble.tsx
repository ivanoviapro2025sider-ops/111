"use client";

import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";
import { FileAttachment } from "@/components/chat/FileAttachment";
import { StreamingMessage } from "@/components/chat/StreamingMessage";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <article
      className={cn(
        "rounded-xl border p-3 text-sm",
        isUser
          ? "ml-auto max-w-[80%] border-indigo-500/40 bg-indigo-500/10"
          : "mr-auto max-w-[90%] border-zinc-800 bg-zinc-950",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-400">
          {isUser ? "You" : message.agent || "Assistant"} ·{" "}
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigator.clipboard.writeText(message.content)}
          aria-label="Copy message"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="prose prose-invert max-w-none prose-pre:bg-zinc-900 prose-code:text-zinc-200">
        {message.isStreaming ? (
          <StreamingMessage content={message.content} />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>

      {!!message.attachments?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.attachments.map((attachment) => (
            <FileAttachment key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}

      {message.metadata?.handoffFrom && message.metadata?.handoffTo && (
        <p className="mt-2 text-xs text-amber-400">
          Handoff: {message.metadata.handoffFrom} → {message.metadata.handoffTo}
        </p>
      )}
    </article>
  );
}
