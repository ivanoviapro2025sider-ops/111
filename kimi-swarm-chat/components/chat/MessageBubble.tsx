"use client";

import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl border px-4 py-3 ${
          isUser
            ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-50"
            : "border-zinc-700 bg-zinc-900 text-zinc-100"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-400">
          <span>
            {message.agent ? `${message.agent} • ` : ""}
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(message.content)}
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-800"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        </div>
        <article className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
