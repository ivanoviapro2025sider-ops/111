"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";

export function ChatWindow({
  messages,
  streamingMessage,
}: {
  messages: ChatMessage[];
  streamingMessage?: ChatMessage | null;
}) {
  const hasMessages = useMemo(
    () => messages.length > 0 || Boolean(streamingMessage),
    [messages.length, streamingMessage],
  );

  if (!hasMessages) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 text-sm text-zinc-400">
        Начните диалог с агентом KIMI
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {streamingMessage ? <StreamingMessage message={streamingMessage} /> : null}
    </div>
  );
}
