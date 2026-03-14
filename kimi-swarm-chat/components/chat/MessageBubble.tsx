"use client";

import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { ChatMessage } from "@/types/chat";
import { AgentIndicator } from "@/components/chat/AgentIndicator";
import { StreamingMessage } from "@/components/chat/StreamingMessage";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`group mb-4 ${isUser ? "text-right" : "text-left"}`}>
      {!isUser && (
        <AgentIndicator
          name={message.agent}
          color={message.agentColor}
          avatar={message.role === "assistant" ? "🤖" : "🛠️"}
        />
      )}
      <div
        className={`inline-block max-w-[90%] rounded-xl px-4 py-3 text-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "border border-zinc-800 bg-zinc-900 text-zinc-100"
        }`}
      >
        {message.isStreaming ? (
          <StreamingMessage content={message.content} />
        ) : (
          <ReactMarkdown
            className="prose prose-invert max-w-none text-sm"
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(message.content)}
        className="ml-2 hidden rounded-md border border-zinc-700 p-1 text-zinc-400 transition hover:text-white group-hover:inline-flex"
        title="Copy message"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
