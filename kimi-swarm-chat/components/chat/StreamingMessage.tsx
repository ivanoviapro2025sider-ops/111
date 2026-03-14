"use client";

import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

export function StreamingMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="space-y-1">
      <MessageBubble message={message} />
      <div className="pl-2 text-xs text-zinc-500">Streaming...</div>
    </div>
  );
}
