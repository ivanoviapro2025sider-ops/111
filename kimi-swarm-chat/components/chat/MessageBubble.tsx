"use client";

import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { ChatMessage } from "@/types/chat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-3xl rounded-xl border px-4 py-3 text-sm ${
          isUser
            ? "border-indigo-400/30 bg-indigo-500/20 text-zinc-50"
            : "border-zinc-800 bg-zinc-900 text-zinc-200"
        }`}
      >
        {!isUser && message.agent && (
          <p className="mb-1 text-xs text-zinc-400">
            {message.agent} · {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        )}
        <div className="prose prose-invert max-w-none prose-pre:bg-zinc-950 prose-code:text-zinc-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content}
          </ReactMarkdown>
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-200 group-hover:opacity-100"
            onClick={async () => navigator.clipboard.writeText(message.content)}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}
